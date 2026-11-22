import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
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

/** Markup inside a Home page `<section id="...">`. */
function homeSection(html: string | null, id: string): string {
  return html?.match(new RegExp(`<section[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/section>`))?.[1] ?? "";
}

describe("Home page hero", () => {
  test("bakes the ID card, full about.md editor text, three stat boxes and hero CTA links into static HTML", () => {
    const build = buildWithFixture("valid");
    expect(build.status).toBe(0);

    const home = build.page("/")!;
    expect(home).not.toBeNull();
    const homeText = text(home);

    // ID card: name, chips, intro, portrait image with meaningful alt, social links.
    expect(home).toMatch(/<h1[^>]*>Dhaivat Patel<\/h1>/);
    expect(homeText).toContain("Software Engineer");
    expect(homeText).toContain("Amazon Ads");
    expect(homeText).toContain(
      "Software engineer, building scalable distributed backend systems, public APIs and practical AI Agents.",
    );
    expect(home).toMatch(/<img[^>]*alt="Dhaivat Patel"/);

    // Editor window: tab + full about.md sections baked in.
    expect(homeText).toContain("about.md");
    expect(homeText).toContain("Hi, I’m Dhaivat.");
    expect(homeText).toContain("1,000+ investigations");
    expect(homeText).toContain("63 bugs before GA");
    expect(homeText).toContain("reduced cost by 25%");
    expect(homeText).toContain("Off the clock");
    expect(homeText).toContain("tennis court");
    expect(homeText).toContain("How I work");
    expect(homeText).toContain("problem solver who learns best by building");

    // Three stat boxes: 5+ years, Masters Rutgers with decorative logo (alt=""), baked contributions linking to GitHub.
    expect(homeText).toContain("5+");
    expect(homeText).toContain("Years of experience");
    expect(homeText).toContain("Masters");
    expect(homeText).toContain("Computer Science, Rutgers");
    expect(home).toMatch(/<img[^>]*\balt(?:="")?(?:\s|>)/);
    expect(homeText).toContain("30");
    expect(homeText).toMatch(/GitHub contributions[\s\S]*Last 12 months/);

    // Hero buttons: Résumé download and Get in touch (#contact).
    expect(home).toContain('href="/resume.pdf"');
    expect(home).toContain('href="#contact"');
    expect(homeText).toContain("Get in touch");
  });
});

describe("Home page Experience section", () => {
  test("renders all four roles newest first with Work highlights, bolded figures, logos and tags", () => {
    const build = buildWithFixture("valid");
    expect(build.status).toBe(0);

    const section = homeSection(build.page("/"), "experience");
    expect(section).toMatch(/<h2[^>]*>Experience\.<\/h2>/);

    const roleHeadings = [...section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]).trim());
    expect(roleHeadings).toEqual([
      "Software Development Engineer @ Amazon Ads",
      "Software Engineer @ Invidi Technologies",
      "SDE Intern @ Amazon",
      "Accessibility Developer @ Rutgers University",
    ]);

    const roles = [...section.matchAll(/<article[^>]*data-role[^>]*>([\s\S]*?)<\/article>/g)].map((m) => m[1]);
    expect(roles).toHaveLength(4);

    // Bullet counts per role: 5, 3, 3, 2.
    const bulletCounts = roles.map((r) => {
      const list = r.match(/<ul[^>]*data-bullets[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
      return [...list.matchAll(/<li\b/g)].length;
    });
    expect(bulletCounts).toEqual([5, 3, 3, 2]);

    // Dates in monospace left column.
    expect(text(roles[0])).toContain("2023–present");
    expect(text(roles[1])).toContain("Mar–Jul 2023");
    expect(text(roles[2])).toContain("May–Aug 2022");
    expect(text(roles[3])).toContain("Feb 2021–Dec 2022");

    // Key figures bolded in bullets; Rutgers bullets have no bolded figure.
    const bulletStrong = (roleHtml: string) => {
      const list = roleHtml.match(/<ul[^>]*data-bullets[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
      return [...list.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/g)].map((m) => text(m[1]));
    };
    expect(bulletStrong(roles[0])).toEqual([
      "1,000+ investigations in two weeks",
      "300+ inconsistent fields and 63 bugs before GA",
      "19 new marketplaces",
      "from 1,000 calls to 4 (−99.6%)",
      "from 16K req/s to 0",
    ]);
    expect(bulletStrong(roles[1])).toEqual(["−10% service load"]);
    expect(bulletStrong(roles[2])).toEqual(["−80% downstream cache calls"]);
    expect(bulletStrong(roles[3])).toEqual([]);

    // Every role has a logo image with meaningful non-empty alt text and tag chips.
    for (const roleHtml of roles) {
      const alt = roleHtml.match(/<img[^>]*\balt="([^"]+)"/)?.[1] ?? "";
      expect(alt.trim().length).toBeGreaterThan(0);
      expect(roleHtml).toMatch(/aria-label="Technologies"/);
    }
  });

  test("changing a bullet in the data changes the built page with no markup edits", () => {
    const sourcePath = resolve(import.meta.dirname, "../../src/content/experience.json");
    const data = JSON.parse(readFileSync(sourcePath, "utf8")) as Array<{
      id: string;
      bullets: string[];
    }>;
    const originalBullet = data[0].bullets[0];
    data[0].bullets[0] = "Updated bullet from data with **42x faster** throughput.";

    const tmpFile = join(resolve(import.meta.dirname, "../../.astro"), "test-experience-override.json");
    mkdirSync(dirname(tmpFile), { recursive: true });
    writeFileSync(tmpFile, JSON.stringify(data, null, 2));
    try {
      const build = buildWithFixture("valid", { env: { EXPERIENCE_FILE: tmpFile } });
      expect(build.status).toBe(0);

      const section = homeSection(build.page("/"), "experience");
      expect(text(section)).toContain("Updated bullet from data with 42x faster throughput.");
      expect(section).toMatch(/<strong[^>]*>42x faster<\/strong>/);
      expect(text(section)).not.toContain(originalBullet.replace(/\*\*/g, ""));
    } finally {
      rmSync(tmpFile, { force: true });
    }
  });
});

describe("Home page Projects band", () => {
  test("shows up to 3 featured projects lowest order first, excludes non-featured, and links to /projects", () => {
    const build = buildWithFixture("featured");
    expect(build.status).toBe(0);

    const band = homeSection(build.page("/"), "projects");
    expect(band).toMatch(/<h2[^>]*>Projects\.<\/h2>/);

    const rowHrefs = [...band.matchAll(/<a[^>]*href="(\/projects\/[^"]+)"/g)].map((m) => m[1]);
    expect(rowHrefs).toEqual(["/projects/zeta", "/projects/mid", "/projects/alpha"]);
    expect(band).not.toContain("/projects/unfeatured");
    expect(band).not.toContain("Unfeatured Project");

    // Headings inside the Home band are h3 (under the band's h2).
    const rowHeadings = [...band.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(rowHeadings).toEqual(["Zeta Project", "Mid Project", "Alpha Project"]);

    // Ends with "All projects →" linking to /projects.
    expect(band).toMatch(/<a[^>]*href="\/projects"[^>]*>\s*All projects →\s*<\/a>/);

    // Non-featured project still appears on /projects.
    expect(build.page("/projects")).toContain('href="/projects/unfeatured"');
  });

  test("follows the draft production/preview rule", () => {
    const shown = buildWithFixture("drafts", { env: { SITE_ENV: undefined, SHOW_DRAFTS: undefined } });
    expect(shown.status).toBe(0);
    const shownBand = homeSection(shown.page("/"), "projects");
    expect(shownBand).toContain('href="/projects/published"');
    expect(shownBand).toContain('href="/projects/wip"');

    for (const env of [
      { SITE_ENV: "production", SHOW_DRAFTS: undefined },
      { SITE_ENV: undefined, SHOW_DRAFTS: "false" },
    ]) {
      const hidden = buildWithFixture("drafts", { env });
      expect(hidden.status).toBe(0);
      const hiddenBand = homeSection(hidden.page("/"), "projects");
      expect(hiddenBand).toContain('href="/projects/published"');
      expect(hiddenBand).not.toContain("/projects/wip");
      expect(hiddenBand).not.toContain("Work In Progress");
    }
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

  test("more than 3 featured projects fail the build with a clear message", () => {
    const { status, output } = buildWithFixture("too-many-featured");
    expect(status).not.toBe(0);
    expect(output).toMatch(/at most 3/i);
    expect(output).toMatch(/featured/i);
    expect(output).toContain('"f1"');
    expect(output).toContain('"f4"');
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

describe("the Deep dive h2 spine", () => {
  // The pass case is the `valid` fixture: every project there has exactly
  // Problem, Architecture, Approach, Results, What I learned.

  test("h2s in the wrong order fail the build, naming the project and the expected spine", () => {
    const { status, output } = buildWithFixture("spine-reordered");
    expect(status).not.toBe(0);
    expect(output).toContain('"project"');
    expect(output).toContain("Problem, Architecture, Approach, Results, What I learned");
    expect(output).toContain("found Problem, Approach, Architecture, Results, What I learned");
  });

  test.each([
    ["missing", "spine-missing", "found Problem, Architecture, Approach, What I learned."],
    ["extra", "spine-extra", "found Problem, Architecture, Approach, Results, What I learned, Credits."],
    ["renamed", "spine-renamed", "found Problem, Design, Approach, Results, What I learned."],
  ])("a %s h2 fails the build, naming the project and what it found", (_, fixture, found) => {
    const { status, output } = buildWithFixture(fixture);
    expect(status).not.toBe(0);
    expect(output).toContain('"project"');
    expect(output).toContain("expected Problem, Architecture, Approach, Results, What I learned");
    expect(output).toContain(found);
  });
});

describe("the Architecture diagram", () => {
  // The pass case is the `valid` fixture: every project there has a diagram
  // from the diagram kit under its Architecture h2.

  test("an Architecture section with no diagram fails the build, naming the project and the fix", () => {
    const { status, output } = buildWithFixture("architecture-no-diagram");
    expect(status).not.toBe(0);
    expect(output).toContain('Personal project "project" has no diagram in its Architecture section');
    expect(output).toContain("src/components/diagram");
  });

  test("a diagram renders as an inline SVG image named by its title, inside the Architecture section", () => {
    const html = buildWithFixture("valid").page("/projects/full")!;
    const architecture = html.match(/<h2 id="architecture"[\s\S]*?(?=<h2 )/)?.[0] ?? "";
    expect(architecture).toMatch(/<svg[^>]*role="img"[^>]*aria-label="A sample pipeline: input flows to output\."/);
  });
});

describe("the Deep dive word count", () => {
  test("outside 800–1,500 words prints a warning naming the project, and the build still passes", () => {
    const { status, output } = buildWithFixture("word-count");
    expect(status).toBe(0);
    // short: 7 words of headings and 5 one-word paragraphs.
    expect(output).toMatch(/Warning: Personal project "short" has 12 words; a Deep dive should run 800–1,500 words\./);
    // long: 7 words of headings and 5 paragraphs of 320 words.
    expect(output).toMatch(/Warning: Personal project "long" has 1,607 words; a Deep dive should run 800–1,500 words\./);
    // in-range has 1,011 words, and an h3 inside Approach, which the spine allows.
    expect(output).not.toContain('"in-range" has');
  });
});

/** The text of a built page with tags removed and whitespace collapsed. */
function text(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

/** The [href, text] links inside the element with the given aria-label. */
function linksIn(html: string, label: string): [string, string][] {
  const block = html.match(new RegExp(`aria-label="${label}"[^>]*>([\\s\\S]*?)</nav>`))?.[1] ?? "";
  return [...block.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2]).trim()]);
}

describe("a Deep dive page", () => {
  test("shows the meta strip, with Built on only when set", () => {
    const build = buildWithFixture("valid");
    expect(build.status).toBe(0);

    const full = text(build.page("/projects/full")!);
    expect(full).toContain("When Spring 2024");
    expect(full).toContain("Stack TypeScript Astro");
    expect(full).toContain("Built on Upstream Thing by someone");
    expect(build.page("/projects/full")).toContain('href="https://github.com/someone/upstream-thing"');
    expect(full).toContain("Links Code ↗ Play level one ↗");
    expect(build.page("/projects/full")).toContain('href="https://example.itch.io/full"');

    const minimal = text(build.page("/projects/minimal")!);
    expect(minimal).toContain("When 2023");
    expect(minimal).not.toContain("Built on");
    expect(minimal).toContain("Links Code ↗");
    expect(minimal).not.toContain("Play");
  });

  test("lists the five h2s in its table of contents, linking to each section", () => {
    const html = buildWithFixture("valid").page("/projects/full")!;
    const toc = linksIn(html, "On this page");
    expect(toc).toEqual([
      ["#problem", "Problem"],
      ["#architecture", "Architecture"],
      ["#approach", "Approach"],
      ["#results", "Results"],
      ["#what-i-learned", "What I learned"],
    ]);
    for (const [href] of toc) expect(html).toMatch(new RegExp(`<h2 id="${href.slice(1)}"`));
  });

  test("links to the previous and next projects in order, with none before the first or after the last", () => {
    const build = buildWithFixture("valid");
    // minimal is order 10, full is order 20.
    expect(linksIn(build.page("/projects/minimal")!, "More projects")).toEqual([
      ["/projects/full", "Next Full Project A pitch that is exactly one hundred and twenty characters long, to show the limit is inclusive and passes the build: ok."],
    ]);
    expect(linksIn(build.page("/projects/full")!, "More projects")).toEqual([
      ["/projects/minimal", "Previous Minimal Project Only the required fields."],
    ]);
  });
});

/** Extract all `<loc>` values from a sitemap XML document. */
function sitemapLocs(xml: string | null): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

describe("sitemap and robots.txt", () => {
  test("production build lists every published page without trailing slashes or drafts, and robots.txt references it", () => {
    const build = buildWithFixture("drafts", { env: { SITE_ENV: "production", SHOW_DRAFTS: undefined } });
    expect(build.status).toBe(0);

    const robots = build.file("robots.txt");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://dhaivat.dev/sitemap-index.xml");

    expect(sitemapLocs(build.file("sitemap-index.xml"))).toEqual(["https://dhaivat.dev/sitemap-0.xml"]);

    const urls = sitemapLocs(build.file("sitemap-0.xml"));
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://dhaivat.dev/",
        "https://dhaivat.dev/projects",
        "https://dhaivat.dev/projects/published",
      ]),
    );
    expect(urls).toHaveLength(3);
    expect(urls.join("\n")).not.toContain("wip");
    expect(urls.join("\n")).not.toContain("404");
    expect(urls.join("\n")).not.toContain("/contact/");
    for (const url of urls) {
      expect(url).not.toMatch(/\.html$/);
      if (url !== "https://dhaivat.dev/") expect(url).not.toMatch(/\/$/);
    }

    for (const route of ["/contact/sent", "/contact/error"]) {
      const html = build.page(route);
      expect(html).not.toBeNull();
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html).not.toContain('<link rel="canonical"');
    }
  });

  test("includes a _headers rule adding X-Robots-Tag: noindex on the pages.dev alias", () => {
    const build = buildWithFixture("valid");
    expect(build.status).toBe(0);
    const headers = build.file("_headers");
    expect(headers).toMatch(/^https:\/\/[^\s]+\.pages\.dev\/\*$/m);
    expect(headers).toMatch(/^\s+X-Robots-Tag:\s*noindex$/m);
  });
});

describe("production-only analytics", () => {
  test("omits Umami and Cloudflare Web Analytics scripts when SITE_ENV is not production", () => {
    const build = buildWithFixture("valid");
    expect(build.status).toBe(0);
    for (const route of ["/", "/projects", "/projects/full"]) {
      const html = build.page(route) ?? "";
      expect(html).not.toContain("cloud.umami.is/script.js");
      expect(html).not.toContain("static.cloudflareinsights.com/beacon.min.js");
    }
  });

  test("renders Umami and Cloudflare Web Analytics scripts when SITE_ENV=production", () => {
    const build = buildWithFixture("valid", { env: { SITE_ENV: "production" } });
    expect(build.status).toBe(0);
    for (const route of ["/", "/projects", "/projects/full"]) {
      const html = build.page(route) ?? "";
      expect(html).toMatch(/<script[^>]+src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*data-website-id="[^"]+"/);
      expect(html).toMatch(
        /<script[^>]+src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"[^>]*data-cf-beacon=/,
      );
    }
  });
});

describe("Personal project media", () => {
  // The pass case for each rule is the `valid` fixture: `full` has a clip in
  // public/full/ and a poster next to its MDX, `minimal` an image next to its MDX.

  test.each([
    ["clip", "missing-clip", "public/gone/hero.mp4"],
    ["image", "missing-image", "gone/hero.png"],
    ["poster", "missing-poster", "gone/hero-poster.jpg"],
  ])("a referenced %s that's missing fails the build, naming the project and the file", (_, fixture, file) => {
    const { status, output } = buildWithFixture(fixture);
    expect(status).not.toBe(0);
    expect(output).toContain('Personal project "gone"');
    expect(output).toContain(file);
    expect(output).toMatch(/doesn't exist/);
  });
});

describe("Personal project media size caps", () => {
  // The sized file is written just before each build (and is gitignored), so
  // multi-megabyte files never live in the repo.
  const fixtures = resolve(import.meta.dirname, "fixtures");

  /** Writes a real JPEG (the fixture's poster) padded after its end marker to `size` bytes, so it still decodes. */
  function writePaddedJpeg(fixture: string, file: string, size: number): void {
    const jpeg = readFileSync(join(fixtures, fixture, "sized/hero-poster.jpg"));
    writeFileSync(join(fixtures, fixture, "sized", file), Buffer.concat([jpeg, Buffer.alloc(size - jpeg.length)]));
  }

  afterEach(() => {
    rmSync(join(fixtures, "clip-size/public/sized/hero.mp4"), { force: true });
    rmSync(join(fixtures, "image-size/sized/hero.jpg"), { force: true });
    rmSync(join(fixtures, "body-image-size/sized/approach-shot.jpg"), { force: true });
  });

  test("a clip of exactly 4 MB passes; one byte more fails, naming the project, the file and the cap", () => {
    const clip = join(fixtures, "clip-size/public/sized/hero.mp4");
    mkdirSync(dirname(clip), { recursive: true });

    writeFileSync(clip, Buffer.alloc(4_000_000));
    expect(buildWithFixture("clip-size").status).toBe(0);

    writeFileSync(clip, Buffer.alloc(4_000_001));
    const { status, output } = buildWithFixture("clip-size");
    expect(status).not.toBe(0);
    expect(output).toContain('Personal project "sized"');
    expect(output).toContain("public/sized/hero.mp4 is 4 MB");
    expect(output).toContain("clips must be at most 4 MB");
  });

  test("a source image of exactly 1 MB passes; one byte more fails, naming the project, the file and the cap", () => {
    writePaddedJpeg("image-size", "hero.jpg", 1_000_000);
    const atCap = buildWithFixture("image-size");
    expect(atCap.status).toBe(0);

    writePaddedJpeg("image-size", "hero.jpg", 1_000_001);
    const { status, output } = buildWithFixture("image-size");
    expect(status).not.toBe(0);
    expect(output).toContain('Personal project "sized"');
    expect(output).toContain("sized/hero.jpg is 1 MB");
    expect(output).toContain("source images must be at most 1 MB");
  });

  test("an image imported in the body of exactly 1 MB passes; one byte more fails, naming the project and the file", () => {
    writePaddedJpeg("body-image-size", "approach-shot.jpg", 1_000_000);
    expect(buildWithFixture("body-image-size").status).toBe(0);

    writePaddedJpeg("body-image-size", "approach-shot.jpg", 1_000_001);
    const { status, output } = buildWithFixture("body-image-size");
    expect(status).not.toBe(0);
    expect(output).toContain('Personal project "sized"');
    expect(output).toContain("sized/approach-shot.jpg is 1 MB");
  });
});

describe("Personal project media alt and caption", () => {
  // The pass case is the `valid` fixture: its frontmatter media and the clip
  // and image in `full`'s body all have an alt and a caption.

  test.each([
    ["alt", "missing-alt"],
    ["caption", "missing-caption"],
  ])("frontmatter media with no %s fails the build, naming the project and the field", (field, fixture) => {
    const { status, output } = buildWithFixture(fixture);
    expect(status).not.toBe(0);
    expect(output).toContain("bare");
    expect(output).toMatch(new RegExp(`media\\.${field}.*required`, "is"));
  });

  test.each([
    ["alt", "body-missing-alt", 'has media (body-clip.mp4) with no alt'],
    ["caption", "body-missing-caption", "has media (an image) with no caption"],
  ])("a <Media> in the body with no %s fails the build, naming the project", (_, fixture, message) => {
    const { status, output } = buildWithFixture(fixture);
    expect(status).not.toBe(0);
    expect(output).toContain(`Personal project "bare" ${message}`);
  });

  test("frontmatter media with a blank alt fails the build, naming the project and the field", () => {
    const { status, output } = buildWithFixture("blank-alt");
    expect(status).not.toBe(0);
    expect(output).toContain("bare");
    expect(output).toMatch(/media\.alt/);
  });

  test("a <Media> in the body given an image file name instead of an import fails the build, naming the project", () => {
    const { status, output } = buildWithFixture("body-string-image");
    expect(status).not.toBe(0);
    expect(output).toContain('Personal project "bare" passes "body-shot.png" to Media');
    expect(output).toContain("import images instead");
  });

  test("a clip with no poster fails the build, naming the project and the clip", () => {
    const { status, output } = buildWithFixture("clip-no-poster");
    expect(status).not.toBe(0);
    expect(output).toContain('Personal project "bare" has clip "hero.mp4" with no poster');
  });

  test("the body's clip and image render in framed figures with their captions", () => {
    const html = buildWithFixture("valid").page("/projects/full")!;
    expect(html).toMatch(/<video[^>]*aria-label="The clip in the body, alt\."/);
    expect(html).toContain('data-src="/full/approach-demo.mp4"');
    expect(html).toMatch(/<img[^>]*alt="The image in the body, alt\."/);
    expect(text(html)).toContain("The clip in the body, caption.");
    expect(text(html)).toContain("The image in the body, caption.");
  });
});
