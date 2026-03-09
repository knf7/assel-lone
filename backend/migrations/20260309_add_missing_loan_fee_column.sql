-- Some APIs write/read najiz_fee_percentage, but older DB snapshots miss this column.
-- Keep it nullable because only Raised cases need it.
ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS najiz_fee_percentage DECIMAL(5, 2);
