# Security and RBAC Audit

Audit date: 2026-05-14

## Strengths

- Cookie session is HTTP-only and secure in production.
- API sets request IDs, structured logs, CORS allowlist, and basic security headers.
- Many write endpoints use `SessionGuard` and service-level journal role checks.
- Restricted PDF downloads verify session and subscriber/editorial entitlement.
- Audit logs exist for sensitive policy, storage, publishing, and communications actions.
- Storage service rejects placeholder credentials for S3-like configuration.

## Security Issues

| Issue ID | Title | Severity | Evidence | Risk | Recommended Fix |
|---|---|---|---|---|---|
| AUD-007 | Missing explicit CSRF strategy | High | Cookie-authenticated API accepts credentialed CORS requests. | Cross-site request risk if SameSite/origin assumptions fail. | Add CSRF token or formally enforce/document strict SameSite/origin model. |
| AUD-008 | Session secret normalization can mask weak secrets | Medium | `sessionSecret.padEnd(32, "0").slice(0, 32)` in `main.ts`. | Short secrets become valid keys. | Enforce min entropy/length at startup. |
| AUD-014 | Distributed rate limit missing | Medium | In-memory `Map` rate buckets. | Multi-replica deployments bypass limits. | Use Redis-backed limiter or edge rate limit. |
| AUD-015 | RBAC checks are partly service-local | Medium | Mixed guards and manual role checks across modules. | Inconsistent future endpoint protection. | Add endpoint-level RBAC matrix tests and shared helper patterns. |
| AUD-016 | Upload completion/integrity gap | Medium | StoredFile row created before object upload verification. | Orphan/stale file records and unverified content. | Add upload finalize, size/checksum validation, stale cleanup. |
| AUD-017 | Webhook security patterns absent | Medium | No webhook endpoints yet. | Future integrations may be added unsafely. | Create standard signature/idempotency guard before adding providers. |

## RBAC Matrix Snapshot

| Module | Expected Roles | Current Status | Gap |
|---|---|---|---|
| Journal settings | Journal admin/managing editor/default admin | Implemented | Add negative tests. |
| Storage config | Settings roles/default admin | Implemented | Add audit/rotation tests. |
| Policies write | Journal admin/managing editor | Implemented | Verify route specificity. |
| Editorial queue | Editorial roles | Implemented | Add route-level RBAC tests. |
| Production pipeline | Production/editor roles | Partially implemented | Add E2E and publishing policy tests. |
| Communications | Settings roles/default admin | Implemented | Add worker status/retry permissions. |
| Restricted PDF | Subscriber/editorial roles | Implemented | Add entitlement expiry tests. |
| Data management | Admin roles | Needs review | High-risk admin surface needs destructive-action tests. |

## Privacy and Compliance Gaps

- No data retention policy is enforced in code for audit logs, notification events, or stale uploads.
- No export governance was observed for sensitive administrative data.
- Legal pages/content should be reviewed before production public launch.
- Subscriber/payment privacy obligations are pending because payments are not implemented.

