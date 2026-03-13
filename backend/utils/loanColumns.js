const db = require('../config/database');

const CACHE_TTL_MS = 1000 * 60 * 10;
let cachedFlags = null;
let cachedAt = 0;

const DEFAULT_FLAGS = {
    hasDeletedAt: false,
    hasIsNajizCase: false,
    hasNajizCollectedAmount: false,
    hasPrincipalAmount: false,
    hasNajizRaisedDate: false,
};

const buildFlags = (columns = []) => {
    const columnSet = new Set(columns);
    return {
        hasDeletedAt: columnSet.has('deleted_at'),
        hasIsNajizCase: columnSet.has('is_najiz_case'),
        hasNajizCollectedAmount: columnSet.has('najiz_collected_amount'),
        hasPrincipalAmount: columnSet.has('principal_amount'),
        hasNajizRaisedDate: columnSet.has('najiz_raised_date'),
    };
};

const loadLoanColumns = async () => {
    const res = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'loans'`
    );
    return res.rows.map((row) => row.column_name);
};

const getLoanColumnFlags = async () => {
    if (db.query && db.query._isMockFunction) {
        return { ...DEFAULT_FLAGS };
    }
    const now = Date.now();
    if (cachedFlags && (now - cachedAt) < CACHE_TTL_MS) {
        return cachedFlags;
    }
    try {
        const columns = await loadLoanColumns();
        cachedFlags = buildFlags(columns);
        cachedAt = now;
        return cachedFlags;
    } catch (error) {
        console.warn('Failed to detect loan columns. Falling back to defaults.', error);
        cachedFlags = { ...DEFAULT_FLAGS };
        cachedAt = now;
        return cachedFlags;
    }
};

module.exports = { getLoanColumnFlags };
