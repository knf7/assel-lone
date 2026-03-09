-- Migration: Enforce tenant RLS policies across all merchant-scoped tables
-- Date: 2026-03-09
-- Notes:
--   - App must set `SET LOCAL app.merchant_id = '<merchant-uuid>'` per request.
--   - This migration is idempotent and safe to re-run.

BEGIN;

-- Helper function used by all policies.
CREATE OR REPLACE FUNCTION public.app_current_merchant_uuid()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    merchant_text TEXT;
BEGIN
    merchant_text := current_setting('app.merchant_id', true);

    IF merchant_text IS NULL OR btrim(merchant_text) = '' THEN
        RETURN NULL;
    END IF;

    RETURN merchant_text::UUID;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.merchants') IS NOT NULL THEN
        ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS merchant_isolation_self ON public.merchants;
        DROP POLICY IF EXISTS tenant_merchants_self_select ON public.merchants;
        DROP POLICY IF EXISTS tenant_merchants_self_update ON public.merchants;
        DROP POLICY IF EXISTS tenant_merchants_self_delete ON public.merchants;

        CREATE POLICY tenant_merchants_self_select ON public.merchants
            FOR SELECT
            USING (id = public.app_current_merchant_uuid());

        CREATE POLICY tenant_merchants_self_update ON public.merchants
            FOR UPDATE
            USING (id = public.app_current_merchant_uuid())
            WITH CHECK (id = public.app_current_merchant_uuid());

        CREATE POLICY tenant_merchants_self_delete ON public.merchants
            FOR DELETE
            USING (id = public.app_current_merchant_uuid());
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.customers') IS NOT NULL THEN
        ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS merchant_isolation_policy ON public.customers;
        DROP POLICY IF EXISTS merchant_isolation_customers ON public.customers;
        DROP POLICY IF EXISTS tenant_customers_isolation ON public.customers;

        CREATE POLICY tenant_customers_isolation ON public.customers
            FOR ALL
            USING (merchant_id = public.app_current_merchant_uuid())
            WITH CHECK (merchant_id = public.app_current_merchant_uuid());
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.loans') IS NOT NULL THEN
        ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS merchant_loans_policy ON public.loans;
        DROP POLICY IF EXISTS merchant_isolation_loans ON public.loans;
        DROP POLICY IF EXISTS tenant_loans_isolation ON public.loans;

        CREATE POLICY tenant_loans_isolation ON public.loans
            FOR ALL
            USING (merchant_id = public.app_current_merchant_uuid())
            WITH CHECK (merchant_id = public.app_current_merchant_uuid());
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.payment_history') IS NOT NULL THEN
        ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS merchant_payments_policy ON public.payment_history;
        DROP POLICY IF EXISTS tenant_payment_history_isolation ON public.payment_history;

        CREATE POLICY tenant_payment_history_isolation ON public.payment_history
            FOR ALL
            USING (merchant_id = public.app_current_merchant_uuid())
            WITH CHECK (merchant_id = public.app_current_merchant_uuid());
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.merchant_employees') IS NOT NULL THEN
        ALTER TABLE public.merchant_employees ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS merchant_isolation_employees ON public.merchant_employees;
        DROP POLICY IF EXISTS tenant_merchant_employees_isolation ON public.merchant_employees;

        CREATE POLICY tenant_merchant_employees_isolation ON public.merchant_employees
            FOR ALL
            USING (merchant_id = public.app_current_merchant_uuid())
            WITH CHECK (merchant_id = public.app_current_merchant_uuid());
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.subscription_requests') IS NOT NULL THEN
        ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_subscription_requests_isolation ON public.subscription_requests;

        CREATE POLICY tenant_subscription_requests_isolation ON public.subscription_requests
            FOR ALL
            USING (merchant_id = public.app_current_merchant_uuid())
            WITH CHECK (merchant_id = public.app_current_merchant_uuid());
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_audit_logs_isolation ON public.audit_logs;

        CREATE POLICY tenant_audit_logs_isolation ON public.audit_logs
            FOR ALL
            USING (merchant_id = public.app_current_merchant_uuid())
            WITH CHECK (merchant_id = public.app_current_merchant_uuid());
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('audit.loan_audit_log') IS NOT NULL THEN
        ALTER TABLE audit.loan_audit_log ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_loan_audit_log_isolation ON audit.loan_audit_log;

        CREATE POLICY tenant_loan_audit_log_isolation ON audit.loan_audit_log
            FOR ALL
            USING (merchant_id = public.app_current_merchant_uuid())
            WITH CHECK (merchant_id = public.app_current_merchant_uuid());
    END IF;
END $$;

COMMIT;
