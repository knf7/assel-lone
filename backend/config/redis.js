const Redis = require('ioredis');

const normalizeRedisUrl = (value) => {
    if (!value) return null;
    let url = String(value).trim();
    // Handle accidental copy/paste of ENV assignment (e.g. REDIS_URL="rediss://...")
    if (url.startsWith('REDIS_URL=')) {
        url = url.slice('REDIS_URL='.length);
    }
    // Strip wrapping quotes
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
        url = url.slice(1, -1);
    }
    return url.trim();
};

const normalizedRedisUrl = normalizeRedisUrl(process.env.REDIS_URL);
const useRedis = !!process.env.REDIS_HOST || !!normalizedRedisUrl;
let redis;

if (useRedis) {
    const baseOptions = {
        maxRetriesPerRequest: null,
        retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
        },
    };

    if (normalizedRedisUrl) {
        // Prefer full Redis URL (recommended for managed providers like Upstash)
        redis = new Redis(normalizedRedisUrl, { ...baseOptions });
    } else {
        const redisOptions = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            ...baseOptions,
        };
        if (process.env.REDIS_PASSWORD) redisOptions.password = process.env.REDIS_PASSWORD;
        redis = new Redis({ ...redisOptions });
    }
    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('error', (err) => console.error('❌ Redis error:', err.message));
} else {
    // Lightweight in-memory fallback for serverless (no persistence, per-instance only)
    console.warn('⚠️ REDIS_HOST not set; using in-memory store (non-persistent)');
    if ((process.env.NODE_ENV || 'development') === 'production' && process.env.REQUIRE_REDIS === 'true') {
        throw new Error('REDIS is required in production. Set REDIS_URL/REDIS_HOST or disable REQUIRE_REDIS.');
    }
    const store = new Map();
    const setex = (key, ttlSeconds, value) => {
        store.set(key, value);
        setTimeout(() => store.delete(key), ttlSeconds * 1000);
    };
    const get = (key) => Promise.resolve(store.get(key) || null);
    const del = (key) => Promise.resolve(store.delete(key));
    const keys = (pattern = '*') => {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        const regex = new RegExp(`^${escaped}$`);
        return Promise.resolve([...store.keys()].filter((k) => regex.test(k)));
    };
    redis = { setex, get, del, keys };
}

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
