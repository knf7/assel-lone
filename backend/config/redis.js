const Redis = require('ioredis');

const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
    },
};

if (process.env.REDIS_PASSWORD) {
    redisOptions.password = process.env.REDIS_PASSWORD;
}

const redis = new Redis({
    ...redisOptions,
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

// ── OTP helpers ──

/**
 * Store OTP for a merchant.
 * @param {string|number} merchantId
 * @param {string} code   6-digit OTP
 * @param {number} ttl    seconds (default 300 = 5 min)
 */
async function setOTP(merchantId, code, ttl = 300) {
    await redis.setex(`otp:${merchantId}`, ttl, code);
}

/**
 * Retrieve stored OTP (returns null if expired).
 */
async function getOTP(merchantId) {
    return redis.get(`otp:${merchantId}`);
}

/**
 * Delete OTP after successful verification.
 */
async function deleteOTP(merchantId) {
    await redis.del(`otp:${merchantId}`);
}

// ── Profile Update helpers ──
async function setProfileUpdateData(merchantId, data, ttl = 300) {
    await redis.setex(`profile_update:${merchantId}`, ttl, JSON.stringify(data));
}

async function getProfileUpdateData(merchantId) {
    const data = await redis.get(`profile_update:${merchantId}`);
    return data ? JSON.parse(data) : null;
}

async function deleteProfileUpdateData(merchantId) {
    await redis.del(`profile_update:${merchantId}`);
}

module.exports = {
    redis, setOTP, getOTP, deleteOTP,
    setProfileUpdateData, getProfileUpdateData, deleteProfileUpdateData
};
