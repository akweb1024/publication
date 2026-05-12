# SEO + AI Agent Readiness Execution Checklist (Repo-Specific)

This checklist is mapped to the current codebase in:
- `apps/web/src/app/*`
- `apps/api/src/modules/*`
- `docker-compose*.yml` and Dockerfiles

Use this as the sprint execution source of truth.

## Scope and Outcomes

Primary outcomes:
1. Better UX navigation and page hierarchy for humans.
2. Better crawlability, metadata quality, and structured data for search engines.
3. Better machine readability and discovery for AI agents, chatbots, and AI search tools.

---

## Sprint 0 (Baseline and Guardrails)

### 0.1 Baseline checks
- [ ] Run production build and record baseline.
  - Command: `npm run build`
- [ ] Run API readiness baseline.
  - Endpoint: `GET /api/v1/health/ready`
- [ ] Validate discovery baseline.
  - Endpoints: `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/api/v1/agent/capabilities`

### 0.2 Deployment guardrails
- [ ] Confirm these files are deployment source of truth:
  - [docker-compose.coolify.yml](/home/itb09/Desktop/test/publication/docker-compose.coolify.yml)
  - [Dockerfile.api](/home/itb09/Desktop/test/publication/Dockerfile.api)
  - [Dockerfile.web](/home/itb09/Desktop/test/publication/Dockerfile.web)
  - [Dockerfile.worker](/home/itb09/Desktop/test/publication/Dockerfile.worker)
  - [Dockerfile.migrate](/home/itb09/Desktop/test/publication/Dockerfile.migrate)
- [ ] Confirm runtime env consistency against:
  - [docs/COOLIFY_ENV_FRESH_TEMPLATE.env](/home/itb09/Desktop/test/publication/docs/COOLIFY_ENV_FRESH_TEMPLATE.env)
  - [docs/COOLIFY_DEPLOYMENT.md](/home/itb09/Desktop/test/publication/docs/COOLIFY_DEPLOYMENT.md)

Acceptance:
- Builds pass locally and on Coolify.
- All discovery endpoints return `200`.

---

## Sprint 1 (Navigation, IA, and Internal Linking)

### 1.1 Navigation clarity
- [ ] Add a dedicated journals directory route if needed (`/journals`) and link from top nav.
  - Files:
    - [apps/web/src/app/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/page.tsx)
    - [apps/web/src/app/layout.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/layout.tsx)
    - TopNav component (if external to app folder)
- [ ] Ensure role pages are visible in nav/footer and internally linked:
  - [apps/web/src/app/authors/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/authors/page.tsx)
  - [apps/web/src/app/readers/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/readers/page.tsx)
  - [apps/web/src/app/editors/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/editors/page.tsx)
  - [apps/web/src/app/subscribers/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/subscribers/page.tsx)

### 1.2 Breadcrumbs + related links
- [ ] Add breadcrumbs on deep pages:
  - [apps/web/src/app/[journalSlug]/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/page.tsx)
  - [apps/web/src/app/[journalSlug]/archive/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/archive/page.tsx)
  - [apps/web/src/app/[journalSlug]/archive/volumes/[volumeId]/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/archive/volumes/[volumeId]/page.tsx)
  - [apps/web/src/app/[journalSlug]/archive/issues/[issueId]/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/archive/issues/[issueId]/page.tsx)
  - [apps/web/src/app/[journalSlug]/articles/[articleId]/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/articles/[articleId]/page.tsx)
  - [apps/web/src/app/[journalSlug]/policies/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/policies/page.tsx)
  - [apps/web/src/app/[journalSlug]/policies/[key]/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/policies/[key]/page.tsx)
- [ ] Add “Related pages” sections to role and policy pages.
  - [apps/web/src/app/policies/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/policies/page.tsx)
  - [apps/web/src/app/about/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/about/page.tsx)

Acceptance:
- All indexable pages reachable in <= 3 clicks from home.
- Every deep page has breadcrumb trail and at least 3 contextual internal links.

---

## Sprint 2 (Metadata, Canonicals, Open Graph, Page Semantics)

### 2.1 Shared metadata model
- [ ] Create shared metadata builder utility for App Router pages.
  - Suggested file: `apps/web/src/lib/seo.ts`
- [ ] Add per-page `metadata`/`generateMetadata` for all public pages.
  - Files under: [apps/web/src/app](/home/itb09/Desktop/test/publication/apps/web/src/app)

### 2.2 Canonical and social metadata
- [ ] Add canonical URL output from `NEXT_PUBLIC_SITE_URL`.
  - [apps/web/src/app/layout.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/layout.tsx)
- [ ] Add Open Graph and Twitter metadata for:
  - Home, journal, article, policy, and role pages.

### 2.3 Semantic HTML and accessibility
- [ ] Confirm one `h1` per page and logical heading order.
- [ ] Ensure landmarks exist: `header`, `nav`, `main`, `footer`.
  - [apps/web/src/app/layout.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/layout.tsx)
- [ ] Add “Skip to content” link in layout.

Acceptance:
- Metadata present and unique on each public route.
- No heading-order or landmark accessibility regressions.

---

## Sprint 3 (Schema.org JSON-LD and Scholarly Metadata)

### 3.1 Site and org schema
- [ ] Inject JSON-LD for `Organization` and `WebSite` (+ `SearchAction`) in root layout.
  - [apps/web/src/app/layout.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/layout.tsx)

### 3.2 Journal and article schema
- [ ] Add `Periodical` schema on journal-level pages.
  - [apps/web/src/app/[journalSlug]/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/page.tsx)
- [ ] Add `ScholarlyArticle` schema on article pages.
  - [apps/web/src/app/[journalSlug]/articles/[articleId]/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/[journalSlug]/articles/[articleId]/page.tsx)

### 3.3 Citation meta tags
- [ ] Add citation tags on article pages:
  - `citation_title`
  - `citation_author`
  - `citation_publication_date`
  - `citation_journal_title`
  - `citation_doi`
  - `citation_pdf_url` (if available)

Acceptance:
- Rich Results and schema validation pass for at least one journal page and one article page.

---

## Sprint 4 (FAQ Snippets + Role and Policy Content Depth)

### 4.1 FAQ blocks for snippet capture
- [ ] Add FAQ sections + `FAQPage` schema:
  - [apps/web/src/app/authors/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/authors/page.tsx)
  - [apps/web/src/app/editors/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/editors/page.tsx)
  - [apps/web/src/app/readers/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/readers/page.tsx)
  - [apps/web/src/app/subscribers/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/subscribers/page.tsx)
  - [apps/web/src/app/policies/page.tsx](/home/itb09/Desktop/test/publication/apps/web/src/app/policies/page.tsx)

### 4.2 Content expansion for AI summaries
- [ ] Add consistent “Quick facts” blocks to journal and policy pages.
  - Fields: review model, publication frequency, scope, ethics summary, indexing status.

Acceptance:
- FAQ schema valid and visible in page source.
- Role/policy pages contain concise Q/A and machine-readable factual blocks.

---

## Sprint 5 (Agent Discovery, Machine-Readable Endpoints, Crawl Optimization)

### 5.1 Agent discovery hardening
- [x] Keep and maintain:
  - [apps/web/src/app/llms.txt/route.ts](/home/itb09/Desktop/test/publication/apps/web/src/app/llms.txt/route.ts)
  - [apps/web/src/app/robots.ts](/home/itb09/Desktop/test/publication/apps/web/src/app/robots.ts)
  - [apps/web/src/app/sitemap.ts](/home/itb09/Desktop/test/publication/apps/web/src/app/sitemap.ts)
  - [apps/api/src/modules/agent/agent.controller.ts](/home/itb09/Desktop/test/publication/apps/api/src/modules/agent/agent.controller.ts)

### 5.2 Add well-known machine-readable descriptor
- [ ] Add `/.well-known/agent.json` route in web app.
  - Suggested file: `apps/web/src/app/.well-known/agent.json/route.ts`
  - Include: site URL, API base URL, auth mode, discovery links.

### 5.3 Expand capabilities contract
- [ ] Extend `/api/v1/agent/capabilities` with:
  - versioning
  - endpoint categories
  - auth requirements by endpoint class
  - rate-limit hints
  - contact/support URL
- [ ] Keep module wired in:
  - [apps/api/src/modules/agent/agent.module.ts](/home/itb09/Desktop/test/publication/apps/api/src/modules/agent/agent.module.ts)
  - [apps/api/src/modules/app.module.ts](/home/itb09/Desktop/test/publication/apps/api/src/modules/app.module.ts)

### 5.4 Public data endpoints for summarization/recommendation
- [ ] Add read-only public APIs for journal/article metadata:
  - Suggested module: `apps/api/src/modules/public/*`
  - Endpoints:
    - `/api/v1/public/journals`
    - `/api/v1/public/journals/:slug`
    - `/api/v1/public/articles/:id`
    - optional `/api/v1/public/policies`

Acceptance:
- Agent discovery endpoints stable and documented.
- Public read-only metadata endpoints available and cacheable.

---

## Sprint 6 (Sitemap Segmentation, Feeds, and Observability)

### 6.1 Sitemap segmentation
- [ ] Replace single sitemap output with sitemap index strategy:
  - `sitemap-static.xml`
  - `sitemap-journals.xml`
  - `sitemap-articles.xml`
  - `sitemap-policies.xml`
- [ ] Ensure `lastModified` is data-driven where possible.

### 6.2 Add feeds
- [ ] Add RSS/Atom/JSON feed routes for latest journals/articles.
  - Suggested route files under `apps/web/src/app/feeds/*` or API public module.

### 6.3 Observability for crawl and agent traffic
- [ ] Add request-level logging for discovery endpoints in API:
  - [apps/api/src/main.ts](/home/itb09/Desktop/test/publication/apps/api/src/main.ts)
- [ ] Define alerts for sustained `5xx` on:
  - `/api/v1/health/ready`
  - `/api/v1/agent/capabilities`

Acceptance:
- Sitemap index and feeds return valid XML/JSON.
- Crawl and agent endpoint reliability observable from logs/alerts.

---

## Deployment + Config Checklist (Do each release)

- [ ] `NEXT_PUBLIC_SITE_URL` set correctly in Coolify runtime env.
- [ ] `SERVICE_URL_API` and `SERVICE_URL_WEB` set consistently.
- [ ] `WEB_ORIGIN` includes production frontend URL(s), comma-separated if multiple.
- [ ] `DATABASE_URL_INTERNAL` points to internal `postgres` service in Coolify.
- [ ] Rebuild with no cache and verify:
  - `GET /robots.txt`
  - `GET /sitemap.xml` (or sitemap index)
  - `GET /llms.txt`
  - `GET /api/v1/agent/capabilities`
  - `GET /api/v1/health/ready`

---

## Done Definition (Project Level)

Mark project complete when all are true:
- [ ] Public pages have unique metadata + canonical URLs.
- [ ] Journal/article pages include structured data and scholarly meta tags.
- [ ] Internal linking is intentional and deep pages are easy to reach.
- [ ] Robots + sitemap strategy supports full crawl coverage.
- [ ] FAQ + role/policy pages support snippet extraction.
- [ ] AI agent endpoints (`llms.txt`, well-known, capabilities API, public metadata APIs) are stable and documented.
- [ ] Health, crawl, and agent access are production monitored.

