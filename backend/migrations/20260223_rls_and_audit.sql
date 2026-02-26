-- 20260223_rls_and_audit.sql
-- Phase: FinTech Evolution (Shielded Logic + RLS)

-- 1. Create Audit Schema for Isolation
CREATE SCHEMA IF NOT EXISTS audit;

-- 2. Create Immutable Audit Log Table
CREATE TABLE IF NOT EXISTS audit.loan_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    old_status TEXT,
    new_status TEXT,
    changed_by UUID, -- Employee ID or Merchant ID
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    payload JSONB -- Store the whole diff if needed
);

-- Revoke dangerous permissions on audit log
REVOKE UPDATE, DELETE, TRUNCATE ON audit.loan_audit_log FROM PUBLIC;

-- 3. Loan State Machine Guard (Trigger)
CREATE OR REPLACE FUNCTION enforce_loan_transition()
RETURNS trigger AS $$
DECLARE
    allowed BOOLEAN := FALSE;
BEGIN
    -- Define legal transitions
    -- Active -> Paid, Cancelled, Raised
    -- Raised -> Paid, Cancelled
    -- Paid -> (None, Final)
    -- Cancelled -> (None, Final)
    
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'Active' AND NEW.status IN ('Paid', 'Cancelled', 'Raised') THEN
        allowed := TRUE;
    ELSIF OLD.status = 'Raised' AND NEW.status IN ('Paid', 'Cancelled') THEN
        allowed := TRUE;
    END IF;

    IF NOT allowed THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS loan_state_guard ON loans;
CREATE TRIGGER loan_state_guard
    BEFORE UPDATE OF status ON loans
    FOR EACH ROW
    EXECUTE FUNCTION enforce_loan_transition();

-- 4. Automatic Audit Trigger
CREATE OR REPLACE FUNCTION log_loan_changes()
RETURNS trigger AS $$
BEGIN
    INSERT INTO audit.loan_audit_log (loan_id, merchant_id, old_status, new_status, changed_at)
    VALUES (NEW.id, NEW.merchant_id, OLD.status, NEW.status, CURRENT_TIMESTAMP);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS loan_audit_trigger ON loans;
CREATE TRIGGER loan_audit_trigger
    AFTER UPDATE OF status ON loans
    FOR EACH ROW
    EXECUTE FUNCTION log_loan_changes();

-- 5. Row Level Security (RLS) Setup
-- Ensure merchant_id is strictly isolated

-- Enable RLS on core tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_employees ENABLE ROW LEVEL SECURITY;

-- 6. Fail-Safe Policies
-- These policies use current_setting('app.merchant_id') which MUST be set via SET LOCAL in a transaction.
-- If not set, current_setting will throw an error or return NULL (handled by true arg).

DROP POLICY IF EXISTS merchant_isolation_loans ON loans;
CREATE POLICY merchant_isolation_loans ON loans
    USING (merchant_id = current_setting('app.merchant_id', true)::UUID);

DROP POLICY IF EXISTS merchant_isolation_customers ON customers;
CREATE POLICY merchant_isolation_customers ON customers
    USING (merchant_id = current_setting('app.merchant_id', true)::UUID);

DROP POLICY IF EXISTS merchant_isolation_employees ON merchant_employees;
CREATE POLICY merchant_isolation_employees ON merchant_employees
    USING (merchant_id = current_setting('app.merchant_id', true)::UUID);

-- Merchants table: only see yourself
DROP POLICY IF EXISTS merchant_isolation_self ON merchants;
CREATE POLICY merchant_isolation_self ON merchants
    USING (id = current_setting('app.merchant_id', true)::UUID);

-- 7. Grant permissions to app role (assuming 'postgres' is used, but we should use a limited user)
-- For now, we apply to current user.
