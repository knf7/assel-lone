-- Add status enum
CREATE TYPE merchant_status AS ENUM ('pending', 'approved', 'rejected');

-- Add status column to merchants table with default 'pending'
ALTER TABLE merchants ADD COLUMN status merchant_status DEFAULT 'pending';

-- Set existing merchants to 'approved' so current users aren't locked out
UPDATE merchants SET status = 'approved';
