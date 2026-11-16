import type { MarkdownHeading } from "astro";

/** Every Deep dive's h2s, exactly these, in this order. */
export const SPINE = ["Problem", "Architecture", "Approach", "Results", "What I learned"] as const;

export const WORD_RANGE = { min: 800, max: 1500 } as const;

/**
 * Fails the build unless the Deep dive's h2s are exactly the spine, in order.
 * Returns the h2s, which are the table of contents.
 */
export function assertSpine(projectId: string, headings: MarkdownHeading[]): MarkdownHeading[] {
  const h2s = headings.filter((h) => h.depth === 2);
  const found = h2s.map((h) => h.text);
  if (found.length !== SPINE.length || found.some((text, i) => text !== SPINE[i])) {
    throw new Error(
      `Personal project "${projectId}" has the wrong h2 headings: expected ${SPINE.join(", ")}, ` +
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
export function countWords(body: string): number {
  const prose = body
    .replace(/^(import|export)\s.*$/gm, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\]\([^)]*\)/g, "]");
  return prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
}

/** Warns, without failing the build, when a Deep dive is outside the word range. */
export function warnOnWordCount(projectId: string, body: string): void {
  const words = countWords(body);
  if (words < WORD_RANGE.min || words > WORD_RANGE.max) {
    console.warn(
      `Warning: Personal project "${projectId}" has ${words} words; ` +
        `a Deep dive should run ${WORD_RANGE.min}–${WORD_RANGE.max.toLocaleString("en-US")} words.`,
    );
  }
}
