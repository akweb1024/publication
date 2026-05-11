# Coolify Deployment Guide (GitHub)

This guide deploys the full Publication Platform stack to Coolify from a GitHub repository using `docker-compose.coolify.yml`.

## 1) Prerequisites

- Coolify server is up and reachable.
- GitHub repository is pushed and accessible to Coolify.
- DNS records prepared for your web domain (and optional API/MinIO domains).
- SMTP credentials available.

## 2) Prepare GitHub repository

1. Push these files to your default deployment branch (`main` recommended):
   - `docker-compose.coolify.yml`
   - `Dockerfile.web`
   - `Dockerfile.api`
   - `Dockerfile.worker`
2. Ensure these files are committed:
   - `.env.prod.example`
   - `.env.prod.secrets.example`

## 3) Create project in Coolify

1. In Coolify, create a new **Project** (or use existing).
2. Click **New Resource** -> **Docker Compose**.
3. Select **Git-based deployment**.
4. Connect/select your GitHub repo.
5. Branch: `main` (or your production branch).
6. Compose path: `docker-compose.coolify.yml`.

## 4) Configure environment variables in Coolify

Add all required variables in Coolify UI (Environment tab). Use `.env.prod.example` and `.env.prod.secrets.example` as source of truth.

### Required core variables

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL` (`postgresql://<user>:<password>@postgres:5432/<db>`)
- `REDIS_URL` (`redis://redis:6379`)
- `SESSION_SECRET` (at least 32 chars)
- `WEB_ORIGIN` (e.g. `https://publication.yourdomain.com`)
- `NEXT_PUBLIC_API_BASE` (e.g. `https://publication.yourdomain.com/api/v1`)
- `API_BASE` (same as above)

### S3 / MinIO variables

- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `S3_ENDPOINT` (`http://minio:9000`)
- `S3_BUCKET`
- `S3_REGION` (e.g. `us-east-1`)
- `S3_FORCE_PATH_STYLE` (`true`)
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

### SMTP variables

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### Full environment template for STM Journals domains

Use this in Coolify -> Environment (replace placeholder secrets):

```env
NODE_ENV=production

# Public domains
SERVICE_URL_API=https://apinew.stmjournals.com
SERVICE_URL_WEB=https://new.stmjournals.com

# App URLs
WEB_ORIGIN=https://new.stmjournals.com
NEXT_PUBLIC_API_BASE=https://apinew.stmjournals.com/api/v1
API_BASE=http://api:4000/api/v1
API_PORT=4000
WEB_PORT=3000

# Postgres
POSTGRES_USER=pub
POSTGRES_PASSWORD=REPLACE_ME
POSTGRES_DB=pub
DATABASE_URL=postgresql://pub:REPLACE_ME@postgres:5432/pub

# Redis
REDIS_URL=redis://redis:6379

# Session
SESSION_SECRET=REPLACE_WITH_32_PLUS_CHAR_SECRET
STORAGE_CONFIG_ENCRYPTION_KEY=REPLACE_WITH_32_PLUS_CHAR_SECRET

# MinIO / S3
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=REPLACE_ME
S3_ENDPOINT=http://minio:9000
S3_BUCKET=publication
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY=REPLACE_ME
S3_SECRET_KEY=REPLACE_ME

# SMTP
SMTP_HOST=REPLACE_SMTP_HOST
SMTP_PORT=587
SMTP_USER=REPLACE_SMTP_USER
SMTP_PASS=REPLACE_SMTP_PASS
SMTP_FROM=no-reply@stmjournals.com
```

## 5) Domain and port routing

- Expose `web` service port `3000` publicly via Coolify domain.
- Keep `api`, `postgres`, `redis`, `minio` private unless explicitly needed.
- If you expose API separately, route to service `api` port `4000` and update `NEXT_PUBLIC_API_BASE`.

## 6) Deploy

1. Click **Deploy** in Coolify.
2. Verify container startup order:
   - `postgres`/`redis` healthy
   - `migrate` completes successfully
   - `api` healthy
   - `web` healthy
3. Open the assigned domain and confirm app loads.

## 7) Post-deploy validation checklist

- `GET /api/v1/health` returns success.
- Login works with seeded or production users.
- File upload path works (S3/MinIO).
- Email notifications send via SMTP.
- Worker is processing queue jobs.

## 8) Ongoing GitHub auto-deploy flow

1. Commit and push to your deploy branch.
2. Coolify pulls latest commit and rebuilds services.
3. Monitor deployment logs and health checks in Coolify.

## 9) Rollback strategy

- In Coolify, redeploy a previous successful commit from Deployments history.
- If a schema migration caused the issue, restore DB from backup before re-deploying.
