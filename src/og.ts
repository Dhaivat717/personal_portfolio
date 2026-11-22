import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori, { type Font } from "satori";
import { iconSvgBody } from "./icons";
import type { Project } from "./projects";
import { site } from "./settings";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Dark-only social card palette matching the dark tokens in src/styles/global.css. */
const THEME = {
  bg: "#000000",
  surface: "#1c1c1e",
  fgStrong: "#ffffff",
  fg: "#f5f5f7",
  muted: "#a1a1a6",
  line: "#38383d",
  accent: "#ff8a3d",
  accentFill: "#24160d",
} as const;

const HOST = new URL(site.origin).hostname;
const require = createRequire(import.meta.url);

type SatoriNode = {
  type: string;
  props: {
    style?: Record<string, string | number>;
    src?: string;
    width?: number;
    height?: number;
    children?: SatoriChild | SatoriChild[];
  };
};
type SatoriChild = SatoriNode | string | number | null | undefined | false;

function h(
  type: string,
  props: SatoriNode["props"],
  ...children: SatoriChild[]
): SatoriNode {
  const flat = children.flat().filter((c): c is SatoriNode | string | number => c !== null && c !== undefined && c !== false);
  return {
    type,
    props: {
      ...props,
      ...(flat.length === 1 ? { children: flat[0] } : flat.length > 1 ? { children: flat } : {}),
    },
  };
}

let cachedFonts: Promise<Font[]> | undefined;
function loadFonts(): Promise<Font[]> {
  cachedFonts ??= (async () => {
    const [inter400, inter600, inter700, mono400] = await Promise.all([
      readFile(require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff")),
      readFile(require.resolve("@fontsource/inter/files/inter-latin-600-normal.woff")),
      readFile(require.resolve("@fontsource/inter/files/inter-latin-700-normal.woff")),
      readFile(require.resolve("@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff")),
    ]);
    return [
      { name: "Inter", data: inter400, weight: 400, style: "normal" },
      { name: "Inter", data: inter600, weight: 600, style: "normal" },
      { name: "Inter", data: inter700, weight: 700, style: "normal" },
      { name: "JetBrains Mono", data: mono400, weight: 400, style: "normal" },
    ];
  })();
  return cachedFonts;
}

let cachedPortrait: Promise<string> | undefined;
function loadPortraitDataUri(): Promise<string> {
  cachedPortrait ??= readFile(resolve(process.cwd(), "src/assets/portrait.jpeg")).then(
    (buf) => `data:image/jpeg;base64,${buf.toString("base64")}`,
  );
  return cachedPortrait;
}

function iconDataUri(name: string, size: number): string {
  const body = iconSvgBody(name).replaceAll("currentColor", THEME.accent);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${THEME.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function iconTile(name: string, boxSize: number, iconSize: number, radius: number): SatoriNode {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: boxSize,
        height: boxSize,
        borderRadius: radius,
        backgroundColor: THEME.accentFill,
        border: `1px solid ${THEME.line}`,
        flexShrink: 0,
      },
    },
    h("img", { src: iconDataUri(name, iconSize), width: iconSize, height: iconSize }),
  );
}

function cardFrame(body: SatoriNode, footerUrl: string, { showAuthor = true }: { showAuthor?: boolean } = {}): SatoriNode {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: OG_WIDTH,
        height: OG_HEIGHT,
        backgroundColor: THEME.bg,
        color: THEME.fg,
        fontFamily: "Inter",
      },
    },
    // Top accent rule
    h("div", {
      style: {
        display: "flex",
        width: OG_WIDTH,
        height: 6,
        backgroundColor: THEME.accent,
        flexShrink: 0,
      },
    }),
    // Padded inner column using explicit inset dimensions so layout stays strictly within 1200×630.
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: OG_WIDTH - 128,
          height: OG_HEIGHT - 6 - 94,
          marginTop: 50,
          marginRight: 64,
          marginBottom: 44,
          marginLeft: 64,
        },
      },
      body,
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            flexShrink: 0,
            borderTop: `1px solid ${THEME.line}`,
            paddingTop: 22,
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              fontFamily: "JetBrains Mono",
              fontSize: 22,
              color: THEME.accent,
            },
          },
          footerUrl,
        ),
        showAuthor
          ? h(
              "div",
              {
                style: {
                  display: "flex",
                  fontSize: 20,
                  color: THEME.muted,
                },
              },
              site.name,
            )
          : null,
      ),
    ),
  );
}

function homeTemplate(portraitUri: string): SatoriNode {
  const body = h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 56,
        width: "100%",
        flexGrow: 1,
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          width: 280,
          height: 304,
          borderRadius: 28,
          overflow: "hidden",
          border: `2px solid ${THEME.line}`,
          backgroundColor: THEME.surface,
          flexShrink: 0,
        },
      },
      h("img", {
        src: portraitUri,
        width: 280,
        height: 304,
        style: { objectFit: "cover", objectPosition: "50% 30%" },
      }),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 20,
          flex: 1,
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: THEME.fgStrong,
          },
        },
        site.name,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: THEME.accent,
              backgroundColor: THEME.accentFill,
              borderRadius: 980,
              padding: "10px 22px",
            },
          },
          site.role,
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: THEME.fg,
              backgroundColor: THEME.surface,
              border: `1px solid ${THEME.line}`,
              borderRadius: 980,
              padding: "10px 22px",
            },
          },
          site.employer,
        ),
      ),
    ),
  );
  return cardFrame(body, HOST, { showAuthor: false });
}

function projectsTemplate(projects: Project[]): SatoriNode {
  const count = projects.length;
  const countLabel = `${count} Personal project${count === 1 ? "" : "s"}`;
  const tiles = projects.slice(0, 8).map((p) => iconTile(p.data.icon, 80, 38, 18));

  const body = h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 32,
        width: "100%",
        flexGrow: 1,
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 14,
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: THEME.fgStrong,
          },
        },
        "Projects",
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontSize: 28,
            color: THEME.muted,
          },
        },
        countLabel,
      ),
    ),
    tiles.length > 0
      ? h(
          "div",
          {
            style: {
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
            },
          },
          ...tiles,
        )
      : null,
  );
  return cardFrame(body, `${HOST}/projects`);
}

function deepDiveTemplate(project: Project): SatoriNode {
  const { title, pitch, stack, icon } = project.data;
  const chips = stack.slice(0, 3);

  const body = h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 26,
        width: "100%",
        flexGrow: 1,
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 24,
          width: "100%",
        },
      },
      iconTile(icon, 84, 42, 20),
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: THEME.fgStrong,
            flexGrow: 1,
          },
        },
        title,
      ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          width: "100%",
          fontSize: 28,
          lineHeight: 1.45,
          color: THEME.muted,
        },
      },
      pitch,
    ),
    chips.length > 0
      ? h(
          "div",
          {
            style: {
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            },
          },
          ...chips.map((tech) =>
            h(
              "div",
              {
                style: {
                  display: "flex",
                  fontFamily: "JetBrains Mono",
                  fontSize: 22,
                  color: THEME.fg,
                  backgroundColor: THEME.surface,
                  border: `1px solid ${THEME.line}`,
                  borderRadius: 980,
                  padding: "8px 18px",
                },
              },
              tech,
            ),
          ),
        )
      : null,
  );
  return cardFrame(body, `${HOST}/projects/${project.id}`);
}

export type SocialCardSpec =
  | { kind: "home" }
  | { kind: "projects"; projects: Project[] }
  | { kind: "deep-dive"; project: Project };

/** Render a 1200×630 PNG social preview card with Satori and resvg. */
export async function renderSocialCard(spec: SocialCardSpec): Promise<Buffer> {
  const fonts = await loadFonts();
  const tree =
    spec.kind === "home"
      ? homeTemplate(await loadPortraitDataUri())
      : spec.kind === "projects"
        ? projectsTemplate(spec.projects)
        : deepDiveTemplate(spec.project);

  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: { loadSystemFonts: false },
  }).render();
  return Buffer.from(png.asPng());
}
