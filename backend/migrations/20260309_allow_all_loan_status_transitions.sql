-- Make loan status transitions resilient to business flow changes.
-- Allow switching between all known statuses instead of a rigid state machine.

CREATE OR REPLACE FUNCTION enforce_loan_transition()
RETURNS trigger AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status NOT IN ('Active', 'Raised', 'Paid', 'Cancelled', 'Overdue') THEN
        RAISE EXCEPTION 'Invalid status value: %', NEW.status;
    END IF;

    -- Allow all transitions between valid statuses.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

