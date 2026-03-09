#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ENV_CHECK=1

for arg in "$@"; do
  case "$arg" in
    --skip-env-check) RUN_ENV_CHECK=0 ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: scripts/preflight.sh [--skip-env-check]"
      exit 1
      ;;
  esac
done

section() {
  echo
  echo "=================================================="
  echo "$1"
  echo "=================================================="
}

if [[ "$RUN_ENV_CHECK" -eq 1 ]]; then
  section "1) Verify production environment values"
  "$ROOT_DIR/scripts/verify-env.sh"
fi

section "2) Backend operational checks"
(
  cd "$ROOT_DIR/backend"
  npm run monitor:check
  npm run security:permissions
  npm run backup:verify
)

section "3) Backend test suite"
(
  cd "$ROOT_DIR/backend"
  npm test -- --runInBand
)

section "4) Frontend lint + build"
(
  cd "$ROOT_DIR/frontend-next"
  npm run lint
  npm run build
)

section "Preflight result"
echo "PASS: System is ready for release candidate deployment."
