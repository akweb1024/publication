import { expect, test } from "@playwright/test";

test("article page exposes citation + Dublin Core meta tags in SSR HTML", async ({ page, request }) => {
  await page.goto("/ijsu/archive");
  await expect(page.getByRole("heading", { name: /Volumes & Issues/i })).toBeVisible();

  const firstArticleLink = page.locator('a[href*="/ijsu/articles/"]').first();
  await expect(firstArticleLink).toBeVisible();
  const href = await firstArticleLink.getAttribute("href");
  expect(href, "Expected archive to contain at least one article link").toBeTruthy();

  const articlePath = href!;
  const articleUrl = new URL(articlePath, page.url()).toString();
  const res = await request.get(articleUrl);
  expect(res.ok()).toBeTruthy();
  const html = await res.text();

  expect(html).toContain('name="citation_title"');
  expect(html).toContain('name="citation_journal_title"');
  expect(html).toContain('name="citation_publication_date"');
  expect(html).toContain('name="citation_abstract_html_url"');
  expect(html).toContain('name="DC.Title"');
  expect(html).toContain('name="DC.Description"');
  expect(html).toContain('name="DC.Identifier"');
  expect(html).toContain('name="DC.Source"');
  expect(html).toContain('name="DC.Type"');
  expect(html).toContain("application/ld+json");

  await page.goto(articlePath);
  await expect(page.locator('meta[name="citation_title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="citation_journal_title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="DC.Title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="DC.Identifier"]')).toHaveCount(1);
});
