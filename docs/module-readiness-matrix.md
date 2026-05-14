# Module Readiness Matrix

Audit date: 2026-05-14  
Status scale: NOT_STARTED, PARTIALLY_DEVELOPED, UNDERDEVELOPED, DEVELOPED_NEEDS_TESTING, TESTING_FAILED, READY_FOR_REVIEW, READY_FOR_PRODUCTION, LIVE, NEEDS_IMPROVEMENT, BLOCKED, CONFLICT_RISK, DEPRECATED.

| Module | Frontend | Backend | Schema | APIs | Tests | Docs | Status | Risk | Priority | Action |
|---|---|---|---|---|---|---|---|---|---|---|
| Public homepage/content | `apps/web/src/app/page.tsx` | Public API | Journal/Article | Public routes | SEO E2E partial | SEO checklist | READY_FOR_REVIEW | Medium | P2_MEDIUM | Finish SEO/accessibility checklist. |
| Public journal pages | `[journalSlug]` routes | `public.controller.ts`, publishing reads | Journal, Policy, Article | `GET /public/*` | Article SEO E2E | Existing docs | READY_FOR_REVIEW | Medium | P2_MEDIUM | Add route coverage for all public journal pages. |
| Auth/session/MFA | login/register/security dashboard | `auth.controller.ts`, `auth.service.ts` | User MFA fields | `/auth/*` | API E2E partial | Deployment docs | DEVELOPED_NEEDS_TESTING | High | P1_HIGH | Add CSRF/session hardening and RBAC tests. |
| Journal admin | `/dashboard/journals` | `journals.controller.ts` | Journal, RoleAssignment, AuditLog | `/journals/*` | API E2E partial | Deployment docs | READY_FOR_REVIEW | Medium | P2_MEDIUM | Add negative RBAC and validation tests. |
| Policy management | Journal policies pages, dashboard settings | `policies.controller.ts` | PolicyDocument, PolicyVersion, PolicyAcceptance | `/journals/:slug/policies/*` | API E2E policy acceptance | Existing docs | NEEDS_IMPROVEMENT | Medium | P2_MEDIUM | Verify route order and add regression test. |
| Author submissions | `/dashboard/submissions` | `submissions.controller.ts` | Submission, ManuscriptVersion, FileSet, StoredFile, Contributor | `/submissions/*` | Author E2E | Existing docs | READY_FOR_REVIEW | Medium | P2_MEDIUM | Add upload completion verification. |
| Editorial workflow | `/dashboard/editor` | `editor.controller.ts` | EditorAssignment, ReviewRound, Decision | `/editor/*`, `/submissions/*/decisions` | API and E2E | Roadmap | READY_FOR_REVIEW | Medium | P2_MEDIUM | Add decision notification status assertions. |
| Reviewer workflow | `/dashboard/reviewer` | `reviewer.controller.ts` | ReviewAssignment, Review | `/reviewer/*`, duplicate `/review-assignments/*` | Unit and E2E | Roadmap | NEEDS_IMPROVEMENT | Medium | P2_MEDIUM | Document or consolidate duplicate API surface. |
| Publishing | `/dashboard/publishing`, archive/article pages | `publishing.controller.ts` | Volume, Issue, Article, PublishedAsset | `/journals/:slug/publishing/*`, `/articles/*` | Publishing E2E | Roadmap | PARTIALLY_DEVELOPED | High | P1_HIGH | Replace DOI placeholder and align with production gate. |
| Production pipeline | `/dashboard/production` | `production.controller.ts` | Article production fields, ProductionTask, ProofRound, ProofAnnotation | `/production/*` | Unit only | Roadmap updated | PARTIALLY_DEVELOPED | High | P1_HIGH | Commit/review, add E2E, author proofing, notifications. |
| Communications center | `/dashboard/communications` | `communications.controller.ts` | EmailTemplate, MessageThread, Message, NotificationPreference, NotificationEvent | `/communications/*`, `/email-templates/*` | Unit tests | Roadmap | PARTIALLY_DEVELOPED | High | P1_HIGH | Add worker status reconciliation, retries, admin resend. |
| Storage configuration | `/dashboard/storage` | `journals.controller.ts`, storage service | JournalStorageConfig, StoredFile | `/storage-config/*`, `/files/*` | Smoke partial | Coolify docs | READY_FOR_REVIEW | Medium | P2_MEDIUM | Add upload verification and storage health checks. |
| Data sync | `/dashboard/storage`/data sync section | `journals.service.ts` | JournalDataSyncConfig, JournalDataSyncRun | `/data-sync/*` | Not enough | Roadmap | PARTIALLY_DEVELOPED | Medium | P2_MEDIUM | Clarify production sync semantics and add tests. |
| Audit logs | `/dashboard/audit` | `journals.controller.ts` audit endpoint | AuditLog | `/journals/:slug/audit-logs` | API partial | Runbook | READY_FOR_REVIEW | Medium | P2_MEDIUM | Add filters, export, retention policy. |
| Security center | `/dashboard/security` | `auth.controller.ts` MFA endpoints | User MFA fields | `/auth/mfa/*` | Not enough | Deployment docs | DEVELOPED_NEEDS_TESTING | High | P1_HIGH | Add MFA E2E and CSRF/session tests. |
| Dashboard overview | `/dashboard` | No summary API | Existing workflow models | None dedicated | None | None | UNDERDEVELOPED | High | P1_HIGH | Add summary/activity API and real metrics. |
| Payment/subscription | `/subscribers`, restricted PDF access | Download entitlement only | Subscriber role dates | No payment APIs | None | None | NOT_STARTED | Medium | P2_MEDIUM | Plan provider, checkout, webhook, invoices. |
| Observability/admin ops | Docs and health badge | Health endpoints, logs | None | `/health`, `/health/ready` | Worker smoke | Observability docs | PARTIALLY_DEVELOPED | Medium | P2_MEDIUM | Add metrics, alerts, CI health checks. |
| CI/CD | None found | N/A | N/A | N/A | Local tests | Coolify docs | UNDERDEVELOPED | High | P1_HIGH | Add GitHub Actions or equivalent pipeline. |

