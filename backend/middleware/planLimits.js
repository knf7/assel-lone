const db = require('../config/database');

// Plan limits configuration
const PLAN_LIMITS = {
    Free: { customers: 10, loans: 20, employees: 0 },
    Basic: { customers: 50, loans: 300, employees: 1 },
    Pro: { customers: 500, loans: 5000, employees: 1 },
    Enterprise: { customers: Infinity, loans: Infinity, employees: 3 },
};

/**
 * Middleware factory to enforce plan limits.
 * @param {'customers'|'loans'|'employees'} resource - The resource type to check.
 */
function checkPlanLimit(resource) {
    return async (req, res, next) => {
        let client;
        try {
            const merchantId = req.merchantId;

            // Start Transaction to prevent Race Conditions (Atomic Limit Check)
            client = await db.pool.connect();
            try {
                await client.query('BEGIN');

                // Lock the merchant row to serialize limit checks
                const merchantResult = await client.query(
                    'SELECT subscription_plan, subscription_status, expiry_date FROM merchants WHERE id = $1 FOR UPDATE',
                    [merchantId]
                );

                if (merchantResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'المستخدم غير موجود' });
                }

                const { subscription_plan, subscription_status, expiry_date } = merchantResult.rows[0];
                const normalizedPlan = (subscription_plan || 'Free').charAt(0).toUpperCase() + (subscription_plan || 'Free').slice(1).toLowerCase();

                // Check if subscription is expired
                if (subscription_status === 'Cancelled' || subscription_status === 'PastDue') {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        error: 'اشتراكك منتهي. جدّد اشتراكك للمتابعة.',
                        code: 'SUBSCRIPTION_EXPIRED',
                    });
                }

                // Check expiry date
                if (expiry_date && new Date(expiry_date) < new Date()) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({
                        error: 'انتهت صلاحية اشتراكك. جدّد الآن.',
                        code: 'SUBSCRIPTION_EXPIRED',
                    });
                }

                const limits = PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS.Free;
                const limit = limits[resource];

                if (limit === Infinity) {
                    await client.query('COMMIT');
                    return next();
                }

                const tableMap = {
                    customers: 'customers',
                    loans: 'loans',
                    employees: 'merchant_employees'
                };
                const table = tableMap[resource];

                const countResult = await client.query(
                    `SELECT COUNT(*) as count FROM ${table} WHERE merchant_id = $1 AND deleted_at IS NULL`,
                    [merchantId]
                );
                const currentCount = parseInt(countResult.rows[0].count, 10);

                if (currentCount >= limit) {
                    await client.query('ROLLBACK');
                    const resourceName = { customers: 'عميل', loans: 'قرض', employees: 'موظف' }[resource];
                    return res.status(403).json({
                        error: `وصلت للحد الأقصى (${limit} ${resourceName}) في باقتك الحالية.`,
                        code: 'PLAN_LIMIT_REACHED',
                        currentCount,
                        limit,
                        plan: subscription_plan,
                    });
                }

                await client.query('COMMIT');
                next();
            } catch (innerErr) {
                await client.query('ROLLBACK');
                throw innerErr;
            } finally {
                if (client) {
                    client.release();
                }
            }
        } catch (err) {
            console.error('Plan limit check error:', err);
            next(); // Don't block on error — fail open
        }
    };
}

module.exports = { checkPlanLimit, PLAN_LIMITS };
