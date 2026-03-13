-- Performance indexes for faster list paging and ordering
CREATE INDEX IF NOT EXISTS idx_loans_merchant_created_active
    ON loans (merchant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_loans_merchant_status_created_active
    ON loans (merchant_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_merchant_created_active
    ON customers (merchant_id, created_at DESC)
    WHERE deleted_at IS NULL;
