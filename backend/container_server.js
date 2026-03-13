const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const loansRoutes = require('./routes/loans');
const customersRoutes = require('./routes/customers');
const reportsRoutes = require('./routes/reports');
const subscriptionRoutes = require('./routes/subscription');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // handled by Nginx in production
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(compression());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting — normal API routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    skip: (req) => req.path.includes('/upload') // no limit for bulk uploads
});
app.use('/api/', limiter);

// Login-specific strict rate limiter: 5 attempts per 15 min
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'تم تجاوز عدد المحاولات المسموح. حاول بعد 15 دقيقة' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);

// Body parsing middleware — 50MB to allow large JSON payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(require('./config/passport').initialize());

// Logging
app.use(morgan('combined'));

// Debug logging
app.use((req, res, next) => {
    console.log(`[DEBUG] Incoming Request: ${req.method} ${req.url}`);
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
app.use('/api/admin', require('./routes/admin'));
app.use('/api/subscription-requests', require('./routes/subscription-requests'));
app.use('/api/public', require('./routes/public'));

// Serve static files from uploads folder
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
