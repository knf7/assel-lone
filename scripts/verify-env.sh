#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV_FILE="${1:-$ROOT_DIR/backend/.env}"
FRONTEND_ENV_FILE="${2:-$ROOT_DIR/frontend-next/.env.local}"

fail=0

info() { echo "[INFO] $*"; }
ok() { echo "[OK]   $*"; }
err() { echo "[ERR]  $*"; fail=1; }

check_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    err "Missing env file: $file"
  else
    ok "Found env file: $file"
  fi
}

get_value() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d'=' -f2- || true
}

is_placeholder() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  [[ "$val" =~ CHANGE_THIS|your_|YOUR_|example|REPLACE_ME|sk_test|pk_test|whsec_your|localhost ]] && return 0
  return 1
}

validate_keys() {
  local file="$1"
  shift
  local keys=("$@")
  for key in "${keys[@]}"; do
    local value
    value="$(get_value "$file" "$key")"
    if is_placeholder "$value"; then
      err "$key is missing or placeholder in $file"
    else
      ok "$key looks set in $file"
    fi
  done
}

check_file "$BACKEND_ENV_FILE"
check_file "$FRONTEND_ENV_FILE"

if [[ "$fail" -eq 0 ]]; then
  info "Validating backend production variables..."
  validate_keys "$BACKEND_ENV_FILE" \
    NODE_ENV \
    DB_HOST \
    DB_PORT \
    DB_NAME \
    DB_USER \
    DB_PASSWORD \
    JWT_SECRET \
    ADMIN_SECRET \
    ADMIN_PASSWORD \
    FRONTEND_URL \
    SENTRY_DSN

  info "Validating frontend production variables..."
  validate_keys "$FRONTEND_ENV_FILE" \
    NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    CLERK_SECRET_KEY \
    NEXT_PUBLIC_SENTRY_DSN
fi

if [[ "$fail" -ne 0 ]]; then
  echo
  err "Environment validation failed."
  exit 1
fi

echo
ok "Environment validation passed."
exit 0
