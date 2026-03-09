#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/db-backup.sh"
"$SCRIPT_DIR/db-restore-check.sh"

echo "Backup + restore verification completed successfully."

