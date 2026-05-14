# Production Readiness Plan

Audit date: 2026-05-14  
Current readiness level: READY_FOR_UAT candidate with production limitations.

## Readiness Checklist

| Area | Status | Blocking Gap | Required Before Production |
|---|---|---|---|
| Build | PARTIALLY_READY | Local validation passes, no CI. | Add CI build/typecheck/test pipeline. |
| Database migrations | PARTIALLY_READY | Production pipeline migration is uncommitted. | Review migration, run staging backup/restore test. |
| Auth/session | PARTIALLY_READY | CSRF/session hardening incomplete. | Add CSRF strategy and session secret validation. |
| RBAC | PARTIALLY_READY | Missing full role matrix tests. | Add negative tests and route matrix docs. |
| Email/notifications | PARTIALLY_READY | Worker does not update DB delivery statuses. | Add reconciliation, retries, admin resend. |
| Publishing | PARTIALLY_READY | DOI placeholder and production gate policy. | Implement/mark DOI manual, align production gate. |
| Storage | PARTIALLY_READY | Upload completion verification missing. | Add finalize/checksum/stale cleanup. |
| Observability | PARTIALLY_READY | No app metrics/real alert receiver. | Add metrics, alert destinations, runbook probes. |
| Security headers | READY_FOR_REVIEW | Basic headers exist. | Add CSP review if public content includes rich HTML. |
| Performance | PARTIALLY_READY | No load testing evidence. | Add query/index review and smoke load test. |
| Accessibility | PARTIALLY_READY | SEO/accessibility checklist incomplete. | Add skip link/landmarks and axe/manual checks. |
| Legal/content | PARTIALLY_READY | Legal/compliance content needs review. | Confirm privacy/terms/support contacts. |
| Deployment | READY_FOR_STAGING | Coolify docs/config exist. | Run staging deploy with migration and rollback plan. |

## Phase Gate Criteria

### Ready for Staging

- Audit docs committed.
- Worktree clean or intentionally staged.
- Prisma migration reviewed.
- CI pipeline added.
- Non-destructive build/typecheck/tests pass.

### Ready for UAT

- Dashboard overview uses real data.
- Communications delivery statuses reconcile.
- Production pipeline has E2E coverage.
- RBAC matrix tests pass.
- Staging migration applied and rollback rehearsed.

### Ready for Production

- DOI/payment decisions resolved or feature-gated.
- Observability alerts configured with real receiver.
- Backup and restore verified.
- Security review complete.
- Release notes and go-live checklist signed off.

