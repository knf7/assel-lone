-- Migration: Add Najiz Collected Amount
-- Date: 2026-02-23

ALTER TABLE loans ADD COLUMN IF NOT EXISTS najiz_collected_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS is_najiz_case BOOLEAN DEFAULT FALSE;

-- Update is_najiz_case for existing 'Raised' loans
UPDATE loans SET is_najiz_case = TRUE WHERE status = 'Raised';
