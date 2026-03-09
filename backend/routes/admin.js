const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const {
    ADMIN_SECRET,
    adminLoginLimiter,
    adminApiLimiter,
    generateAdminToken,
    authenticateAdmin,
} = require('../middleware/adminAuth');

const router = express.Router();

// ── POST /api/admin/login ──
router.post('/login', adminLoginLimiter, (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!password) {
        return res.status(400).json({ error: 'كلمة المرور مطلوبة' });
    }
    if (!adminPassword) {
        return res.status(500).json({ error: 'إعدادات الإدارة غير مكتملة (ADMIN_PASSWORD)' });
    }

    if (password !== adminPassword) {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }

    const token = generateAdminToken();
    res.json({ token, expiresIn: '2h' });
});

// ── All routes below require admin auth ──
router.use(authenticateAdmin);
router.use(adminApiLimiter);

// ── GET /api/admin/merchants ──
router.get('/merchants', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                m.id,
                m.business_name,
                m.email,
                m.mobile_number,
                m.subscription_plan,
                m.subscription_status,
                m.expiry_date,
                m.created_at,
                (SELECT COUNT(*) FROM customers c WHERE c.merchant_id = m.id) as customer_count,
                (SELECT COUNT(*) FROM loans l WHERE l.merchant_id = m.id) as loan_count
            FROM merchants m
            ORDER BY m.created_at DESC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Admin merchants error:', err);
        res.status(500).json({ error: 'فشل جلب بيانات التجار' });
    }
});

// ── GET /api/admin/stats ──
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                COUNT(*) as total_merchants,
                COUNT(*) FILTER (WHERE subscription_plan = 'Free') as free_count,
                COUNT(*) FILTER (WHERE subscription_plan = 'Basic') as basic_count,
                COUNT(*) FILTER (WHERE subscription_plan = 'Pro') as pro_count,
                COUNT(*) FILTER (WHERE subscription_plan = 'Enterprise') as enterprise_count,
                COUNT(*) FILTER (WHERE subscription_status = 'Active') as active_count,
                COUNT(*) FILTER (WHERE subscription_status = 'Cancelled') as cancelled_count
            FROM merchants
        `);

        const totals = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM customers) as total_customers,
                (SELECT COUNT(*) FROM loans) as total_loans,
                (SELECT COALESCE(SUM(amount), 0) FROM loans) as total_volume
        `);

        // Time-series data for the last 6 months
        const chartData = await db.query(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM') as month,
                COUNT(*) as count
            FROM merchants
            WHERE created_at > CURRENT_DATE - INTERVAL '6 months'
            GROUP BY month
            ORDER BY month ASC
        `);

        res.json({
            ...stats.rows[0],
            ...totals.rows[0],
            chartData: chartData.rows
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'فشل جلب الإحصائيات' });
    }
});

// ── PUT /api/admin/merchants/:id/subscription ──
router.put('/merchants/:id/subscription', async (req, res) => {
    try {
        const { id } = req.params;
        const { plan, status, expiryDate } = req.body;
        const normalizedPlan = plan ? (plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase()) : null;

        const validPlans = ['Free', 'Basic', 'Pro', 'Enterprise'];
        const validStatuses = ['Active', 'Cancelled', 'PastDue', 'Inactive'];

        if (normalizedPlan && !validPlans.includes(normalizedPlan)) {
            return res.status(400).json({ error: 'باقة غير صالحة' });
        }
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'حالة غير صالحة' });
        }

        const updates = [];
        const values = [];
        let idx = 1;

        if (normalizedPlan) {
            updates.push(`subscription_plan = $${idx++}`);
            values.push(normalizedPlan);
        }
        if (status) {
            updates.push(`subscription_status = $${idx++}`);
            values.push(status);
        }
        if (expiryDate !== undefined) {
            updates.push(`expiry_date = $${idx++}`);
            values.push(expiryDate || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'لا يوجد تحديثات' });
        }

        values.push(id);
        const result = await db.query(
            `UPDATE merchants SET ${updates.join(', ')} WHERE id = $${idx} 
             RETURNING id, business_name, email, subscription_plan, subscription_status, expiry_date`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'التاجر غير موجود' });
        }

        res.json({ message: 'تم تحديث الاشتراك', merchant: result.rows[0] });
    } catch (err) {
        console.error('Admin update subscription error:', err);
        res.status(500).json({ error: 'فشل تحديث الاشتراك' });
    }
});

// ── DELETE /api/admin/merchants/:id ──
router.delete('/merchants/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Delete related data first
        await db.query('DELETE FROM loans WHERE merchant_id = $1', [id]);
        await db.query('DELETE FROM customers WHERE merchant_id = $1', [id]);
        await db.query('DELETE FROM merchants WHERE id = $1', [id]);

        res.json({ message: 'تم حذف التاجر وجميع بياناته' });
    } catch (err) {
        console.error('Admin delete merchant error:', err);
        res.status(500).json({ error: 'فشل حذف التاجر' });
    }
});

// ── GET /api/admin/subscription-requests ──
router.get('/subscription-requests', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                sr.*,
                m.business_name,
                m.email
            FROM subscription_requests sr
            JOIN merchants m ON m.id = sr.merchant_id
            ORDER BY sr.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get subscription requests error:', err);
        res.status(500).json({ error: 'فشل جلب طلبات الاشتراك' });
    }
});

// ── POST /api/admin/subscription-requests/:id/action ──
router.post('/subscription-requests/:id/action', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { id } = req.params;
        const { action, notes } = req.body; // action: 'Approve' or 'Rejected'

        if (!['Approved', 'Rejected'].includes(action)) {
            return res.status(400).json({ error: 'إجراء غير صالح' });
        }

        await client.query('BEGIN');

        // Update request status
        const updateReq = await client.query(
            'UPDATE subscription_requests SET status = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [action, notes, id]
        );

        if (updateReq.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'الطلب غير موجود' });
        }

        const request = updateReq.rows[0];
        const normalizedPlan = (request.plan || 'Free').charAt(0).toUpperCase() + (request.plan || 'Free').slice(1).toLowerCase();

        if (action === 'Approved') {
            // Update merchant's plan and expiry date (45 days from now)
            await client.query(
                "UPDATE merchants SET subscription_plan = $1, subscription_status = 'Active', status = 'approved', expiry_date = CURRENT_TIMESTAMP + INTERVAL '45 days' WHERE id = $2",
                [normalizedPlan, request.merchant_id]
            );
        } else if (action === 'Rejected') {
            // Update merchant's status to rejected and store the reason
            await client.query(
                "UPDATE merchants SET status = 'rejected', rejection_reason = $1 WHERE id = $2",
                [notes, request.merchant_id]
            );
        }

        await client.query('COMMIT');
        res.json({ message: `تم ${action === 'Approved' ? 'الموافقة على' : 'رفض'} الطلب بنجاح` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin action subscription request error:', err);
        res.status(500).json({ error: 'فشل تنفيذ الإجراء' });
    } finally {
        client.release();
    }
});

// ── GET /api/admin/global-search ──
router.get('/global-search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json({ merchants: [], customers: [], loans: [] });

        const searchPattern = `%${q}%`;

        const merchants = await db.query(
            "SELECT id, business_name, email FROM merchants WHERE business_name ILIKE $1 OR email ILIKE $1 LIMIT 5",
            [searchPattern]
        );

        const customers = await db.query(
            "SELECT c.id, c.full_name, m.business_name as merchant FROM customers c JOIN merchants m ON m.id = c.merchant_id WHERE c.full_name ILIKE $1 OR c.national_id ILIKE $1 LIMIT 5",
            [searchPattern]
        );

        const loans = await db.query(
            "SELECT l.id, l.amount, m.business_name as merchant FROM loans l JOIN merchants m ON m.id = l.merchant_id WHERE CAST(l.id AS TEXT) ILIKE $1 LIMIT 5",
            [searchPattern]
        );

        res.json({
            merchants: merchants.rows,
            customers: customers.rows,
            loans: loans.rows
        });
    } catch (err) {
        console.error('Admin global search error:', err);
        res.status(500).json({ error: 'فشل عملية البحث' });
    }
});

// ── GET /api/admin/settings ──
router.get('/settings', async (req, res) => {
    try {
        const result = await db.query('SELECT key, value FROM platform_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (err) {
        console.error('Admin get settings error:', err);
        res.status(500).json({ error: 'فشل جلب الإعدادات' });
    }
});

// ── POST /api/admin/settings ──
router.post('/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ error: 'المفتاح والقيمة مطلوبان' });
        }

        await db.query(
            'INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
            [key, value]
        );

        res.json({ message: 'تم تحديت الإعدادات بنجاح' });
    } catch (err) {
        console.error('Admin update settings error:', err);
        res.status(500).json({ error: 'فشل تحديث الإعدادات' });
    }
});

module.exports = router;
