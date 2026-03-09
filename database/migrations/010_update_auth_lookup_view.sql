BEGIN;

DROP VIEW IF EXISTS auth_lookup_view CASCADE;

CREATE VIEW auth_lookup_view AS
SELECT 
    id,
    id as merchant_id,
    business_name as name,
    email,
    username,
    password_hash,
    'merchant' as role,
    subscription_plan,
    CASE 
        WHEN expiry_date IS NOT NULL AND CURRENT_TIMESTAMP > expiry_date THEN 'Expired'
        ELSE subscription_status 
    END as subscription_status,
    expiry_date,
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
    NULL as subscription_plan,
    CASE 
        WHEN m.expiry_date IS NOT NULL AND CURRENT_TIMESTAMP > m.expiry_date THEN 'Expired'
        ELSE m.subscription_status 
    END as status,
    m.expiry_date,
    m.subscription_status as merchant_status,
    e.permissions,
    NULL::timestamp as locked_until,
    0 as failed_login_attempts
FROM merchant_employees e
JOIN merchants m ON m.id = e.merchant_id
WHERE e.deleted_at IS NULL;

COMMIT;
