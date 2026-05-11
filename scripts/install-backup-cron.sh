#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCHEDULE="${BACKUP_CRON_SCHEDULE:-0 2 * * *}"
LOG_FILE="${BACKUP_CRON_LOG:-$ROOT_DIR/backups/backup-cron.log}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$(dirname "$LOG_FILE")"

CRON_CMD="cd $ROOT_DIR && RETENTION_DAYS=$RETENTION_DAYS npm run ops:backup >> $LOG_FILE 2>&1"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

crontab -l 2>/dev/null | grep -v "npm run ops:backup" > "$TMP_FILE" || true
echo "$SCHEDULE $CRON_CMD" >> "$TMP_FILE"
crontab "$TMP_FILE"

echo "Installed backup cron:"
echo "$SCHEDULE $CRON_CMD"
