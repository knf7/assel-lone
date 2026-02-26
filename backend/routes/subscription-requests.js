const express = require('express');
const db = require('../config/database');
const { authenticateToken, injectMerchantId } = require('../middleware/auth');
const { uploadReceipt } = require('../middleware/upload');
const { sendAdminNotificationEmail } = require('../utils/mailer');

const router = express.Router();

router.use(authenticateToken);
router.use(injectMerchantId);

/**
 * POST /api/subscription-requests/submit
 * Submit a manual subscription upgrade request with a receipt.
 */
router.post('/submit', uploadReceipt.single('receipt'), async (req, res) => {
    try {
        const { plan } = req.body;
        const merchantId = req.merchantId;

        if (!plan || !req.file) {
            return res.status(400).json({ error: 'الخطة وصورة الإيصال مطلوبتان' });
        }

        const receiptUrl = `/uploads/receipts/${req.file.filename}`;

        const result = await db.query(
            'INSERT INTO subscription_requests (merchant_id, plan, receipt_url) VALUES ($1, $2, $3) RETURNING *',
            [merchantId, plan, receiptUrl]
        );

        // Fetch merchant details for the email
        const merchantObj = await db.query('SELECT business_name, email FROM merchants WHERE id = $1', [merchantId]);
        if (merchantObj.rows.length > 0) {
            const { business_name, email } = merchantObj.rows[0];
            const receiptPath = req.file.path; // Absolute path on the server/container
            await sendAdminNotificationEmail(business_name, email, plan, receiptPath).catch(e => console.error('Failed to send admin notification:', e));
        }

        res.status(201).json({
            message: 'تم إرسال طلبك بنجاح. سيقوم المسؤول بمراجعته وتفعيل باقتك قريباً.',
            request: result.rows[0]
        });
    } catch (err) {
        console.error('Submit subscription request error:', err);
        res.status(500).json({ error: 'فشل إرسال الطلب' });
    }
});

/**
 * GET /api/subscription-requests/my-requests
 * Get status of recent requests by the merchant.
 */
router.get('/my-requests', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM subscription_requests WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT 5',
            [req.merchantId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get my requests error:', err);
        res.status(500).json({ error: 'فشل جلب الطلبات' });
    }
});

module.exports = router;
