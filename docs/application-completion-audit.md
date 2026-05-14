# Application Completion Audit

Audit date: 2026-05-14  
Repository state audited: local worktree at `f02e818`, including uncommitted Production Pipeline v1 changes.

## Executive Summary

The platform is a production-oriented publication SaaS monorepo with a Next.js web app, NestJS/Fastify API, BullMQ worker, Prisma/Postgres schema, S3-compatible storage, Redis, and Coolify/Docker deployment assets. The core manuscript lifecycle is materially developed: journal setup, user auth, role assignments, author submissions, policy acceptance, editorial assignment, review, decisions, publishing, storage configuration, audit logs, communications, and the newly added production pipeline all exist in code.

The application is not yet fully production-ready. No current P0 build blocker was found from the latest validation evidence, but several P1 release risks remain: uncommitted production pipeline work, mock dashboard metrics, queued communications that are not reconciled to sent/failed state, placeholder DOI deposit logic, incomplete CI/CD, limited distributed rate limiting, missing CSRF protection, and incomplete test coverage for the newest operational modules.

## Current Architecture

| Layer | Evidence | Current State |
|---|---|---|
| Web | `apps/web/src/app`, `apps/web/e2e` | Next.js App Router with public journal pages and dashboard modules. |
| API | `apps/api/src/modules` | NestJS/Fastify API under `/api/v1` with auth, journals, submissions, editor, reviewer, publishing, communications, storage, production, health, agent. |
| Worker | `apps/worker/src/index.ts` | BullMQ email worker using Redis and SMTP. |
| Database | `packages/db/prisma/schema.prisma` | Prisma schema with journal, submission, review, article, storage, data sync, communications, and production models. |
| Shared | `packages/shared/src` | Shared role constants, queue names, Prisma enum fallback. |
| Deployment | `Dockerfile.*`, `docker-compose*.yml`, `docs/COOLIFY_DEPLOYMENT.md` | Docker/Coolify model with API, web, worker, migration, Postgres, Redis, MinIO. |

## Module Inventory Summary

| Area | Readiness | Notes |
|---|---|---|
| Public journal site | READY_FOR_REVIEW | Public routes, archive, article metadata, robots/sitemap exist; SEO checklist still has open items. |
| Auth and session | DEVELOPED_NEEDS_TESTING | Cookie session, MFA, Google token login, nav context exist; CSRF and session-secret strength need hardening. |
| Journal administration | READY_FOR_REVIEW | Metadata, roles, storage, policies, audit logs are implemented; stronger tests and admin guard consistency needed. |
| Author submissions | READY_FOR_REVIEW | Draft, metadata, contributors, policy acceptance, file upload presign exist; missing post-upload verification and broader E2E. |
| Editorial workflow | READY_FOR_REVIEW | Queue, assignments, review rounds, reviewer invites, decisions implemented and tested in happy paths. |
| Reviewer workflow | READY_FOR_REVIEW | Reviewer assignment list, respond, submit review implemented; duplicate route surface needs cleanup or documentation. |
| Publishing | PARTIALLY_DEVELOPED | Volumes/issues/article publishing exist; DOI deposit is placeholder; production gate is permissive for `NOT_STARTED`. |
| Production pipeline | PARTIALLY_DEVELOPED | Schema/API/dashboard/service tests exist in uncommitted work; missing E2E, author proof UI, notification hooks. |
| Communications | PARTIALLY_DEVELOPED | Templates, threads, preferences, email queue exist; delivery reconciliation and retries are missing. |
| Storage/data sync | PARTIALLY_DEVELOPED | Hybrid storage and config UI exist; data sync needs clearer production semantics and health checks. |
| Dashboards | UNDERDEVELOPED | Dashboard shell is strong, but overview metrics use static zeros and mock recent activity. |
| Payments/subscriptions | NOT_STARTED | Subscriber roles and restricted PDFs exist, but no payment provider, subscription checkout, invoices, or webhooks. |
| Observability | PARTIALLY_DEVELOPED | Structured logs and docs exist; metrics, alerts, traces, SLOs, and app-level dashboards need implementation. |
| CI/CD | UNDERDEVELOPED | No GitHub workflow files found; validation is local/manual. |

## Evidence Highlights

- API security and observability hooks exist in `apps/api/src/main.ts`: request IDs, structured request logs, CORS, in-memory rate limiting, secure session cookie, and security headers.
- Dashboard overview includes hardcoded zero metrics and mock activity in `apps/web/src/app/dashboard/page.tsx`.
- Communications queue creates `Message` and `NotificationEvent` records with `QUEUED` status, but the worker sends SMTP mail without updating those records.
- DOI deposit currently creates an audit log and queues a notification email, not a registry deposit.
- Policy controller declares `GET :key` before `GET active-required`, which should be verified for route shadowing.
- No `.github/workflows` directory was found.

## Readiness Verdict

Overall readiness: 74/100, staging candidate with important production limitations.

Recommended next action: complete and commit the audit pack, then start Phase 0/1 with release-state cleanup, queued email reconciliation, dashboard real metrics, route-order verification, CSRF/session hardening, and CI setup.

