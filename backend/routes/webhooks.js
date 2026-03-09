/**
 * Clerk Webhook Handler
 * Listens to Clerk events (user.created, user.updated, user.deleted)
 * and syncs them to the PostgreSQL merchants table.
 * 
 * Clerk sends webhooks signed with Svix - we verify them before processing.
 */
const express = require('express');
const router = express.Router();
const { Webhook } = require('svix');
const db = require('../config/database');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/auditLogger');

// Clerk webhooks must receive the raw body for signature verification
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        logger.error('[Clerk Webhook] CLERK_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Verify the webhook signature
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
        return res.status(400).json({ error: 'Missing svix headers' });
    }

    let event;
    try {
        const wh = new Webhook(WEBHOOK_SECRET);
        event = wh.verify(req.body, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
        });
    } catch (err) {
        logger.error('[Clerk Webhook] Signature verification failed:', err.message);
        return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // Process the event
    const { type, data } = event;

    try {
        switch (type) {
            case 'user.created': {
                const email = data.email_addresses?.[0]?.email_address;
                const clerkUserId = data.id;
                const businessName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'My Business';
                const apiKey = 'sk_live_' + require('crypto').randomBytes(32).toString('hex');

                const result = await db.query(
                    `INSERT INTO merchants (clerk_user_id, email, password_hash, business_name, api_key, subscription_plan, subscription_status, expiry_date)
                     VALUES ($1, $2, 'clerk_managed', $3, $4, 'Pro', 'Active', CURRENT_TIMESTAMP + INTERVAL '45 days')
                     ON CONFLICT (clerk_user_id) DO NOTHING
                     RETURNING id`,
                    [clerkUserId, email, businessName, apiKey]
                );

                if (result.rows.length > 0) {
                    await logAudit({
                        merchantId: result.rows[0].id,
                        action: 'CLERK_USER_CREATED',
                        entity: 'Merchant',
                        entityId: result.rows[0].id,
                        details: { email, clerkUserId },
                    });
                    logger.info(`[Clerk Webhook] Created merchant for: ${email}`);
                }
                break;
            }

            case 'user.updated': {
                const email = data.email_addresses?.[0]?.email_address;
                const clerkUserId = data.id;
                const businessName = `${data.first_name || ''} ${data.last_name || ''}`.trim();

                if (businessName) {
                    await db.query(
                        `UPDATE merchants SET email = $1, business_name = $2, updated_at = NOW() WHERE clerk_user_id = $3`,
                        [email, businessName, clerkUserId]
                    );
                }
                logger.info(`[Clerk Webhook] Updated merchant for: ${email}`);
                break;
            }

            case 'user.deleted': {
                const clerkUserId = data.id;
                // Soft delete or hard delete based on your policy
                // For safety, we'll just log it and mark as inactive
                await db.query(
                    `UPDATE merchants SET subscription_status = 'Cancelled', updated_at = NOW() WHERE clerk_user_id = $1`,
                    [clerkUserId]
                );
                logger.info(`[Clerk Webhook] Deactivated merchant for clerk_user_id: ${clerkUserId}`);
                break;
            }

            default:
                logger.info(`[Clerk Webhook] Unhandled event type: ${type}`);
        }

        res.status(200).json({ received: true });
    } catch (err) {
        logger.error('[Clerk Webhook] Processing error:', err);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;
