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
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_CONTAINER="${DB_CONTAINER:-loan-management-postgres}"
SOURCE_BACKUP="${1:-}"
TMP_DB="restore_check_$(date +%Y%m%d_%H%M%S)"

if [[ -z "$SOURCE_BACKUP" ]]; then
  SOURCE_BACKUP="$(ls -t "$BACKUP_DIR"/db_backup_*.dump 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$SOURCE_BACKUP" || ! -f "$SOURCE_BACKUP" ]]; then
  echo "No backup file found. Provide path or run backup first."
  exit 1
fi

cleanup() {
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TMP_DB';" >/dev/null 2>&1 || true
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
      -c "DROP DATABASE IF EXISTS $TMP_DB;" >/dev/null 2>&1 || true
  elif command -v docker >/dev/null 2>&1; then
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TMP_DB';" >/dev/null 2>&1 || true
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
      -c "DROP DATABASE IF EXISTS $TMP_DB;" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

run_psql() {
  local db="$1"; shift
  local sql="$1"
  local PSQL_BIN=""
  if command -v psql >/dev/null 2>&1; then
    PSQL_BIN="$(command -v psql)"
  elif [[ -x "/opt/homebrew/opt/postgresql@16/bin/psql" ]]; then
    PSQL_BIN="/opt/homebrew/opt/postgresql@16/bin/psql"
  elif [[ -x "/usr/local/opt/postgresql@16/bin/psql" ]]; then
    PSQL_BIN="/usr/local/opt/postgresql@16/bin/psql"
  fi

  if [[ -n "$PSQL_BIN" ]]; then
    PGPASSWORD="$DB_PASSWORD" "$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 -c "$sql"
    return
  fi
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 -c "$sql"
}

run_scalar() {
  local db="$1"; shift
  local sql="$1"
  local PSQL_BIN=""
  if command -v psql >/dev/null 2>&1; then
    PSQL_BIN="$(command -v psql)"
  elif [[ -x "/opt/homebrew/opt/postgresql@16/bin/psql" ]]; then
    PSQL_BIN="/opt/homebrew/opt/postgresql@16/bin/psql"
  elif [[ -x "/usr/local/opt/postgresql@16/bin/psql" ]]; then
    PSQL_BIN="/usr/local/opt/postgresql@16/bin/psql"
  fi

  if [[ -n "$PSQL_BIN" ]]; then
    PGPASSWORD="$DB_PASSWORD" "$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" -tA -v ON_ERROR_STOP=1 -c "$sql"
    return
  fi
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$db" -tA -v ON_ERROR_STOP=1 -c "$sql"
}

run_restore() {
  local PG_RESTORE_BIN=""
  if command -v pg_restore >/dev/null 2>&1; then
    PG_RESTORE_BIN="$(command -v pg_restore)"
  elif [[ -x "/opt/homebrew/opt/postgresql@16/bin/pg_restore" ]]; then
    PG_RESTORE_BIN="/opt/homebrew/opt/postgresql@16/bin/pg_restore"
  elif [[ -x "/usr/local/opt/postgresql@16/bin/pg_restore" ]]; then
    PG_RESTORE_BIN="/usr/local/opt/postgresql@16/bin/pg_restore"
  fi

  if [[ -n "$PG_RESTORE_BIN" ]]; then
    PGPASSWORD="$DB_PASSWORD" "$PG_RESTORE_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TMP_DB" -v "$SOURCE_BACKUP" >/dev/null
    return
  fi
  cat "$SOURCE_BACKUP" | docker exec -i "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$TMP_DB" -v >/dev/null
}

echo "[$(date)] Restore check started using backup: $SOURCE_BACKUP"
run_psql postgres "CREATE DATABASE $TMP_DB;"
run_restore

TABLES_COUNT="$(run_scalar "$TMP_DB" "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('merchants','customers','loans');" | tr -d '[:space:]')"
LOANS_COUNT="$(run_scalar "$TMP_DB" "SELECT COUNT(*) FROM loans;" | tr -d '[:space:]')"

if [[ "$TABLES_COUNT" != "3" ]]; then
  echo "[$(date)] Restore check FAILED: expected core tables not found."
  exit 1
fi

echo "[$(date)] Restore check PASSED."
echo "[$(date)] Core tables found: $TABLES_COUNT, loans rows: $LOANS_COUNT"
