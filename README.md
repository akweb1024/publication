# Publication Platform (Multi-Journal)

Production-ready monorepo for a multi-journal publishing platform.

## Architecture

- `apps/web`: Next.js 15 frontend
- `apps/api`: NestJS + Fastify REST API (`/api/v1`)
- `apps/worker`: BullMQ background worker
- `packages/db`: Prisma schema/client for PostgreSQL

## Local development

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### Setup

```bash
cp .env.example .env
docker compose up -d
./scripts/pnpm.sh install
./scripts/pnpm.sh db:migrate
./scripts/pnpm.sh db:seed
./scripts/pnpm.sh dev
```

### Local URLs

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/health`
- API readiness: `http://localhost:4000/api/v1/health/ready`
- Mailhog: `http://localhost:58025`
- MinIO console: `http://localhost:59001`

## Production deployment on Coolify (GitHub)

This repository includes a Coolify-ready stack that builds directly from your GitHub repo.

### Included deployment files

- `docker-compose.coolify.yml` (Coolify compose stack)
- `Dockerfile.web`
- `Dockerfile.api`
- `Dockerfile.worker`
- `.env.prod.example`
- `.env.prod.secrets.example`

### Deploy steps (quick)

1. Push your code to GitHub (`main` or production branch).
2. In Coolify: **New Resource -> Docker Compose -> Git-based**.
3. Select your GitHub repo and branch.
4. Set compose path to `docker-compose.coolify.yml`.
5. Add environment variables from `.env.prod.example` and `.env.prod.secrets.example`.
6. Configure domain for `web` service (port `3000`).
7. Deploy and check that `migrate`, `api`, and `web` become healthy.

Full guide: [docs/COOLIFY_DEPLOYMENT.md](/home/itb09/Desktop/test/publication/docs/COOLIFY_DEPLOYMENT.md)

## Required production environment variables

At minimum, configure:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DATABASE_URL_INTERNAL` (`postgresql://<user>:<password>@postgres:5432/<db>?schema=public`) for in-stack services
- Optional `DATABASE_URL` for host tools/scripts outside Docker
- `REDIS_URL` (`redis://redis:6379`)
- `SESSION_SECRET` (32+ chars)
- `WEB_ORIGIN`
- `NEXT_PUBLIC_API_BASE`
- `API_BASE`
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

Use `.env.prod.example` and `.env.prod.secrets.example` as your source templates.

## Build, test, and ops commands

```bash
npm run build
npm run typecheck
npm run test
npm run test:e2e
```

Ops helpers:

```bash
npm run ops:backup
npm run ops:restore-drill -- backups/<timestamp>
npm run ops:roll-restart
npm run ops:deploy-prod
npm run ops:obs:up
```

## Demo accounts (seeded dev)

- `admin@publisher.local` / `admin123`
- `editor@publisher.local` / `password123`
- `reviewer@publisher.local` / `password123`
- `author@publisher.local` / `password123`
