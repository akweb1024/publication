import { NextResponse } from "next/server";

const lines = [
  "User-Agent: *",
  "Allow: /",
  "",
  "# STM Journals - Agent Access Guide",
  "Site: https://new.stmjournals.com",
  "API Base: https://apinew.stmjournals.com/api/v1",
  "",
  "Preferred discovery endpoints:",
  "- /sitemap.xml",
  "- /robots.txt",
  "- /.well-known/agent.json",
  "- /api/v1/health/ready",
  "- /api/v1/agent/capabilities",
  "- /api/v1/public/journals",
  "",
  "Authentication:",
  "- Browser users authenticate via session cookies.",
  "- Programmatic agents should use dedicated API credentials and role-scoped access.",
].join("\n");

export async function GET() {
  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
