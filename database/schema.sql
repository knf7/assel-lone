-- =====================================================
-- Multi-Tenant Loan Management SaaS - Database Schema
-- =====================================================
-- Database: PostgreSQL 15+
-- Purpose: Strict multi-tenant isolation with FK constraints
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Merchant status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'merchant_status') THEN
        CREATE TYPE merchant_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- =====================================================
-- TABLE: merchants (Tenants)
-- =====================================================
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(30) NOT NULL UNIQUE,
    business_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    clerk_user_id VARCHAR(255) UNIQUE,
    mobile_number VARCHAR(20),
    whatsapp_phone_id VARCHAR(20) UNIQUE,
    google_id VARCHAR(100) UNIQUE,
    
    -- Subscription Management
    subscription_plan VARCHAR(20) NOT NULL DEFAULT 'Free' CHECK (subscription_plan IN ('Free', 'Pro', 'Enterprise')),
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (subscription_status IN ('Active', 'Inactive', 'Cancelled', 'PastDue')),
    status merchant_status DEFAULT 'pending',
    stripe_customer_id VARCHAR(100) UNIQUE,
    stripe_subscription_id VARCHAR(100) UNIQUE,
    expiry_date TIMESTAMP,

    -- Security
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    session_version INT DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for performance
CREATE INDEX idx_merchants_email ON merchants(email);
CREATE INDEX idx_merchants_api_key ON merchants(api_key);
CREATE INDEX idx_merchants_whatsapp_phone ON merchants(whatsapp_phone_id);
CREATE INDEX idx_merchants_subscription_status ON merchants(subscription_status);
CREATE INDEX idx_merchants_stripe_customer ON merchants(stripe_customer_id);
CREATE INDEX idx_merchants_google_id ON merchants(google_id);

-- =====================================================
-- TABLE: merchant_employees (Sub-accounts)
-- =====================================================
CREATE TABLE merchant_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{"can_view_loans": true, "can_add_loans": true, "can_view_customers": true, "can_view_analytics": false}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_employee_merchant 
        FOREIGN KEY (merchant_id) 
        REFERENCES merchants(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_employee_merchant_id ON merchant_employees(merchant_id);
CREATE INDEX idx_employee_email ON merchant_employees(email);

-- =====================================================
-- TABLE: customers
-- =====================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL,
    
    -- Customer Information
    full_name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraints (CASCADE DELETE for data isolation)
    CONSTRAINT fk_customer_merchant 
        FOREIGN KEY (merchant_id) 
        REFERENCES merchants(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint: One customer per merchant (by national_id)
    CONSTRAINT unique_customer_per_merchant 
        UNIQUE (merchant_id, national_id)
);

-- Indexes for performance
CREATE INDEX idx_customers_merchant_id ON customers(merchant_id);
CREATE INDEX idx_customers_national_id ON customers(merchant_id, national_id);
CREATE INDEX idx_customers_mobile ON customers(mobile_number);

-- =====================================================
-- TABLE: loans (Transaction Ledger)
-- =====================================================
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    
    -- Loan Details
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    receipt_number VARCHAR(100),
    receipt_image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Paid', 'Cancelled', 'Overdue', 'Raised')),
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Najiz (Judicial) Details
    najiz_case_number VARCHAR(100),
    najiz_case_amount DECIMAL(10, 2),
    najiz_status VARCHAR(50),
    
    -- Payment Tracking
    paid_amount DECIMAL(10, 2) DEFAULT 0.00,
    payment_date TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraints
    CONSTRAINT fk_loan_merchant 
        FOREIGN KEY (merchant_id) 
        REFERENCES merchants(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_loan_customer 
        FOREIGN KEY (customer_id) 
        REFERENCES customers(id) 
        ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_loans_merchant_id ON loans(merchant_id);
CREATE INDEX idx_loans_customer_id ON loans(customer_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_transaction_date ON loans(transaction_date DESC);
CREATE INDEX idx_loans_merchant_status ON loans(merchant_id, status);

-- =====================================================
-- TABLE: payment_history (Audit Trail)
-- =====================================================
CREATE TABLE payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    
    -- Payment Details
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_reference VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_payment_loan 
        FOREIGN KEY (loan_id) 
        REFERENCES loans(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_payment_merchant 
        FOREIGN KEY (merchant_id) 
        REFERENCES merchants(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_payment_history_loan ON payment_history(loan_id);
CREATE INDEX idx_payment_history_merchant ON payment_history(merchant_id);

-- =====================================================
-- TRIGGERS: Auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS: Business Intelligence
-- =====================================================

-- View: Merchant Dashboard Metrics
CREATE OR REPLACE VIEW merchant_dashboard_metrics AS
SELECT 
    m.id AS merchant_id,
    m.business_name,
    COUNT(DISTINCT c.id) AS total_customers,
    COUNT(l.id) FILTER (WHERE l.status = 'Active') AS active_loans,
    COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'Active'), 0) AS total_outstanding,
    COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'Paid'), 0) AS total_collected,
    COALESCE(SUM(l.amount), 0) AS total_loans_value
FROM merchants m
LEFT JOIN customers c ON c.merchant_id = m.id
LEFT JOIN loans l ON l.merchant_id = m.id
GROUP BY m.id, m.business_name;

-- View: Customer Debt Summary
CREATE OR REPLACE VIEW customer_debt_summary AS
SELECT 
    c.id AS customer_id,
    c.merchant_id,
    c.full_name,
    c.national_id,
    c.mobile_number,
    COUNT(l.id) AS total_loans,
    COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'Active'), 0) AS outstanding_debt,
    COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'Paid'), 0) AS paid_amount,
    MAX(l.transaction_date) AS last_transaction_date
FROM customers c
LEFT JOIN loans l ON l.customer_id = c.id
GROUP BY c.id, c.merchant_id, c.full_name, c.national_id, c.mobile_number;

-- =====================================================
-- SECURITY: Row-Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can only see their own data
CREATE POLICY merchant_isolation_policy ON customers
    FOR ALL
    USING (merchant_id = current_setting('app.current_merchant_id')::UUID);

CREATE POLICY merchant_loans_policy ON loans
    FOR ALL
    USING (merchant_id = current_setting('app.current_merchant_id')::UUID);

CREATE POLICY merchant_payments_policy ON payment_history
    FOR ALL
    USING (merchant_id = current_setting('app.current_merchant_id')::UUID);

-- =====================================================
-- SEED DATA: Sample Merchant (For Testing)
-- =====================================================

-- Insert sample merchant
INSERT INTO merchants (
    username,
    business_name, 
    email, 
    password_hash, 
    api_key, 
    whatsapp_phone_id,
    subscription_plan,
    subscription_status,
    status,
    expiry_date
) VALUES (
    'testmerchant',
    'Test Merchant Store',
    'test@merchant.com',
    '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', -- bcrypt hash
    'test_api_key_' || md5(random()::text),
    '+966500000000',
    'Pro',
    'Active',
    'approved',
    CURRENT_TIMESTAMP + INTERVAL '30 days'
);

-- =====================================================
-- TABLE: audit_logs (Security Monitoring)
-- =====================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_merchant ON audit_logs(merchant_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function: Generate API Key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN 'sk_live_' || encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function: Check Subscription Status
CREATE OR REPLACE FUNCTION is_subscription_active(merchant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_active BOOLEAN;
BEGIN
    SELECT 
        subscription_status = 'Active' 
        AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)
    INTO is_active
    FROM merchants
    WHERE id = merchant_uuid;
    
    RETURN COALESCE(is_active, FALSE);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE merchants IS 'Multi-tenant table storing merchant/business information';
COMMENT ON TABLE customers IS 'Customer records with strict merchant_id isolation';
COMMENT ON TABLE loans IS 'Transaction ledger for all loan records';
COMMENT ON TABLE payment_history IS 'Audit trail for all payment transactions';
COMMENT ON COLUMN merchants.api_key IS 'Unique API key for webhook authentication';
COMMENT ON COLUMN merchants.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN merchants.subscription_status IS 'Current subscription status (Active/Inactive/Cancelled/PastDue)';
