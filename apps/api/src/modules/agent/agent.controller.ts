import { Controller, Get } from "@nestjs/common";

@Controller("agent")
export class AgentController {
  @Get("capabilities")
  capabilities() {
    const siteBase = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SERVICE_URL_WEB ?? null;
    const apiBase = process.env.SERVICE_URL_API ?? null;
    return {
      name: "Publication Platform API",
      version: "1.1",
      basePath: "/api/v1",
      protocol: "https",
      discovery: {
        health: "/api/v1/health",
        readiness: "/api/v1/health/ready",
        capabilities: "/api/v1/agent/capabilities",
        llms: siteBase ? `${siteBase}/llms.txt` : null,
        wellKnownAgent: siteBase ? `${siteBase}/.well-known/agent.json` : null,
        robots: siteBase ? `${siteBase}/robots.txt` : null,
        sitemap: siteBase ? `${siteBase}/sitemap.xml` : null,
      },
      auth: {
        mode: "session-cookie",
        loginEndpoint: "/api/v1/auth/login",
        logoutEndpoint: "/api/v1/auth/logout",
        sessionContextEndpoint: "/api/v1/auth/nav-context",
        supportsProgrammaticReadOnlyAccess: true,
        notes: [
          "Primary web auth is session-based.",
          "Agents should use dedicated least-privilege credentials for authenticated workflows.",
          "Public metadata endpoints under /api/v1/public/* do not require login.",
        ],
      },
      endpointGroups: {
        publicReadOnly: [
          "/api/v1/public/journals",
          "/api/v1/public/journals/{journalSlug}",
          "/api/v1/public/journals/{journalSlug}/policies",
          "/api/v1/public/articles/{articleId}",
          "/api/v1/health",
          "/api/v1/health/ready",
          "/api/v1/agent/capabilities",
        ],
        authenticatedEditorial: [
          "/api/v1/auth/*",
          "/api/v1/journals/*",
          "/api/v1/submissions/*",
          "/api/v1/editor/*",
          "/api/v1/reviewer/*",
          "/api/v1/publishing/*",
          "/api/v1/queues/*",
        ],
      },
      domains: {
        website: siteBase,
        api: apiBase,
      },
      features: [
        "journals",
        "public-journal-metadata",
        "public-article-metadata",
        "policy-discovery",
        "policies",
        "submissions",
        "editorial-workflow",
        "publishing",
        "storage",
        "reviewer-workflow",
      ],
      rateLimits: {
        generalWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
        generalMax: Number(process.env.RATE_LIMIT_MAX ?? 120),
        authMax: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
      },
      responseFormat: {
        mediaTypes: ["application/json"],
        encoding: "utf-8",
      },
      support: {
        contact: process.env.SMTP_FROM ?? null,
        docs: "/docs/SEO_AI_AGENT_EXECUTION_CHECKLIST.md",
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
