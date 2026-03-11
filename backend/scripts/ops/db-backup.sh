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
BACKUP_EXCLUDE_SCHEMAS="${BACKUP_EXCLUDE_SCHEMAS:-auth,realtime,storage,graphql,graphql_public,pgbouncer,vault,extensions,supabase_migrations}"
BACKUP_EXCLUDE_EXTENSIONS="${BACKUP_EXCLUDE_EXTENSIONS:-pg_graphql,pg_stat_statements,supabase_vault}"
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

build_exclude_args() {
  local schemas_csv="$1"
  local -a args=()
  IFS=',' read -r -a schemas <<< "$schemas_csv"
  for schema in "${schemas[@]}"; do
    schema="$(echo "$schema" | xargs)"
    if [[ -n "$schema" ]]; then
      args+=("--exclude-schema=${schema}")
    fi
  done
  echo "${args[@]}"
}

build_exclude_extension_args() {
  local ext_csv="$1"
  local -a args=()
  IFS=',' read -r -a exts <<< "$ext_csv"
  for ext in "${exts[@]}"; do
    ext="$(echo "$ext" | xargs)"
    if [[ -n "$ext" ]]; then
      args+=("--exclude-extension=${ext}")
    fi
  done
  echo "${args[@]}"
}

run_pg_dump_local() {
  local PG_DUMP_BIN="${PG_DUMP_BIN:-}"
  if [[ -z "$PG_DUMP_BIN" ]]; then
    if command -v pg_dump >/dev/null 2>&1; then
      PG_DUMP_BIN="$(command -v pg_dump)"
    elif [[ -x "/opt/homebrew/opt/postgresql@17/bin/pg_dump" ]]; then
      PG_DUMP_BIN="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
    elif [[ -x "/usr/local/opt/postgresql@17/bin/pg_dump" ]]; then
      PG_DUMP_BIN="/usr/local/opt/postgresql@17/bin/pg_dump"
    elif [[ -x "/opt/homebrew/opt/postgresql@16/bin/pg_dump" ]]; then
      PG_DUMP_BIN="/opt/homebrew/opt/postgresql@16/bin/pg_dump"
    elif [[ -x "/usr/local/opt/postgresql@16/bin/pg_dump" ]]; then
      PG_DUMP_BIN="/usr/local/opt/postgresql@16/bin/pg_dump"
    fi
  fi
  if [[ -z "$PG_DUMP_BIN" ]]; then
    return 1
  fi
  echo "[$(date)] Using local pg_dump (${PG_DUMP_BIN})..."
  local EXCLUDE_ARGS
  EXCLUDE_ARGS=($(build_exclude_args "$BACKUP_EXCLUDE_SCHEMAS"))
  local EXCLUDE_EXT_ARGS
  EXCLUDE_EXT_ARGS=($(build_exclude_extension_args "$BACKUP_EXCLUDE_EXTENSIONS"))
  PGPASSWORD="$DB_PASSWORD" "$PG_DUMP_BIN" \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -Fc \
    --no-owner \
    --no-privileges \
    "${EXCLUDE_ARGS[@]}" \
    "${EXCLUDE_EXT_ARGS[@]}" \
    -f "$BACKUP_FILE"
}

run_pg_dump_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  echo "[$(date)] Using docker pg_dump from container $DB_CONTAINER..."
  local EXCLUDE_ARGS
  EXCLUDE_ARGS=($(build_exclude_args "$BACKUP_EXCLUDE_SCHEMAS"))
  local EXCLUDE_EXT_ARGS
  EXCLUDE_EXT_ARGS=($(build_exclude_extension_args "$BACKUP_EXCLUDE_EXTENSIONS"))
  docker exec "$DB_CONTAINER" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -Fc \
    --no-owner \
    --no-privileges \
    "${EXCLUDE_ARGS[@]}" \
    "${EXCLUDE_EXT_ARGS[@]}" \
    > "$BACKUP_FILE"
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
