# Schema Impact Analysis

Audit date: 2026-05-14

## Current Schema Summary

The Prisma schema supports:

- Multi-journal tenancy and roles.
- Policy versioning and acceptance.
- Submissions, contributors, file sets, and stored files.
- Editorial assignments, review rounds, reviewer assignments, reviews, and decisions.
- Publishing volumes, issues, articles, access states, and published assets.
- Storage and external data sync configuration.
- Communications center entities.
- Production pipeline entities in the current uncommitted worktree.

## Missing Schema Requirements

| Requirement | Current State | Recommended Schema Direction |
|---|---|---|
| DOI deposit tracking | Audit log and email queue only | Add `DoiDepositAttempt` or generalized `ProviderJob` with provider, payload hash, response, status, retry count. |
| Payment/subscription | Subscriber dates on role assignment | Add provider customer/subscription/payment event models if paid access is required. |
| Upload lifecycle | `StoredFile` represents created file metadata | Add status fields or upload session model for pending/uploaded/verified/failed. |
| Webhook idempotency | No webhook model | Add `WebhookEvent` with provider, external id, signature status, processed at, failure reason. |
| Notification delivery reconciliation | `NotificationEvent` and `Message` have status fields | Existing schema can support reconciliation; jobs need message/event IDs. |
| Dashboard activity | `AuditLog` exists | Existing schema can support first version of activity feed. |

## Schema Conflicts or Risks

- `Article.productionStatus` is new and defaults to `NOT_STARTED`; publishing currently allows `NOT_STARTED` and `READY_FOR_PUBLICATION`. This is compatible but weakens the production pipeline unless policy is changed.
- Communications delivery status fields exist but are not updated by the worker.
- Upload metadata can be persisted before the binary object is actually present.
- Payment/subscriber lifecycle is not normalized beyond role assignment dates.

## Required Migrations

No destructive migration should be run from this audit. Candidate future migrations:

1. Upload lifecycle status/verified fields.
2. DOI deposit attempt tracking.
3. Webhook event/idempotency table.
4. Payment/subscription provider tables if paid access is in scope.

## Safe Migration Plan

1. Add nullable fields or new tables first.
2. Backfill from existing records where possible.
3. Deploy application code that writes both old and new fields.
4. Verify staging data and queries.
5. Tighten constraints only after backfill validation.

## Rollback Plan

- Keep additive migrations reversible by leaving old fields untouched.
- For each migration, create a pre-migration backup.
- Test rollback on staging with representative article, submission, and notification records.

## Seed Data Requirements

- Ensure seed covers one author, reviewer, editor, production editor, subscriber, journal admin.
- Add seed examples for production task/proof states.
- Add seed examples for communications sent/failed/skipped once reconciliation exists.

