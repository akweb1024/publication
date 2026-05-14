# Integration Health Audit

Audit date: 2026-05-14

| Integration | Purpose | Env/Config | Current Status | Risks | Required Action |
|---|---|---|---|---|---|
| PostgreSQL | Primary relational database | `DATABASE_URL` | CONFIGURED | Migration order and uncommitted production migration need release discipline. | Run migration review in staging before production. |
| Redis/BullMQ | Email queue/background jobs | `REDIS_URL` | CONFIGURED | Jobs lack DB reconciliation/idempotency metadata. | Add job IDs, event IDs, retry policy, status updates. |
| SMTP | Outbound email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | PARTIALLY_CONFIGURED | Delivery success/failure not persisted. | Worker should update `Message` and `NotificationEvent`. |
| S3-compatible storage/MinIO | File uploads/downloads | `S3_*`, journal storage config | CONFIGURED | Upload completion/checksum verification missing. | Add finalize/health/checksum path. |
| Google OAuth | Login via Google token | Google client env | PARTIALLY_CONFIGURED | Token login path exists; callback/provider configuration needs deployment verification. | Add auth E2E/manual staging verification. |
| DOI/Crossref | DOI deposit | Not implemented | NOT_STARTED | Current route only queues an email; misleading operational status. | Add DOI provider module or clearly mark as manual queue. |
| Payment provider | Paid subscriber access | Not present | NOT_STARTED | Restricted PDF entitlement has no checkout/renewal source. | Plan payment/subscription module. |
| Webhooks | External callbacks | None found | NOT_STARTED | No signature/idempotency patterns yet. | Add standard webhook guard before first provider. |
| AI/agent discovery | AI agent metadata/capability surfacing | `.well-known`, `/agent/capabilities` | CONFIGURED | Discovery only; no AI workflow module. | Keep as discovery unless product needs AI editorial tools. |
| Observability/alerting | Monitoring and alert routing | docs and compose assets | PARTIALLY_CONFIGURED | Placeholder alert receiver and no app metrics endpoint. | Implement metrics and configure real alert destinations. |

## Webhook Readiness

No payment, DOI, SMS, or provider webhook endpoints were found. Before adding webhooks, implement:

- Signature verification middleware.
- Idempotency key storage.
- Retry-safe transaction handling.
- Audit log and provider event storage.
- Admin replay/diagnostic surface.

