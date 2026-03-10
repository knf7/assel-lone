-- Add status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'merchant_status') THEN
        CREATE TYPE merchant_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- Add status column to merchants table with default 'pending'
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS status merchant_status DEFAULT 'pending';

-- Set existing merchants to 'approved' so current users aren't locked out
UPDATE merchants SET status = 'approved' WHERE status IS NULL;
