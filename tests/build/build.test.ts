import { describe, expect, test } from "vitest";
import { buildWithFixture } from "./build";

describe("production build", () => {
  test("succeeds with valid content", () => {
    const { status, output } = buildWithFixture("valid");
    expect(output).toContain("Complete!");
    expect(status).toBe(0);
  });

  test("fails and points at the bad line when a Personal project's frontmatter is malformed", () => {
    const { status, output } = buildWithFixture("malformed-frontmatter");
    expect(status).not.toBe(0);
    expect(output).toMatch(/broken[\\/]index\.mdx:3/);
    expect(output).toContain("title: [unclosed");
  });
});

describe("Personal projects", () => {
  test("each project folder becomes a row on /projects and a page at /projects/<slug>, lowest order first", () => {
    const build = buildWithFixture("valid");
    expect(build.status).toBe(0);

    const index = build.page("/projects");
    expect(index).not.toBeNull();
    expect(index).toContain("<title>Projects · Dhaivat Patel</title>");
    // minimal (order 10) comes before full (order 20), though "full" sorts first by name.
    const minimalAt = index!.indexOf('href="/projects/minimal"');
    const fullAt = index!.indexOf('href="/projects/full"');
    expect(minimalAt).toBeGreaterThan(-1);
    expect(fullAt).toBeGreaterThan(minimalAt);
    expect(index).toContain("Only the required fields.");

    const full = build.page("/projects/full");
    expect(full).toContain("<title>Full Project · Dhaivat Patel</title>");
    expect(full).toMatch(/<h1[^>]*>Full Project<\/h1>/);
    expect(full).toContain("exactly one hundred and twenty characters long");
    expect(full).toContain("<p>The body of the full project uses every field.</p>");
  });
});

/** The nav's Projects drop-down entries on a built page, in order, as [href, text]. */
function navProjects(html: string | null): [string, string][] {
  const list = html?.match(/id="nav-projects"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
  return [...list.matchAll(/<a[^>]*href="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/a>/g)].map((m) => [m[1], m[2]]);
}

describe("the nav's Projects drop-down", () => {
  test("lists at most 8 projects, lowest order first, then All projects →", () => {
    const build = buildWithFixture("many");
    expect(build.status).toBe(0);
    // p10 has the lowest order (90) and p01 the highest (99).
    const expected: [string, string][] = ["10", "09", "08", "07", "06", "05", "04", "03"].map((n) => [
      `/projects/p${n}`,
      `Project ${n}`,
    ]);
    expected.push(["/projects", "All projects →"]);
    for (const route of ["/", "/projects", "/projects/p01"]) {
      expect(navProjects(build.page(route))).toEqual(expected);
    }
  });

  test("includes drafts only when drafts are shown", () => {
    const shown = buildWithFixture("drafts", { env: { SITE_ENV: undefined, SHOW_DRAFTS: undefined } });
    expect(navProjects(shown.page("/"))).toContainEqual(["/projects/wip", "Work In Progress"]);

    const hidden = buildWithFixture("drafts", { env: { SITE_ENV: "production", SHOW_DRAFTS: undefined } });
    expect(navProjects(hidden.page("/"))).toEqual([
      ["/projects/published", "Published Project"],
      ["/projects", "All projects →"],
    ]);
  });
});

describe("Personal project schema", () => {
  // The pass case for each rule is the `valid` fixture: `full` uses every
  // field, `minimal` omits every optional one, `full`'s pitch is exactly 120
  // characters and the two orders differ.

  test("an unknown frontmatter field fails the build, naming the project and the field", () => {
    const { status, output } = buildWithFixture("unknown-field");
    expect(status).not.toBe(0);
    expect(output).toContain("stray-field");
    expect(output).toMatch(/unrecognized key.*subtitle/i);
  });

  test("a missing required field fails the build, naming the project and the field", () => {
    const { status, output } = buildWithFixture("missing-field");
    expect(status).not.toBe(0);
    expect(output).toContain("no-when");
    expect(output).toMatch(/\bwhen\b.*required/i);
  });

  test("a pitch over 120 characters fails the build, naming the project and the limit", () => {
    const { status, output } = buildWithFixture("long-pitch");
    expect(status).not.toBe(0);
    expect(output).toContain("wordy");
    expect(output).toMatch(/pitch.*120 characters/i);
  });

  test("two projects with the same order fail the build, naming both projects and the rule", () => {
    const { status, output } = buildWithFixture("duplicate-order");
    expect(status).not.toBe(0);
    expect(output).toMatch(/alpha.*beta/);
    expect(output).toMatch(/order 500/);
    expect(output).toMatch(/unique/i);
  });

  test("an icon that isn't in the shared icon set fails the build, naming the project and the icon", () => {
    const { status, output } = buildWithFixture("unknown-icon");
    expect(status).not.toBe(0);
    expect(output).toContain("projects → bad-icon");
    expect(output).toMatch(/"not-a-real-icon" is not a Lucide icon name/);
  });
});

describe("Draft Personal projects", () => {
  test("render, page and row, when SITE_ENV isn't production", () => {
    const build = buildWithFixture("drafts", { env: { SITE_ENV: undefined, SHOW_DRAFTS: undefined } });
    expect(build.status).toBe(0);
    expect(build.page("/projects/wip")).toContain("Work In Progress");
    expect(build.page("/projects")).toContain('href="/projects/wip"');
  });

  test.each([
    ["SITE_ENV=production", { SITE_ENV: "production", SHOW_DRAFTS: undefined }],
    ["SHOW_DRAFTS=false", { SITE_ENV: undefined, SHOW_DRAFTS: "false" }],
  ])("are absent entirely with %s", (_, env) => {
    const build = buildWithFixture("drafts", { env });
    expect(build.status).toBe(0);
    expect(build.page("/projects/wip")).toBeNull();
    expect(build.page("/projects")).not.toContain("/projects/wip");
    expect(build.page("/projects")).not.toContain("Work In Progress");
    expect(build.page("/projects/published")).toContain("Published Project");
  });
});
