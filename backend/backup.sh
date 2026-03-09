#!/bin/bash

# Aseel SaaS - Automated PostgreSQL Backup Script
# Usage: Add to crontab -e
# Example (Every day at 2:00 AM): 0 2 * * * /path/to/backup.sh

set -e

BACKUP_DIR="/var/backups/aseel_db"
DATE=$(date +"%Y%m%d_%H%M%S")
DB_CONTAINER="postgres_db" # Name of your PostgreSQL Docker container
DB_USER="postgres"
DB_NAME="loan_management"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform backup using pg_dump inside the docker container
docker exec $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/backup_$DATE.sql"

# Compress the backup to save space
gzip "$BACKUP_DIR/backup_$DATE.sql"

# Optional: Keep only the last 7 days of backups to prevent disk exhaustion
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -exec rm {} \;

echo "✅ Backup successfully created at $BACKUP_DIR/backup_$DATE.sql.gz"
