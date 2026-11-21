import { existsSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Media rules for Personal projects. Clips (MP4/WebM) live in the static
 * public folder under the project's slug; images sit next to the MDX so Astro
 * optimizes them. The build fails on a missing file or one over its size cap.
 *
 * PUBLIC_DIR lets the build tests point the build at a fixture's public folder.
 */
export const publicDir = process.env.PUBLIC_DIR ?? "./public";

/** Per-kind size caps (decimal megabytes, as Finder shows them) and error copy. */
const MEDIA_RULES = {
  clip: {
    maxBytes: 4_000_000,
    plural: "clips",
    where: "Clips live in the public folder under the project's slug.",
  },
  image: {
    maxBytes: 1_000_000,
    plural: "source images",
    where: "Images sit next to the project's MDX file.",
  },
} as const;

type MediaKind = keyof typeof MEDIA_RULES;

const CLIP_FORMATS = ["webm", "mp4"] as const;
const CLIP_EXTENSION = new RegExp(`\\.(${CLIP_FORMATS.join("|")})$`, "i");

/** True for a clip file name (`hero.mp4`, `results-demo.webm`). */
export function isClipName(name: string): boolean {
  return CLIP_EXTENSION.test(name);
}

export interface ClipSource {
  url: string;
  type: `video/${(typeof CLIP_FORMATS)[number]}`;
}

/**
 * A clip's sources, WebM first: the named file plus its sibling in the other
 * format when one exists (`hero.mp4` also finds `hero.webm`). Fails the build
 * if the named file is missing or any source is over the clip cap.
 */
export function clipSources(project: string, name: string): ClipSource[] {
  const base = name.replace(CLIP_EXTENSION, "");
  const namedFormat = name.slice(base.length + 1).toLowerCase();
  const sources: ClipSource[] = [];
  for (const format of CLIP_FORMATS) {
    const isNamed = format === namedFormat;
    const file = isNamed ? name : `${base}.${format}`;
    const path = join(publicDir, project, file);
    if (isNamed) checkFile(project, name, path, "clip");
    else if (existsSync(path)) checkFile(project, file, path, "clip");
    else continue;
    sources.push({ url: `/${project}/${file}`, type: `video/${format}` });
  }
  return sources;
}

/** A project's frontmatter `media` file names, as the content store holds them. */
export interface StoredMedia {
  src: string;
  poster?: string;
}

/**
 * Checks every media file a project names outside its `<Media>` clips (which
 * the component checks as it renders): the frontmatter `media`, as the content
 * store holds it, and each image the MDX body imports from next to itself.
 */
export function checkProjectMedia(
  project: string,
  entryFile: string,
  media: StoredMedia,
  body: string,
): void {
  const nextToMdx = (name: string) => join(dirname(entryFile), name);
  if (isClipName(media.src)) clipSources(project, media.src);
  else checkFile(project, imageName(media.src), nextToMdx(imageName(media.src)), "image");
  if (media.poster) checkFile(project, imageName(media.poster), nextToMdx(imageName(media.poster)), "image");
  for (const [, name] of body.matchAll(/^import\s+\w+\s+from\s+["']\.\/([^"']+\.(?:png|jpe?g|webp|avif|gif))["']/gim)) {
    checkFile(project, name, nextToMdx(name), "image");
  }
}

/**
 * The file name an `image()` field was written with. The content store keeps
 * it behind Astro's image marker (`__ASTRO_IMAGE_./hero.png`). If Astro ever
 * changes the marker, the check fails loudly ("doesn't exist"), never silently.
 */
function imageName(stored: string): string {
  return stored.replace(/^__ASTRO_IMAGE_/, "").replace(/^\.\//, "");
}

function checkFile(project: string, name: string, path: string, kind: MediaKind): void {
  const rule = MEDIA_RULES[kind];
  const where = relative(process.cwd(), path);
  if (!existsSync(path)) {
    throw new Error(`Personal project "${project}" uses ${kind} "${name}", but ${where} doesn't exist. ${rule.where}`);
  }
  const bytes = statSync(path).size;
  if (bytes > rule.maxBytes) {
    throw new Error(
      `Personal project "${project}" has a ${kind} over the size cap: ${where} is ${megabytes(bytes)}; ` +
        `${rule.plural} must be at most ${megabytes(rule.maxBytes)}.`,
    );
  }
}

function megabytes(bytes: number): string {
  return `${Number((bytes / 1_000_000).toFixed(2))} MB`;
}
