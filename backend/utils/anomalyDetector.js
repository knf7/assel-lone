const { redis } = require('../config/redis');
const db = require('../config/database');

/**
 * ── Anomaly Detector ──
 * Tracks destructive actions (Delete, Status changes) per merchant/employee.
 * Triggers alerts or freezes if thresholds are exceeded.
 */
const trackActivity = async (merchantId, userId, action, threshold = 10, windowMs = 60000) => {
    const key = `anomaly:${merchantId}:${userId}:${action}`;

    try {
        const count = await redis.incr(key);

        if (count === 1) {
            await redis.expire(key, Math.ceil(windowMs / 1000));
        }

        if (count > threshold) {
            console.warn(`🚨 ANOMALY DETECTED: Merchant ${merchantId} / User ${userId} performing high volume of ${action} (${count} in ${windowMs}ms)`);

            // Protective Action: Invalidate all sessions and lock account
            await db.query(
                "UPDATE merchants SET session_version = COALESCE(session_version, 1) + 1, locked_until = CURRENT_TIMESTAMP + INTERVAL '1 hour' WHERE id = $1",
                [merchantId]
            );

            return true; // Threshold exceeded
        }
    } catch (err) {
        // Circuit Breaker: If Redis is down, we log but don't block operations unless mutation
        console.error('Anomaly Detector (Redis) Error:', err.message);
        return false; // Fail-open for the tracker itself
    }

    return false;
};

module.exports = { trackActivity };
