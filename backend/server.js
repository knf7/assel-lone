const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const loansRoutes = require('./routes/loans');
const customersRoutes = require('./routes/customers');
const reportsRoutes = require('./routes/reports');
const subscriptionRoutes = require('./routes/subscription');
const logger = require('./utils/logger');
const metricsController = require('./controllers/metricsController');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Cloudflare proxy
app.set('trust proxy', 1);

// Security middleware
app.use(cookieParser());
app.use(helmet({
    contentSecurityPolicy: false, // handled by Nginx in production
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
}));
const allowedOrigins = [
    process.env.FRONTEND_URL,
    // Production server
    'http://109.199.113.45',
    'http://109.199.113.45:80',
    'https://109.199.113.45',
    // Local development
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
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
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
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
    if (authHeader === (process.env.ADMIN_SECRET || 'secret123')) {
        return metricsController.getMetrics(req, res);
    }
    res.status(403).json({ error: 'Unauthorized access to metrics' });
});

// Serve static files from uploads folder
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

module.exports = app;
