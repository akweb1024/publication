# Phase 1 Reliability Runbook

## Scope

This runbook covers:

- Automated Postgres + Redis backups
- Restore drill verification
- Basic incident checks for uptime and queue continuity

## Preconditions

- `docker compose up -d` is running
- Postgres/Redis containers are healthy
- Seed/migrations already applied

## 1) Create a backup

```bash
npm run ops:backup
```

Optional backup controls:

- `RETENTION_DAYS=30 npm run ops:backup`
- `ENCRYPT_BACKUP=true GPG_RECIPIENT=ops@your-domain.com npm run ops:backup`
- `OFFSITE_COPY_CMD='aws s3 sync "$BACKUP_PATH" s3://your-bucket/publication-backups/' npm run ops:backup`

Output: `backups/<timestamp>/` containing:

- `postgres.dump`
- `redis.rdb`
- `manifest.json`
- `SHA256SUMS`

## 2) Run restore drill

```bash
npm run ops:restore-drill -- backups/<timestamp>
```

The drill:

- Restores Postgres dump into `restore_drill` DB
- Verifies key table counts (`Journal`, `Submission`)
- Verifies Redis RDB file integrity (non-zero loadable artifact)

Expected: `Restore drill passed.`

## 3) Incident-first checks

### API readiness

```bash
curl -sS -i http://127.0.0.1:4000/api/v1/health/ready
```

Expect HTTP `200` and both checks `up`.

### Queue continuity

- Restart worker process
- Ensure queued jobs resume processing without duplicates
- Correlate via structured logs and `x-request-id`

## 4) Weekly reliability checklist

1. Run `npm run ops:backup`
2. Run `npm run ops:restore-drill -- backups/<latest>`
3. Capture result in ops log (date + operator + status)
4. Verify API readiness + worker job processing

## 5) Nightly automation (cron)

Install nightly backup cron (default: 2:00 AM, 14-day retention):

```bash
npm run ops:backup:cron-install
```

Customize schedule/retention:

```bash
BACKUP_CRON_SCHEDULE="0 1 * * *" RETENTION_DAYS=30 npm run ops:backup:cron-install
```

## 6) Gaps to close outside repo

To fully complete Phase 1 in production:

- Managed Postgres/Redis provider setup
- Offsite backup retention policy + encryption
- Centralized logging/alerting sink (Datadog/Grafana/ELK/etc.)
- Zero-downtime deployment orchestration for API/worker
