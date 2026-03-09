-- Allow business-required rollback transitions in loan status workflow.
-- Previous rules blocked Paid -> Active, which is needed for "إلغاء السداد".

CREATE OR REPLACE FUNCTION enforce_loan_transition()
RETURNS trigger AS $$
DECLARE
    allowed BOOLEAN := FALSE;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Active can move to any operational state.
    IF OLD.status = 'Active' AND NEW.status IN ('Paid', 'Cancelled', 'Raised') THEN
        allowed := TRUE;
    -- Raised can be paid, cancelled, or restored back to Active.
    ELSIF OLD.status = 'Raised' AND NEW.status IN ('Paid', 'Cancelled', 'Active') THEN
        allowed := TRUE;
    -- Paid can be rolled back to Active when payment is undone.
    ELSIF OLD.status = 'Paid' AND NEW.status IN ('Active') THEN
        allowed := TRUE;
    -- Cancelled can be re-opened to Active.
    ELSIF OLD.status = 'Cancelled' AND NEW.status IN ('Active') THEN
        allowed := TRUE;
    END IF;

    IF NOT allowed THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
