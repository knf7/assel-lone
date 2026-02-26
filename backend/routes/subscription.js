const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const { authenticateToken, injectMerchantId } = require('../middleware/auth');

const router = express.Router();

// POST /api/subscription/create-checkout - Create Stripe checkout session
router.post('/create-checkout', authenticateToken, injectMerchantId, async (req, res) => {
    try {
        const { planId } = req.body; // 'pro' or 'enterprise'

        const prices = {
            pro: process.env.STRIPE_PRO_PRICE_ID,
            enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
        };

        if (!prices[planId]) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        // Get merchant
        const merchantResult = await db.query(
            'SELECT email, stripe_customer_id FROM merchants WHERE id = $1',
            [req.merchantId]
        );

        const merchant = merchantResult.rows[0];
        let customerId = merchant.stripe_customer_id;

        // Create Stripe customer if doesn't exist
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: merchant.email,
                metadata: { merchantId: req.merchantId }
            });
            customerId = customer.id;

            await db.query(
                'UPDATE merchants SET stripe_customer_id = $1 WHERE id = $2',
                [customerId, req.merchantId]
            );
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: prices[planId],
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/settings?success=true`,
            cancel_url: `${process.env.FRONTEND_URL}/settings?cancelled=true`,
            metadata: {
                merchantId: req.merchantId,
                planId
            }
        });

        res.json({ sessionUrl: session.url });
    } catch (err) {
        console.error('Create checkout error:', err);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// POST /api/subscription/webhook - Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionCancelled(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook handler error:', err);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// GET /api/subscription/status - Get subscription info
router.get('/status', authenticateToken, injectMerchantId, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT subscription_plan, subscription_status, expiry_date, stripe_subscription_id
       FROM merchants WHERE id = $1`,
            [req.merchantId]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get subscription error:', err);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

// Helper functions
async function handleSubscriptionUpdate(subscription) {
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = subscription.status;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Determine plan from price ID
    let plan = 'Free';
    if (subscription.items.data[0].price.id === process.env.STRIPE_PRO_PRICE_ID) {
        plan = 'Pro';
    } else if (subscription.items.data[0].price.id === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
        plan = 'Enterprise';
    }

    await db.query(
        `UPDATE merchants 
     SET subscription_plan = $1, 
         subscription_status = $2,
         stripe_subscription_id = $3,
         expiry_date = $4
     WHERE stripe_customer_id = $5`,
        [plan, status === 'active' ? 'Active' : 'Inactive', subscriptionId, currentPeriodEnd, customerId]
    );
}

async function handleSubscriptionCancelled(subscription) {
    const customerId = subscription.customer;

    await db.query(
        `UPDATE merchants 
     SET subscription_plan = 'Free',
         subscription_status = 'Cancelled',
         stripe_subscription_id = NULL
     WHERE stripe_customer_id = $1`,
        [customerId]
    );
}

async function handlePaymentSucceeded(invoice) {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;

    if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await handleSubscriptionUpdate(subscription);
    }
}

async function handlePaymentFailed(invoice) {
    const customerId = invoice.customer;

    await db.query(
        `UPDATE merchants 
     SET subscription_status = 'PastDue'
     WHERE stripe_customer_id = $1`,
        [customerId]
    );
}

module.exports = router;
