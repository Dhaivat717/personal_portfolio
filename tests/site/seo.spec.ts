import { expect, test } from "@playwright/test";
import { discoverRoutes } from "../../scripts/routes.ts";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function readSummaryPitch(page: import("@playwright/test").Page): Promise<string> {
  return (await page.getByRole("main").locator("header p").first().textContent())?.trim() ?? "";
}

async function readJsonLd(page: import("@playwright/test").Page): Promise<Record<string, unknown>> {
  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  expect(raw).not.toBeNull();
  return JSON.parse(raw!) as Record<string, unknown>;
}

function findGraphNode(ld: Record<string, unknown>, type: string): Record<string, unknown> | undefined {
  expect(ld["@context"]).toBe("https://schema.org");
  expect(Array.isArray(ld["@graph"])).toBe(true);
  return (ld["@graph"] as Record<string, unknown>[]).find((node) => node["@type"] === type);
}

test.describe("SEO metadata", () => {
  test("Home page has title, description and canonical URL", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Dhaivat Patel · Software Engineer @ Amazon Ads");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /^Software engineer at Amazon Ads with 5\+ years of experience/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://dhaivat.dev/");
  });

  test("/projects has title, description and canonical URL without trailing slash", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveTitle("Projects · Dhaivat Patel");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://dhaivat.dev/projects");
  });

  test("a Deep dive has title, pitch description and canonical URL without trailing slash", async ({ page }) => {
    await page.goto("/projects/whatsapp-auto-wish-bot");
    await expect(page).toHaveTitle("WhatsApp Auto-Wish Bot · Dhaivat Patel");
    const pitch = await readSummaryPitch(page);
    expect(pitch.length).toBeGreaterThan(0);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", pitch);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://dhaivat.dev/projects/whatsapp-auto-wish-bot",
    );
  });

  test("Home page includes WebSite, ProfilePage and enriched Person JSON-LD", async ({ page }) => {
    await page.goto("/");
    const ld = await readJsonLd(page);

    expect(findGraphNode(ld, "WebSite")).toMatchObject({
      "@type": "WebSite",
      "@id": "https://dhaivat.dev/#website",
      url: "https://dhaivat.dev",
      name: "Dhaivat Patel",
      alternateName: ["dhaivat.dev"],
      publisher: { "@id": "https://dhaivat.dev/#person" },
    });

    expect(findGraphNode(ld, "ProfilePage")).toMatchObject({
      "@type": "ProfilePage",
      "@id": "https://dhaivat.dev/#profile",
      url: "https://dhaivat.dev/",
      mainEntity: { "@id": "https://dhaivat.dev/#person" },
      isPartOf: { "@id": "https://dhaivat.dev/#website" },
    });

    const person = findGraphNode(ld, "Person");
    expect(person).toMatchObject({
      "@type": "Person",
      "@id": "https://dhaivat.dev/#person",
      name: "Dhaivat Patel",
      alternateName: ["Dhaivat", "Dhaivat H. Patel"],
      jobTitle: "Software Engineer",
      worksFor: {
        "@type": "Organization",
        name: "Amazon Ads",
        parentOrganization: { "@type": "Organization", name: "Amazon" },
      },
      url: "https://dhaivat.dev",
      alumniOf: { "@type": "CollegeOrUniversity", name: "Rutgers University" },
      homeLocation: { "@type": "Place", name: "New York City" },
    });
    expect(person?.image).toMatch(/^https:\/\/dhaivat\.dev\/.+/);
    expect(person?.knowsAbout).toEqual(
      expect.arrayContaining([
        "Software Development",
        "Distributed Systems",
        "Backend Engineering",
        "Public APIs",
        "AI Agents",
      ]),
    );
    expect(person?.sameAs).toEqual(
      expect.arrayContaining([
        "https://github.com/Dhaivat717",
        "https://www.linkedin.com/in/dhaivat-h-patel/",
      ]),
    );
  });

  test("/projects includes CollectionPage and ItemList JSON-LD listing every Personal project", async ({ page }) => {
    await page.goto("/projects");
    const ld = await readJsonLd(page);
    const linkHrefs = await page
      .getByRole("main")
      .locator("ul a[href^='/projects/']")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(linkHrefs.length).toBeGreaterThan(0);

    expect(ld).toMatchObject({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": "https://dhaivat.dev/projects#collection",
      url: "https://dhaivat.dev/projects",
      name: "Projects · Dhaivat Patel",
      isPartOf: { "@id": "https://dhaivat.dev/#website" },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: linkHrefs.length,
      },
    });
    const mainEntity = ld.mainEntity as { itemListElement: Array<{ "@type": string; position: number; name: string; url: string }> };
    const items = mainEntity.itemListElement;
    expect(items).toHaveLength(linkHrefs.length);
    for (let i = 0; i < linkHrefs.length; i++) {
      expect(items[i]).toMatchObject({
        "@type": "ListItem",
        position: i + 1,
        url: `https://dhaivat.dev${linkHrefs[i]}`,
      });
      expect(items[i].name.length).toBeGreaterThan(0);
    }
  });

  test("a Deep dive includes SoftwareSourceCode and BreadcrumbList JSON-LD referencing the Home Person", async ({
    page,
  }) => {
    await page.goto("/projects/whatsapp-auto-wish-bot");
    const pitch = await readSummaryPitch(page);
    const stack = (
      await page.getByRole("main").getByRole("list", { name: "Stack" }).getByRole("listitem").allTextContents()
    ).map((s) => s.trim());
    const ld = await readJsonLd(page);

    expect(findGraphNode(ld, "SoftwareSourceCode")).toMatchObject({
      "@type": "SoftwareSourceCode",
      name: "WhatsApp Auto-Wish Bot",
      description: pitch,
      url: "https://dhaivat.dev/projects/whatsapp-auto-wish-bot",
      codeRepository: "https://github.com/Dhaivat717/birthday_festival_wish_bot_whatsapp",
      programmingLanguage: stack,
      author: {
        "@type": "Person",
        "@id": "https://dhaivat.dev/#person",
        name: "Dhaivat Patel",
        url: "https://dhaivat.dev",
      },
    });

    expect(findGraphNode(ld, "BreadcrumbList")).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://dhaivat.dev/" },
        { "@type": "ListItem", position: 2, name: "Projects", item: "https://dhaivat.dev/projects" },
        {
          "@type": "ListItem",
          position: 3,
          name: "WhatsApp Auto-Wish Bot",
          item: "https://dhaivat.dev/projects/whatsapp-auto-wish-bot",
        },
      ],
    });
  });

  test("robots.txt allows crawling and points to the sitemap, which lists published pages without trailing slashes", async ({
    request,
  }) => {
    const robotsRes = await request.get("/robots.txt");
    expect(robotsRes.status()).toBe(200);
    const robots = await robotsRes.text();
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://dhaivat.dev/sitemap-index.xml");

    const indexRes = await request.get("/sitemap-index.xml");
    expect(indexRes.status()).toBe(200);
    expect(await indexRes.text()).toContain("<loc>https://dhaivat.dev/sitemap-0.xml</loc>");

    const sitemapRes = await request.get("/sitemap-0.xml");
    expect(sitemapRes.status()).toBe(200);
    const sitemap = await sitemapRes.text();
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(
      expect.arrayContaining([
        "https://dhaivat.dev/",
        "https://dhaivat.dev/projects",
        "https://dhaivat.dev/projects/whatsapp-auto-wish-bot",
      ]),
    );
    expect(locs.join("\n")).not.toContain("404");
    for (const url of locs) {
      expect(url).not.toMatch(/\.html$/);
      if (url !== "https://dhaivat.dev/") expect(url).not.toMatch(/\/$/);
    }
  });

  test("every indexable page's og:image and Twitter card resolve to a 1200×630 PNG", async ({ page, request }) => {
    const routes = discoverRoutes().filter((route) => route !== "/404" && !route.startsWith("/contact/"));
    expect(routes).toEqual(expect.arrayContaining(["/", "/projects"]));

    for (const route of routes) {
      await page.goto(route);
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(ogImage, `${route} should set og:image`).toMatch(/^https:\/\/dhaivat\.dev\/og\/.+\.png$/);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", ogImage!);

      const cardPath = new URL(ogImage!).pathname;
      const res = await request.get(cardPath);
      expect(res.status(), `${cardPath} for ${route} should return 200`).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      const body = await res.body();
      expect(pngDimensions(body), `${cardPath} should be a 1200×630 PNG`).toEqual({ width: 1200, height: 630 });
    }
  });
});
