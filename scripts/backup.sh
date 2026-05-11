#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$BACKUP_DIR/$STAMP"
mkdir -p "$OUT_DIR"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-$(docker compose ps -q postgres)}"
REDIS_CONTAINER="${REDIS_CONTAINER:-$(docker compose ps -q redis)}"
POSTGRES_DB="${POSTGRES_DB:-pub}"
POSTGRES_USER="${POSTGRES_USER:-pub}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
ENCRYPT_BACKUP="${ENCRYPT_BACKUP:-false}"
GPG_RECIPIENT="${GPG_RECIPIENT:-}"
OFFSITE_COPY_CMD="${OFFSITE_COPY_CMD:-}"
CHECKSUM_FILE="SHA256SUMS"

if [[ -z "$POSTGRES_CONTAINER" || -z "$REDIS_CONTAINER" ]]; then
  echo "postgres/redis containers are not running. Start infra with: docker compose up -d"
  exit 1
fi

echo "Creating Postgres backup..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$OUT_DIR/postgres.dump"

echo "Creating Redis backup..."
docker exec "$REDIS_CONTAINER" redis-cli --rdb /data/dump.rdb >/dev/null
docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$OUT_DIR/redis.rdb"

echo "Generating checksums..."
(
  cd "$OUT_DIR"
  sha256sum postgres.dump redis.rdb > "$CHECKSUM_FILE"
)

if [[ "$ENCRYPT_BACKUP" == "true" ]]; then
  if [[ -z "$GPG_RECIPIENT" ]]; then
    echo "ENCRYPT_BACKUP=true but GPG_RECIPIENT is not set"
    exit 1
  fi
  echo "Encrypting backup artifacts with GPG recipient: $GPG_RECIPIENT"
  gpg --batch --yes --trust-model always --output "$OUT_DIR/postgres.dump.gpg" --encrypt --recipient "$GPG_RECIPIENT" "$OUT_DIR/postgres.dump"
  gpg --batch --yes --trust-model always --output "$OUT_DIR/redis.rdb.gpg" --encrypt --recipient "$GPG_RECIPIENT" "$OUT_DIR/redis.rdb"
  rm -f "$OUT_DIR/postgres.dump" "$OUT_DIR/redis.rdb"
  (
    cd "$OUT_DIR"
    sha256sum postgres.dump.gpg redis.rdb.gpg > "$CHECKSUM_FILE"
  )
fi

cat > "$OUT_DIR/manifest.json" <<EOF
{
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "postgresDump": "$( [[ "$ENCRYPT_BACKUP" == "true" ]] && echo "postgres.dump.gpg" || echo "postgres.dump" )",
  "redisDump": "$( [[ "$ENCRYPT_BACKUP" == "true" ]] && echo "redis.rdb.gpg" || echo "redis.rdb" )",
  "checksumFile": "$CHECKSUM_FILE",
  "encrypted": $([[ "$ENCRYPT_BACKUP" == "true" ]] && echo "true" || echo "false"),
  "postgresDb": "$POSTGRES_DB",
  "postgresUser": "$POSTGRES_USER"
}
EOF

if [[ -n "$OFFSITE_COPY_CMD" ]]; then
  echo "Running offsite copy command..."
  BACKUP_PATH="$OUT_DIR" sh -c "$OFFSITE_COPY_CMD"
fi

echo "Applying retention policy (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +

echo "Backup completed: $OUT_DIR"
