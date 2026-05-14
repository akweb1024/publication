# Prioritized Action Roadmap

Audit date: 2026-05-14

## P0 Critical

No confirmed P0 issue was found in the current audit evidence. Continue treating build, migration, auth, exposed secrets, and production crash failures as stop-the-line if discovered in CI/staging.

## P1 High

| Order | Issue | Action | Exit Criteria |
|---:|---|---|---|
| 1 | AUD-001 | Review and commit or park Production Pipeline v1. | Worktree clean; migration reviewed; branch state clear. |
| 2 | AUD-016 | Add CI pipeline. | Install/generate/typecheck/test/build gates pass. |
| 3 | AUD-003 | Reconcile communications delivery status. | Sent/failed statuses update in DB; retry/admin view exists. |
| 4 | AUD-002 | Replace dashboard mock metrics. | `/dashboard` displays real counts/activity. |
| 5 | AUD-007 | Add CSRF/session hardening. | Security tests and documented threat model. |
| 6 | AUD-015 | Add RBAC role matrix tests. | Sensitive endpoints have allow/deny coverage. |
| 7 | AUD-005/AUD-010 | Complete production-to-publish policy. | Accepted article can pass production and publish in E2E. |
| 8 | AUD-004 | Resolve DOI placeholder. | Real provider integration or feature-gated manual workflow. |

## P2 Medium

| Issue | Action |
|---|---|
| AUD-006 | Verify/reorder policy route and add regression test. |
| AUD-008 | Enforce session secret strength. |
| AUD-009 | Add upload finalize/checksum lifecycle. |
| AUD-011 | Update help content and onboarding guidance. |
| AUD-012 | Add metrics/alerts and observability runbook checks. |
| AUD-013 | Document or consolidate duplicate reviewer endpoints. |
| AUD-014 | Move rate limiting to Redis/edge for multi-replica deployments. |
| AUD-017 | Add webhook signature/idempotency standard. |
| AUD-018 | Add API response contract tests or shared generated types. |
| AUD-019 | Plan payment/subscription provider if paid access is required. |
| AUD-020 | Complete SEO/accessibility checklist. |

