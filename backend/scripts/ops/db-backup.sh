#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROOT_DIR="$(cd "$BACKEND_DIR/.." && pwd)"

if [[ -f "$BACKEND_DIR/.env" ]]; then
  set -a
  source "$BACKEND_DIR/.env"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/db_backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-loan_management}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_CONTAINER="${DB_CONTAINER:-loan-management-postgres}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_FILE="$BACKUP_DIR/db_backup_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "$BACKUP_DIR"

run_pg_dump_local() {
  local PG_DUMP_BIN=""
  if command -v pg_dump >/dev/null 2>&1; then
    PG_DUMP_BIN="$(command -v pg_dump)"
  elif [[ -x "/opt/homebrew/opt/postgresql@16/bin/pg_dump" ]]; then
    PG_DUMP_BIN="/opt/homebrew/opt/postgresql@16/bin/pg_dump"
  elif [[ -x "/usr/local/opt/postgresql@16/bin/pg_dump" ]]; then
    PG_DUMP_BIN="/usr/local/opt/postgresql@16/bin/pg_dump"
  fi
  if [[ -z "$PG_DUMP_BIN" ]]; then
    return 1
  fi
  echo "[$(date)] Using local pg_dump..."
  PGPASSWORD="$DB_PASSWORD" "$PG_DUMP_BIN" \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -Fc \
    -f "$BACKUP_FILE"
}

run_pg_dump_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  echo "[$(date)] Using docker pg_dump from container $DB_CONTAINER..."
  docker exec "$DB_CONTAINER" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -Fc > "$BACKUP_FILE"
}

echo "[$(date)] Starting backup for database: $DB_NAME"
if ! run_pg_dump_local; then
  if ! run_pg_dump_docker; then
    echo "[$(date)] ERROR: unable to run pg_dump (local/docker)."
    exit 1
  fi
fi

shasum -a 256 "$BACKUP_FILE" > "$CHECKSUM_FILE"
echo "[$(date)] Backup created: $BACKUP_FILE"
echo "[$(date)] Checksum file: $CHECKSUM_FILE"

find "$BACKUP_DIR" -name "db_backup_*.dump" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "db_backup_*.dump.sha256" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Old backups pruned (>${RETENTION_DAYS} days)"
