# Route, API, and Schema Audit

Audit date: 2026-05-14

## Frontend Routes

| Route | Class | Status | Notes |
|---|---|---|---|
| `/` | PUBLIC | READY_FOR_REVIEW | Public landing route exists. |
| `/about`, `/authors`, `/editors`, `/readers`, `/policies`, `/subscribers`, `/journals` | PUBLIC | READY_FOR_REVIEW | Static/content routes exist; content/legal review still needed. |
| `/:journalSlug` | PUBLIC | READY_FOR_REVIEW | Journal landing route exists. |
| `/:journalSlug/focus-scope`, `/editorial-board`, `/policies`, `/policies/:key`, `/archive` | PUBLIC | READY_FOR_REVIEW | Journal content routes exist. |
| `/:journalSlug/archive/volumes/:volumeId`, `/issues/:issueId` | PUBLIC | READY_FOR_REVIEW | Archive detail routes exist. |
| `/:journalSlug/articles/:articleId` | PUBLIC | READY_FOR_REVIEW | Article page exists; restricted PDF handled by file endpoint. |
| `/login`, `/register` | PUBLIC | DEVELOPED_NEEDS_TESTING | Auth screens exist; add negative auth tests. |
| `/dashboard` | AUTHENTICATED | UNDERDEVELOPED | Metrics are static/mock. |
| `/dashboard/journals` | ADMIN | READY_FOR_REVIEW | Journal settings and roles. |
| `/dashboard/storage` | ADMIN | READY_FOR_REVIEW | Storage and data sync controls. |
| `/dashboard/data` | ADMIN | DEVELOPED_NEEDS_TESTING | Data management surface needs stronger audit/RBAC tests. |
| `/dashboard/security` | AUTHENTICATED | DEVELOPED_NEEDS_TESTING | MFA user controls. |
| `/dashboard/audit` | ADMIN | READY_FOR_REVIEW | Audit log UI. |
| `/dashboard/submissions` | AUTHENTICATED | READY_FOR_REVIEW | Author workspace. |
| `/dashboard/editor` | ADMIN/EDITORIAL | READY_FOR_REVIEW | Editorial queue. |
| `/dashboard/reviewer` | AUTHENTICATED | READY_FOR_REVIEW | Reviewer assignments. |
| `/dashboard/publishing` | EDITORIAL/PRODUCTION | PARTIALLY_DEVELOPED | DOI and production gating incomplete. |
| `/dashboard/communications` | ADMIN | PARTIALLY_DEVELOPED | Delivery statuses not reconciled. |
| `/dashboard/production` | EDITORIAL/PRODUCTION | PARTIALLY_DEVELOPED | Uncommitted module; missing E2E/proof recipient loop. |
| `/dashboard/help` | AUTHENTICATED | NEEDS_IMPROVEMENT | Help content should include communications/production pipeline. |
| `/.well-known/agent.json`, `/llms.txt`, `/robots.txt`, `/sitemap.xml` | PUBLIC | READY_FOR_REVIEW | AI/SEO routes exist; checklist still has open items. |

## API Surface

| API Area | Routes | Status | Findings |
|---|---|---|---|
| Health | `/health`, `/health/ready` | READY | Good production probes. |
| Auth | `/auth/register`, `/auth/login`, `/auth/google`, `/auth/logout`, `/auth/session`, `/auth/nav-context`, MFA routes | PARTIAL | Needs CSRF/session threat model and E2E. |
| User profile | `/me` GET/PATCH | READY | Authenticated profile path. |
| Journals/admin | `/journals`, `/journals/:journalSlug`, roles, audit logs, storage config, data sync | PARTIAL | Large admin surface; needs more negative RBAC tests. |
| Policies | `/journals/:journalSlug/policies/*` | PARTIAL | `:key` route appears before `active-required`; verify/reorder. |
| Submissions | `/journals/:journalSlug/submissions`, `/submissions/*` | READY | Upload completion verification is missing. |
| Editor | `/journals/:slug/editor/*`, assignment/review/decision endpoints | READY | Good core coverage; notification side effects need tests. |
| Reviewer | `/reviewer/*` and `/review-assignments/*` | PARTIAL | Duplicate route surface should be documented or consolidated. |
| Publishing | volumes/issues/articles/assign/publish/doi-deposit | PARTIAL | DOI deposit placeholder; production gate permissive. |
| Production | `/journals/:slug/production/*`, `/articles/:id/production/*`, `/proof-rounds/*` | PARTIAL | Uncommitted; unit tests only. |
| Communications | templates, communications, preferences | PARTIAL | Queue status reconciliation missing. |
| Storage files | `/files/:fileId/download` | READY | Restricted PDF access checks exist. |
| Public | `/public/journals`, `/public/articles/:articleId` | READY | Supports public journal/article reads. |
| Agent | `/agent/capabilities` | READY | Discovery endpoint only. |

## Schema Coverage

The Prisma schema includes models for:

- Tenant/publisher/journal setup: `Publisher`, `Journal`, `JournalRoleAssignment`, `User`.
- Policy/compliance: `PolicyDocument`, `PolicyVersion`, `PolicyAcceptance`.
- Submission workflow: `SubmissionSequence`, `Submission`, `ManuscriptVersion`, `FileSet`, `StoredFile`, `SubmissionContributor`.
- Editorial/review: `EditorAssignment`, `ReviewRound`, `ReviewAssignment`, `Review`, `Decision`.
- Publishing: `Volume`, `Issue`, `Article`, `PublishedAsset`.
- Communications: `MessageThread`, `Message`, `EmailTemplate`, `NotificationPreference`, `NotificationEvent`.
- Storage/data sync: `JournalStorageConfig`, `JournalDataSyncConfig`, `JournalDataSyncRun`.
- Production pipeline: `ProductionTask`, `ProofRound`, `ProofAnnotation`, article production fields.

## Route/API Issues

| Issue ID | Title | Severity | Evidence | Action |
|---|---|---|---|---|
| AUD-006 | Policy route specificity risk | Medium | `policies.controller.ts` declares `@Get(":key")` before `@Get("active-required")`. | Add regression test and reorder static route first if needed. |
| AUD-013 | Duplicate reviewer API surface | Medium | Reviewer controller exposes both reviewer-scoped and direct review-assignment endpoints. | Document compatibility or version/deprecate one surface. |
| AUD-018 | API response contracts are informal | Medium | Zod validates bodies, but response DTOs/output validation are inconsistent. | Add DTO/contract tests for public/admin APIs. |
| AUD-009 | Upload metadata can outlive failed object upload | Medium | StoredFile row is created before presigned upload completion. | Add upload completion endpoint/status. |

