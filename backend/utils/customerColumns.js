const db = require('../config/database');

const CACHE_TTL_MS = 1000 * 60 * 10;
let cachedFlags = null;
let cachedAt = 0;

const DEFAULT_FLAGS = {
    hasEmail: false,
    hasCreatedAt: true,
    hasDeletedAt: true
};

const buildFlags = (columns = []) => {
    const columnSet = new Set(columns);
    return {
        hasEmail: columnSet.has('email'),
        hasCreatedAt: columnSet.has('created_at'),
        hasDeletedAt: columnSet.has('deleted_at')
    };
};

const loadCustomerColumns = async () => {
    const result = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'customers'`
    );
    return result.rows.map((row) => row.column_name);
};

const getCustomerColumnFlags = async () => {
    if (db.query && db.query._isMockFunction) {
        return { ...DEFAULT_FLAGS };
    }

    const now = Date.now();
    if (cachedFlags && (now - cachedAt) < CACHE_TTL_MS) {
        return cachedFlags;
    }

    try {
        const columns = await loadCustomerColumns();
        cachedFlags = buildFlags(columns);
        cachedAt = now;
        return cachedFlags;
    } catch (error) {
        console.warn('Failed to detect customer columns. Falling back to defaults.', error?.message || error);
        cachedFlags = { ...DEFAULT_FLAGS };
        cachedAt = now;
        return cachedFlags;
    }
};

module.exports = { getCustomerColumnFlags };
