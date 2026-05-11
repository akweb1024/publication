# Multi‑Journal Publishing Platform (Custom) — MVP → Scale‑Up

## Summary
Build a single platform for one publication house hosting many journals at `/{journalSlug}/...`, supporting issue-based publishing, double‑blind peer review, policy versioning, and a scalable workflow for submissions → review → decisions → production → publication. MVP ships without subscriptions/paywall (mixed-access is represented, but enforcement is deferred).

**Decisions locked**
- Stack: TypeScript monorepo (`pnpm`), `apps/web` (Next.js), `apps/api` (NestJS/Fastify REST), `apps/worker` (BullMQ), `packages/db` (Prisma), Postgres + Redis, S3-compatible storage (MinIO in dev).
- Hosting (v1): Docker Compose for dev + Docker on a single server for prod.
- Email (MVP): SMTP adapter (pluggable later).
- Mixed access (MVP): model OA/restricted + public pages; no paywall enforcement until Scale‑Up.

---

## Core Architecture
- **Web app (`apps/web`)**
  - Public: publisher home + journal home + issues + article landing pages + policy pages.
  - Private: author dashboard (submissions), editor dashboard (queues), reviewer dashboard (assignments).
- **API (`apps/api`)**
  - Versioned REST JSON (`/api/v1/...`) + OpenAPI spec.
  - RBAC + journal scoping enforced at the API boundary.
- **Worker (`apps/worker`)**
  - Email sending, reminders/escalations, file processing (checksum/AV scan hook), DOI deposit jobs (scale-up), exports.
- **Storage**
  - Postgres as source of truth.
  - S3 bucket for manuscript files, review attachments, published PDFs.
  - Redis for queues + rate limiting.
- **Security**
  - Cookie-based sessions for browser flows.
  - Argon2 password hashing, MFA-ready design for staff roles (scale-up).
  - Append-only audit log for sensitive actions (review access, decisions, policy changes).

---

## Explicit Data Model (MVP-first)
All tables use `id UUID PK`, `createdAt`, `updatedAt`. “FK” implies indexed foreign key. “Unique” implies DB uniqueness constraint.

### Multi-journal + identity
- **Publisher**
  - `name`, `defaultLocale`, `supportEmail`
- **Journal**
  - `publisherId FK`, `slug Unique`, `title`, `issnPrint`, `issnOnline`, `description`, `status {DRAFT|LIVE|ARCHIVED}`
  - `reviewModel {DOUBLE_BLIND}` (fixed now, extensible)
  - `submissionEmailFrom`, `brandingJson`, `timezone`
- **User**
  - `email Unique`, `passwordHash`, `name`, `status {ACTIVE|DISABLED}`
  - optional later: `orcidId`, `orcidAccessTokenRef`
- **JournalRoleAssignment**
  - `journalId FK`, `userId FK`, `role`
  - `role Enum`: `JOURNAL_ADMIN`, `EDITOR_IN_CHIEF`, `MANAGING_EDITOR`, `SECTION_EDITOR`, `ASSOCIATE_EDITOR`, `COPYEDITOR`, `PRODUCTION_EDITOR`, `REVIEWER`, `AUTHOR_SUPPORT`
  - Unique: (`journalId`, `userId`, `role`)
- **AuditLog**
  - `journalId FK nullable`, `actorUserId FK`, `action`, `entityType`, `entityId`, `ip`, `userAgent`, `metadataJson`, `occurredAt`
  - Append-only; used for compliance + blind-review traceability

### Policies (versioned)
- **PolicyDocument**
  - `journalId FK`, `key` (e.g., `peer-review`, `ethics`, `privacy`, `open-access`, `retractions`), `title`
  - Unique: (`journalId`, `key`)
- **PolicyVersion** (explicitly requested)
  - `policyDocumentId FK`, `versionNumber`, `effectiveFrom`, `effectiveTo nullable`
  - `contentHtml` (or `contentMd`), `changeNote`, `publishedByUserId FK`
  - Unique: (`policyDocumentId`, `versionNumber`)
- **PolicyAcceptance**
  - `policyVersionId FK`, `userId FK`, `acceptedAt`, `context` (`SUBMISSION`, `REVIEW`, `GENERAL`)
  - Unique: (`policyVersionId`, `userId`, `context`)

### Submissions → review
- **Submission** (explicitly requested)
  - `journalId FK`, `submitterUserId FK`, `trackingNumber Unique per journal` (e.g., `JOURNALSLUG-2026-000123`)
  - `status Enum`: `DRAFT`, `SUBMITTED`, `TRIAGE`, `EDITOR_ASSIGNED`, `UNDER_REVIEW`, `REVISION_REQUESTED`, `REVISED_SUBMITTED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`
  - `manuscriptTitle`, `abstractText`, `keywordsText[]`, `articleType` (journal-defined string)
  - `submittedAt`, `decisionAt nullable`
- **ManuscriptVersion**
  - `submissionId FK`, `versionNumber`, `coverLetter`, `authorStatementJson`, `fileSetId FK`, `submittedAt`
  - Unique: (`submissionId`, `versionNumber`)
- **FileSet**
  - `journalId FK`, `kind {SUBMISSION|REVIEW|PRODUCTION|PUBLISHED}`, `storagePrefix`, `checksumManifestJson`
- **StoredFile**
  - `fileSetId FK`, `role {MANUSCRIPT|SUPPLEMENT|FIGURE|RESPONSE_LETTER|OTHER}`, `originalName`, `mimeType`, `sizeBytes`, `sha256`, `storageKey`, `uploadedByUserId FK`
- **SubmissionContributor**
  - `submissionId FK`, `userId FK nullable` (nullable for external coauthors not registered)
  - `displayName`, `email`, `affiliation`, `isCorresponding`, `orcidId nullable`
  - `creditRoles Text[]` (CRediT 14 roles supported as controlled list)
  - `isAnonymizedCopy` (for blind-review safe display)
- **EditorAssignment**
  - `submissionId FK`, `userId FK`, `role {HANDLING_EDITOR|SECTION_EDITOR}`, `assignedAt`, `unassignedAt nullable`

### Review (double-blind)
- **ReviewRound**
  - `submissionId FK`, `roundNumber`, `startedAt`, `endedAt nullable`
  - Unique: (`submissionId`, `roundNumber`)
- **ReviewAssignment**
  - `reviewRoundId FK`, `reviewerUserId FK`, `status {INVITED|ACCEPTED|DECLINED|OVERDUE|SUBMITTED|CANCELLED}`
  - `invitedAt`, `respondBy`, `dueAt`, `acceptedAt nullable`
  - Unique: (`reviewRoundId`, `reviewerUserId`)
- **Review** (explicitly requested)
  - `reviewAssignmentId FK Unique`, `submittedAt`, `recommendation {ACCEPT|MINOR|MAJOR|REJECT}`
  - `commentsToAuthor`, `commentsToEditor`, `attachmentsFileSetId FK nullable`

### Decisions + communications
- **Decision**
  - `submissionId FK`, `reviewRoundId FK nullable`, `type {DESK_REJECT|REVISE_MAJOR|REVISE_MINOR|ACCEPT|REJECT}`, `letterToAuthor`, `internalNote`, `decidedByUserId FK`, `decidedAt`
- **MessageThread**
  - `journalId FK`, `submissionId FK nullable`, `subject`, `createdByUserId FK`
- **Message**
  - `threadId FK`, `fromUserId FK nullable`, `toEmails Text[]`, `bodyHtml`, `sentAt nullable`, `deliveryStatus`

### Publishing (issue-based)
- **Volume**
  - `journalId FK`, `year`, `number`, Unique: (`journalId`, `year`, `number`)
- **Issue** (explicitly requested)
  - `journalId FK`, `volumeId FK`, `number`, `title`, `publicationDate`, `status {PLANNED|PUBLISHED}`
  - Unique: (`journalId`, `volumeId`, `number`)
- **Article** (explicitly requested; created after acceptance)
  - `journalId FK`, `submissionId FK Unique`, `issueId FK nullable` (optional until assigned)
  - `title`, `abstractText`, `keywordsText[]`
  - `doi nullable`, `pageStart nullable`, `pageEnd nullable`, `articleNumber nullable`
  - `access {OPEN|RESTRICTED}`, `licenseKey nullable`, `publishedAt nullable`, `status {IN_PRESS|PUBLISHED|RETRACTED|CORRECTED|EOC}`
- **PublishedAsset**
  - `articleId FK`, `pdfFileId FK`, `versionLabel` (e.g., `Version of Record`), `publishedAt`

---

## API Surface (v1, REST JSON + OpenAPI)
All endpoints enforce `journalSlug` scoping and RBAC.

### Public
- `GET /api/v1/journals` (publisher listing)
- `GET /api/v1/journals/{journalSlug}`
- `GET /api/v1/journals/{journalSlug}/policies` + `GET .../policies/{key}` (latest) + `GET .../policies/{key}/versions/{n}`
- `GET /api/v1/journals/{journalSlug}/volumes` + `/issues`
- `GET /api/v1/journals/{journalSlug}/issues/{issueId}/articles`
- `GET /api/v1/journals/{journalSlug}/articles/{articleId}` (landing metadata)
- `GET /api/v1/files/{fileId}/download` (MVP: public for published PDFs only)

### Auth + profiles
- `POST /api/v1/auth/register` (authors/reviewers)
- `POST /api/v1/auth/login` / `POST /api/v1/auth/logout` / `GET /api/v1/auth/session`
- `GET/PATCH /api/v1/me`
- Scale-up: `POST /api/v1/auth/orcid/connect` + callback

### Author submissions
- `POST /api/v1/journals/{journalSlug}/submissions` (creates DRAFT)
- `POST /api/v1/submissions/{submissionId}/files` (upload to FileSet)
- `POST /api/v1/submissions/{submissionId}/submit` (locks version, records PolicyAcceptance)
- `GET /api/v1/submissions?journalSlug=&mine=true`
- `GET /api/v1/submissions/{submissionId}` (role-filtered fields to preserve blinding)

### Editorial workflow
- `GET /api/v1/journals/{journalSlug}/editor/queue?status=...`
- `POST /api/v1/submissions/{submissionId}/assign-editor`
- `POST /api/v1/submissions/{submissionId}/start-review-round`
- `POST /api/v1/review-rounds/{roundId}/invite-reviewer`
- `POST /api/v1/review-assignments/{assignmentId}/cancel`
- `POST /api/v1/submissions/{submissionId}/decisions`

### Reviewer
- `GET /api/v1/reviewer/assignments`
- `POST /api/v1/review-assignments/{assignmentId}/respond` (accept/decline)
- `POST /api/v1/review-assignments/{assignmentId}/submit-review`

### Publishing
- `POST/GET /api/v1/journals/{journalSlug}/volumes`
- `POST/GET /api/v1/journals/{journalSlug}/issues`
- `POST /api/v1/articles/{articleId}/assign-issue`
- `POST /api/v1/articles/{articleId}/publish` (creates PublishedAsset, sets `publishedAt`)
- Scale-up: `POST /api/v1/articles/{articleId}/doi/deposit` (async job)

### Policies (admin)
- `POST /api/v1/journals/{journalSlug}/policies/{key}/versions` (draft/publish)
- `POST /api/v1/journals/{journalSlug}/policies/{key}/versions/{n}/activate` (sets effective window)

---

## Phased Implementation (MVP → Scale‑Up)

### Phase 0 — Foundations (Weeks 0–2)
- Scaffold monorepo, CI, lint/typecheck/test pipelines, Docker Compose (Postgres/Redis/MinIO).
- Implement auth (sessions), user model, journal model, RBAC + journal scoping middleware, AuditLog.
- Implement file storage abstraction (S3-compatible) + signed upload/download; enforce “published PDF only” public download.
- Implement PolicyDocument/PolicyVersion/PolicyAcceptance with admin UI + public rendering.

**Exit criteria**
- Can create journals, roles, policies; audit log records admin actions; files upload/download works.

### Phase 1 — MVP: Submission + Double‑Blind Review + Issue Publishing (Weeks 2–8)
- Author submission flow: draft → upload files → add contributors + CRediT roles → accept required policies → submit.
- Editor queue: triage, assign handling editor, start review round.
- Reviewer workflow: invite/accept/decline, submit review (with blinded manuscript access).
- Decisions: record decision + send templated email; support revision requested → revised submission (new ManuscriptVersion).
- Publishing MVP: after ACCEPTED create Article; manage Volumes/Issues; assign articles to issue; publish article landing + PDF.

**Exit criteria**
- End-to-end for one journal: submit → review → accept → assign to issue → publish landing+PDF.

### Phase 2 — Scale‑Up: Automation + Integrations + Hardening (Weeks 8–16)
- Workflow automation: reminders, overdue escalations, decision SLA dashboards.
- ORCID connect for authors/reviewers; store ORCID iD and display in metadata.
- Crossref DOI deposit pipeline (async worker) + retry/backoff + audit trail of deposits.
- Plagiarism integration (adapter interface; vendor-specific config per journal).
- Indexing/export: OAI-PMH endpoint for article metadata (oai_dc) + sitemap generation.
- Performance + ops: query optimization, background job monitoring, rate limits, structured logging, backups/restore drills.

**Exit criteria**
- Multiple journals at scale with stable ops, DOI automation, ORCID linking, exports, and monitoring.

### Phase 3 — Enterprise Extensions (as needed)
- Mixed-access enforcement: login-gated PDFs; then institutional subscriptions/entitlements if required.
- Production pipeline: JATS XML ingestion/authoring, HTML fulltext rendering, version-of-record management.
- Post-publication updates: corrections, expressions of concern, retractions with COPE-aligned notice linking.
- SSO for staff (SAML/OIDC), MFA enforcement, advanced compliance reporting.

---

## Acceptance Tests (API + E2E)
Implement as: API tests (supertest) + UI E2E (Playwright) + RBAC/permission test matrix.

1. **Multi-journal isolation**
   - Create Journal A and B; ensure editor of A cannot list/read submissions of B; audit logs show denied access attempts.
2. **Policy versioning + effective dates**
   - Publish Policy v1, accept at submission; publish v2 with later effective date; new submissions must accept v2; old submission retains v1 acceptance record.
3. **Double-blind enforcement**
   - Reviewer views submission: cannot see author identity fields; editor-in-chief can (configurable); audit log records any identity reveal action (if enabled later).
4. **Submission lifecycle**
   - Draft → upload → submit; verify immutable submitted version; revision creates new ManuscriptVersion with correct versionNumber.
5. **Review round**
   - Invite reviewer → accept → submit review; editor sees review + recommendation; author sees only commentsToAuthor.
6. **Decision + email**
   - Record “major revision” decision triggers email queued/sent; message thread retains a copy.
7. **Issue-based publishing**
   - Create volume/issue; assign accepted article; publish article; public landing shows metadata + downloadable PDF; issue page lists articles in defined order.
8. **Auditability**
   - Key actions (policy publish, reviewer invite, decision, publish) produce AuditLog entries with actor + entity links.
9. **Resilience**
   - Worker down: UI still works, emails queued; worker restart drains queue without duplicates (idempotency keys).

---

## Assumptions (explicit)
- Single publisher instance with many journals (multi-journal, not multi-publisher SaaS in v1).
- Mixed access is represented in the model, but paywall/subscriptions are deferred until Phase 3.
- Output formats in MVP: article landing page + PDF (no JATS/HTML fulltext until later).
