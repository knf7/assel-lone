#!/bin/bash

# Configuration
SERVER_IP="109.199.113.45"
SERVER_USER="root"

echo "🚀 Starting deployment to $SERVER_IP..."

# 1. Sync files to server (excluding node_modules and data)
echo "📦 Syncing files..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'postgres_data' --exclude 'redis_data' --exclude 'baserow_data' --exclude 'n8n_data' ./ root@$SERVER_IP:/root/loan-management-saas/

# 2. Cleanup sensitive files on server
echo "🧹 Cleaning up sensitive files on server..."
ssh root@$SERVER_IP "rm -f /root/loan-management-saas/server_credentials.txt /root/loan-management-saas/install_ssh_key.exp"

# 3. Restart services on server
echo "🔄 Restarting Docker containers..."
ssh root@$SERVER_IP "cd /root/loan-management-saas && docker compose up -d --build"

echo "✅ Deployment complete! Please check http://109.199.113.45"
