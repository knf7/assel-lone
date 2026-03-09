-- Fix production/runtime mismatch:
-- 1) loans route selects l.notes but column was missing in some DBs.
-- 2) legacy RLS policies still referenced app.current_merchant_id, causing 500s.

ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Remove legacy schema policies that depend on app.current_merchant_id.
DROP POLICY IF EXISTS merchant_isolation_policy ON customers;
DROP POLICY IF EXISTS merchant_loans_policy ON loans;
DROP POLICY IF EXISTS merchant_payments_policy ON payment_history;

-- Ensure payment_history policy uses the active per-request RLS key.
CREATE POLICY merchant_payments_policy ON payment_history
    USING (merchant_id = current_setting('app.merchant_id', true)::UUID);
