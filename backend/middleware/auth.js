const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // Fallback to cookie
    if (!token && req.cookies) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // ── Verify Session Version (Zero-Trust) ──
        if (decoded.role === 'employee') {
            const result = await db.query(
                'SELECT session_version, permissions FROM merchant_employees WHERE id = $1 AND merchant_id = $2',
                [decoded.employeeId, decoded.merchantId]
            );
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Employee not found or unauthorized' });
            }

            const currentVersion = result.rows[0].session_version || 1;
            if (decoded.version && decoded.version < currentVersion) {
                return res.status(401).json({ error: 'Session expired. Please login again.' });
            }

            // Sync permissions from DB to avoid staleness
            decoded.permissions = result.rows[0].permissions;
        } else {
            const result = await db.query(
                'SELECT session_version FROM merchants WHERE id = $1',
                [decoded.merchantId]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Merchant not found' });
            }

            const currentVersion = result.rows[0].session_version || 1;
            if (decoded.version && decoded.version < currentVersion) {
                return res.status(401).json({ error: 'Session expired. Please login again.' });
            }
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

const injectMerchantId = (req, res, next) => {
    if (req.user && req.user.merchantId) {
        req.merchantId = req.user.merchantId;
        next();
    } else {
        res.status(403).json({ error: 'Merchant ID not found in token' });
    }
};

/**
 * ── injectRlsContext ──
 * Enforces PostgreSQL Row-Level Security (RLS) at the connection level.
 * Acquires a client, starts a transaction, sets app.merchant_id,
 * and attaches it to req.dbClient for use in controllers.
 */
const injectRlsContext = async (req, res, next) => {
    if (!req.user || !req.user.merchantId) {
        return res.status(403).json({ error: 'Security context missing (Unauthenticated)' });
    }

    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        // SET LOCAL is scoped to the transaction only - failsafe against connection pooling leaks
        await client.query(`SET LOCAL app.merchant_id = '${req.user.merchantId}'`);

        req.dbClient = client;

        const cleanup = async () => {
            res.removeListener('finish', cleanup);
            res.removeListener('close', cleanup);
            try {
                // If the response failed, we might want to rollback, 
                // but for simple GETs/updates, COMMIT is usually fine unless 
                // we're doing multi-step mutations.
                await client.query('COMMIT');
            } catch (err) {
                console.error('RLS Transaction Commit Error:', err);
            } finally {
                client.release(true);
            }
        };

        res.on('finish', cleanup);
        res.on('close', cleanup);

        next();
    } catch (err) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (e) { }
            client.release();
        }
        console.error('RLS Injection Failure:', err);
        res.status(500).json({ error: 'حدث خطأ في جدار الحماية للبيانات' });
    }
};

const checkPermission = (permission) => {
    return (req, res, next) => {
        // Merchants have all permissions
        if (!req.user.role || req.user.role === 'merchant') {
            return next();
        }

        // Check employee permissions
        if (req.user.permissions && req.user.permissions[permission]) {
            return next();
        }

        res.status(403).json({ error: 'ليس لديك صلاحية للقيام بهذا الإجراء' });
    };
};

/**
 * ── stepUpAuth ──
 * Requires a valid one-time token (OTT) generated via password verification.
 */
const { redis } = require('../config/redis');

const stepUpAuth = async (req, res, next) => {
    const stepUpToken = req.headers['x-step-up-token'];

    if (!stepUpToken) {
        return res.status(401).json({
            error: 'step_up_required',
            message: 'هذه العملية تتطلب تأكيد إضافي للهوية (Step-Up Auth)'
        });
    }

    try {
        const userId = req.user.userId;
        // We can use the originalUrl or a generic 'mutation' action type
        const actionType = req.method + ':' + req.baseUrl;
        const key = `stepup:${userId}:${actionType}`;

        const storedToken = await redis.get(key);

        if (!storedToken || storedToken !== stepUpToken) {
            return res.status(401).json({ error: 'رمز التأكيد غير صالح أو منتهي الصلاحية' });
        }

        // OTT: One-time use
        await redis.del(key);

        next();
    } catch (err) {
        console.error('Step-Up Auth Verification Error:', err);
        res.status(500).json({ error: 'خطأ في التحقق من الرمز' });
    }
};

module.exports = {
    authenticateToken,
    injectMerchantId,
    injectRlsContext,
    checkPermission,
    stepUpAuth,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
