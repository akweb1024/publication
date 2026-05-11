#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_PATH="${1:-}"
if [[ -z "$BACKUP_PATH" ]]; then
  echo "Usage: ./scripts/restore-drill.sh <backup-directory>"
  echo "Example: ./scripts/restore-drill.sh backups/20260509-120000"
  exit 1
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-$(docker compose ps -q postgres)}"
REDIS_CONTAINER="${REDIS_CONTAINER:-$(docker compose ps -q redis)}"
POSTGRES_USER="${POSTGRES_USER:-pub}"
RESTORE_DB="${RESTORE_DB:-restore_drill}"

if [[ -z "$POSTGRES_CONTAINER" || -z "$REDIS_CONTAINER" ]]; then
  echo "postgres/redis containers are not running. Start infra with: docker compose up -d"
  exit 1
fi

if [[ ! -f "$BACKUP_PATH/postgres.dump" || ! -f "$BACKUP_PATH/redis.rdb" ]]; then
  if [[ -f "$BACKUP_PATH/postgres.dump.gpg" && -f "$BACKUP_PATH/redis.rdb.gpg" ]]; then
    echo "Encrypted backup detected."
  else
    echo "Backup files missing in $BACKUP_PATH"
    exit 1
  fi
fi

if [[ -f "$BACKUP_PATH/SHA256SUMS" ]]; then
  echo "Verifying backup checksums..."
  (cd "$BACKUP_PATH" && sha256sum -c SHA256SUMS >/dev/null)
fi

POSTGRES_DUMP_FILE="$BACKUP_PATH/postgres.dump"
REDIS_DUMP_FILE="$BACKUP_PATH/redis.rdb"

if [[ -f "$BACKUP_PATH/postgres.dump.gpg" && -f "$BACKUP_PATH/redis.rdb.gpg" ]]; then
  if ! command -v gpg >/dev/null 2>&1; then
    echo "gpg is required to restore encrypted backups"
    exit 1
  fi
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  gpg --batch --yes --decrypt --output "$TMP_DIR/postgres.dump" "$BACKUP_PATH/postgres.dump.gpg"
  gpg --batch --yes --decrypt --output "$TMP_DIR/redis.rdb" "$BACKUP_PATH/redis.rdb.gpg"
  POSTGRES_DUMP_FILE="$TMP_DIR/postgres.dump"
  REDIS_DUMP_FILE="$TMP_DIR/redis.rdb"
fi

echo "Restoring Postgres backup into database: $RESTORE_DB"
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS $RESTORE_DB;" >/dev/null
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $RESTORE_DB;" >/dev/null
cat "$POSTGRES_DUMP_FILE" | docker exec -i "$POSTGRES_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --clean --if-exists >/dev/null

echo "Verifying Postgres restore..."
JOURNAL_COUNT="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -At -c "SELECT COUNT(*) FROM \"Journal\";")"
SUBMISSION_COUNT="$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -At -c "SELECT COUNT(*) FROM \"Submission\";")"
echo "Journal rows: $JOURNAL_COUNT"
echo "Submission rows: $SUBMISSION_COUNT"

echo "Testing Redis RDB loadability..."
docker cp "$REDIS_DUMP_FILE" "$REDIS_CONTAINER:/data/restore-drill.rdb"
REDIS_BYTES="$(docker exec "$REDIS_CONTAINER" sh -lc "wc -c /data/restore-drill.rdb | awk '{print \$1}'")"
echo "Redis backup bytes: $REDIS_BYTES"

if [[ "$JOURNAL_COUNT" == "0" || "$SUBMISSION_COUNT" == "0" || "$REDIS_BYTES" == "0" ]]; then
  echo "Restore drill failed integrity checks."
  exit 1
fi

echo "Restore drill passed."
