import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

// Below the seams: axe can't see inside SVGs, so diagram colors are checked
// here, on the color tokens directly, in both themes.

const root = resolve(import.meta.dirname, "../..");
const css = readFileSync(join(root, "src/styles/global.css"), "utf8");
const kitDir = join(root, "src/components/diagram");

type Theme = "light" | "dark";

/** A color written into markup or CSS: #hex, rgb()/hsl(), or a fill/stroke attribute. */
const HARD_CODED_COLOR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(fill|stroke)="(?!none")/i;

/** A `--name: light-dark(#light, #dark)` token's hex value in one theme. */
function token(name: string, theme: Theme): string {
  const m = css.match(new RegExp(`--${name}:\\s*light-dark\\(\\s*(#[0-9a-f]{3,6})\\s*,\\s*(#[0-9a-f]{3,6})\\s*\\)`, "i"));
  if (!m) throw new Error(`--${name} isn't a light-dark(#hex, #hex) token in global.css`);
  return theme === "light" ? m[1] : m[2];
}

/** WCAG 2.x relative luminance of a #rgb or #rrggbb color. */
function luminance(hex: string): number {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("contrast math", () => {
  test("matches known WCAG ratios", () => {
    expect(contrast("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrast("#fff", "#fff")).toBeCloseTo(1, 5);
    // WebAIM's checker: #767676 on white is 4.54:1.
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});

/**
 * Site-wide color token pairs checked in both themes against WCAG 2.2 AA:
 * text pairs >= 4.5:1, UI-part pairs (focus rings, icons, diagram strokes) >= 3:1.
 */
const siteSurfaces = ["bg", "surface", "hover", "accent-fill"];
const textPairs: [fg: string, bg: string][] = [
  ...["fg", "fg-strong", "muted", "accent"].flatMap((fg) => siteSurfaces.map((bg): [string, string] => [fg, bg])),
  ["on-accent", "accent"],
];
const uiPartPairs: [part: string, bg: string][] = [
  ...["stroke", "muted", "accent", "fg", "fg-strong"].flatMap((part) => siteSurfaces.map((bg): [string, string] => [part, bg])),
];

describe.each(["light", "dark"] as const)("site color tokens in the %s theme", (theme) => {
  test.each(textPairs)("text --%s on --%s is at least 4.5:1", (fg, bg) => {
    expect(contrast(token(fg, theme), token(bg, theme))).toBeGreaterThanOrEqual(4.5);
  });

  test.each(uiPartPairs)("UI part --%s on --%s is at least 3:1", (part, bg) => {
    expect(contrast(token(part, theme), token(bg, theme))).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Every color the diagram kit draws with, and what it is drawn on. The figure
 * sits on --bg; default boxes are filled with --surface, accent boxes with
 * --accent-fill; upstream boxes and groups are unfilled, so on --bg.
 */
const diagramBackgrounds = ["bg", "surface", "accent-fill"];
const diagramText: [fg: string, bg: string][] = [
  ...["fg", "muted", "accent"].flatMap((fg) => diagramBackgrounds.map((bg): [string, string] => [fg, bg])),
];
const diagramStrokes: [stroke: string, bg: string][] = [
  // Box, group and branch outlines; arrows; accent outlines and arrows.
  ...["stroke", "muted", "accent"].flatMap((s) => diagramBackgrounds.map((bg): [string, string] => [s, bg])),
];

describe.each(["light", "dark"] as const)("diagram colors in the %s theme", (theme) => {
  test.each(diagramText)("text --%s on --%s is at least 4.5:1", (fg, bg) => {
    expect(contrast(token(fg, theme), token(bg, theme))).toBeGreaterThanOrEqual(4.5);
  });

  test.each(diagramStrokes)("stroke --%s on --%s is at least 3:1", (stroke, bg) => {
    expect(contrast(token(stroke, theme), token(bg, theme))).toBeGreaterThanOrEqual(3);
  });
});

describe("the diagram kit", () => {
  const sources = readdirSync(kitDir)
    .filter((f) => f.endsWith(".astro"))
    .map((f) => [f, readFileSync(join(kitDir, f), "utf8")] as const);
  const checked = new Set([...diagramText, ...diagramStrokes].flat());

  test.each(sources)("%s colors only with tokens covered by the contrast checks", (_, source) => {
    const style = source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    const colors = [...style.matchAll(/(?:^|[\s;{])(fill|stroke|color|background(?:-color)?):\s*([^;]+);/g)].map((m) =>
      m[2].trim(),
    );
    expect(colors.length).toBeGreaterThan(0);
    for (const value of colors) {
      if (value === "none") continue;
      const name = value.match(/^var\(--([\w-]+)\)$/)?.[1];
      expect(name, `"${value}" is not a theme token`).toBeDefined();
      expect([...checked], `--${name} isn't covered by the diagram contrast checks`).toContain(name);
    }
    expect(source).not.toMatch(HARD_CODED_COLOR);
  });

  // Each Personal project's own diagram files (e.g. architecture.astro) draw
  // only with the kit, so they carry no colors of their own.
  const projectsDir = join(root, "src/content/projects");
  const diagrams = readdirSync(projectsDir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".astro"))
    .map((f) => [f, readFileSync(join(projectsDir, f), "utf8")] as const);

  test.each(diagrams)("src/content/projects/%s has no hard-coded colors", (_, source) => {
    expect(source).not.toMatch(HARD_CODED_COLOR);
    expect(source).not.toMatch(/<style|style=/);
  });
});
