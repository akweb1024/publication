# Dashboard and Analytics Audit

Audit date: 2026-05-14

| Dashboard | Stakeholder | Metrics/Data | Status | Findings | Action |
|---|---|---|---|---|---|
| Workflow Dashboard | All authenticated users | Journals count, workflow metrics, recent activity | UNDERDEVELOPED | Most metrics are static zeros; recent activity is mock. | Add summary/activity API. |
| Journal Settings | Journal admins | Journal metadata, roles, policies | READY_FOR_REVIEW | Operational controls exist. | Add validation/RBAC tests and change history view improvements. |
| Storage Settings | Journal admins | Storage routing/config/data sync | READY_FOR_REVIEW | Hybrid storage simulation exists. | Add health check and sync run observability. |
| Audit Logs | Admin/auditor | Audit entries | READY_FOR_REVIEW | Search/filter UI exists. | Add export, retention, and sensitive data review. |
| Security Center | Authenticated users/admins | MFA/session controls | DEVELOPED_NEEDS_TESTING | User MFA controls exist. | Add E2E/security tests. |
| Author Workspace | Authors | Drafts/submission state | READY_FOR_REVIEW | Core author workflow exists. | Add upload finalize UX. |
| Editorial Workspace | Editors | Queue, candidates, review assignments, decisions | READY_FOR_REVIEW | Core triage path exists. | Add deeper dashboard metrics and notification assertions. |
| Reviewer Workspace | Reviewers | Assignments/review forms | READY_FOR_REVIEW | Core review path exists. | Add route compatibility docs/tests. |
| Publishing Workspace | Production/editorial staff | Volumes/issues/articles | PARTIALLY_DEVELOPED | DOI placeholder and production gate mismatch. | Complete DOI/pipeline alignment. |
| Communications Center | Journal admins | Templates, threads, notification events | PARTIALLY_DEVELOPED | Shows queued events but statuses may never resolve. | Add delivery reconciliation and retry controls. |
| Production Pipeline | Production staff | Accepted articles, tasks, proof rounds | PARTIALLY_DEVELOPED | New and uncommitted; lacks E2E/author proof UI. | Complete module before production. |

## Analytics Gaps

- No centralized dashboard summary API.
- No production throughput metrics: task aging, proof turnarounds, blocked tasks.
- No communications deliverability metrics: sent, failed, retry count, bounce/provider response.
- No submission funnel metrics: draft to submitted to accepted to published.
- No exportable operational reports beyond visible tables.

