const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// ── Admin login rate limiter (3 attempts / 30 minutes) ──
const adminLoginLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 3,
    message: { error: 'تم تجاوز عدد المحاولات. حاول بعد 30 دقيقة.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Admin API rate limiter (100 requests / 15 minutes) ──
const adminApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'طلبات كثيرة. حاول لاحقاً.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Generate admin JWT token.
 */
function generateAdminToken() {
    if (!ADMIN_SECRET) {
        throw new Error('ADMIN_SECRET is not configured');
    }
    return jwt.sign(
        { role: 'admin', iat: Math.floor(Date.now() / 1000) },
        ADMIN_SECRET,
        { expiresIn: '2h' }
    );
}

/**
 * Middleware: verify admin JWT token.
 */
function authenticateAdmin(req, res, next) {
    if (!ADMIN_SECRET) {
        return res.status(500).json({ error: 'إعدادات الأمان غير مكتملة (ADMIN_SECRET)' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'توكن الأدمن مطلوب' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, ADMIN_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'صلاحيات غير كافية' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'توكن غير صالح أو منتهي' });
    }
}

module.exports = {
    ADMIN_SECRET,
    adminLoginLimiter,
    adminApiLimiter,
    generateAdminToken,
    authenticateAdmin,
};
