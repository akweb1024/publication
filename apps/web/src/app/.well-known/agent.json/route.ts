import { NextResponse } from "next/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://new.stmjournals.com";
const apiUrl = process.env.NEXT_PUBLIC_API_BASE ?? process.env.SERVICE_URL_API ?? "https://apinew.stmjournals.com/api/v1";

export async function GET() {
  return NextResponse.json(
    {
      name: "STM Journals Agent Descriptor",
      version: "1.0.0",
      website: siteUrl,
      apiBase: apiUrl,
      discovery: {
        llms: `${siteUrl}/llms.txt`,
        robots: `${siteUrl}/robots.txt`,
        sitemap: `${siteUrl}/sitemap.xml`,
        capabilities: `${apiUrl}/agent/capabilities`,
      },
      publicData: {
        journals: `${apiUrl}/public/journals`,
        journalBySlug: `${apiUrl}/public/journals/{journalSlug}`,
        articleById: `${apiUrl}/public/articles/{articleId}`,
        policiesByJournal: `${apiUrl}/public/journals/{journalSlug}/policies`,
      },
      auth: {
        mode: "session-cookie",
        loginEndpoint: `${apiUrl}/auth/login`,
        notes: [
          "Read-only public metadata endpoints do not require login.",
          "Editorial and workflow endpoints require authenticated session access.",
        ],
      },
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
