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
RESTORE_DB_HOST="${RESTORE_DB_HOST:-$DB_HOST}"
RESTORE_DB_PORT="${RESTORE_DB_PORT:-$DB_PORT}"
RESTORE_DB_USER="${RESTORE_DB_USER:-$DB_USER}"
RESTORE_DB_PASSWORD="${RESTORE_DB_PASSWORD:-$DB_PASSWORD}"
RESTORE_DB_NAME="${RESTORE_DB_NAME:-postgres}"
RESTORE_DB_SSLMODE="${RESTORE_DB_SSLMODE:-${PGSSLMODE:-}}"
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
    PGPASSWORD="$RESTORE_DB_PASSWORD" PGSSLMODE="$RESTORE_DB_SSLMODE" \
      psql -h "$RESTORE_DB_HOST" -p "$RESTORE_DB_PORT" -U "$RESTORE_DB_USER" -d "$RESTORE_DB_NAME" \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TMP_DB';" >/dev/null 2>&1 || true
    PGPASSWORD="$RESTORE_DB_PASSWORD" PGSSLMODE="$RESTORE_DB_SSLMODE" \
      psql -h "$RESTORE_DB_HOST" -p "$RESTORE_DB_PORT" -U "$RESTORE_DB_USER" -d "$RESTORE_DB_NAME" \
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
    PGPASSWORD="$RESTORE_DB_PASSWORD" PGSSLMODE="$RESTORE_DB_SSLMODE" \
      "$PSQL_BIN" -h "$RESTORE_DB_HOST" -p "$RESTORE_DB_PORT" -U "$RESTORE_DB_USER" -d "$db" -v ON_ERROR_STOP=1 -c "$sql"
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
    PGPASSWORD="$RESTORE_DB_PASSWORD" PGSSLMODE="$RESTORE_DB_SSLMODE" \
      "$PSQL_BIN" -h "$RESTORE_DB_HOST" -p "$RESTORE_DB_PORT" -U "$RESTORE_DB_USER" -d "$db" -tA -v ON_ERROR_STOP=1 -c "$sql"
    return
  fi
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$db" -tA -v ON_ERROR_STOP=1 -c "$sql"
}

run_restore() {
  local PG_RESTORE_BIN="${PG_RESTORE_BIN:-}"
  if [[ -z "$PG_RESTORE_BIN" ]]; then
    if command -v pg_restore >/dev/null 2>&1; then
      PG_RESTORE_BIN="$(command -v pg_restore)"
    elif [[ -x "/opt/homebrew/opt/postgresql@17/bin/pg_restore" ]]; then
      PG_RESTORE_BIN="/opt/homebrew/opt/postgresql@17/bin/pg_restore"
    elif [[ -x "/usr/local/opt/postgresql@17/bin/pg_restore" ]]; then
      PG_RESTORE_BIN="/usr/local/opt/postgresql@17/bin/pg_restore"
    elif [[ -x "/opt/homebrew/opt/postgresql@16/bin/pg_restore" ]]; then
      PG_RESTORE_BIN="/opt/homebrew/opt/postgresql@16/bin/pg_restore"
    elif [[ -x "/usr/local/opt/postgresql@16/bin/pg_restore" ]]; then
      PG_RESTORE_BIN="/usr/local/opt/postgresql@16/bin/pg_restore"
    fi
  fi

  local RESTORE_OPTS=(--no-owner --no-privileges --no-publications --no-subscriptions --section=pre-data --section=data)
  if [[ -n "$PG_RESTORE_BIN" ]]; then
    PGPASSWORD="$RESTORE_DB_PASSWORD" PGSSLMODE="$RESTORE_DB_SSLMODE" \
      "$PG_RESTORE_BIN" -h "$RESTORE_DB_HOST" -p "$RESTORE_DB_PORT" -U "$RESTORE_DB_USER" -d "$TMP_DB" \
      "${RESTORE_OPTS[@]}" -v "$SOURCE_BACKUP" >/dev/null
    return
  fi
  cat "$SOURCE_BACKUP" | docker exec -i "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$TMP_DB" \
    "${RESTORE_OPTS[@]}" -v >/dev/null
}

echo "[$(date)] Restore check started using backup: $SOURCE_BACKUP"
run_psql "$RESTORE_DB_NAME" "CREATE DATABASE $TMP_DB;"
# Pre-create extensions schema + core extensions used by public tables
run_psql "$TMP_DB" "CREATE SCHEMA IF NOT EXISTS extensions;"
run_psql "$TMP_DB" "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA extensions;"
run_psql "$TMP_DB" "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;"
run_restore

TABLES_COUNT="$(run_scalar "$TMP_DB" "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('merchants','customers','loans');" | tr -d '[:space:]')"
LOANS_COUNT="$(run_scalar "$TMP_DB" "SELECT COUNT(*) FROM loans;" | tr -d '[:space:]')"

if [[ "$TABLES_COUNT" != "3" ]]; then
  echo "[$(date)] Restore check FAILED: expected core tables not found."
  exit 1
fi

echo "[$(date)] Restore check PASSED."
echo "[$(date)] Core tables found: $TABLES_COUNT, loans rows: $LOANS_COUNT"
