# Application Gap Analysis

Audit date: 2026-05-14

## Major Gaps

| Gap ID | Area | Gap | Evidence | Priority | Recommended Action |
|---|---|---|---|---|---|
| GAP-001 | Release state | Production Pipeline v1 exists only in local uncommitted changes. | Dirty worktree includes `apps/api/src/modules/production`, production dashboard, schema migration. | P1_HIGH | Review, validate, commit, and deploy migration deliberately. |
| GAP-002 | Dashboard data | Overview metrics are static zeros and activity is mock. | `apps/web/src/app/dashboard/page.tsx` stat cards and recent activity. | P1_HIGH | Add dashboard summary API and wire real counts/activity. |
| GAP-003 | Communications | Queued emails are not reconciled to sent/failed database status. | `CommunicationsService` writes `QUEUED`; `apps/worker/src/index.ts` only sends email/logs. | P1_HIGH | Include event/message IDs in jobs and update statuses on complete/fail. |
| GAP-004 | DOI integration | DOI deposit is a placeholder email workflow. | `PublishingService.enqueueDoiDeposit`. | P1_HIGH | Add provider abstraction, validation, idempotency, retry and admin status. |
| GAP-005 | Production pipeline | Workflow exists but lacks author proof UI, E2E, notifications, and strict publishing policy. | Production service/dashboard uncommitted; publishing permits `NOT_STARTED`. | P1_HIGH | Decide enforcement policy and complete proof/notification loop. |
| GAP-006 | CI/CD | No repo CI workflow was found. | `.github` contains agent only. | P1_HIGH | Add build, typecheck, unit, API, and web E2E gates. |
| GAP-007 | CSRF/session | Cookie-authenticated API has no explicit CSRF token strategy. | `main.ts` uses secure session + CORS credentials. | P1_HIGH | Add CSRF token or same-site constraints with documented threat model. |
| GAP-008 | Rate limiting | Rate limits are in-memory, not distributed. | `main.ts` `Map` buckets. | P2_MEDIUM | Move production rate limiting to Redis/Fastify plugin or edge layer. |
| GAP-009 | Upload integrity | File metadata is created before object upload verification. | `SubmissionsService.createSubmissionUpload`. | P2_MEDIUM | Add upload completion confirmation, MIME/size validation, checksum verification. |
| GAP-010 | Payments | Payment/subscription module is not started. | Schema has subscriber window fields, no payment provider/routes. | P2_MEDIUM | Add after core publishing stability if paid access is required. |
| GAP-011 | Observability | Logs exist but metrics/alerts are docs-first. | `docs/OBSERVABILITY_ALERTING_SETUP.md` placeholder receiver. | P2_MEDIUM | Add metrics endpoint, alert receiver configuration, runbook checks. |
| GAP-012 | SEO/accessibility | Checklist has incomplete public SEO/accessibility tasks. | `docs/SEO_AI_AGENT_EXECUTION_CHECKLIST.md`. | P2_MEDIUM | Complete sitemap/feed/landmark/skip-link tasks and tests. |

## Dependency Map

| Upstream | Downstream | Dependency |
|---|---|---|
| Auth/session | Every dashboard/API module | User identity and journal role checks. |
| Journal resolver | Policies, submissions, editor, publishing, storage, communications, production | Journal-scoped tenancy. |
| Prisma schema | API services, worker reconciliation, dashboard data | Schema models and enums define workflow states. |
| Storage config | Submission uploads, published assets, restricted PDF downloads | S3-compatible presigned upload/download flow. |
| Email queue | Reviewer invites, decisions, communications, DOI placeholder | Redis worker and SMTP delivery. |
| Audit log | Admin, policy, publishing, production, storage actions | Traceability for sensitive actions. |
| Production pipeline | Publishing | Accepted articles should pass production before publication once policy is enforced. |

## Sync Gaps

| Feature | Frontend | API | Schema | Gap |
|---|---|---|---|---|
| Dashboard overview | Shows many metrics | No summary endpoint | Data exists across models | UI is not connected. |
| Communications delivery | Shows queued/sent/failed fields | Creates queued events | Status fields exist | Worker never updates statuses. |
| Production proofing | Admin dashboard exists | Production endpoints exist | Proof models exist | Author-facing proof review path missing. |
| DOI deposit | Button/API exists | Placeholder queue | No deposit attempt/status model | Cannot track registry submission. |
| Subscription access | Restricted download logic exists | No payment/subscription API | Subscriber dates on role assignment | No checkout/webhook/renewal lifecycle. |

