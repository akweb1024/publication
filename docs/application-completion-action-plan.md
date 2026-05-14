# Application Completion Action Plan

Audit date: 2026-05-14

## Phase 0: Stop-the-line Critical Audit

Current P0 blockers found: none confirmed from latest validation evidence.

Actions:

1. Freeze implementation until audit docs are reviewed.
2. Confirm current uncommitted Production Pipeline v1 scope.
3. Rerun non-destructive validation: Prisma validate, API tests, web build, typecheck.
4. Review dirty worktree and decide commit/rework plan.

## Phase 1: Stabilize Foundation

Priority fixes:

- AUD-001: Commit or explicitly park Production Pipeline v1.
- AUD-006: Verify policy route order and add regression test.
- AUD-007: Add CSRF/session hardening.
- AUD-008: Enforce strong session secret requirements.
- AUD-015: Add RBAC matrix tests and shared permission documentation.
- AUD-019: Add CI workflow.

## Phase 2: Complete Core User Journeys

Priority fixes:

- AUD-002: Add real dashboard summary/activity API.
- AUD-005: Complete accepted article to production to publish journey.
- AUD-016: Add upload completion verification.
- Add subscriber entitlement expiry tests.

## Phase 3: Complete Integrations and Webhooks

Priority fixes:

- AUD-003: Add worker status reconciliation and retry controls.
- AUD-004: Implement or feature-flag DOI deposit provider.
- Create webhook signature/idempotency guard before payment/DOI webhooks.

## Phase 4: Complete Dashboards and Analytics

Priority fixes:

- Replace fake dashboard metrics.
- Add admin dashboard exports/filtering where operationally needed.
- Add communications delivery metrics.
- Add production throughput/task-aging metrics.

## Phase 5: Complete Content and UX

Priority fixes:

- Update Help Center for Communications and Production.
- Finish SEO/accessibility checklist.
- Review public legal/support pages.
- Add useful empty states for each dashboard module.

## Phase 6: Testing and QA

Priority fixes:

- Add API integration tests for communications, production, upload lifecycle, RBAC.
- Add E2E for production pipeline and communications center.
- Add security negative tests.
- Add CI test matrix.

## Phase 7: Production Readiness

Priority fixes:

- Add metrics endpoint and real alert receiver.
- Rehearse backup/restore and migration rollback.
- Add release checklist and runbook updates.
- Add performance smoke/load checks.

## Phase 8: Deployment Preparation

Priority fixes:

- Deploy to staging.
- Run UAT checklist by role.
- Resolve all P0/P1 issues.
- Prepare production env checklist and release notes.

