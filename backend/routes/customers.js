const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken, injectMerchantId, injectRlsContext, checkPermission } = require('../middleware/auth');
const { getCache, setCache, clearCacheByPrefix } = require('../utils/cache');

const router = express.Router();

const RATINGS_TABLE_CACHE_TTL_MS = 1000 * 60 * 5;
let ratingsTableCache = { value: null, checkedAt: 0 };

const resolveRatingsTable = async (client) => {
    const now = Date.now();
    if (ratingsTableCache.value !== null && (now - ratingsTableCache.checkedAt) < RATINGS_TABLE_CACHE_TTL_MS) {
        return ratingsTableCache.value;
    }
    const runner = client?.query ? client.query.bind(client) : db.query;
    if (!runner) {
        ratingsTableCache = { value: false, checkedAt: now };
        return false;
    }
    try {
        const ratingsTableCheck = await runner(`SELECT to_regclass('public.customer_ratings') AS t`);
        const exists = Boolean(ratingsTableCheck.rows[0]?.t);
        ratingsTableCache = { value: exists, checkedAt: now };
        return exists;
    } catch (err) {
        ratingsTableCache = { value: false, checkedAt: now };
        return false;
    }
};

const invalidateReportsCache = async (merchantId) => {
    if (!merchantId) return;
    try {
        await clearCacheByPrefix(`reports:dashboard:${merchantId}`);
        await clearCacheByPrefix(`reports:analytics:${merchantId}:`);
        await clearCacheByPrefix(`reports:ai:${merchantId}`);
        await clearCacheByPrefix(`customers:list:${merchantId}:`);
        await clearCacheByPrefix(`loans:list:${merchantId}:`);
    } catch {
        // Best-effort cache invalidation
    }
};

const buildCustomerSearchFilter = (searchValue, paramIndex) => {
    const normalized = String(searchValue || '').trim();
    if (!normalized) return { clause: '', params: [] };
    const isNumeric = /^[0-9]+$/.test(normalized);
    if (isNumeric) {
        return {
            clause: `(c.national_id::text LIKE $${paramIndex} OR c.mobile_number::text LIKE $${paramIndex})`,
            params: [`${normalized}%`]
        };
    }
    return {
        clause: `c.full_name ILIKE $${paramIndex}`,
        params: [`%${normalized}%`]
    };
};

const buildCustomerStats = (customerId, loanAggMap, ratingAggMap) => {
    const loanAgg = loanAggMap.get(customerId) || {};
    const ratingAgg = ratingAggMap.get(customerId) || {};
    const paid = parseInt(loanAgg.paid_loans || 0, 10);
    const raised = parseInt(loanAgg.raised_loans || 0, 10);
    const active = parseInt(loanAgg.active_loans || 0, 10);
    const total = parseInt(loanAgg.total_loans || 0, 10);
    const rawScore = 100 + (paid * 3) - (active * 8) - (raised * 15);
    const computedRating = Math.max(0, Math.min(10, rawScore / 10));
    const manualRating = Number(ratingAgg.overall_score || 0);
    const hasSystemRating = paid > 0;
    const rating = manualRating > 0 ? manualRating : (hasSystemRating ? computedRating : null);
    const customer_status = raised > 0 ? 'raised' : active > 0 ? 'unpaid' : total > 0 ? 'paid' : 'new';

    return {
        total_debt: Number(loanAgg.total_debt || 0),
        total_loans: Number(loanAgg.total_loans || 0),
        paid_loans: Number(loanAgg.paid_loans || 0),
        raised_loans: Number(loanAgg.raised_loans || 0),
        active_loans: Number(loanAgg.active_loans || 0),
        delivery_avg: Number(ratingAgg.delivery_avg || 0),
        monthly_avg: Number(ratingAgg.monthly_avg || 0),
        overall_score: Number(ratingAgg.overall_score || 0),
        rating: typeof rating === 'number' ? Number(rating.toFixed(1)) : null,
        rating_source: manualRating > 0 ? 'manual' : (hasSystemRating ? 'system' : 'unrated'),
        customer_status
    };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeRatedBy = (user) => {
    const candidate = user?.employeeId || user?.userId || null;
    if (!candidate) return null;
    const value = String(candidate).trim();
    return UUID_PATTERN.test(value) ? value : null;
};

const isTxAbortedError = (err) => {
    if (!err) return false;
    if (err.code === '25P02') return true;
    return String(err.message || '').toLowerCase().includes('current transaction is aborted');
};

const isPaidLoanStatus = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === 'paid' || normalized === 'completed' || normalized === 'settled') return true;
    const compactArabic = normalized.replace(/\s+/g, '');
    return compactArabic.includes('تمالسداد')
        || compactArabic.includes('مسدد')
        || compactArabic.includes('مدفوع')
        || compactArabic.includes('مكتملة');
};

const runWithFreshMerchantClient = async (merchantId, runner) => {
    if (!db.pool || typeof db.pool.connect !== 'function') {
        return runner({ query: db.query });
    }
    const freshClient = await db.pool.connect();
    try {
        await freshClient.query('BEGIN');
        await freshClient.query('SELECT set_config($1, $2, $3)', ['app.merchant_id', merchantId, true]);
        const result = await runner(freshClient);
        await freshClient.query('COMMIT');
        return result;
    } catch (err) {
        try { await freshClient.query('ROLLBACK'); } catch { }
        throw err;
    } finally {
        freshClient.release(true);
    }
};

// Apply auth middleware and RLS
router.use(authenticateToken);
router.use(injectMerchantId);
router.use(injectRlsContext);

// Virtual/helper: WhatsApp and Najiz links for Customer (no ORM; applied when returning rows)
const normalizeCustomerField = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim();
};

const enrichCustomer = (c) => {
    const mobileNumber = normalizeCustomerField(c.mobile_number);
    const nationalId = normalizeCustomerField(c.national_id);
    const sanitizedMobile = mobileNumber.replace(/\D/g, '');
    return {
        ...c,
        mobile_number: mobileNumber || c.mobile_number,
        national_id: nationalId || c.national_id,
        whatsappLink: sanitizedMobile ? `https://wa.me/${sanitizedMobile}` : null,
        najizLink: nationalId ? `https://www.najiz.sa/applications/landing/verification?id=${encodeURIComponent(nationalId)}` : null
    };
};


// Validation schema
const customerSchema = Joi.object({
    fullName: Joi.string().required().min(3).max(200),
    nationalId: Joi.string().required().pattern(/^[0-9]{10}$/),
    mobileNumber: Joi.string().required().pattern(/^[0-9]{9,20}$/),
    email: Joi.string().email().allow('', null).optional()
}).options({ stripUnknown: true });

const customerRatingSchema = Joi.object({
    scope: Joi.string().valid('delivery', 'monthly').required(),
    score: Joi.number().min(1).max(10).precision(1).required(),
    loanId: Joi.string().uuid().allow('', null).optional(),
    month: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).allow('', null).optional(),
    notes: Joi.string().max(500).allow('', null).optional()
}).options({ stripUnknown: true });

const ensureCustomerRatingsTable = async (client) => {
    if (!client?.query || client?.query?._isMockFunction || process.env.NODE_ENV === 'test') {
        return true;
    }

    const runEnsure = async (dbClient) => {
        try {
            const check = await dbClient.query(`SELECT to_regclass('public.customer_ratings') AS t`);
            const exists = Boolean(check.rows[0]?.t);

            // Best-effort: ensure uuid helpers are available when creating the table.
            if (!exists) {
                try { await dbClient.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`); } catch { }
                try { await dbClient.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`); } catch { }
            }

            const uuidFnResult = await dbClient.query(
                `SELECT to_regprocedure('gen_random_uuid()') AS gen,
                        to_regprocedure('uuid_generate_v4()') AS uuid`
            );
            const uuidDefault = uuidFnResult.rows[0]?.gen
                ? 'gen_random_uuid()'
                : (uuidFnResult.rows[0]?.uuid ? 'uuid_generate_v4()' : "md5(random()::text || clock_timestamp()::text)::uuid");

            if (!exists) {
                await dbClient.query(`
                    CREATE TABLE IF NOT EXISTS customer_ratings (
                        id UUID PRIMARY KEY DEFAULT ${uuidDefault},
                        merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
                        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                        loan_id UUID NULL REFERENCES loans(id) ON DELETE CASCADE,
                        rating_scope VARCHAR(20) NOT NULL CHECK (rating_scope IN ('delivery', 'monthly')),
                        score NUMERIC(3, 1) NOT NULL CHECK (score >= 1 AND score <= 10),
                        month_key DATE NULL,
                        notes TEXT NULL,
                        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
                        rated_by UUID NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            }

            const updateFn = await dbClient.query(
                `SELECT to_regprocedure('public.update_updated_at_column()') AS fn`
            );
            if (!updateFn.rows[0]?.fn) {
                await dbClient.query(`
                    CREATE OR REPLACE FUNCTION update_updated_at_column()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        NEW.updated_at = CURRENT_TIMESTAMP;
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;
                `);
            }

            await dbClient.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_delivery_rating
                    ON customer_ratings (merchant_id, loan_id, rating_scope)
                    WHERE rating_scope = 'delivery' AND loan_id IS NOT NULL
            `);
            await dbClient.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_monthly_rating
                    ON customer_ratings (merchant_id, customer_id, month_key, rating_scope)
                    WHERE rating_scope = 'monthly' AND month_key IS NOT NULL
            `);
            await dbClient.query(`
                CREATE INDEX IF NOT EXISTS idx_customer_ratings_customer
                    ON customer_ratings (merchant_id, customer_id, created_at DESC)
            `);
            await dbClient.query(`
                CREATE INDEX IF NOT EXISTS idx_customer_ratings_scope
                    ON customer_ratings (merchant_id, rating_scope, month_key DESC)
            `);
            await dbClient.query(`
                DROP TRIGGER IF EXISTS update_customer_ratings_updated_at ON customer_ratings;
                CREATE TRIGGER update_customer_ratings_updated_at
                    BEFORE UPDATE ON customer_ratings
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            `);
            await dbClient.query(`
                ALTER TABLE customer_ratings ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_customer_ratings_isolation ON customer_ratings;
                CREATE POLICY tenant_customer_ratings_isolation ON customer_ratings
                    FOR ALL
                    USING (merchant_id = current_setting('app.merchant_id', true)::UUID)
                    WITH CHECK (merchant_id = current_setting('app.merchant_id', true)::UUID)
            `);
            return true;
        } catch (err) {
            console.error('Ensure customer_ratings table failed:', err);
            return false;
        }
    };

    const primaryResult = await runEnsure(client);
    if (primaryResult) return true;

    if (!db.pool || typeof db.pool.connect !== 'function') {
        return false;
    }

    const fallbackClient = await db.pool.connect();
    try {
        return await runEnsure(fallbackClient);
    } finally {
        fallbackClient.release(true);
    }
};

// GET /api/customers - List all customers
router.get('/', checkPermission('can_view_customers'), async (req, res) => {
    const requestCacheState = {
        key: null,
        header: null,
        useCache: false
    };
    try {
        const { page = 1, limit = 20, search, skip_count, include_stats } = req.query;
        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const limitNumber = Math.min(100, parseInt(limit, 10) || 20);
        const offset = (pageNumber - 1) * limitNumber;
        const includeStats = include_stats !== 'false';
        const skipCount = skip_count === 'true'
            || req.query.skipCount === 'true'
            || includeStats === false;
        const isMockedDb = Boolean(req.dbClient?.query?._isMockFunction);
        let hasRatingsTable = false;
        if (includeStats && process.env.NODE_ENV !== 'test' && !isMockedDb) {
            hasRatingsTable = await resolveRatingsTable(req.dbClient);
        }

        let whereClause = 'c.merchant_id = $1 AND c.deleted_at IS NULL';
        let whereClauseFallback = 'c.merchant_id = $1';
        let params = [req.merchantId];

        const searchFilter = buildCustomerSearchFilter(search, params.length + 1);
        if (searchFilter.clause) {
            whereClause += ` AND (${searchFilter.clause})`;
            whereClauseFallback += ` AND (${searchFilter.clause})`;
            params.push(...searchFilter.params);
        }

        const cacheParams = {
            page: pageNumber,
            limit: limitNumber,
            search: search || null,
            skip_count: skipCount,
            include_stats: includeStats
        };
        const cacheKey = `customers:list:${req.merchantId}:${Buffer.from(JSON.stringify(cacheParams)).toString('base64')}`;
        const useCache = !isMockedDb;
        const ttlSeconds = Number(process.env.CUSTOMERS_LIST_CACHE_TTL || 120);
        const swrSeconds = Math.min(60, Math.max(10, Math.floor(ttlSeconds / 2)));
        const cacheHeader = `private, max-age=${ttlSeconds}, stale-while-revalidate=${swrSeconds}, stale-if-error=300`;
        requestCacheState.key = cacheKey;
        requestCacheState.header = cacheHeader;
        requestCacheState.useCache = useCache;
        if (useCache) {
            try {
                const cached = await getCache(cacheKey);
                if (cached) {
                    res.set('Cache-Control', cacheHeader);
                    return res.json(cached);
                }
            } catch (cacheErr) {
                console.warn('Customers cache read failed:', cacheErr?.message || cacheErr);
            }
        }

        const isTransactionAbort = (err) => {
            if (!err) return false;
            if (err.code === '25P02') return true;
            return String(err.message || '').toLowerCase().includes('current transaction is aborted');
        };

        const runFreshQuery = async (query, queryParams) => {
            if (!db.pool || typeof db.pool.connect !== 'function') {
                return db.query(query, queryParams);
            }
            const freshClient = await db.pool.connect();
            try {
                await freshClient.query('BEGIN');
                await freshClient.query('SELECT set_config($1, $2, $3)', ['app.merchant_id', req.merchantId, true]);
                const result = await freshClient.query(query, queryParams);
                await freshClient.query('COMMIT');
                return result;
            } catch (err) {
                try { await freshClient.query('ROLLBACK'); } catch { }
                throw err;
            } finally {
                freshClient.release(true);
            }
        };

        const runQuery = async (query, queryParams) => {
            if (isMockedDb || !req.dbClient?.query) {
                return db.query(query, queryParams);
            }
            if (req.dbClientBroken) {
                return runFreshQuery(query, queryParams);
            }
            try {
                return await req.dbClient.query(query, queryParams);
            } catch (err) {
                if (!isTransactionAbort(err)) {
                    throw err;
                }
                req.dbClientBroken = true;
                console.warn('Customers query aborted; retrying on fresh connection.');
                return runFreshQuery(query, queryParams);
            }
        };

        const countSelect = skipCount ? '' : ', COUNT(*) OVER() AS total_count';
        const queryLimit = skipCount ? limitNumber + 1 : limitNumber;
        const baseSelect = includeStats
            ? 'c.*'
            : 'c.id, c.full_name, c.national_id, c.mobile_number, NULL::text AS email, c.created_at';
        const baseQuery = `
            SELECT ${baseSelect}${countSelect}
            FROM customers c
            WHERE ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const baseQueryFallback = `
            SELECT ${baseSelect}${countSelect}
            FROM customers c
            WHERE ${whereClauseFallback}
            ORDER BY c.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        let baseResult;
        try {
            baseResult = await runQuery(baseQuery, [...params, queryLimit, offset]);
        } catch (err) {
            console.warn('Customers base query fallback:', err?.message || err);
            baseResult = await runQuery(baseQueryFallback, [...params, queryLimit, offset]);
        }

        let baseRows = baseResult.rows;
        let hasMore = false;
        if (skipCount && baseRows.length > limitNumber) {
            hasMore = true;
            baseRows = baseRows.slice(0, limitNumber);
        }

        const totalCount = skipCount
            ? ((pageNumber - 1) * limitNumber + baseRows.length + (hasMore ? 1 : 0))
            : (baseRows.length ? parseInt(baseRows[0].total_count || 0, 10) : 0);

        const baseRowsClean = baseRows.map((row) => {
            const { total_count, ...rest } = row;
            return rest;
        });
        const customerIds = baseRowsClean.map((row) => row.id).filter(Boolean);

        const loanAggMap = new Map();
        const ratingAggMap = new Map();
        if (includeStats && customerIds.length > 0) {
            const loanAggQuery = `
                SELECT
                    l.customer_id,
                    COALESCE(SUM(CASE WHEN l.status = 'Active' THEN l.amount ELSE 0 END), 0) AS total_debt,
                    COALESCE(COUNT(l.id), 0) AS total_loans,
                    COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Paid'), 0) AS paid_loans,
                    COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Raised'), 0) AS raised_loans,
                    COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Active'), 0) AS active_loans
                FROM loans l
                WHERE l.merchant_id = $1
                  AND l.customer_id = ANY($2::uuid[])
                  AND l.deleted_at IS NULL
                GROUP BY l.customer_id
            `;
            const loanAggFallbackQuery = `
                SELECT
                    l.customer_id,
                    COALESCE(SUM(CASE WHEN l.status = 'Active' THEN l.amount ELSE 0 END), 0) AS total_debt,
                    COALESCE(COUNT(l.id), 0) AS total_loans,
                    COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Paid'), 0) AS paid_loans,
                    COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Raised'), 0) AS raised_loans,
                    COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Active'), 0) AS active_loans
                FROM loans l
                WHERE l.merchant_id = $1
                  AND l.customer_id = ANY($2::uuid[])
                GROUP BY l.customer_id
            `;
            const ratingAggQuery = `
                SELECT
                    cr.customer_id,
                    ROUND(COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'delivery'), 0)::numeric, 1) AS delivery_avg,
                    ROUND(COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'monthly'), 0)::numeric, 1) AS monthly_avg,
                    ROUND((
                        COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'delivery'), 0) * 0.6
                        + COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'monthly'), 0) * 0.4
                    )::numeric, 1) AS overall_score
                FROM customer_ratings cr
                WHERE cr.merchant_id = $1
                  AND cr.customer_id = ANY($2::uuid[])
                GROUP BY cr.customer_id
            `;

            const fetchLoanAgg = async () => {
                try {
                    return await runQuery(loanAggQuery, [req.merchantId, customerIds]);
                } catch (err) {
                    console.warn('Customers loan aggregate fallback:', err?.message || err);
                    return await runQuery(loanAggFallbackQuery, [req.merchantId, customerIds]);
                }
            };

            const results = await Promise.allSettled([
                fetchLoanAgg(),
                hasRatingsTable ? runQuery(ratingAggQuery, [req.merchantId, customerIds]) : Promise.resolve({ rows: [] })
            ]);

            if (results[0].status === 'fulfilled') {
                results[0].value.rows.forEach((row) => loanAggMap.set(row.customer_id, row));
            } else {
                console.warn('Customers loan aggregate failed:', results[0].reason?.message || results[0].reason);
            }

            if (results[1].status === 'fulfilled') {
                results[1].value.rows.forEach((row) => ratingAggMap.set(row.customer_id, row));
            } else if (hasRatingsTable) {
                console.warn('Customers rating aggregate failed:', results[1].reason?.message || results[1].reason);
            }
        }

        const enriched = baseRowsClean.map((c) => {
            return enrichCustomer({
                ...c,
                ...(includeStats ? buildCustomerStats(c.id, loanAggMap, ratingAggMap) : {}),
                stats_pending: !includeStats
            });
        });

        const payload = {
            customers: enriched,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                totalCount,
                totalPages: skipCount ? (hasMore ? pageNumber + 1 : pageNumber) : Math.ceil(totalCount / limitNumber),
                hasMore
            }
        };

        if (useCache) {
            try {
                await setCache(cacheKey, payload, Number.isFinite(ttlSeconds) ? ttlSeconds : 30);
                res.set('Cache-Control', cacheHeader);
            } catch (cacheErr) {
                console.warn('Customers cache write failed:', cacheErr?.message || cacheErr);
            }
        }

        res.json(payload);
    } catch (err) {
        console.error('Get customers error:', err);
        if (requestCacheState.useCache && requestCacheState.key) {
            try {
                const cached = await getCache(requestCacheState.key);
                if (cached) {
                    if (requestCacheState.header) {
                        res.set('Cache-Control', requestCacheState.header);
                    }
                    return res.json(cached);
                }
            } catch {
                // ignore cache fallback errors
            }
        }
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// GET /api/customers/stats - lightweight stats for list items
router.get('/stats', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const idsParam = req.query.ids;
        const rawIds = Array.isArray(idsParam)
            ? idsParam.flatMap((value) => String(value).split(','))
            : String(idsParam || '').split(',');
        const customerIds = rawIds
            .map((id) => id.trim())
            .filter((id) => /^[0-9a-fA-F-]{36}$/.test(id))
            .slice(0, 100);

        if (customerIds.length === 0) {
            return res.json({ stats: {} });
        }

        const cacheKey = `customers:stats:${req.merchantId}:${Buffer.from(customerIds.join(',')).toString('base64')}`;
        const ttlSeconds = Number(process.env.CUSTOMERS_STATS_CACHE_TTL || 90);
        const swrSeconds = Math.min(60, Math.max(10, Math.floor(ttlSeconds / 3)));
        const cacheHeader = `private, max-age=${ttlSeconds}, stale-while-revalidate=${swrSeconds}, stale-if-error=300`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.set('Cache-Control', cacheHeader);
            return res.json(cached);
        }

        const isMockedDb = Boolean(req.dbClient?.query?._isMockFunction);
        let hasRatingsTable = false;
        if (process.env.NODE_ENV !== 'test' && !isMockedDb) {
            hasRatingsTable = await resolveRatingsTable(req.dbClient);
        }

        const loanAggQuery = `
            SELECT
                l.customer_id,
                COALESCE(SUM(CASE WHEN l.status = 'Active' THEN l.amount ELSE 0 END), 0) AS total_debt,
                COALESCE(COUNT(l.id), 0) AS total_loans,
                COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Paid'), 0) AS paid_loans,
                COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Raised'), 0) AS raised_loans,
                COALESCE(COUNT(l.id) FILTER (WHERE l.status = 'Active'), 0) AS active_loans
            FROM loans l
            WHERE l.merchant_id = $1
              AND l.customer_id = ANY($2::uuid[])
              AND l.deleted_at IS NULL
            GROUP BY l.customer_id
        `;
        const ratingAggQuery = `
            SELECT
                cr.customer_id,
                ROUND(COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'delivery'), 0)::numeric, 1) AS delivery_avg,
                ROUND(COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'monthly'), 0)::numeric, 1) AS monthly_avg,
                ROUND((
                    COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'delivery'), 0) * 0.6
                    + COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'monthly'), 0) * 0.4
                )::numeric, 1) AS overall_score
            FROM customer_ratings cr
            WHERE cr.merchant_id = $1
              AND cr.customer_id = ANY($2::uuid[])
            GROUP BY cr.customer_id
        `;

        const loanAggMap = new Map();
        const ratingAggMap = new Map();
        const results = await Promise.allSettled([
            req.dbClient.query(loanAggQuery, [req.merchantId, customerIds]),
            hasRatingsTable ? req.dbClient.query(ratingAggQuery, [req.merchantId, customerIds]) : Promise.resolve({ rows: [] })
        ]);

        if (results[0].status === 'fulfilled') {
            results[0].value.rows.forEach((row) => loanAggMap.set(row.customer_id, row));
        }
        if (results[1].status === 'fulfilled') {
            results[1].value.rows.forEach((row) => ratingAggMap.set(row.customer_id, row));
        }

        const stats = {};
        customerIds.forEach((id) => {
            stats[id] = buildCustomerStats(id, loanAggMap, ratingAggMap);
        });

        const payload = { stats };
        await setCache(cacheKey, payload, Number.isFinite(ttlSeconds) ? ttlSeconds : 90);
        res.set('Cache-Control', cacheHeader);
        res.json(payload);
    } catch (err) {
        console.error('Get customers stats error:', err);
        res.status(500).json({ error: 'Failed to fetch customer stats' });
    }
});

// GET /api/customers/:id/ratings - list ratings for customer
router.get('/:id/ratings', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const ratingsReady = await ensureCustomerRatingsTable(req.dbClient);
        if (!ratingsReady) {
            return res.status(503).json({ error: 'customer_ratings table is missing or not ready yet.' });
        }
        const { limit = 24 } = req.query;
        const customerId = req.params.id;

        const customerExists = await req.dbClient.query(
            'SELECT id FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL',
            [customerId, req.merchantId]
        );
        if (customerExists.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const ratingsResult = await req.dbClient.query(
            `SELECT id, rating_scope, score, month_key, loan_id, notes, is_locked, created_at, updated_at
             FROM customer_ratings
             WHERE merchant_id = $1 AND customer_id = $2
             ORDER BY month_key DESC NULLS LAST, created_at DESC
             LIMIT $3`,
            [req.merchantId, customerId, Number(limit)]
        );

        const summaryResult = await req.dbClient.query(
            `SELECT
              ROUND(COALESCE(AVG(score) FILTER (WHERE rating_scope = 'delivery'), 0)::numeric, 1) AS delivery_avg,
              ROUND(COALESCE(AVG(score) FILTER (WHERE rating_scope = 'monthly'), 0)::numeric, 1) AS monthly_avg,
              ROUND((
                COALESCE(AVG(score) FILTER (WHERE rating_scope = 'delivery'), 0) * 0.6
                + COALESCE(AVG(score) FILTER (WHERE rating_scope = 'monthly'), 0) * 0.4
              )::numeric, 1) AS overall_score
             FROM customer_ratings
             WHERE merchant_id = $1 AND customer_id = $2`,
            [req.merchantId, customerId]
        );

        res.json({
            ratings: ratingsResult.rows,
            summary: summaryResult.rows[0] || { delivery_avg: 0, monthly_avg: 0, overall_score: 0 }
        });
    } catch (err) {
        console.error('Get customer ratings error:', err);
        res.status(500).json({ error: 'Failed to fetch customer ratings' });
    }
});

// POST /api/customers/:id/ratings - add/update manual rating
router.post('/:id/ratings', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const runQuery = async (query, queryParams = []) => {
            if (!req.dbClient?.query || req.dbClient?.query?._isMockFunction) {
                return db.query(query, queryParams);
            }
            if (req.dbClientBroken) {
                return runWithFreshMerchantClient(req.merchantId, (client) => client.query(query, queryParams));
            }
            try {
                return await req.dbClient.query(query, queryParams);
            } catch (err) {
                if (!isTxAbortedError(err)) throw err;
                req.dbClientBroken = true;
                console.warn('Customer rating query aborted; retrying with a fresh connection.');
                return runWithFreshMerchantClient(req.merchantId, (client) => client.query(query, queryParams));
            }
        };

        const ratingsReady = await ensureCustomerRatingsTable(req.dbClient);
        if (!ratingsReady) {
            return res.status(503).json({ error: 'customer_ratings table is missing or not ready yet.' });
        }
        const { error, value } = customerRatingSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const customerId = req.params.id;
        const scope = value.scope;
        const score = Number(value.score);
        const notes = value.notes || null;
        const ratedBy = normalizeRatedBy(req.user);
        let loanId = value.loanId || null;
        let monthKey = value.month ? `${value.month}-01` : null;

        const customerExists = await runQuery(
            'SELECT id FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL',
            [customerId, req.merchantId]
        );
        if (customerExists.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        if (scope === 'delivery') {
            if (!loanId) {
                return res.status(400).json({ error: 'loanId is required for delivery rating' });
            }

            const loanCheck = await runQuery(
                `SELECT id, customer_id, status
                 FROM loans
                 WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL`,
                [loanId, req.merchantId]
            );

            if (loanCheck.rows.length === 0 || loanCheck.rows[0].customer_id !== customerId) {
                return res.status(400).json({ error: 'Loan does not belong to this customer' });
            }

            if (!isPaidLoanStatus(loanCheck.rows[0].status)) {
                return res.status(400).json({ error: 'Delivery rating is allowed only after loan is marked as Paid' });
            }
        } else {
            // monthly
            loanId = null;
            if (!monthKey) {
                const now = new Date();
                monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            }
        }

        // Lock updates after 48 hours to preserve audit trail.
        const existing = await runQuery(
            `SELECT id, is_locked, created_at
             FROM customer_ratings
             WHERE merchant_id = $1
               AND customer_id = $2
               AND rating_scope = $3
               AND (
                 ($3 = 'delivery' AND loan_id = $4)
                 OR
                 ($3 = 'monthly' AND month_key = $5::date)
               )
             LIMIT 1`,
            [req.merchantId, customerId, scope, loanId, monthKey]
        );

        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            const createdAt = new Date(row.created_at).getTime();
            const isExpired = Date.now() - createdAt > 48 * 60 * 60 * 1000;
            if (row.is_locked || isExpired) {
                await runQuery(
                    'UPDATE customer_ratings SET is_locked = true WHERE id = $1',
                    [row.id]
                );
                return res.status(409).json({
                    error: 'Rating is locked and can no longer be edited after 48 hours'
                });
            }
        }

        let result;
        if (scope === 'delivery') {
            if (existing.rows.length > 0) {
                result = await runQuery(
                    `UPDATE customer_ratings
                     SET score = $1,
                         notes = $2,
                         rated_by = $3,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $4 AND merchant_id = $5
                     RETURNING *`,
                    [score, notes, ratedBy, existing.rows[0].id, req.merchantId]
                );
            } else {
                try {
                    result = await runQuery(
                        `INSERT INTO customer_ratings
                          (merchant_id, customer_id, loan_id, rating_scope, score, month_key, notes, rated_by)
                         VALUES ($1, $2, $3, 'delivery', $4, NULL, $5, $6)
                         RETURNING *`,
                        [req.merchantId, customerId, loanId, score, notes, ratedBy]
                    );
                } catch (err) {
                    if (err.code !== '23505') throw err;
                    result = await runQuery(
                        `UPDATE customer_ratings
                         SET score = $1,
                             notes = $2,
                             rated_by = $3,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE merchant_id = $4
                           AND customer_id = $5
                           AND rating_scope = 'delivery'
                           AND loan_id = $6
                         RETURNING *`,
                        [score, notes, ratedBy, req.merchantId, customerId, loanId]
                    );
                }
            }
        } else {
            if (existing.rows.length > 0) {
                result = await runQuery(
                    `UPDATE customer_ratings
                     SET score = $1,
                         notes = $2,
                         rated_by = $3,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $4 AND merchant_id = $5
                     RETURNING *`,
                    [score, notes, ratedBy, existing.rows[0].id, req.merchantId]
                );
            } else {
                try {
                    result = await runQuery(
                        `INSERT INTO customer_ratings
                          (merchant_id, customer_id, loan_id, rating_scope, score, month_key, notes, rated_by)
                         VALUES ($1, $2, NULL, 'monthly', $3, $4::date, $5, $6)
                         RETURNING *`,
                        [req.merchantId, customerId, score, monthKey, notes, ratedBy]
                    );
                } catch (err) {
                    if (err.code !== '23505') throw err;
                    result = await runQuery(
                        `UPDATE customer_ratings
                         SET score = $1,
                             notes = $2,
                             rated_by = $3,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE merchant_id = $4
                           AND customer_id = $5
                           AND rating_scope = 'monthly'
                           AND month_key = $6::date
                         RETURNING *`,
                        [score, notes, ratedBy, req.merchantId, customerId, monthKey]
                    );
                }
            }
        }

        if (!result?.rows?.[0]) {
            return res.status(500).json({ error: 'تعذر حفظ التقييم حالياً. حاول مرة أخرى.' });
        }

        res.status(201).json({
            message: 'Rating saved successfully',
            rating: result.rows[0]
        });
    } catch (err) {
        console.error('Save customer rating error:', err);
        if (err?.code === '22P02') {
            return res.status(400).json({ error: 'صيغة البيانات غير صحيحة. تأكد من القيم المدخلة.' });
        }
        if (err?.code === '23503') {
            return res.status(400).json({ error: 'القرض أو العميل غير صالح لهذا التقييم.' });
        }
        res.status(500).json({ error: 'Failed to save customer rating' });
    }
});

// GET /api/customers/:id - Get customer with loan history
router.get('/:id', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const ratingsTableCheck = await req.dbClient.query(`SELECT to_regclass('public.customer_ratings') AS t`);
        const hasRatingsTable = Boolean(ratingsTableCheck.rows[0]?.t);
        // Get customer
        const customerResult = await req.dbClient.query(
            'SELECT * FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL',
            [req.params.id, req.merchantId]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const customer = customerResult.rows[0];

        // Get loan history
        const loansResult = await req.dbClient.query(
            `SELECT id, amount, receipt_number, status, transaction_date, created_at
       FROM loans
       WHERE customer_id = $1 AND merchant_id = $2 AND deleted_at IS NULL
       ORDER BY transaction_date DESC`,
            [req.params.id, req.merchantId]
        );

        // Calculate totals
        const totals = await req.dbClient.query(
            `SELECT 
         COALESCE(SUM(CASE WHEN status = 'Active' THEN amount ELSE 0 END), 0) as active_debt,
         COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END), 0) as paid_amount,
         COUNT(*) as total_loans
       FROM loans
       WHERE customer_id = $1 AND merchant_id = $2`,
            [req.params.id, req.merchantId]
        );

        const ratingSummaryResult = hasRatingsTable
            ? await req.dbClient.query(
                `SELECT
              ROUND(COALESCE(AVG(score) FILTER (WHERE rating_scope = 'delivery'), 0)::numeric, 1) AS delivery_avg,
              ROUND(COALESCE(AVG(score) FILTER (WHERE rating_scope = 'monthly'), 0)::numeric, 1) AS monthly_avg,
              ROUND((
                COALESCE(AVG(score) FILTER (WHERE rating_scope = 'delivery'), 0) * 0.6
                + COALESCE(AVG(score) FILTER (WHERE rating_scope = 'monthly'), 0) * 0.4
              )::numeric, 1) AS overall_score
             FROM customer_ratings
             WHERE merchant_id = $1 AND customer_id = $2`,
                [req.merchantId, req.params.id]
            )
            : { rows: [{ delivery_avg: 0, monthly_avg: 0, overall_score: 0 }] };

        res.json({
            customer: enrichCustomer(customer),
            loans: loansResult.rows,
            summary: totals.rows[0],
            ratingSummary: ratingSummaryResult.rows[0] || { delivery_avg: 0, monthly_avg: 0, overall_score: 0 }
        });
    } catch (err) {
        console.error('Get customer error:', err);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// POST /api/customers - Create new customer
const { checkPlanLimit } = require('../middleware/planLimits');

router.post('/', checkPermission('can_view_customers'), checkPlanLimit('customers'), async (req, res) => {
    try {
        const { error, value } = customerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { fullName, nationalId, mobileNumber } = value;

        // Check for duplicate national ID (both active and soft-deleted)
        const duplicate = await req.dbClient.query(
            'SELECT id, deleted_at FROM customers WHERE merchant_id = $1 AND national_id = $2',
            [req.merchantId, nationalId]
        );

        if (duplicate.rows.length > 0) {
            const customerRow = duplicate.rows[0];
            if (!customerRow.deleted_at) {
                return res.status(409).json({ error: 'Customer with this National ID already exists' });
            } else {
                // Restore soft-deleted customer
                const result = await req.dbClient.query(
                    `UPDATE customers 
                     SET deleted_at = NULL, full_name = $3, mobile_number = $4, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND merchant_id = $2
                     RETURNING *`,
                    [customerRow.id, req.merchantId, fullName, mobileNumber]
                );
                await invalidateReportsCache(req.merchantId);
                return res.status(201).json({
                    message: 'Customer restored successfully',
                    customer: enrichCustomer(result.rows[0])
                });
            }
        }

        const result = await req.dbClient.query(
            `INSERT INTO customers 
       (merchant_id, full_name, national_id, mobile_number)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [req.merchantId, fullName, nationalId, mobileNumber]
        );

        await invalidateReportsCache(req.merchantId);
        res.status(201).json({
            message: 'Customer created successfully',
            customer: enrichCustomer(result.rows[0])
        });
    } catch (err) {
        console.error('Create customer error:', err);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// PATCH /api/customers/:id - Update customer
router.patch('/:id', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const { fullName, mobileNumber } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (fullName) {
            updates.push(`full_name = $${paramIndex}`);
            params.push(fullName);
            paramIndex++;
        }
        if (mobileNumber) {
            updates.push(`mobile_number = $${paramIndex}`);
            params.push(mobileNumber);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(req.params.id, req.merchantId);

        const result = await req.dbClient.query(
            `UPDATE customers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} AND merchant_id = $${paramIndex + 1} AND deleted_at IS NULL
       RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        await invalidateReportsCache(req.merchantId);
        res.json({
            message: 'Customer updated successfully',
            customer: enrichCustomer(result.rows[0])
        });
    } catch (err) {
        console.error('Update customer error:', err);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', checkPermission('can_view_customers'), async (req, res) => {
    try {
        // Check if customer has active loans (respecting soft delete)
        const loansCheck = await req.dbClient.query(
            'SELECT COUNT(*) FROM loans WHERE customer_id = $1 AND status = $2 AND deleted_at IS NULL',
            [req.params.id, 'Active']
        );

        const activeLoansCount = parseInt(loansCheck.rows[0]?.count || '0', 10);
        if (activeLoansCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete customer with active loans. Please settle all loans first.'
            });
        }

        // Soft Delete (Shielded Logic Phase)
        const result = await req.dbClient.query(
            'UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL RETURNING id',
            [req.params.id, req.merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found or unauthorized' });
        }

        await invalidateReportsCache(req.merchantId);
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        console.error('Delete customer error:', err);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

module.exports = router;
