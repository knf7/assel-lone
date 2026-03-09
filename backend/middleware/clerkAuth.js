/**
 * Clerk Authentication Middleware for Express
 * Replaces custom JWT verification with Clerk's token verification.
 * The existing authenticateToken is preserved as a fallback for legacy routes.
 */
const { clerkClient } = require('@clerk/clerk-sdk-node');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * authenticateClerk - Verifies Clerk session tokens from the Authorization header.
 * On success, populates req.user with { clerkUserId, merchantId, email, role }.
 */
const authenticateClerk = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        // Verify the Clerk session token
        const verifiedToken = await clerkClient.verifyToken(token);
        const clerkUserId = verifiedToken.sub;

        // Look up the merchant in our database by clerk_user_id
        const result = await db.query(
            'SELECT id, email, business_name, subscription_plan, subscription_status FROM merchants WHERE clerk_user_id = $1',
            [clerkUserId]
        );

        if (result.rows.length === 0) {
            // User exists in Clerk but not yet in our DB (webhook may not have fired yet)
            // Auto-provision: fetch user details from Clerk and create merchant
            try {
                const clerkUser = await clerkClient.users.getUser(clerkUserId);
                const email = clerkUser.emailAddresses?.[0]?.emailAddress;
                const businessName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'My Business';
                const apiKey = 'sk_live_' + require('crypto').randomBytes(32).toString('hex');

                const insertResult = await db.query(
                    `INSERT INTO merchants (clerk_user_id, email, password_hash, business_name, api_key, subscription_plan, subscription_status, expiry_date)
                     VALUES ($1, $2, 'clerk_managed', $3, $4, 'Pro', 'Active', CURRENT_TIMESTAMP + INTERVAL '30 days')
                     ON CONFLICT (clerk_user_id) DO UPDATE SET email = EXCLUDED.email
                     RETURNING id, email, business_name, subscription_plan, subscription_status`,
                    [clerkUserId, email, businessName, apiKey]
                );

                const merchant = insertResult.rows[0];
                req.user = {
                    clerkUserId,
                    merchantId: merchant.id,
                    userId: merchant.id,
                    email: merchant.email,
                    businessName: merchant.business_name,
                    role: 'merchant',
                };
                logger.info(`[Clerk] Auto-provisioned merchant: ${merchant.email}`);
                return next();
            } catch (provisionErr) {
                logger.error('[Clerk] Auto-provision failed:', provisionErr);
                return res.status(403).json({ error: 'User not provisioned. Please try again.' });
            }
        }

        const merchant = result.rows[0];

        // Auto-repair missing expiry date for existing Free tier users
        if (!merchant.expiry_date && merchant.subscription_plan === 'Free') {
            await db.query(
                `UPDATE merchants 
                 SET expiry_date = CURRENT_TIMESTAMP + INTERVAL '30 days' 
                 WHERE id = $1`,
                [merchant.id]
            );
            logger.info(`[Clerk] Auto-repaired missing expiry date for merchant: ${merchant.email}`);
        }

        req.user = {
            clerkUserId,
            merchantId: merchant.id,
            userId: merchant.id,
            email: merchant.email,
            businessName: merchant.business_name,
            role: 'merchant',
        };

        next();
    } catch (err) {
        logger.error('[Clerk] Token verification failed:', err.message);
        return res.status(403).json({ error: 'Invalid or expired session token' });
    }
};

module.exports = { authenticateClerk };
