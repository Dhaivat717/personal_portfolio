/**
 * How a diagram part reads:
 * - `default`: a plain part of the system.
 * - `accent`: the part that matters most, or Dhaivat's own work.
 * - `upstream`: someone else's work the project builds on, muted and dashed.
 */
export type Tone = "default" | "accent" | "upstream";

export type Point = readonly [x: number, y: number];

/** Arrowhead size in viewBox units. */
const HEAD_LENGTH = 8;
const HEAD_HALF_WIDTH = 4.5;

/**
 * An arrow along `points`: the line (stopping where the head begins, so it
 * never pokes past the tip) and the head's triangle, pointing along the last
 * segment.
 */
export function arrowGeometry(points: readonly Point[]): { line: string; head: string } {
  if (points.length < 2) throw new Error("An <Arrow> needs at least two points.");
  const [tx, ty] = points.at(-1)!;
  const [px, py] = points.at(-2)!;
  const length = Math.hypot(tx - px, ty - py);
  if (length === 0) throw new Error("An <Arrow>'s last two points must differ.");
  const [dx, dy] = [(tx - px) / length, (ty - py) / length];
  const [bx, by] = [tx - dx * HEAD_LENGTH, ty - dy * HEAD_LENGTH];
  const [nx, ny] = [-dy * HEAD_HALF_WIDTH, dx * HEAD_HALF_WIDTH];

  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  const pt = (x: number, y: number) => `${fmt(x)} ${fmt(y)}`;
  const line = [...points.slice(0, -1), [bx, by] as const].map(([x, y], i) => `${i ? "L" : "M"}${pt(x, y)}`).join("");
  const head = `M${pt(tx, ty)}L${pt(bx + nx, by + ny)}L${pt(bx - nx, by - ny)}Z`;
  return { line, head };
}

/**
 * Where an arrow's label goes by default: just past the start of the first
 * segment, above it if it runs across, beside it if it runs down.
 */
export function defaultLabelAt(points: readonly Point[]): Point {
  const [[x0, y0], [x1, y1]] = points;
  return Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? [x0 + 16 * Math.sign(x1 - x0 || 1), y0 - 6] : [x0 + 8, (y0 + y1) / 2 + 4];
}
