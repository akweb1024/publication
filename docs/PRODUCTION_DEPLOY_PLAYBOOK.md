# Production Deploy Playbook (Single Server, Docker Compose)

## Goal

Deploy safely on a single server with near-zero downtime behavior by restarting app services one-by-one and validating health before moving to the next service.

## Assumptions

- You deploy with Docker Compose.
- Production compose file is `docker-compose.prod.yml` (fallback: `docker-compose.yml`).
- `api`, `web`, and `worker` are separate services in Compose.
- Infra services (`postgres`, `redis`, `minio`) stay running during app rollout.

## 1) Pre-deploy checks

```bash
docker compose -f docker-compose.prod.yml config >/dev/null
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:4000/api/v1/health/ready
```

Confirm:

- API readiness is healthy (`ok: true`)
- No active incident / disk pressure / backup failure

## 2) Backup before rollout

```bash
npm run ops:backup
```

Keep the generated backup path handy.

## 3) Build/pull latest images

Use whichever strategy your server follows:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml build
```

## 4) Rolling restart (app services only)

```bash
COMPOSE_FILE=docker-compose.prod.yml \
SERVICES=api,worker,web \
API_HEALTH_URL=http://127.0.0.1:4000/api/v1/health/ready \
WEB_HEALTH_URL=http://127.0.0.1:3000 \
npm run ops:roll-restart
```

What it does:

- Recreates `api`, waits for API readiness.
- Recreates `worker`, waits until running.
- Recreates `web`, waits until reachable.

## Optional controlled dry run

Use this before the first real deployment:

```bash
COMPOSE_FILE=docker-compose.prod.yml DRY_RUN=true npm run ops:deploy-prod
```

This prints every deploy step without making live changes.

## 5) Post-deploy verification

```bash
curl -fsS http://127.0.0.1:4000/api/v1/health/ready
curl -fsS http://127.0.0.1:3000 >/dev/null
```

Then verify:

- Login + one submission flow
- Editorial queue page
- Worker logs show no repeated failures

## 6) Rollback path

If rollout fails:

1. Revert app image tag/commit.
2. Re-run rolling restart script.
3. If data corruption is suspected, run restore drill first:
   - `npm run ops:restore-drill -- backups/<timestamp>`

## 7) Operational cadence

- Weekly: backup + restore drill (`docs/PHASE1_RELIABILITY_RUNBOOK.md`)
- Every deploy: pre-check + rolling restart + post-check
