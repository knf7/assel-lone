# Multi-Tenant Loan Management SaaS Platform

A comprehensive B2B SaaS platform for managing customer debts with automated WhatsApp reporting, AI-powered message processing, and Stripe subscription billing.

## 🚀 Features

### Core Functionality
- **Multi-Tenant Architecture**: Complete data isolation between merchants
- **WhatsApp Integration**: Automated debt tracking via WhatsApp messages
- **AI-Powered Processing**: Groq (Llama-3-70b) for intelligent message parsing
- **Subscription Billing**: Stripe integration with automatic tier management
- **Real-Time Dashboard**: Metrics, charts, and activity tracking
- **Export & Reporting**: XLSX/PDF exports with financial analytics

### Technical Highlights
- **Event-Driven Architecture**: n8n workflows for business logic
- **No-Code Database**: Baserow for flexible data management
- **Modern Frontend**: React with responsive design and RTL support
- **Production-Ready**: Docker Compose with health checks and monitoring
- **Security First**: JWT authentication, RLS policies, rate limiting

## 📋 Prerequisites

- Docker & Docker Compose (v2.0+)
- Ubuntu VPS (2GB RAM minimum, 4GB recommended)
- Domain name with SSL certificate
- External API Keys:
  - Groq API Key
  - WhatsApp Business API
  - Stripe Account

## 🛠️ Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-repo/loan-management-saas.git
cd loan-management-saas
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

**Required Variables:**
```env
# Database
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password

# Baserow
BASEROW_SECRET_KEY=generate_random_key_here

# n8n
N8N_BASIC_AUTH_PASSWORD=your_n8n_password

# External APIs
GROQ_API_KEY=gsk_your_groq_key
WHATSAPP_API_TOKEN=your_whatsapp_token
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Initialize Baserow

1. Access Baserow: `http://your-domain:8000`
2. Create account and database
3. Import table schemas from `database/BASEROW_SCHEMA.md`
4. Get Table IDs from URLs
5. Update `.env` with Table IDs:
   ```env
   MERCHANTS_TABLE_ID=12345
   CUSTOMERS_TABLE_ID=12346
   LOANS_TABLE_ID=12347
   ```

### 5. Import n8n Workflows

1. Access n8n: `http://your-domain:5678`
2. Login with credentials from `.env`
3. Import workflows:
   - `n8n/whatsapp_main_workflow.json`
   - `n8n/stripe_billing_workflow.json`
4. Configure credentials:
   - Baserow API Token
   - Groq API
   - WhatsApp API
   - Stripe API

### 6. Configure WhatsApp Webhook

```bash
curl -X POST "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/subscribed_apps" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d "subscribed_fields=messages"
```

Set webhook URL: `https://your-domain.com/webhook/whatsapp-webhook`

### 7. Configure Stripe Webhook

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/webhook/stripe-webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook secret to `.env`

## 📱 Usage

### For Merchants

1. **Sign Up**: Register at `https://your-domain.com/signup`
2. **Connect WhatsApp**: Add WhatsApp Phone ID in settings
3. **Start Using**: Send messages to register debts

### WhatsApp Commands

**Register New Debt:**
```
سجل دين لـ أحمد علي
المبلغ: 5000 ريال
رقم الهوية: 1234567890
الجوال: 0500000000
رقم الإيصال: REC-001
```

**Get Report:**
```
أعطني تقرير الديون
```

**Export Data:**
```
صدر البيانات
```

## 🏗️ Architecture

```
┌─────────────┐
│  WhatsApp   │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌─────────────┐
│     n8n     │◄────►│   Groq AI   │
│  Workflows  │      └─────────────┘
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌─────────────┐
│   Baserow   │◄────►│ PostgreSQL  │
│  Database   │      └─────────────┘
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌─────────────┐
│    React    │◄────►│   Stripe    │
│  Frontend   │      │   Billing   │
└─────────────┘      └─────────────┘
```

## 🔒 Security

### Multi-Tenancy Isolation
- Row-Level Security (RLS) policies
- Merchant ID in all queries
- JWT token validation

### API Security
- Rate limiting (100 req/hour per merchant)
- CORS configuration
- Webhook signature verification
- SQL injection prevention

### Data Protection
- Encrypted passwords (bcrypt)
- HTTPS/TLS encryption
- Secure environment variables
- Regular backups

## 📊 Database Schema

### Merchants Table
```sql
- id (UUID, PK)
- business_name
- email (Unique)
- password_hash
- api_key (Unique)
- whatsapp_phone_id
- subscription_plan (Free/Pro/Enterprise)
- subscription_status (Active/Inactive/Cancelled)
- stripe_customer_id
- stripe_subscription_id
- expiry_date
```

### Customers Table
```sql
- id (UUID, PK)
- merchant_id (FK → Merchants)
- full_name
- national_id
- mobile_number
- UNIQUE(merchant_id, national_id)
```

### Loans Table
```sql
- id (UUID, PK)
- merchant_id (FK → Merchants)
- customer_id (FK → Customers)
- amount (DECIMAL)
- receipt_number
- receipt_image_url
- status (Active/Paid/Cancelled)
- transaction_date
```

## 🔧 Maintenance

### Backup Database

```bash
# Manual backup
docker-compose exec postgres pg_dump -U postgres loan_management > backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres loan_management < backup.sql
```

### Update Services

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d
```

### Monitor Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f n8n
```

## 📈 Scaling

### Horizontal Scaling
- Add n8n worker nodes
- Redis cluster for queue
- PostgreSQL read replicas

### Performance Optimization
- Enable Redis caching
- CDN for static assets
- Database query optimization
- Connection pooling

## 🐛 Troubleshooting

### n8n Workflow Not Triggering
1. Check webhook URL is accessible
2. Verify credentials are configured
3. Check n8n logs: `docker-compose logs n8n`

### Database Connection Error
1. Ensure PostgreSQL is running
2. Check credentials in `.env`
3. Verify network connectivity

### WhatsApp Not Responding
1. Verify webhook is registered
2. Check WhatsApp API token
3. Review n8n execution logs

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@your-domain.com

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] SMS integration
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] API marketplace
