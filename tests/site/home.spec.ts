import { expect, test, type Page } from "@playwright/test";

/** Records the initial `[data-about-editor]` textContent at `DOMContentLoaded` before subsequent timer ticks. */
async function recordInitialEditorText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as unknown as { __editorInitial?: string };
    document.addEventListener("DOMContentLoaded", () => {
      const el = document.querySelector("[data-about-editor]");
      win.__editorInitial = el?.textContent ?? "";
    });
  });
}

async function readInitialEditorText(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __editorInitial?: string }).__editorInitial ?? "");
}

test("Home page shows name, role and employer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dhaivat Patel");
  await expect(page.getByText("Software Engineer", { exact: true })).toBeVisible();
  await expect(page.getByText("Amazon Ads", { exact: true }).first()).toBeVisible();
});

test("hero renders two equal-height columns with the ID card, stat boxes and CTA buttons", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const hero = page.locator("[data-hero]");
  const idCard = hero.locator(".idcard");
  const rightCol = hero.locator(".rightcol");
  await expect(idCard).toBeVisible();
  await expect(rightCol).toBeVisible();

  const cardBox = (await idCard.boundingBox())!;
  const rightBox = (await rightCol.boundingBox())!;
  expect(Math.abs(cardBox.height - rightBox.height)).toBeLessThanOrEqual(2);

  // Portrait photo has meaningful alt text and eager/high-priority loading for LCP.
  const photo = idCard.getByRole("img", { name: "Dhaivat Patel" });
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("loading", "eager");
  await expect(photo).toHaveAttribute("fetchpriority", "high");

  // Intro and GitHub / LinkedIn links on the ID card.
  await expect(idCard).toContainText(
    "Software engineer, building scalable distributed backend systems, public APIs and practical AI Agents.",
  );
  await expect(idCard.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/Dhaivat717",
  );
  await expect(idCard.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/dhaivat-h-patel/",
  );

  // Three stat boxes: 5+ years · Masters Computer Science, Rutgers (decorative logo alt="") · N GitHub contributions linking to GitHub.
  const stats = rightCol.locator(".stats");
  await expect(stats).toContainText("5+");
  await expect(stats).toContainText("Years of experience");
  await expect(stats).toContainText("Masters");
  await expect(stats).toContainText("Computer Science, Rutgers");
  await expect(stats.locator("img")).toHaveAttribute("alt", "");

  const ghStat = stats.getByRole("link", { name: /GitHub contributions/ });
  await expect(ghStat).toHaveAttribute("href", "https://github.com/Dhaivat717");
  await expect(ghStat).toContainText("30");
  await expect(ghStat).toContainText("Last 12 months");

  // Résumé and Get in touch buttons.
  const resumeBtn = rightCol.getByRole("link", { name: "Download résumé" });
  await expect(resumeBtn).toHaveAttribute("href", "/resume.pdf");
  const contactBtn = rightCol.getByRole("link", { name: "Get in touch" });
  await expect(contactBtn).toHaveAttribute("href", "#contact");
});

test("the about.md editor types out its text on load and again on reload without resizing the hero columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await recordInitialEditorText(page);
  await page.goto("/");
  const editor = page.locator("[data-about-editor]");
  const idCard = page.locator("[data-hero] .idcard");
  await expect(editor).toBeVisible();

  // At DOMContentLoaded, the editor starts empty/mid-typing (before the final paragraph).
  expect(await readInitialEditorText(page)).not.toContain("Projects section below.");
  const typingEditorHeight = (await editor.boundingBox())!.height;
  const typingCardHeight = (await idCard.boundingBox())!.height;

  // Wait for typing to finish.
  await expect(editor).toHaveAttribute("data-typed", "done", { timeout: 25_000 });
  const doneEditorHeight = (await editor.boundingBox())!.height;
  const doneCardHeight = (await idCard.boundingBox())!.height;
  expect(Math.abs(typingEditorHeight - doneEditorHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(typingCardHeight - doneCardHeight)).toBeLessThanOrEqual(2);
  await expect(editor).toContainText("Hi, I’m Dhaivat.");
  await expect(editor).toContainText(
    "I’m a software engineer based in the NYC area. I am currently at Amazon Ads, where I build the APIs and platforms that advertisers use in 19+ marketplaces. Recently, I built an LLM on-call agent that runs 1,000+ investigations",
  );
  await expect(editor).toContainText("Off the clock");
  await expect(editor).toContainText("How I work");
  await expect(editor).toContainText("Projects section below.");

  // Reloading runs the typing animation again rather than skipping it.
  await page.reload();
  expect(await readInitialEditorText(page)).not.toContain("Projects section below.");
  await expect(editor).toHaveAttribute("data-typed", "typing");
});

test.describe("with prefers-reduced-motion: reduce", () => {
  test.use({ reducedMotion: "reduce" });

  test("the full about.md editor text renders immediately without typing", async ({ page }) => {
    await recordInitialEditorText(page);
    await page.goto("/");
    const editor = page.locator("[data-about-editor]");
    expect(await readInitialEditorText(page)).toContain("Projects section below.");
    await expect(editor).toHaveAttribute("data-typed", "done");
    await expect(editor).toContainText("Hi, I’m Dhaivat.");
    await expect(editor).toContainText("Off the clock");
    await expect(editor).toContainText("How I work");
    await expect(editor).toContainText("Projects section below.");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the full about.md editor text and baked contributions number render immediately", async ({
    page,
  }) => {
    await page.goto("/");
    const editor = page.locator("[data-about-editor]");
    await expect(editor).toBeVisible();
    await expect(editor).toContainText("Hi, I’m Dhaivat.");
    await expect(editor).toContainText("1,000+ investigations");
    await expect(editor).toContainText("Off the clock");
    await expect(editor).toContainText("How I work");
    await expect(editor).toContainText("Projects section below.");

    const ghStat = page.getByRole("link", { name: /GitHub contributions/ });
    await expect(ghStat).toBeVisible();
    await expect(ghStat).toContainText("30");
    await expect(ghStat).toHaveAttribute("href", "https://github.com/Dhaivat717");
  });
});

test("'Skip to content' is the first focusable element and moves focus to the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("Home page has the Section anchors later tickets fill", async ({ page }) => {
  await page.goto("/");
  for (const id of ["experience", "projects", "contact"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
});

test("footer links to GitHub and LinkedIn and shows the year, with no raw email", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", /github\.com\//);
  await expect(footer.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", /linkedin\.com\//);
  await expect(footer).toContainText(String(new Date().getFullYear()));
  expect(await page.content()).not.toMatch(/mailto:|[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
});

test("there is exactly one h1 and the document language is English", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("Home Projects band shows Featured projects as rows and links to /projects", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("#projects");
  await expect(section.getByRole("heading", { level: 2 })).toHaveText("Projects");
  await expect(section.locator(".project-list")).toHaveCSS("border-top-width", "1px");

  const row = section.getByRole("link", { name: /WhatsApp Auto-Wish Bot/ });
  await expect(row).toHaveAttribute("href", "/projects/whatsapp-auto-wish-bot");
  await expect(row.locator("svg")).toBeVisible();
  await expect(row.getByRole("heading", { level: 3, name: "WhatsApp Auto-Wish Bot" })).toBeVisible();
  await expect(row.getByRole("list", { name: "Stack" }).getByRole("listitem").first()).toBeVisible();
  await expect(row).toContainText("read →");

  const allProjects = section.getByRole("link", { name: "All projects →" });
  await expect(allProjects).toHaveAttribute("href", "/projects");
  await allProjects.click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("Experience section shows all five roles newest first without tabs, with loaded logos in white rounded squares", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const section = page.locator("#experience");
  await expect(section.getByRole("heading", { level: 2 })).toHaveText("Experience");
  await expect(section.getByRole("tab")).toHaveCount(0);

  const roles = section.locator("[data-role]");
  await expect(roles).toHaveCount(5);

  const headings = await roles.locator("h3").allInnerTexts();
  expect(headings).toEqual([
    "Software Development Engineer @ Amazon Ads",
    "Software Engineer @ Invidi Technologies",
    "SDE Intern @ Amazon",
    "Accessibility Developer @ Rutgers University",
    "Software Developer @ BoTree Technologies",
  ]);

  for (let i = 0; i < 5; i++) {
    const role = roles.nth(i);
    await expect(role).toBeVisible();
    const logoBox = role.locator(".logo-box");
    const img = logoBox.locator("img");
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();
    const alt = await img.getAttribute("alt");
    expect(alt?.trim().length).toBeGreaterThan(0);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    const boxStyle = await logoBox.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        radius: parseFloat(s.borderTopLeftRadius),
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      };
    });
    expect(boxStyle.bg).toBe("rgb(255, 255, 255)");
    expect(boxStyle.radius).toBeGreaterThan(0);
    expect(Math.abs(boxStyle.width - boxStyle.height)).toBeLessThanOrEqual(1);
    await expect(role.getByRole("list", { name: "Technologies" })).toHaveCSS("margin-top", "22px");
  }

  // Rutgers role has 2 bullets and no bolded figures.
  const rutgers = section.locator('[data-role="rutgers-accessibility"]');
  await expect(rutgers.locator("[data-bullets] li")).toHaveCount(2);
  await expect(rutgers.locator("[data-bullets] strong")).toHaveCount(0);
});

test("Experience left column stays sticky while reading a role on desktop and stacks on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/");

  const firstRole = page.locator('#experience [data-role="amazon-ads"]');
  const side = firstRole.locator(".side");
  const details = firstRole.locator(".details");

  expect(await side.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");

  // Scroll down into the middle of the first role's bullets so sticky kicks in.
  await firstRole.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top + 140, behavior: "instant" });
  });

  const sideBox = (await side.boundingBox())!;
  const detailsBox = (await details.boundingBox())!;
  // Left column stays pinned below the nav while details have scrolled above it.
  expect(sideBox.y).toBeGreaterThanOrEqual(52);
  expect(sideBox.y).toBeLessThanOrEqual(100);
  expect(detailsBox.y).toBeLessThan(sideBox.y);

  // On phones, the left column is static and stacks above the bullets.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await side.evaluate((el) => getComputedStyle(el).position)).toBe("static");
  const mobileSide = (await side.boundingBox())!;
  const mobileDetails = (await details.boundingBox())!;
  expect(mobileSide.y + mobileSide.height).toBeLessThanOrEqual(mobileDetails.y + 1);
});

test("Experience section works at 320 px width and 200% zoom without horizontal overflow", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 640, height: 400 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const section = page.locator("#experience");
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator("h3")).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(section.locator("h3").nth(i)).toBeVisible();
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(0);
  }
});
