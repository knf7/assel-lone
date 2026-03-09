-- Migration: Add Employees and Najiz Fields
-- Date: 2026-02-23

-- 1. Update loans table status constraint
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE loans ADD CONSTRAINT loans_status_check CHECK (status IN ('Active', 'Paid', 'Cancelled', 'Overdue', 'Raised'));

-- 2. Add Najiz fields to loans
ALTER TABLE loans ADD COLUMN IF NOT EXISTS najiz_case_number VARCHAR(100);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS najiz_case_amount DECIMAL(10, 2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS najiz_status VARCHAR(50);

-- 3. Create merchant_employees table
CREATE TABLE IF NOT EXISTS merchant_employees (
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

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_employee_merchant_id ON merchant_employees(merchant_id);

-- Update updated_at trigger for merchant_employees
CREATE TRIGGER update_merchant_employees_updated_at BEFORE UPDATE ON merchant_employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update merchant_dashboard_metrics view to include Cases and Delayed
DROP VIEW IF EXISTS merchant_dashboard_metrics CASCADE;
CREATE VIEW merchant_dashboard_metrics AS
SELECT 
    m.id AS merchant_id,
    m.business_name,
    COUNT(DISTINCT c.id) AS total_customers,
    COUNT(l.id) FILTER (WHERE l.status = 'Active') AS active_loans,
    COUNT(l.id) FILTER (WHERE l.status = 'Overdue') AS delayed_loans,
    COUNT(l.id) FILTER (WHERE l.status = 'Raised') AS cases_count,
    COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'Active'), 0) AS total_outstanding,
    COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'Paid'), 0) AS total_collected,
    COALESCE(SUM(l.amount), 0) AS total_loans_value
FROM merchants m
LEFT JOIN customers c ON c.merchant_id = m.id
LEFT JOIN loans l ON l.merchant_id = m.id
GROUP BY m.id, m.business_name;
