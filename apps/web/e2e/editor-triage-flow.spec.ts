import { expect, test } from "@playwright/test";

const editorEmail = process.env.E2E_EDITOR_EMAIL ?? "editor@publisher.local";
const editorPassword = process.env.E2E_EDITOR_PASSWORD ?? "password123";

test("editor triage flow: assign editor, invite reviewer, deadline guardrail", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill(editorEmail!);
  await page.getByLabel("Password").fill(editorPassword!);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/dashboard/editor");
  await expect(page.getByRole("heading", { name: "Editorial Queue" })).toBeVisible();
  await page.getByLabel("Journal").selectOption("demo-journal");

  const firstCard = page.locator("section .list .list-item").filter({ hasText: "DEMO-JOURNAL-2026-000001" }).first();
  await expect(firstCard).toBeVisible();
  const assignSelect = firstCard.locator("select").nth(0);
  const reviewerSelect = firstCard.locator("select").nth(1);
  const respondInput = firstCard.locator('input[id^="respond-by-"]');
  const dueInput = firstCard.locator('input[id^="due-at-"]');
  const assignButton = firstCard.getByRole("button", { name: "Assign Editor" });
  const inviteButton = firstCard.getByRole("button", { name: "Invite Reviewer" });

  const editorValue = await assignSelect.locator("option").filter({ hasText: "editor@publisher.local" }).first().getAttribute("value");
  expect(editorValue).toBeTruthy();
  await assignSelect.selectOption(editorValue!);
  await assignButton.click();
  await expect(page.getByText("Handling editor assigned.")).toBeVisible();

  const reviewerValue = await reviewerSelect
    .locator("option")
    .filter({ hasText: "reviewer@publisher.local" })
    .first()
    .getAttribute("value");
  expect(reviewerValue).toBeTruthy();
  await reviewerSelect.selectOption(reviewerValue!);

  await respondInput.fill("2026-12-31T18:00");
  await dueInput.fill("2026-12-30T18:00");
  await expect(firstCard.getByText("Respond By must be earlier than or equal to Due At.")).toBeVisible();
  await expect(inviteButton).toBeDisabled();

  await dueInput.fill("2027-01-10T18:00");
  await expect(firstCard.getByText("Respond By must be earlier than or equal to Due At.")).toHaveCount(0);
  await expect(inviteButton).toBeEnabled();

  await inviteButton.click();
  const invitedMessage = page.getByText("Reviewer invited.");
  const alert = page.locator(".alert").first();
  await Promise.race([
    invitedMessage.waitFor({ state: "visible", timeout: 15000 }),
    alert.waitFor({ state: "visible", timeout: 15000 }),
  ]);
});
