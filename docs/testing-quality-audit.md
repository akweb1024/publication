# Testing and Quality Audit

Audit date: 2026-05-14

## Existing Tests

| Test Area | Files | Coverage |
|---|---|---|
| API E2E | `apps/api/src/test/api.e2e.test.ts` | Multi-journal isolation, policy acceptance/tracking number, reviewer redaction. |
| Reviewer service | `apps/api/src/test/services/reviewer.service.test.ts` | Accept/decline/submit review service logic. |
| Communications service | `apps/api/src/test/services/communications.service.test.ts` | Template/default queue behavior with mocks. |
| Production service | `apps/api/src/test/services/production.service.test.ts` | Production task/proof service logic; currently uncommitted. |
| Web E2E | `apps/web/e2e/*.spec.ts` | Publishing flow, author happy path, editor triage, reviewer submit review, article SEO meta. |
| Smoke tests | `apps/web/src/smoke.test.ts`, `apps/worker/src/smoke.test.ts` | Basic package/runtime smoke checks. |

## Latest Validation Evidence

Recent non-destructive validations from the current work sequence passed:

- Prisma generate.
- Prisma schema validate with placeholder `DATABASE_URL`.
- API test suite.
- Web build including `/dashboard/production`.
- Repo typecheck after build.
- Coolify compose config with warning for unset `NEXT_PUBLIC_SITE_URL`.
- `git diff --check`.

These should be rerun in CI after audit docs are committed.

## Missing Tests

| Issue ID | Area | Missing Test | Priority |
|---|---|---|---|
| AUD-001 | Release state | CI gate to prevent uncommitted/generated artifacts from being missed. | P1_HIGH |
| AUD-002 | Dashboard | API-backed summary unit/integration tests and UI E2E. | P1_HIGH |
| AUD-003 | Communications | Worker completion/failure status update tests and retry tests. | P1_HIGH |
| AUD-004 | DOI | DOI provider/idempotency/failure tests after implementation. | P1_HIGH |
| AUD-005 | Production | E2E for accepted article through production to publish. | P1_HIGH |
| AUD-006 | Policies | Regression for `/policies/active-required`. | P2_MEDIUM |
| AUD-007 | Security | CSRF/session negative tests. | P1_HIGH |
| AUD-015 | RBAC | Role matrix tests for admin/editor/production/reviewer/subscriber. | P1_HIGH |
| AUD-016 | Uploads | Upload completion/checksum/failure cleanup tests. | P2_MEDIUM |
| AUD-020 | Payments | Checkout/webhook/subscriber entitlement tests when module starts. | P2_MEDIUM |

## Quality Risks

- No GitHub Actions or equivalent CI workflow was found.
- Newest major modules have unit tests but not enough route/E2E coverage.
- API request validation is present via Zod in controllers, but output contracts are not centralized.
- Manual validation is currently doing the work that CI should enforce.

## Recommended Test Plan

1. Add CI workflow: install, generate Prisma, lint/typecheck, API tests, web build, worker tests.
2. Add high-value API integration tests for Communications and Production.
3. Add one E2E per critical role: author, editor, reviewer, production editor, journal admin, subscriber.
4. Add RBAC denial tests for sensitive routes.
5. Add migration validation in staging before any production DB changes.

