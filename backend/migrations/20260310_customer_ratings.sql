-- Customer ratings (delivery + monthly)
-- Best-practice model:
-- 1) Delivery rating is tied to a specific paid loan.
-- 2) Monthly rating is tied to customer + month.
-- 3) Rating can be locked for audit integrity.

CREATE TABLE IF NOT EXISTS customer_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    loan_id UUID NULL REFERENCES loans(id) ON DELETE CASCADE,
    rating_scope VARCHAR(20) NOT NULL CHECK (rating_scope IN ('delivery', 'monthly')),
    score NUMERIC(3, 1) NOT NULL CHECK (score >= 1 AND score <= 10),
    month_key DATE NULL,
    notes TEXT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    rated_by UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One delivery rating per loan.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_delivery_rating
    ON customer_ratings (merchant_id, loan_id, rating_scope)
    WHERE rating_scope = 'delivery' AND loan_id IS NOT NULL;

-- One monthly rating per customer per month.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_monthly_rating
    ON customer_ratings (merchant_id, customer_id, month_key, rating_scope)
    WHERE rating_scope = 'monthly' AND month_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_ratings_customer
    ON customer_ratings (merchant_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_ratings_scope
    ON customer_ratings (merchant_id, rating_scope, month_key DESC);

-- Keep updated_at current.
DROP TRIGGER IF EXISTS update_customer_ratings_updated_at ON customer_ratings;
CREATE TRIGGER update_customer_ratings_updated_at
    BEFORE UPDATE ON customer_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for tenant isolation
ALTER TABLE customer_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_customer_ratings_isolation ON customer_ratings;
CREATE POLICY tenant_customer_ratings_isolation ON customer_ratings
    FOR ALL
    USING (merchant_id = current_setting('app.merchant_id', true)::UUID)
    WITH CHECK (merchant_id = current_setting('app.merchant_id', true)::UUID);
