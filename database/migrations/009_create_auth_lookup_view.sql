-- Create a unified view for authentication to allow login via email or username across merchants and employees
DROP VIEW IF EXISTS auth_lookup_view CASCADE;

CREATE VIEW auth_lookup_view AS
SELECT 
    id,
    id as merchant_id,
    business_name as name,
    email,
    email as username,
    password_hash,
    'merchant' as role,
    subscription_status as status,
    NULL as merchant_status,
    NULL::jsonb as permissions,
    locked_until,
    failed_login_attempts
FROM merchants
UNION ALL
SELECT 
    e.id,
    e.merchant_id,
    e.full_name as name,
    e.email,
    e.email as username,
    e.password_hash,
    'employee' as role,
    'Active' as status,
    m.subscription_status as merchant_status,
    e.permissions,
    NULL::timestamp as locked_until,
    0 as failed_login_attempts
FROM merchant_employees e
JOIN merchants m ON m.id = e.merchant_id
WHERE e.deleted_at IS NULL;
