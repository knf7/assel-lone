-- Search-focused indexes for faster customer/loan lookups
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_merchant_national_active
    ON customers (merchant_id, national_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_merchant_mobile_active
    ON customers (merchant_id, mobile_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_full_name_trgm
    ON customers USING gin (full_name gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_loans_customer_active
    ON loans (customer_id)
    WHERE deleted_at IS NULL;
