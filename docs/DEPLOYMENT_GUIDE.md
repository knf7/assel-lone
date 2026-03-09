# Deployment Guide - Multi-Tenant Loan Management SaaS

This guide walks you through deploying the platform on an Ubuntu VPS from scratch.

## Prerequisites

- Ubuntu 22.04 LTS VPS (minimum 2GB RAM, 20GB storage)
- Root or sudo access
- Domain name pointed to your VPS IP
- SSH access

## Step 1: Server Setup

### 1.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Docker

```bash
# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 1.3 Install Additional Tools

```bash
sudo apt install -y git nginx certbot python3-certbot-nginx ufw
```

### 1.4 Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

## Step 2: SSL Certificate Setup

### 2.1 Obtain Let's Encrypt Certificate

```bash
# Stop nginx if running
sudo systemctl stop nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Certificates will be at:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 2.2 Auto-Renewal Setup

```bash
# Test renewal
sudo certbot renew --dry-run

# Renewal is automatic via systemd timer
sudo systemctl status certbot.timer
```

## Step 3: Clone and Configure Project

### 3.1 Clone Repository

```bash
cd /opt
sudo git clone https://github.com/your-repo/loan-management-saas.git
cd loan-management-saas
sudo chown -R $USER:$USER .
```

### 3.2 Configure Environment

```bash
cp .env.example .env
nano .env
```

**Critical Variables to Set:**

```env
# Database (Generate strong passwords)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

# Baserow
BASEROW_PUBLIC_URL=https://your-domain.com
BASEROW_SECRET_KEY=$(openssl rand -base64 64)

# n8n
N8N_HOST=your-domain.com
N8N_PROTOCOL=https
N8N_WEBHOOK_URL=https://your-domain.com
N8N_BASIC_AUTH_PASSWORD=$(openssl rand -base64 16)

# External APIs (Get from respective platforms)
GROQ_API_KEY=gsk_your_key_here
WHATSAPP_API_TOKEN=your_token_here
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### 3.3 Update Nginx Configuration

```bash
# Copy SSL certificates
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# Update domain in nginx.conf
sed -i 's/your-domain.com/actual-domain.com/g' nginx/nginx.conf
```

## Step 4: Deploy Services

### 4.1 Start Docker Compose

```bash
# Pull images
docker compose pull

# Start services in detached mode
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 4.2 Verify Services

```bash
# Check if all services are healthy
docker compose ps

# Expected output:
# NAME                          STATUS
# loan-management-postgres      Up (healthy)
# loan-management-redis         Up (healthy)
# loan-management-baserow       Up (healthy)
# loan-management-n8n           Up (healthy)
# loan-management-frontend      Up (healthy)
# loan-management-nginx         Up (healthy)
```

## Step 5: Initialize Baserow

### 5.1 Access Baserow

1. Open browser: `https://your-domain.com/baserow`
2. Create admin account
3. Create new database: "Loan Management"

### 5.2 Create Tables

Follow `database/BASEROW_SCHEMA.md` to create:

1. **Merchants Table**
   - Add all fields as specified
   - Set field types correctly
   - Configure unique constraints

2. **Customers Table**
   - Link to Merchants table
   - Set composite unique constraint

3. **Loans Table**
   - Link to both Merchants and Customers
   - Configure decimal precision for amounts

### 5.3 Get Table IDs

1. Open each table in Baserow
2. Copy Table ID from URL: `https://your-domain.com/database/{database_id}/table/{TABLE_ID}`
3. Update `.env`:

```bash
nano .env

# Add these lines:
MERCHANTS_TABLE_ID=12345
CUSTOMERS_TABLE_ID=12346
LOANS_TABLE_ID=12347
```

4. Restart n8n to load new variables:

```bash
docker compose restart n8n
```

## Step 6: Configure n8n

### 6.1 Access n8n

1. Open: `https://your-domain.com/n8n`
2. Login with credentials from `.env`

### 6.2 Create Credentials

**Baserow API Token:**
1. In Baserow: Account Settings → API Tokens
2. Create new token
3. In n8n: Credentials → Add → HTTP Header Auth
   - Name: `Baserow API Token`
   - Header Name: `Authorization`
   - Header Value: `Token YOUR_BASEROW_TOKEN`

**Groq API:**
1. n8n: Credentials → Add → Groq API
2. Enter API key from Groq Console

**WhatsApp API:**
1. n8n: Credentials → Add → HTTP Header Auth
   - Name: `WhatsApp API Token`
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_WHATSAPP_TOKEN`

### 6.3 Import Workflows

1. Workflows → Import from File
2. Import `n8n/whatsapp_main_workflow.json`
3. Import `n8n/stripe_billing_workflow.json`
4. Assign credentials to each node
5. Activate both workflows

## Step 7: Configure External Services

### 7.1 WhatsApp Business API

```bash
# Register webhook
curl -X POST "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/subscribed_apps" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d "subscribed_fields=messages"

# Set webhook URL
# URL: https://your-domain.com/webhook/whatsapp-webhook
# Verify Token: (set in WhatsApp Business settings)
```

### 7.2 Stripe Webhooks

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-domain.com/webhook/stripe-webhook`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy webhook signing secret
6. Update `.env` with `STRIPE_WEBHOOK_SECRET`
7. Restart n8n: `docker compose restart n8n`

## Step 8: Testing

### 8.1 Test WhatsApp Integration

Send test message to your WhatsApp Business number:

```
سجل دين لـ أحمد علي
المبلغ: 1000 ريال
رقم الهوية: 1234567890
الجوال: 0500000000
```

Expected: Confirmation message received

### 8.2 Test Dashboard

1. Access: `https://your-domain.com`
2. Create merchant account
3. Login and verify dashboard loads
4. Check metrics are displayed

### 8.3 Test Stripe Integration

1. Create test subscription in Stripe Dashboard
2. Verify merchant subscription status updates in Baserow
3. Check WhatsApp notification received

## Step 9: Monitoring & Maintenance

### 9.1 Setup Monitoring

```bash
# Install monitoring tools
docker run -d \
  --name=cadvisor \
  --volume=/:/rootfs:ro \
  --volume=/var/run:/var/run:ro \
  --volume=/sys:/sys:ro \
  --volume=/var/lib/docker/:/var/lib/docker:ro \
  --publish=8080:8080 \
  --detach=true \
  google/cadvisor:latest
```

### 9.2 Setup Automated Backups

```bash
# Create backup script
cat > /opt/loan-management-saas/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/loan-management"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker compose exec -T postgres pg_dump -U postgres loan_management > $BACKUP_DIR/db_$DATE.sql

# Backup volumes
docker run --rm -v loan-management-saas_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/postgres_data_$DATE.tar.gz -C /data .
docker run --rm -v loan-management-saas_n8n_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/n8n_data_$DATE.tar.gz -C /data .

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/loan-management-saas/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/loan-management-saas/backup.sh >> /var/log/backup.log 2>&1") | crontab -
```

### 9.3 Log Rotation

```bash
# Configure Docker log rotation
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

sudo systemctl restart docker
```

## Step 10: Security Hardening

### 10.1 Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config

# Set:
PermitRootLogin no
PasswordAuthentication no

sudo systemctl restart sshd
```

### 10.2 Install Fail2Ban

```bash
sudo apt install -y fail2ban

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 10.3 Setup Automatic Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs [service_name]

# Restart specific service
docker compose restart [service_name]

# Rebuild and restart
docker compose up -d --build [service_name]
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker compose logs postgres

# Connect to database
docker compose exec postgres psql -U postgres -d loan_management

# Check connections
SELECT * FROM pg_stat_activity;
```

### Webhook Not Working

```bash
# Test webhook endpoint
curl -X POST https://your-domain.com/webhook/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check n8n logs
docker compose logs n8n | grep webhook
```

## Performance Optimization

### Enable Redis Caching

```bash
# Already configured in docker-compose.yml
# Verify Redis is working
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping
```

### Database Optimization

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d loan_management

# Run VACUUM
VACUUM ANALYZE;

# Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

## Conclusion

Your Multi-Tenant Loan Management SaaS is now deployed and ready for production use!

**Next Steps:**
1. Create your first merchant account
2. Configure WhatsApp Business number
3. Set up Stripe products and pricing
4. Invite team members
5. Monitor system health

**Support:**
- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@your-domain.com
