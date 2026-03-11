const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

function loadEnv() {
    const envPath = path.join(__dirname, '../../.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!(key in process.env)) process.env[key] = value;
    }
}

async function request(baseUrl, check) {
    const headers = {};
    if (check.token) headers.Authorization = `Bearer ${check.token}`;
    if (check.headers) Object.assign(headers, check.headers);
    const res = await fetch(`${baseUrl}${check.path}`, {
        method: check.method || 'GET',
        headers,
    });
    return res.status;
}

function printResults(results) {
    console.log('\nAPI Permission Checklist\n');
    console.log('Status | Expected | Endpoint | Result');
    console.log('--- | --- | --- | ---');
    for (const r of results) {
        console.log(`${r.actual} | ${r.expected} | ${r.label} | ${r.pass ? 'PASS' : 'FAIL'}`);
    }
}

async function run() {
    loadEnv();

    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3100}`;
    const JWT_SECRET = process.env.JWT_SECRET;
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    const TEST_MERCHANT_ID = process.env.TEST_MERCHANT_ID;

    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET missing in env');
    }

    let merchantId = TEST_MERCHANT_ID;
    if (!merchantId && ADMIN_SECRET) {
        try {
            const adminToken = jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '5m' });
            const res = await fetch(`${baseUrl}/api/system-manage-x7/merchants`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });
            if (res.ok) {
                const merchants = await res.json();
                if (Array.isArray(merchants) && merchants.length) {
                    merchantId = merchants[0].id;
                }
            }
        } catch (err) {
            console.warn('Failed to fetch merchant via admin API:', err.message);
        }
    }
    if (!merchantId) {
        const db = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 5432),
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'loan_management',
        });
        await db.connect();
        const merchantRes = await db.query('SELECT id FROM merchants ORDER BY created_at ASC LIMIT 1');
        await db.end();
        if (!merchantRes.rows.length) {
            throw new Error('No merchant found for permission tests');
        }
        merchantId = merchantRes.rows[0].id;
    }

    const merchantToken = jwt.sign(
        { merchantId, userId: merchantId, role: 'merchant', email: 'merchant@test.local' },
        JWT_SECRET,
        { expiresIn: '30m' }
    );
    const employeeNoPermToken = jwt.sign(
        {
            merchantId,
            userId: '00000000-0000-0000-0000-000000000001',
            role: 'employee',
            permissions: {
                can_view_loans: false,
                can_add_loans: false,
                can_view_dashboard: false,
                can_view_analytics: false,
            },
        },
        JWT_SECRET,
        { expiresIn: '30m' }
    );
    const employeeLoansToken = jwt.sign(
        {
            merchantId,
            userId: '00000000-0000-0000-0000-000000000002',
            role: 'employee',
            permissions: {
                can_view_loans: true,
                can_add_loans: false,
                can_view_dashboard: false,
                can_view_analytics: false,
            },
        },
        JWT_SECRET,
        { expiresIn: '30m' }
    );
    const employeeAnalyticsToken = jwt.sign(
        {
            merchantId,
            userId: '00000000-0000-0000-0000-000000000003',
            role: 'employee',
            permissions: {
                can_view_loans: false,
                can_add_loans: false,
                can_view_dashboard: true,
                can_view_analytics: true,
            },
        },
        JWT_SECRET,
        { expiresIn: '30m' }
    );

    let adminToken = null;
    if (ADMIN_SECRET) {
        adminToken = jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '30m' });
    }

    const checks = [
        { label: 'loans without token', method: 'GET', path: '/api/loans', expected: 401 },
        { label: 'loans with merchant token', method: 'GET', path: '/api/loans', token: merchantToken, expected: 200 },
        { label: 'loans with no-perm employee', method: 'GET', path: '/api/loans', token: employeeNoPermToken, expected: 403 },
        { label: 'loans with view-loans employee', method: 'GET', path: '/api/loans', token: employeeLoansToken, expected: 200 },
        { label: 'reports dashboard with no-perm employee', method: 'GET', path: '/api/reports/dashboard', token: employeeNoPermToken, expected: 403 },
        { label: 'reports dashboard with analytics employee', method: 'GET', path: '/api/reports/dashboard', token: employeeAnalyticsToken, expected: 200 },
        { label: 'reports analytics with no-perm employee', method: 'GET', path: '/api/reports/analytics', token: employeeNoPermToken, expected: 403 },
        { label: 'reports analytics with analytics employee', method: 'GET', path: '/api/reports/analytics', token: employeeAnalyticsToken, expected: 200 },
        { label: 'admin list merchants without token', method: 'GET', path: '/api/system-manage-x7/merchants', expected: 401 },
        { label: 'admin list merchants with merchant token', method: 'GET', path: '/api/system-manage-x7/merchants', token: merchantToken, expected: 401 },
    ];

    if (adminToken) {
        checks.push({
            label: 'admin list merchants with admin token',
            method: 'GET',
            path: '/api/system-manage-x7/merchants',
            token: adminToken,
            expected: 200,
        });
    } else {
        console.warn('ADMIN_SECRET is not set. Skipping positive admin-token check.');
    }

    const results = [];
    for (const c of checks) {
        const actual = await request(baseUrl, c);
        results.push({ ...c, actual, pass: actual === c.expected });
    }

    printResults(results);

    const failed = results.filter((r) => !r.pass);
    if (failed.length) {
        console.error(`\nPermission checklist failed: ${failed.length} case(s).`);
        process.exit(1);
    }
    console.log('\nPermission checklist passed.');
}

run().catch((err) => {
    console.error('Permission checklist failed:', err);
    process.exit(1);
});
