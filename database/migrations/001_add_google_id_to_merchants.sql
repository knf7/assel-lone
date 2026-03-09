-- Add google_id for Google OAuth (run on existing databases)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_merchants_google_id ON merchants(google_id);
