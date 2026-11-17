import type { MarkdownHeading } from "astro";
import type { Project } from "./projects";

/** Every Deep dive's h2s, exactly these, in this order. */
const SPINE = ["Problem", "Architecture", "Approach", "Results", "What I learned"] as const;

const WORD_RANGE = { min: 800, max: 1500 } as const;

/**
 * The Deep dive's h2s, which are its table of contents. Fails the build
 * unless they are exactly the spine, in order.
 */
export function spineHeadings(project: Project, headings: MarkdownHeading[]): MarkdownHeading[] {
  const h2s = headings.filter((h) => h.depth === 2);
  const found = h2s.map((h) => h.text);
  if (found.length !== SPINE.length || found.some((text, i) => text !== SPINE[i])) {
    throw new Error(
      `Personal project "${project.id}" has the wrong h2 headings: expected ${SPINE.join(", ")}, ` +
        `found ${found.length > 0 ? found.join(", ") : "none"}. ` +
        `Every Deep dive uses exactly these h2s, in this order; use h3s inside Approach.`,
    );
  }
  return h2s;
}

/**
 * Words a Visitor reads in a Deep dive's MDX body: prose and code excerpts,
 * not imports, exports, JSX tags or Markdown punctuation.
 */
function countWords(body: string): number {
  const prose = body
    .replace(/^(import|export)\s.*$/gm, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\]\([^)]*\)/g, "]");
  return prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
}

/** Warns, without failing the build, when a Deep dive is outside the word range. */
export function warnOnWordCount(project: Project): void {
  const words = countWords(project.body ?? "");
  if (words < WORD_RANGE.min || words > WORD_RANGE.max) {
    console.warn(
      `Warning: Personal project "${project.id}" has ${words.toLocaleString("en-US")} words; ` +
        `a Deep dive should run ${WORD_RANGE.min}–${WORD_RANGE.max.toLocaleString("en-US")} words.`,
    );
  }
}
