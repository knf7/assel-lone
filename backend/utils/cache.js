const { redis } = require('../config/redis');

const parseJSON = (value) => {
    if (!value) return null;
    try { return JSON.parse(value); } catch { return null; }
};

async function getCache(key) {
    if (!redis || typeof redis.get !== 'function') return null;
    try {
        const value = await redis.get(key);
        return parseJSON(value);
    } catch {
        return null;
    }
}

async function setCache(key, value, ttlSeconds = 30) {
    if (!redis || typeof redis.setex !== 'function') return;
    try {
        await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
        // Best-effort cache; ignore failures
    }
}

module.exports = {
    getCache,
    setCache
};
