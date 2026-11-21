import { expect, test } from "@playwright/test";

test("Home page shows name, role and employer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dhaivat Patel");
  await expect(page.getByText("Software Engineer", { exact: true })).toBeVisible();
  await expect(page.getByText("Amazon Ads", { exact: true })).toBeVisible();
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
  await expect(section.getByRole("heading", { level: 2 })).toHaveText("Projects.");

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
