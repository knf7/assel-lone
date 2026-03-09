# Baserow Table Definitions
# Import these field definitions into Baserow UI

## Table 1: Merchants (Tenants)

| Field Name | Field Type | Options/Constraints |
|------------|-----------|---------------------|
| id | UUID | Primary Key, Auto-generate |
| business_name | Text | Required, Max 255 chars |
| email | Email | Required, Unique |
| password_hash | Text | Required, Max 255 chars |
| api_key | Text | Required, Unique, Max 64 chars |
| whatsapp_phone_id | Phone Number | Unique |
| subscription_plan | Single Select | Options: Free, Pro, Enterprise (Default: Free) |
| subscription_status | Single Select | Options: Active, Inactive, Cancelled, PastDue (Default: Active) |
| stripe_customer_id | Text | Unique, Max 100 chars |
| stripe_subscription_id | Text | Unique, Max 100 chars |
| expiry_date | Date | Allow null |
| created_at | Created On | Auto-populate |
| updated_at | Last Modified | Auto-update |

**Indexes:**
- email (Unique)
- api_key (Unique)
- whatsapp_phone_id (Unique)
- subscription_status

---

## Table 2: Customers

| Field Name | Field Type | Options/Constraints |
|------------|-----------|---------------------|
| id | UUID | Primary Key, Auto-generate |
| merchant_id | Link to Table | Link to: Merchants, Required |
| full_name | Text | Required, Max 255 chars |
| national_id | Text | Required, Max 50 chars |
| mobile_number | Phone Number | Required |
| created_at | Created On | Auto-populate |
| updated_at | Last Modified | Auto-update |

**Unique Constraint:**
- Composite: (merchant_id + national_id)

**Indexes:**
- merchant_id
- national_id

---

## Table 3: Loans (Transaction Ledger)

| Field Name | Field Type | Options/Constraints |
|------------|-----------|---------------------|
| id | UUID | Primary Key, Auto-generate |
| merchant_id | Link to Table | Link to: Merchants, Required |
| customer_id | Link to Table | Link to: Customers, Required |
| amount | Number | Decimal (10,2), Min: 0.01, Required |
| receipt_number | Text | Max 100 chars |
| receipt_image_url | URL | Allow null |
| status | Single Select | Options: Active, Paid, Cancelled, Overdue (Default: Active) |
| transaction_date | Date | Required, Default: Today |
| paid_amount | Number | Decimal (10,2), Default: 0.00 |
| payment_date | Date | Allow null |
| created_at | Created On | Auto-populate |
| updated_at | Last Modified | Auto-update |

**Indexes:**
- merchant_id
- customer_id
- status
- transaction_date (Descending)

---

## Table 4: Payment History (Audit Trail)

| Field Name | Field Type | Options/Constraints |
|------------|-----------|---------------------|
| id | UUID | Primary Key, Auto-generate |
| loan_id | Link to Table | Link to: Loans, Required |
| merchant_id | Link to Table | Link to: Merchants, Required |
| amount | Number | Decimal (10,2), Required |
| payment_method | Single Select | Options: Cash, Bank Transfer, Card, WhatsApp Pay |
| transaction_reference | Text | Max 100 chars |
| created_at | Created On | Auto-populate |

**Indexes:**
- loan_id
- merchant_id

---

## Baserow API Configuration

### Authentication
```bash
# Get your Baserow API Token from: Account Settings > API Tokens
BASEROW_API_TOKEN=your_token_here
BASEROW_BASE_URL=https://your-baserow-instance.com/api
```

### Example API Calls

**Create Customer:**
```bash
curl -X POST "${BASEROW_BASE_URL}/database/rows/table/{customers_table_id}/" \
  -H "Authorization: Token ${BASEROW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "uuid-here",
    "full_name": "Ahmed Ali",
    "national_id": "1234567890",
    "mobile_number": "+966500000000"
  }'
```

**Query Loans by Merchant:**
```bash
curl -X GET "${BASEROW_BASE_URL}/database/rows/table/{loans_table_id}/?filter__merchant_id__equal=uuid-here" \
  -H "Authorization: Token ${BASEROW_API_TOKEN}"
```

**Update Subscription Status:**
```bash
curl -X PATCH "${BASEROW_BASE_URL}/database/rows/table/{merchants_table_id}/{row_id}/" \
  -H "Authorization: Token ${BASEROW_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_status": "Active",
    "expiry_date": "2026-03-15"
  }'
```

---

## Import Instructions

1. **Access Baserow:** Login to your Baserow instance
2. **Create Database:** Create a new database named "Loan Management"
3. **Create Tables:** For each table above:
   - Click "Add Table"
   - Name the table
   - Add fields one by one using the field definitions
4. **Set Relationships:**
   - In Customers table: Link `merchant_id` to Merchants table
   - In Loans table: Link `merchant_id` to Merchants and `customer_id` to Customers
   - In Payment History: Link `loan_id` to Loans and `merchant_id` to Merchants
5. **Get Table IDs:** Note down the table IDs from the URL for n8n integration
6. **Generate API Token:** Account Settings > API Tokens > Create Token

---

## Data Validation Rules

### Merchants Table
- Email must be valid format
- API Key must be unique (auto-generate using: `sk_live_` + random 32 bytes)
- WhatsApp Phone ID must be in E.164 format (+966XXXXXXXXX)

### Customers Table
- National ID must be unique per merchant
- Mobile number must be valid phone format

### Loans Table
- Amount must be greater than 0
- Customer must belong to the same merchant (enforce in n8n workflow)
- Status transitions: Active → Paid/Cancelled/Overdue

### Payment History
- Amount must match loan amount or be partial payment
- Transaction reference should be unique
