#!/bin/bash

# Configuration
BACKUP_DIR="./db_backups"
DB_CONTAINER="loan-management-postgres"
DB_USER="postgres"
DB_NAME="loan_management"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql.gz"
RETENTION_DAYS=7

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Execute pg_dump inside the docker container and compress it
echo "[$(date)] Starting backup of $DB_NAME..."
docker exec -t $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup successful: $BACKUP_FILE"
else
  echo "[$(date)] Backup FAILED!"
  exit 1
fi

# Clean up old backups (keep last $RETENTION_DAYS days)
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;

echo "[$(date)] Backup process completed."
