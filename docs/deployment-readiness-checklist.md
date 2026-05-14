# Deployment Readiness Checklist

Audit date: 2026-05-14

## Pre-Deployment

| Item | Status | Notes |
|---|---|---|
| Worktree clean and intended changes committed | NOT_READY | Production Pipeline v1 and audit docs are currently local. |
| Prisma migrations reviewed | PARTIAL | Production pipeline migration needs review before deploy. |
| Environment variables complete | PARTIAL | Coolify template exists; `NEXT_PUBLIC_SITE_URL` warning observed in compose config. |
| Secrets are not committed | READY_FOR_REVIEW | No secret exposure was identified in audit outputs; continue avoiding plaintext. |
| CI pipeline green | NOT_READY | No workflow found. |
| Staging deploy completed | NOT_READY | Required before production. |
| Database backup verified | NOT_READY | Needs documented restore test. |
| Rollback plan tested | NOT_READY | Needs staging rehearsal. |

## Runtime

| Item | Status | Notes |
|---|---|---|
| API health endpoint | READY_FOR_REVIEW | `/health`, `/health/ready` exist. |
| Worker health/queue status | PARTIAL | Worker logs exist; no DB queue reconciliation dashboard. |
| Error logging | PARTIAL | Structured logs exist; external monitor not wired. |
| Metrics/alerts | NOT_READY | Alert receiver placeholder; app metrics missing. |
| Rate limits | PARTIAL | In-memory only. |
| Security headers | READY_FOR_REVIEW | Basic API headers exist. |
| HTTPS assumptions | PARTIAL | Secure cookies in production; deployment proxy must provide HTTPS. |

## Go-Live Gates

- All P0 and P1 issues closed or explicitly feature-gated.
- Staging migration and rollback validated.
- Communications delivery statuses are reliable.
- Production pipeline policy decided and tested.
- Dashboard overview uses real data.
- RBAC/security tests pass.
- Observability alerts reach real destination.

