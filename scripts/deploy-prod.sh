#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICES="${SERVICES:-api,worker,web}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:4000/api/v1/health/ready}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:3000}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
SKIP_PULL="${SKIP_PULL:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
DRY_RUN="${DRY_RUN:-false}"

run_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

echo "Deploy started with compose file: $COMPOSE_FILE"
run_cmd "docker compose -f \"$COMPOSE_FILE\" config >/dev/null"

if [[ "$SKIP_BACKUP" != "true" ]]; then
  echo "Step 1/6: taking backup"
  run_cmd "npm run ops:backup"
else
  echo "Step 1/6: skipping backup (SKIP_BACKUP=true)"
fi

if [[ "$SKIP_PULL" != "true" ]]; then
  echo "Step 2/6: pulling latest images"
  run_cmd "docker compose -f \"$COMPOSE_FILE\" pull"
else
  echo "Step 2/6: skipping pull (SKIP_PULL=true)"
fi

if [[ "$SKIP_BUILD" != "true" ]]; then
  echo "Step 3/6: building images"
  run_cmd "docker compose -f \"$COMPOSE_FILE\" build"
else
  echo "Step 3/6: skipping build (SKIP_BUILD=true)"
fi

echo "Step 4/6: running migrations"
run_cmd "docker compose -f \"$COMPOSE_FILE\" run --rm api npm run db:deploy"

echo "Step 5/6: rolling restart"
run_cmd "COMPOSE_FILE=\"$COMPOSE_FILE\" SERVICES=\"$SERVICES\" API_HEALTH_URL=\"$API_HEALTH_URL\" WEB_HEALTH_URL=\"$WEB_HEALTH_URL\" npm run ops:roll-restart"

echo "Step 6/6: smoke checks"
run_cmd "curl -fsS \"$API_HEALTH_URL\" >/dev/null"
run_cmd "curl -fsS \"$WEB_HEALTH_URL\" >/dev/null"
echo "Deploy succeeded."
