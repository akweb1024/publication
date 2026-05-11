import { expect, test } from "@playwright/test";

const editorEmail = process.env.E2E_EDITOR_EMAIL ?? "editor@publisher.local";
const editorPassword = process.env.E2E_EDITOR_PASSWORD ?? "password123";

test("publishing flow: create volume + issue and assign article", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(editorEmail);
  await page.getByLabel("Password").fill(editorPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/publishing");
  await expect(page.getByRole("heading", { name: "Publishing Operations" })).toBeVisible();
  await page.getByRole("combobox").first().selectOption("demo-journal");

  const nonce = (Date.now() % 900000) + 100000;
  await page.getByLabel("Volume year").fill("2026");
  await page.getByLabel("Volume number").fill(String(nonce));
  await page.getByRole("button", { name: "Create Volume" }).click();
  await expect(page.getByText("Volume created.")).toBeVisible();

  const volumeSelect = page.getByLabel("Parent volume");
  await volumeSelect.selectOption({ index: 1 });
  await page.getByLabel("Issue number").fill(String((nonce % 900) + 1));
  await page.getByLabel("Issue title").fill(`Automation Issue ${nonce}`);
  await page.getByRole("button", { name: "Create Issue" }).click();
  await expect(page.getByText("Issue created.")).toBeVisible();

  const articleCard = page.locator("section .list .list-item").filter({ hasText: "DEMO-JOURNAL-2026-000099" }).first();
  await expect(articleCard).toBeVisible();
  const issueSelect = articleCard.locator("select").first();
  const createdIssueValue = await issueSelect
    .locator("option")
    .filter({ hasText: `Automation Issue ${nonce}` })
    .first()
    .getAttribute("value");
  expect(createdIssueValue).toBeTruthy();
  await issueSelect.selectOption(createdIssueValue!);
  await articleCard.getByRole("button", { name: "Assign Issue" }).click();
  await expect(page.getByText("Article assigned to issue.")).toBeVisible();
});
