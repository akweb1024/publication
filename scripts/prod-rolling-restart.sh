#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  COMPOSE_FILE="docker-compose.yml"
fi

SERVICES_RAW="${SERVICES:-api,worker,web}"
IFS=',' read -r -a REQUESTED_SERVICES <<< "$SERVICES_RAW"

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:4000/api/v1/health/ready}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:3000}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-90}"

function wait_http_ok() {
  local url="$1"
  local timeout="$2"
  local started
  started="$(date +%s)"
  while true; do
    if curl -fsS -m 3 "$url" >/dev/null 2>&1; then
      return 0
    fi
    local now
    now="$(date +%s)"
    if (( now - started >= timeout )); then
      echo "Health check timed out for $url after ${timeout}s"
      return 1
    fi
    sleep 2
  done
}

function wait_container_running() {
  local service="$1"
  local timeout="$2"
  local started
  started="$(date +%s)"
  while true; do
    local cid
    cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$service")"
    if [[ -n "$cid" ]]; then
      local state
      state="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)"
      if [[ "$state" == "running" ]]; then
        return 0
      fi
    fi
    local now
    now="$(date +%s)"
    if (( now - started >= timeout )); then
      echo "Container for service '$service' did not reach running state after ${timeout}s"
      return 1
    fi
    sleep 2
  done
}

echo "Using compose file: $COMPOSE_FILE"
AVAILABLE_SERVICES="$(docker compose -f "$COMPOSE_FILE" config --services)"

for raw_service in "${REQUESTED_SERVICES[@]}"; do
  service="$(echo "$raw_service" | xargs)"
  if [[ -z "$service" ]]; then
    continue
  fi
  if ! echo "$AVAILABLE_SERVICES" | grep -qx "$service"; then
    echo "Skipping '$service' (not defined in $COMPOSE_FILE)"
    continue
  fi

  echo "Rolling restart: $service"
  docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate "$service"

  if [[ "$service" == "api" ]]; then
    wait_http_ok "$API_HEALTH_URL" "$HEALTH_TIMEOUT_SECONDS"
    echo "api healthy: $API_HEALTH_URL"
  elif [[ "$service" == "web" ]]; then
    wait_http_ok "$WEB_HEALTH_URL" "$HEALTH_TIMEOUT_SECONDS"
    echo "web reachable: $WEB_HEALTH_URL"
  else
    wait_container_running "$service" "$HEALTH_TIMEOUT_SECONDS"
    echo "$service running"
  fi
done

echo "Rolling restart completed."
