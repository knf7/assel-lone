-- Migration: Add Principal Amount and Profit Percentage
-- Date: 2026-02-24

ALTER TABLE loans ADD COLUMN IF NOT EXISTS principal_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS profit_percentage DECIMAL(5, 2) DEFAULT 0;

-- Backfill principal_amount with amount for existing loans so data isn't 0
UPDATE loans SET principal_amount = amount WHERE principal_amount = 0 OR principal_amount IS NULL;
