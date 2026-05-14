# Frontend, Backend, and Schema Sync Audit

Audit date: 2026-05-14

## Sync Issue Register

| Issue ID | File Path | Component/Page | Issue Type | Severity | Affected Route | User Impact | Recommended Fix |
|---|---|---|---|---|---|---|---|
| AUD-002 | `apps/web/src/app/dashboard/page.tsx` | Dashboard overview | Mock/static data | High | `/dashboard` | Operators see zero metrics even when data exists. | Add `/dashboard/summary` API and wire real counts/activity. |
| AUD-003 | `apps/api/src/modules/communications/communications.service.ts`, `apps/worker/src/index.ts` | Communications Center | Backend/worker status mismatch | High | `/dashboard/communications` | Queued events may never show sent/failed state. | Add event/message IDs to queue jobs and update DB on worker complete/fail. |
| AUD-005 | `apps/web/src/app/dashboard/production/page.tsx`, `apps/api/src/modules/production/*` | Production Pipeline | Workflow sync incomplete | High | `/dashboard/production` | Staff can manage production, but authors cannot complete proof loop. | Add author proof screen, notifications, and E2E. |
| AUD-004 | `apps/api/src/modules/publishing/publishing.service.ts` | DOI deposit | API name exceeds implementation | High | `/dashboard/publishing` | Staff may believe DOI was deposited when only a notification was queued. | Rename as placeholder or implement real DOI deposit tracking. |
| AUD-010 | `apps/web/src/app/dashboard/publishing/page.tsx` | Publish flow | Production policy mismatch | High | `/dashboard/publishing` | New production workflow can be bypassed for `NOT_STARTED` articles. | Decide backward compatibility policy and surface production readiness before publish. |
| AUD-009 | `apps/api/src/modules/submissions/submissions.service.ts` | Submission upload | Storage/schema lifecycle mismatch | Medium | `/dashboard/submissions` | A DB file row can exist even if upload fails. | Add upload finalize/status and cleanup stale pending files. |
| AUD-011 | `apps/web/src/app/dashboard/help/page.tsx` | Help Center | Content drift | Medium | `/dashboard/help` | Users may not see guidance for communications/production modules. | Update help workflows after module stabilization. |
| AUD-018 | Multiple controllers | API contracts | Type/contract drift risk | Medium | All API consumers | Frontend types can diverge from backend responses. | Generate shared API types or add contract tests. |

## Field Flow Checks

| Workflow | UI Field | API Body | Schema Field | Status | Notes |
|---|---|---|---|---|---|
| Submission metadata | title, abstract, keywords, article type | `update-draft` | `Submission.manuscriptTitle`, `abstractText`, `keywordsText`, `articleType` | Synced | Needs stronger validation for keyword limits and article type set. |
| Submission files | originalName, mimeType, sizeBytes, sha256, role | `createUpload` | `StoredFile.*` | Partial | No confirmed upload completion state. |
| Policy acceptance | accepted policy IDs | `submit` | `PolicyAcceptance` | Synced | API E2E covers required acceptance. |
| Decision letters | letter text | `decisions` | `Decision`, notification event | Partial | Decision created; notification queue status not reconciled. |
| Email templates | subject/body/variables/active | template CRUD | `EmailTemplate` | Synced | Variables are stored but not schema-typed beyond JSON. |
| Notification preferences | event key/email enabled | preference PATCH | `NotificationPreference` | Synced | Event taxonomy should be documented. |
| Production tasks | status/assignee/due/notes | task PATCH | `ProductionTask` | Partial | New module lacks E2E and author proof loop. |
| Proof rounds | file ID/notes/status | proof APIs | `ProofRound`, `ProofAnnotation` | Partial | Recipient-facing proof review missing. |
| Publishing articles | issue ID, PDF file ID | assign/publish | `Article`, `PublishedAsset` | Partial | DOI and production readiness not complete. |

## Orphan or Weakly Connected UI

- Dashboard overview stats and recent activity need a backend data source.
- Production pipeline dashboard exists in local changes but should be committed and validated before release.
- Help Center should be updated to explain Communications Center and Production Pipeline.
- Subscriber route and restricted PDF behavior exist, but no payment/subscription workflow connects them.

