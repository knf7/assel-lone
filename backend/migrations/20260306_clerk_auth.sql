-- Migration: Add clerk_user_id column to merchants table for Clerk Authentication
-- Run this migration on existing databases to support Clerk Auth

-- Add clerk_user_id column
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255) UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_merchants_clerk_user_id ON merchants(clerk_user_id);

-- Make password_hash nullable (Clerk manages passwords externally)
ALTER TABLE merchants ALTER COLUMN password_hash DROP NOT NULL;
