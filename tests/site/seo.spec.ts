import { expect, test } from "@playwright/test";

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
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Placeholder: a bot that sends birthday and festival wishes on WhatsApp on time, so nobody gets forgotten.",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://dhaivat.dev/projects/whatsapp-auto-wish-bot",
    );
  });

  test("Home page includes Person JSON-LD", async ({ page }) => {
    await page.goto("/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    expect(raw).not.toBeNull();
    const ld = JSON.parse(raw!);
    expect(ld).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": "https://dhaivat.dev/#person",
      name: "Dhaivat Patel",
      jobTitle: "Software Engineer",
      worksFor: { "@type": "Organization", name: "Amazon Ads" },
      url: "https://dhaivat.dev",
      alumniOf: { "@type": "CollegeOrUniversity", name: "Rutgers University" },
    });
    expect(ld.image).toMatch(/^https:\/\/dhaivat\.dev\/.+/);
    expect(ld.sameAs).toEqual(
      expect.arrayContaining([
        "https://github.com/Dhaivat717",
        "https://www.linkedin.com/in/dhaivat-h-patel/",
      ]),
    );
  });

  test("a Deep dive includes SoftwareSourceCode JSON-LD referencing the Home Person", async ({ page }) => {
    await page.goto("/projects/whatsapp-auto-wish-bot");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    expect(raw).not.toBeNull();
    const ld = JSON.parse(raw!);
    expect(ld).toMatchObject({
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: "WhatsApp Auto-Wish Bot",
      description:
        "Placeholder: a bot that sends birthday and festival wishes on WhatsApp on time, so nobody gets forgotten.",
      codeRepository: "https://github.com/Dhaivat717/birthday_festival_wish_bot_whatsapp",
      programmingLanguage: ["Node.js", "WhatsApp"],
      author: {
        "@type": "Person",
        "@id": "https://dhaivat.dev/#person",
        name: "Dhaivat Patel",
        url: "https://dhaivat.dev",
      },
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
});
