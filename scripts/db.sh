#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CMD="${1:-}"
if [[ -z "$CMD" ]]; then
  echo "Usage: ./scripts/db.sh <db:migrate|db:deploy|db:generate>"
  exit 1
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

case "$CMD" in
  db:migrate)
    exec ./scripts/pnpm.sh --filter @pub/db db:migrate
    ;;
  db:deploy)
    exec ./scripts/pnpm.sh --filter @pub/db db:deploy
    ;;
  db:generate)
    exec ./scripts/pnpm.sh --filter @pub/db db:generate
    ;;
  *)
    echo "Unsupported command: $CMD"
    exit 1
    ;;
esac

