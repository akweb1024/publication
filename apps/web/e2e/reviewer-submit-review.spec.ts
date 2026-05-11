import { expect, test } from "@playwright/test";

const reviewerEmail = process.env.E2E_REVIEWER_EMAIL ?? "reviewer@publisher.local";
const reviewerPassword = process.env.E2E_REVIEWER_PASSWORD ?? "password123";
const seededTrackingNumber = "DEMO-JOURNAL-2026-REVIEW-E2E";

test("reviewer flow: accept assignment and submit review", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(reviewerEmail);
  await page.getByLabel("Password").fill(reviewerPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/dashboard/reviewer");
  await expect(page.getByRole("heading", { name: "Reviewer Assignments" })).toBeVisible();

  const assignment = page.locator("section .list .list-item").filter({ hasText: seededTrackingNumber }).first();
  await expect(assignment).toBeVisible();
  const acceptButton = assignment.getByRole("button", { name: "Accept" });
  if (await acceptButton.isVisible()) {
    await acceptButton.click();
  }

  await assignment.getByLabel("Recommendation").selectOption("MAJOR");
  await assignment.getByLabel("Comments to Author").fill("Please strengthen methods and provide clearer figure legends.");
  await assignment.getByLabel("Comments to Editor (optional)").fill("Sound work but revisions are required.");
  await assignment.getByRole("button", { name: "Submit Review" }).click();
  await expect(page.getByText("Review submitted.")).toBeVisible();
});
