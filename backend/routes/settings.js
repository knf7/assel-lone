const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const { setProfileUpdateData, getProfileUpdateData, deleteProfileUpdateData } = require('../config/redis');
const { sendOTPEmail } = require('../utils/mailer');

function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Middleware to ensure authentication and merchant ID
const { authenticateToken, injectMerchantId, checkPermission } = require('../middleware/auth');

router.use(authenticateToken);
router.use(injectMerchantId);
router.use(checkPermission('can_view_settings'));

// GET /api/settings/profile - Fetch merchant profile data
router.get('/profile', async (req, res) => {
    try {
        const merchantId = req.user.merchantId;
        const result = await db.query(
            'SELECT username, business_name, email, mobile_number, whatsapp_phone_id, subscription_plan, subscription_status, expiry_date FROM merchants WHERE id = $1',
            [merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Merchant not found' });
        }

        res.json({ profile: result.rows[0] });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile data' });
    }
});

// PATCH /api/settings/profile - Propose merchant profile update (generates OTP)
router.patch('/profile', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const merchantId = req.user.merchantId;
        const { username, business_name, email, mobile_number, whatsapp_phone_id } = req.body;

        if (!username && !business_name && !email && !mobile_number && whatsapp_phone_id === undefined) {
            return res.status(400).json({ error: 'No fields provided to update' });
        }

        // Ensure email uniqueness if it's changing
        if (email) {
            const emailCheck = await client.query(
                'SELECT id FROM merchants WHERE email = $1 AND id != $2',
                [email, merchantId]
            );
            if (emailCheck.rows.length > 0) {
                return res.status(400).json({ error: 'البريد الإلكتروني مستخدم لحساب آخر' });
            }
        }

        const otp = generateOTP();
        const proposedChanges = { username, business_name, email, mobile_number, whatsapp_phone_id };

        // Save proposed changes and OTP to Redis (valid for 5 mins = 300s)
        await setProfileUpdateData(merchantId, { otp, changes: proposedChanges }, 300);

        // Fetch current email to send OTP
        const currentProfile = await client.query('SELECT email FROM merchants WHERE id = $1', [merchantId]);
        const currentEmail = currentProfile.rows[0].email;

        // Send OTP email
        try {
            await sendOTPEmail(currentEmail, otp);
        } catch (mailErr) {
            console.error('Failed to send Profile OTP email:', mailErr.message);
            console.log(`🔑 Profile Update OTP for ${currentEmail}: ${otp}`);
        }

        res.json({ requiresOTP: true, message: 'تم إرسال رمز التحقق إلى بريدك الحالي' });
    } catch (error) {
        console.error('Error initiating profile update:', error);
        res.status(500).json({ error: 'فشل بدء التحديث' });
    } finally {
        client.release();
    }
});

// POST /api/settings/verify-profile-update - Verify OTP and apply profile update
router.post('/verify-profile-update', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const merchantId = req.user.merchantId;
        const { code } = req.body;

        if (!code || code.length !== 6) {
            return res.status(400).json({ error: 'الرمز يجب أن يكون 6 أرقام' });
        }

        const updateData = await getProfileUpdateData(merchantId);

        if (!updateData) {
            return res.status(410).json({ error: 'انتهت صلاحية الرمز أو لم يتم طلب تحديث' });
        }

        if (updateData.otp !== code) {
            return res.status(401).json({ error: 'الرمز غير صحيح. حاول مرة أخرى.' });
        }

        const changes = updateData.changes;
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (changes.username) {
            updates.push(`username = $${paramCount++}`);
            values.push(changes.username);
        }
        if (changes.business_name) {
            updates.push(`business_name = $${paramCount++}`);
            values.push(changes.business_name);
        }
        if (changes.email) {
            updates.push(`email = $${paramCount++}`);
            values.push(changes.email);
        }
        if (changes.mobile_number) {
            updates.push(`mobile_number = $${paramCount++}`);
            values.push(changes.mobile_number);
        }
        if (changes.whatsapp_phone_id !== undefined) {
            updates.push(`whatsapp_phone_id = $${paramCount++}`);
            values.push(changes.whatsapp_phone_id);
        }

        if (updates.length > 0) {
            values.push(merchantId);
            const query = `
                UPDATE merchants 
                SET ${updates.join(', ')} 
                WHERE id = $${paramCount} 
                RETURNING username, business_name, email, mobile_number, whatsapp_phone_id
            `;
            const result = await client.query(query, values);
            await deleteProfileUpdateData(merchantId);
            return res.json({ message: 'تم تحديث الملف الشخصي بنجاح', profile: result.rows[0] });
        } else {
            return res.status(400).json({ error: 'لا توجد تغييرات صالحة لتطبيقها' });
        }
    } catch (error) {
        console.error('Error verifying profile update:', error);
        res.status(500).json({ error: 'فشل تطبيق التحديث' });
    } finally {
        client.release();
    }
});

// POST /api/settings/change-password - Update password securely
router.post('/change-password', async (req, res) => {
    try {
        const merchantId = req.user.merchantId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        // Fetch user from DB to verify old password
        const result = await db.query('SELECT password_hash FROM merchants WHERE id = $1', [merchantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Merchant not found' });
        }

        const merchant = result.rows[0];
        const validPassword = await bcrypt.compare(currentPassword, merchant.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        // Hash new password and save
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        await db.query(
            'UPDATE merchants SET password_hash = $1 WHERE id = $2',
            [newPasswordHash, merchantId]
        );

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
