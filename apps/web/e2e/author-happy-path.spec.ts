import { expect, test } from "@playwright/test";

function uniqueEmail() {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return `author-${nonce}@example.com`;
}

test("author happy path with autosave and unsaved guardrails", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  const email = uniqueEmail();
  await page.getByLabel("Name").fill("Author Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("author-pass-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Submission Composer" })).toBeVisible();

  const journalSelect = page.locator("#journal");
  await expect(journalSelect).toBeVisible();
  await expect(journalSelect.locator('option[value="demo-journal"]')).toHaveCount(1);
  await journalSelect.selectOption("demo-journal");

  await page.getByRole("button", { name: "Create Draft" }).click();
  await expect(page.getByText("Draft created.")).toBeVisible();

  await page.getByLabel("Manuscript Title").fill("Playwright Submission Title");
  await page.getByLabel("Abstract").fill("Playwright abstract for autosave check.");
  await page.getByLabel("Keywords (comma separated)").fill("playwright,testing");
  await page.getByLabel("Article Type").fill("Research Article");

  await expect(page.getByText(/Autosave:\s*(Saving…|All changes saved)/)).toBeVisible();
  await expect(page.getByText(/Last saved/)).toBeVisible();

  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });

  await page.getByLabel("Manuscript Title").fill("Unsaved edit to trigger guardrail");
  await page.locator("#journal").selectOption("ijsu");
  await expect(dialogs.length).toBeGreaterThan(0);
});
