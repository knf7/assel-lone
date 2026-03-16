-- Improve customer loan aggregates
CREATE INDEX IF NOT EXISTS idx_loans_merchant_customer_active
    ON loans (merchant_id, customer_id)
    WHERE deleted_at IS NULL;
