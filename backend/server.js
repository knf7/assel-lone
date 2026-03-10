const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { validateEnv } = require('./config/env');
const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

// Sentry Initialization First
if (process.env.SENTRY_DSN) {
    const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || (process.env.NODE_ENV === 'production' ? 0.2 : 1));
    const profilesSampleRate = Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || (process.env.NODE_ENV === 'production' ? 0.1 : 1));

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            nodeProfilingIntegration(),
        ],
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.2,
        profilesSampleRate: Number.isFinite(profilesSampleRate) ? profilesSampleRate : 0.1,
    });
}

const authRoutes = require('./routes/auth');
const loansRoutes = require('./routes/loans');
const customersRoutes = require('./routes/customers');
const { bindTransport } = require('./utils/emailWorker');
const mailer = require('./utils/mailer');

// Bind mailer to the worker queue
bindTransport(async (jobData) => {
    const transport = await mailer.getTransporter();
    return transport.sendMail(jobData);
});
const reportsRoutes = require('./routes/reports');
const subscriptionRoutes = require('./routes/subscription');
const logger = require('./utils/logger');
const metricsController = require('./controllers/metricsController');
const bullBoardEnabled = process.env.ENABLE_BULL_BOARD === 'true' && !process.env.VERCEL;
let createBullBoard;
let BullMQAdapter;
let ExpressAdapter;
let emailQueue;
if (bullBoardEnabled) {
    try {
        // Optional in serverless builds; avoid crashing when UI deps are missing.
        ({ createBullBoard } = require('@bull-board/api'));
        ({ BullMQAdapter } = require('@bull-board/api/bullMQAdapter'));
        ({ ExpressAdapter } = require('@bull-board/express'));
        ({ emailQueue } = require('./utils/emailQueue'));
    } catch (err) {
        console.warn('[WARN] Bull Board disabled:', err.message);
    }
}
const { redis } = require('./config/redis');
const db = require('./config/database');
const { createObservability } = require('./middleware/observability');

validateEnv();

// Initialize Bull Board for Queue Monitoring (if available)
let serverAdapter;
if (bullBoardEnabled && createBullBoard && BullMQAdapter && ExpressAdapter && emailQueue) {
    try {
        serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/admin/queues');
        createBullBoard({
            queues: [new BullMQAdapter(emailQueue)],
            serverAdapter: serverAdapter,
        });
    } catch (err) {
        console.warn('[WARN] Bull Board init failed:', err.message);
        serverAdapter = null;
    }
}

const app = express();
const PORT = process.env.PORT || 3001;
const observability = createObservability({
    logger,
    notify: (message, snapshot, level = 'warning') => {
        if (process.env.SENTRY_DSN) {
            Sentry.captureMessage(message, {
                level,
                extra: { snapshot },
            });
        }
    },
});

// Trust Cloudflare proxy
app.set('trust proxy', 1);

// Security middleware
app.use(cookieParser());
app.use(helmet()); // Enable all Helmet security headers

const parseOriginList = (value) =>
    (value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

const allowedOrigins = new Set([
    process.env.FRONTEND_URL,
    ...parseOriginList(process.env.FRONTEND_URLS),
    // Only trusted explicitly matching domains
    'https://aseel-saas.com',
    'https://app.aseel-saas.com',
    // Local development
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3003',
].filter(Boolean));

const allowVercelPreviews = process.env.CORS_ALLOW_VERCEL === 'true';
const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;
    if (allowVercelPreviews && origin.endsWith('.vercel.app')) return true;
    return false;
};

app.use(cors({
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Rate limiting — normal API routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    skip: (req) => req.path.includes('/upload') // no limit for bulk uploads
});
app.use('/api/', limiter);

// Rate limiting — for login endpoint (very high limit for performance testing)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000000, // Very high limit for performance testing
    message: 'Too many login attempts from this IP, please try again after 15 minutes'
});
app.use('/api/auth/login', loginLimiter);


// Body parsing middleware — 50MB to allow large JSON payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple XSS Sanitizer Middleware
const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    for (let key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = obj[key].replace(/</g, "&lt;").replace(/>/g, "&gt;");
        } else if (typeof obj[key] === 'object') {
            sanitize(obj[key]);
        }
    }
};
app.use((req, res, next) => {
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
});

app.use(require('./config/passport').initialize());

// Logging
app.use(morgan('combined'));
app.use(observability.middleware);

// Debug logging (Hardened - Zero Trust)
app.use((req, res, next) => {
    const sanitize = (obj) => {
        if (!obj) return obj;
        const sanitized = { ...obj };
        const secretKeys = ['password', 'otp', 'token', 'secret', 'nationalId', 'mobile_number', 'fullName', 'authorization'];

        Object.keys(sanitized).forEach(key => {
            if (secretKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '***';
            }
        });
        return sanitized;
    };

    const safeUrl = req.url.replace(/(token|password|otp|secret|nationalId)=[^&]+/gi, '$1=***');
    const safeHeaders = sanitize(req.headers);

    logger.info(`Incoming Request: ${req.method} ${safeUrl}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        headers: {
            ...safeHeaders,
            authorization: safeHeaders.authorization ? 'Bearer ***' : undefined
        }
        // Never log the full body in production; redact key fields if needed
    });
    next();
});

// Health check
app.get('/health', async (req, res) => {
    const payload = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'unknown',
            redis: 'unknown'
        }
    };

    try {
        await db.query('SELECT 1');
        payload.services.database = 'up';
    } catch (e) {
        payload.services.database = 'down';
    }

    try {
        await redis.ping();
        payload.services.redis = 'up';
    } catch (e) {
        payload.services.redis = 'down';
    }

    const allUp = payload.services.database === 'up' && payload.services.redis === 'up';
    if (!allUp) payload.status = 'degraded';
    res.status(allUp ? 200 : 503).json(payload);
});
// Compatibility health route under /api
app.get('/api/health', async (req, res) => {
    const payload = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'unknown',
            redis: 'unknown'
        }
    };

    try {
        await db.query('SELECT 1');
        payload.services.database = 'up';
    } catch (e) {
        payload.services.database = 'down';
    }

    try {
        await redis.ping();
        payload.services.redis = 'up';
    } catch (e) {
        payload.services.redis = 'down';
    }

    const allUp = payload.services.database === 'up' && payload.services.redis === 'up';
    if (!allUp) payload.status = 'degraded';
    res.status(allUp ? 200 : 503).json(payload);
});

// API Routes
// Clerk Webhooks (must be before json body parser for raw body access)
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/auth', authRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/settings', require('./routes/settings'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/system-manage-x7', require('./routes/admin')); // Obfuscated Admin Path
app.use('/api/subscription-requests', require('./routes/subscription-requests'));
app.use('/api/public', require('./routes/public'));

// Observability Route (Internal/Protected)
app.get('/api/admin-metrics-x7', (req, res, next) => {
    const authHeader = req.headers['x-metrics-key'];
    if (process.env.ADMIN_SECRET && authHeader === process.env.ADMIN_SECRET) {
        return metricsController.getMetrics(req, res);
    }
    res.status(403).json({ error: 'Unauthorized access to metrics' });
});

app.get('/api/ops/runtime-metrics', (req, res) => {
    const authHeader = req.headers['x-metrics-key'];
    if (!process.env.ADMIN_SECRET || authHeader !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Unauthorized access to runtime metrics' });
    }
    return res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        runtime: observability.getSnapshot(),
    });
});

// --- BullMQ Dashboard (Secured) ---
// In production, you would attach authentication middleware here
if (serverAdapter) {
    app.use('/admin/queues', (req, res, next) => {
        // Simplistic auth wrapper, usually replaced by proper passport/JWT middleware
        const authHeader = req.headers['authorization'] || req.query.key;
        if (process.env.ADMIN_SECRET && authHeader === process.env.ADMIN_SECRET) {
            return next();
        }
        if (process.env.NODE_ENV === 'development') return next();
        res.status(401).send('Unauthorized for Queue Monitoring');
    }, serverAdapter.getRouter());
}

// Serve static files from uploads folder
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// The error handler must be before any other error middleware and after all controllers
if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
}

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`🚀 Server running on port ${PORT}`);
        logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

module.exports = app;
