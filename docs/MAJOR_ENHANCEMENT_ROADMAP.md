# Major Enhancement Roadmap

This roadmap is based on the current production publication platform architecture, schema, API modules, frontend routes, deployment model, and test coverage. The platform already has a sound multi-journal foundation, so the recommended path is modular expansion rather than a rewrite.

## Current Platform Snapshot

### Architecture

- Monorepo using pnpm workspaces.
- `apps/web`: Next.js 15 App Router frontend.
- `apps/api`: NestJS 11 + Fastify REST API under `/api/v1`.
- `apps/worker`: BullMQ worker currently focused on queued email delivery.
- `packages/db`: Prisma + PostgreSQL schema, migrations, and seed data.
- `packages/shared`: shared runtime enum accessors, role constants, admin email helpers, and queue constants.

### Core Domain Model

The Prisma schema already supports:

- Multi-publisher and multi-journal management through `Publisher` and `Journal`.
- Journal roles and role hierarchy through `User` and `JournalRoleAssignment`.
- Audit trails through `AuditLog`.
- Versioned policies and acceptance through `PolicyDocument`, `PolicyVersion`, and `PolicyAcceptance`.
- Submission lifecycle through `Submission`, `SubmissionSequence`, `ManuscriptVersion`, `SubmissionContributor`, `FileSet`, and `StoredFile`.
- Editorial and peer-review workflow through `EditorAssignment`, `ReviewRound`, `ReviewAssignment`, `Review`, and `Decision`.
- Messaging through `MessageThread` and `Message`.
- Publishing workflow through `Volume`, `Issue`, `Article`, and `PublishedAsset`.
- Journal-scoped storage configuration through `JournalStorageConfig`.
- Journal data sync configuration and run history through `JournalDataSyncConfig` and `JournalDataSyncRun`.

### API Modules

Current backend modules cover:

- Auth, session, MFA, user profile, and nav context.
- Journal administration, roles, audit logs, storage config, and data sync config.
- Policy versioning and activation.
- Author submission creation, draft update, submit, files, and contributors.
- Editorial queue, editor assignment, review rounds, reviewer invitation, cancellation, and decisions.
- Reviewer assignment response and review submission.
- Publishing volumes, issues, article assignment, article publishing, and DOI deposit entry point.
- File downloads, public journal/article metadata, agent capabilities, and health/readiness.

### Frontend Routes

The frontend already separates:

- Public site pages: home, journals directory, about, authors, editors, readers, subscribers, policies.
- Journal pages: journal landing, focus and scope, editorial board, policies, archive, volume, issue, and article pages.
- Dashboard pages: overview, submissions, editor, reviewer, publishing, journals, storage, data, audit, security, and help.
- Discovery routes: `llms.txt` and `/.well-known/agent.json`.

### Deployment And Operations

Production is designed around Docker/Coolify:

- `docker-compose.coolify.yml` runs `postgres`, `redis`, `minio`, `migrate`, `api`, `worker`, and `web`.
- `Dockerfile.api`, `Dockerfile.web`, `Dockerfile.worker`, and `Dockerfile.migrate` build separate runtime images.
- Required services are PostgreSQL, Redis, MinIO/S3-compatible storage, SMTP, API, worker, and web.
- Existing ops docs cover Coolify deployment, production deployment playbook, reliability runbook, observability, backups, restore drills, and alerting.

### Current Test Surface

- API E2E tests cover multi-journal isolation, policy acceptance before submit, tracking numbers, and double-blind reviewer redaction.
- Reviewer service unit tests cover assignment listing, accepting/declining, permission checks, invalid status checks, and review submission.
- Web Playwright tests cover author happy path, editor triage, reviewer review submission, publishing flow, and article SEO metadata.
- Worker and web have smoke tests.

## Enhancement Principles

1. Extend the existing journal-scoped domain model.
2. Reuse `JournalResolverService`, shared role constants, audit logging, and `AppShell` dashboard primitives.
3. Prefer additive migrations with nullable/defaulted columns and backfill jobs.
4. Keep production compatibility with Coolify, Redis, PostgreSQL, MinIO/S3, and SMTP.
5. Add focused tests with every workflow module: service/unit tests for business rules, API E2E for contracts, and Playwright for primary operator journeys.

## Recommended Major Modules

## 1. Production Pipeline Module

### Goal

Add a real post-acceptance production workflow for copyediting, proofing, layout, asset preparation, and final publication approval.

### Schema Changes

- Add `ProductionTask` with `journalId`, `submissionId`, `articleId`, `type`, `status`, `assignedToUserId`, `dueAt`, `completedAt`, and `metadataJson`.
- Add enums `ProductionTaskType` and `ProductionTaskStatus`.
- Add `ProofRound` with `articleId`, `roundNumber`, `status`, `authorApprovedAt`, and `editorApprovedAt`.
- Add `ProofAnnotation` for comments on proofs/assets.
- Optionally add `Article.productionStatus`.

### API Endpoints

- `GET /journals/:journalSlug/production/tasks`
- `POST /articles/:articleId/production/tasks`
- `PATCH /production/tasks/:taskId`
- `POST /articles/:articleId/proof-rounds`
- `POST /proof-rounds/:proofRoundId/approve`
- `POST /proof-rounds/:proofRoundId/annotations`

### Frontend Screens

- `/dashboard/production`
- Article production detail panel inside `/dashboard/publishing`
- Proof review screen for author and production editor.

### Background Jobs

- Due-date reminder emails.
- Proof approval reminder emails.
- Optional generated task creation when a submission becomes `ACCEPTED`.

### Risks

- Status drift between `Submission`, `Article`, and production tasks.
- Confusing overlap with publishing dashboard if production and publishing are not clearly separated.

### Migration Plan

- Add nullable/additive production tables.
- Backfill one default production task for existing `IN_PRESS` articles.
- Add service-level guards so only accepted/in-press articles enter production.

### Validation Tests

- API E2E: accepted article creates production task and prevents invalid transitions.
- Unit: task status transition matrix.
- Playwright: production editor completes copyedit/proof task and article becomes publish-ready.

## 2. Reviewer Discovery And Scoring Module

### Goal

Help editors find reviewers by expertise, prior workload, conflicts, response history, and review quality.

### Schema Changes

- Add `ReviewerProfile` with `userId`, `journalId`, `expertiseKeywords`, `affiliationsJson`, `maxActiveReviews`, `availabilityStatus`.
- Add `ReviewerMetricSnapshot` with invitation counts, acceptance rate, average response time, completion rate, and overdue count.
- Add `ReviewerConflict` with reviewer, contributor email/domain/ORCID, reason, and source.
- Add optional `SubmissionSuggestedReviewer`.

### API Endpoints

- `GET /journals/:journalSlug/reviewers/search`
- `GET /journals/:journalSlug/reviewers/:userId/profile`
- `PATCH /journals/:journalSlug/reviewers/:userId/profile`
- `POST /submissions/:submissionId/reviewer-suggestions`
- `POST /reviewers/:userId/conflicts`

### Frontend Screens

- Reviewer database tab under `/dashboard/editor`.
- Reviewer profile drawer.
- Suggested reviewers panel in reviewer invitation flow.

### Background Jobs

- Nightly metric snapshot refresh.
- Conflict pre-check when contributors are added or a review round starts.

### Risks

- Reviewer scoring can become opaque or unfair.
- Conflict data may contain sensitive personal data.

### Migration Plan

- Start with deterministic scoring from existing assignments.
- Keep AI-assisted matching optional and explainable.
- Backfill profiles for users with `REVIEWER` role.

### Validation Tests

- Unit: scoring and conflict rules.
- API E2E: reviewer suggestions exclude conflicted users.
- Playwright: editor searches, filters, and invites a reviewer from suggestions.

## 3. Author Revision And Response Module

### Goal

Formalize revision cycles with required response letters, changed manuscripts, editor checks, and version comparison metadata.

### Schema Changes

- Add `RevisionRequest` with `submissionId`, `decisionId`, `dueAt`, `instructionsHtml`, `status`.
- Add `RevisionSubmission` with `revisionRequestId`, `manuscriptVersionId`, `responseLetterFileId`, `submittedAt`.
- Add `RevisionChecklistItem` for journal-specific required revision checks.

### API Endpoints

- `POST /submissions/:submissionId/revision-requests`
- `GET /submissions/:submissionId/revisions`
- `POST /revision-requests/:revisionRequestId/submit`
- `PATCH /revision-requests/:revisionRequestId`

### Frontend Screens

- Author revision workspace under `/dashboard/submissions`.
- Editor revision review panel under `/dashboard/editor`.

### Background Jobs

- Revision due-date reminders.
- Overdue revision status updates.

### Risks

- Duplicate state with `SubmissionStatus.REVISION_REQUESTED` and `REVISED_SUBMITTED`.
- File versioning must remain clear for double-blind review.

### Migration Plan

- Add revision tables and link them to existing `Decision` and `ManuscriptVersion`.
- Preserve existing status enum and treat revision rows as the detailed source.

### Validation Tests

- API E2E: major revision creates request, author submits response, status becomes `REVISED_SUBMITTED`.
- Unit: due-date and required-file validation.
- Playwright: author resubmits revision from dashboard.

## 4. Communications And Notification Center

### Goal

Turn current email queue and message tables into a full journal communication center with templates, event triggers, inbox history, and delivery tracking.

### Schema Changes

- Add `EmailTemplate` with `journalId`, `key`, `subject`, `bodyHtml`, `variablesJson`, `active`.
- Add `NotificationPreference` per user/journal.
- Extend `Message` with `templateKey`, `providerMessageId`, `failedReason`, and `retryCount`.
- Add `NotificationEvent` for domain event history.

### API Endpoints

- `GET /journals/:journalSlug/email-templates`
- `POST /journals/:journalSlug/email-templates`
- `PATCH /email-templates/:templateId`
- `GET /journals/:journalSlug/communications`
- `POST /communications/:threadId/messages`
- `PATCH /me/notification-preferences`

### Frontend Screens

- `/dashboard/communications`
- Email template manager under `/dashboard/journals?tab=notifications`
- Submission communication timeline.

### Background Jobs

- Event-triggered emails for submit, assign editor, invite reviewer, decision, revision, publish.
- Retry failed outbound emails.
- Digest notifications.

### Risks

- Template variables can break emails if unvalidated.
- Duplicate sends if queue idempotency is not enforced.

### Migration Plan

- Seed default templates for existing workflow events.
- Add idempotency keys to queued jobs before enabling automated event triggers.

### Validation Tests

- Unit: template variable validation and rendering.
- API E2E: decision action enqueues correct email event.
- Worker test: failed email retries and records failure metadata.
- Playwright: admin edits template and sends test email.

## 5. Subscription, Access, And Reader Entitlement Module

### Goal

Use the existing `SUBSCRIBER` role and article access model to support subscriptions, restricted access, institutional access, and reader entitlements.

### Schema Changes

- Add `SubscriptionPlan` with journal, name, price, duration, access rules.
- Add `Subscription` with user, journal, plan, status, start/end dates.
- Add `Institution` and `InstitutionEntitlement`.
- Add `AccessGrant` for article-level or issue-level exceptions.
- Add enum `SubscriptionStatus`.

### API Endpoints

- `GET /journals/:journalSlug/subscription-plans`
- `POST /journals/:journalSlug/subscription-plans`
- `POST /subscriptions/checkout`
- `GET /me/subscriptions`
- `POST /articles/:articleId/access-grants`
- `GET /articles/:articleId/access-check`

### Frontend Screens

- `/subscribers`
- Reader account area.
- Admin subscription settings under `/dashboard/journals`.
- Article access banner and purchase/subscription prompt.

### Background Jobs

- Subscription expiry reminders.
- Entitlement expiry sync.
- Payment reconciliation if a payment provider is added later.

### Risks

- Payment provider integration expands compliance and support burden.
- Article access checks must be enforced server-side, not only in UI.

### Migration Plan

- First implement manual/admin-created subscriptions.
- Then add payment integration in a second phase.
- Backfill `SUBSCRIBER` role assignment dates into `Subscription` rows where possible.

### Validation Tests

- API E2E: restricted article blocks non-entitled user and allows entitled user.
- Unit: entitlement resolution across user, institution, issue, and article.
- Playwright: subscriber sees restricted article content after entitlement.

## 6. Analytics And Editorial Reporting Module

### Goal

Add operational analytics for journal admins: submission volume, turnaround time, reviewer performance, acceptance rate, publication throughput, and SLA breaches.

### Schema Changes

- Add `JournalMetricSnapshot` with date, metric key, value, dimensionsJson.
- Add `WorkflowEvent` with entity type/id, journal, actor, event key, and metadataJson.
- Optionally derive from `AuditLog` initially before adding event-specific capture.

### API Endpoints

- `GET /journals/:journalSlug/analytics/overview`
- `GET /journals/:journalSlug/analytics/submissions`
- `GET /journals/:journalSlug/analytics/reviewers`
- `GET /journals/:journalSlug/analytics/publishing`
- `POST /journals/:journalSlug/analytics/recompute`

### Frontend Screens

- `/dashboard/reports`
- Analytics cards on dashboard home.
- Export controls for CSV.

### Background Jobs

- Nightly metric aggregation.
- On-demand recompute job.
- Alert job for overdue editorial/review tasks.

### Risks

- Heavy analytics queries can slow production if run live.
- Metrics definitions must be stable and transparent.

### Migration Plan

- Start with read-only computed endpoints.
- Add snapshot table once metrics stabilize.
- Backfill snapshots for existing submissions and articles.

### Validation Tests

- Unit: metric calculation fixtures.
- API E2E: analytics respects journal isolation.
- Playwright: admin dashboard reports render seeded metrics.

## 7. Indexing, DOI, And External Registry Integration Module

### Goal

Complete scholarly publishing integrations: DOI deposit, Crossref-like metadata export, sitemap/feed expansion, and indexing status.

### Schema Changes

- Add `ExternalDeposit` with `articleId`, provider, status, payloadJson, responseJson, errorMessage, submittedAt.
- Add `IndexingTarget` with journal, provider, enabled, settingsJson.
- Add `IndexingRun` with target, status, recordsProcessed, errorMessage.
- Add enum `ExternalDepositStatus`.

### API Endpoints

- `POST /articles/:articleId/doi/deposit`
- `GET /articles/:articleId/deposits`
- `GET /journals/:journalSlug/indexing-targets`
- `PATCH /journals/:journalSlug/indexing-targets/:targetId`
- `POST /journals/:journalSlug/indexing/run`

### Frontend Screens

- Indexing settings under `/dashboard/publishing`.
- Article metadata/deposit status panel.
- Public RSS/Atom/JSON feed routes for latest articles.

### Background Jobs

- DOI deposit retry.
- Scheduled indexing export.
- Feed/sitemap freshness checks.

### Risks

- Registry payloads are strict and failures can be hard to diagnose.
- DOI deposits must be idempotent.

### Migration Plan

- Add dry-run payload generation first.
- Store every outbound payload and provider response.
- Enable live provider submission only after journal-level credentials are configured.

### Validation Tests

- Unit: Crossref-style payload generation.
- API E2E: dry-run deposit records payload without publishing externally.
- Playwright: production editor sees deposit status and retry controls.

## 8. AI-Assisted Editorial Tools Module

### Goal

Add assistive, auditable AI features without replacing editorial judgment: submission triage summaries, policy checks, reviewer matching explanations, decision letter drafting, and article metadata suggestions.

### Schema Changes

- Add `AiRun` with journal, entity type/id, task key, model/provider, promptVersion, inputHash, outputJson, status, errorMessage.
- Add `AiSuggestion` with `aiRunId`, suggestionType, targetEntity, status, acceptedByUserId, acceptedAt.
- Add `AiPolicy` for journal-level feature enablement and redaction rules.

### API Endpoints

- `POST /submissions/:submissionId/ai/triage-summary`
- `POST /submissions/:submissionId/ai/policy-check`
- `POST /submissions/:submissionId/ai/decision-draft`
- `GET /submissions/:submissionId/ai-runs`
- `PATCH /ai-suggestions/:suggestionId`

### Frontend Screens

- AI assist panel in `/dashboard/editor`.
- AI metadata suggestions in `/dashboard/publishing`.
- AI governance settings under `/dashboard/security`.

### Background Jobs

- Async AI runs for long manuscript analysis.
- Retry failed AI runs.
- Optional scheduled metadata enrichment for accepted articles.

### Risks

- Privacy, manuscript confidentiality, hallucinations, and over-reliance.
- Needs explicit journal-level governance and auditability.

### Migration Plan

- Start with no external calls: store manual mock/dry-run records and UI review flow.
- Add provider integration behind env flags.
- Require human accept/reject action before any AI output changes production data.

### Validation Tests

- Unit: redaction and prompt-input builder.
- API E2E: AI suggestion cannot directly mutate submission without acceptance.
- Playwright: editor reviews AI suggestion and accepts/rejects it.

## Suggested Delivery Order

1. Communications and notification center, because it strengthens every workflow.
2. Production pipeline, because accepted articles currently need a richer post-acceptance path.
3. Author revision module, because it completes the peer-review lifecycle.
4. Reviewer discovery and scoring, because it improves editorial efficiency.
5. Analytics and reporting, because it gives operators visibility into the new workflows.
6. Indexing and DOI integrations, because it improves scholarly credibility after publishing flow is stronger.
7. Subscription/access, if restricted content or monetization is a business priority.
8. AI-assisted editorial tools, after governance, audit, and workflow data are strong.

## Baseline Validation For Any Major Module

Before implementation:

```bash
./scripts/pnpm.sh -r typecheck
./scripts/pnpm.sh -r test
./scripts/pnpm.sh --filter @pub/web build
```

For modules touching dashboard workflows:

```bash
PW_USE_WEBSERVER=1 ./scripts/pnpm.sh --filter @pub/web test:e2e
```

For deployment-impacting changes:

```bash
docker compose -f docker-compose.coolify.yml config
```

## Recommended Next Implementation Slice

The best first major enhancement is the communications and notification center. It has a strong existing base (`MessageThread`, `Message`, BullMQ email queue, SMTP worker, role-aware dashboard shell), improves all user roles, and creates reusable event infrastructure for later modules such as revisions, production tasks, subscriptions, reviewer reminders, and AI notifications.
