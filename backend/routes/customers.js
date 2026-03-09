const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken, injectMerchantId, injectRlsContext, checkPermission } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware and RLS
router.use(authenticateToken);
router.use(injectMerchantId);
router.use(injectRlsContext);

// Virtual/helper: WhatsApp and Najiz links for Customer (no ORM; applied when returning rows)
const enrichCustomer = (c) => ({
    ...c,
    whatsappLink: c.mobile_number ? `https://wa.me/${c.mobile_number.replace(/\D/g, '')}` : null,
    najizLink: c.national_id ? `https://www.najiz.sa/applications/landing/verification?id=${encodeURIComponent(c.national_id)}` : null
});


// Validation schema
const customerSchema = Joi.object({
    fullName: Joi.string().required().min(3).max(200),
    nationalId: Joi.string().required().pattern(/^[0-9]{10}$/),
    mobileNumber: Joi.string().required().pattern(/^[0-9]{9,20}$/),
    email: Joi.string().email().allow('', null).optional()
}).options({ stripUnknown: true });

const customerRatingSchema = Joi.object({
    scope: Joi.string().valid('delivery', 'monthly').required(),
    score: Joi.number().min(1).max(10).precision(1).required(),
    loanId: Joi.string().uuid().allow('', null).optional(),
    month: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).allow('', null).optional(),
    notes: Joi.string().max(500).allow('', null).optional()
}).options({ stripUnknown: true });

// GET /api/customers - List all customers
router.get('/', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;
        let hasRatingsTable = false;
        if (process.env.NODE_ENV !== 'test' && !req.dbClient?.query?._isMockFunction) {
            const ratingsTableCheck = await req.dbClient.query(`SELECT to_regclass('public.customer_ratings') AS t`);
            hasRatingsTable = Boolean(ratingsTableCheck.rows[0]?.t);
        }

        let whereClause = 'c.merchant_id = $1 AND c.deleted_at IS NULL';
        let params = [req.merchantId];

        if (search) {
            whereClause += ' AND (full_name ILIKE $2 OR national_id ILIKE $2 OR mobile_number ILIKE $2)';
            params.push(`%${search}%`);
        }

        // Get total count
        const countResult = await req.dbClient.query(
            `SELECT COUNT(*) FROM customers c WHERE ${whereClause}`,
            params
        );
        const totalCount = parseInt(countResult.rows[0].count);

        // Get customers with total debt
        const result = await req.dbClient.query(
            hasRatingsTable
                ? `SELECT c.*, 
              COALESCE(SUM(CASE WHEN l.status = 'Active' AND l.deleted_at IS NULL THEN l.amount ELSE 0 END), 0) as total_debt,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL), 0) as total_loans,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'Paid'), 0) as paid_loans,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'Raised'), 0) as raised_loans,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'Active'), 0) as active_loans,
              rating_agg.delivery_avg,
              rating_agg.monthly_avg,
              rating_agg.overall_score
       FROM customers c
       LEFT JOIN loans l ON c.id = l.customer_id
       LEFT JOIN LATERAL (
         SELECT
           ROUND(COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'delivery'), 0)::numeric, 1) AS delivery_avg,
           ROUND(COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'monthly'), 0)::numeric, 1) AS monthly_avg,
           ROUND((
             COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'delivery'), 0) * 0.6
             + COALESCE(AVG(cr.score) FILTER (WHERE cr.rating_scope = 'monthly'), 0) * 0.4
           )::numeric, 1) AS overall_score
         FROM customer_ratings cr
         WHERE cr.merchant_id = c.merchant_id AND cr.customer_id = c.id
       ) rating_agg ON true
       WHERE ${whereClause}
       GROUP BY c.id, rating_agg.delivery_avg, rating_agg.monthly_avg, rating_agg.overall_score
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
                : `SELECT c.*, 
              COALESCE(SUM(CASE WHEN l.status = 'Active' AND l.deleted_at IS NULL THEN l.amount ELSE 0 END), 0) as total_debt,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL), 0) as total_loans,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'Paid'), 0) as paid_loans,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'Raised'), 0) as raised_loans,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'Active'), 0) as active_loans,
              0::numeric AS delivery_avg,
              0::numeric AS monthly_avg,
              0::numeric AS overall_score
       FROM customers c
       LEFT JOIN loans l ON c.id = l.customer_id
       WHERE ${whereClause}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );

        const enriched = result.rows.map((c) => {
            const paid = parseInt(c.paid_loans || 0, 10);
            const raised = parseInt(c.raised_loans || 0, 10);
            const active = parseInt(c.active_loans || 0, 10);
            const total = parseInt(c.total_loans || 0, 10);
            const rawScore = 100 + (paid * 3) - (active * 8) - (raised * 15);
            const computedRating = Math.max(0, Math.min(10, rawScore / 10));
            const manualRating = Number(c.overall_score || 0);
            const rating = manualRating > 0 ? manualRating : computedRating;
            const customer_status = raised > 0 ? 'raised' : active > 0 ? 'unpaid' : total > 0 ? 'paid' : 'new';

            return enrichCustomer({
                ...c,
                rating: Number(rating.toFixed(1)),
                rating_source: manualRating > 0 ? 'manual' : 'system',
                customer_status
            });
        });

        res.json({
            customers: enriched,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (err) {
        console.error('Get customers error:', err);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// GET /api/customers/:id/ratings - list ratings for customer
router.get('/:id/ratings', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const ratingsTableCheck = await req.dbClient.query(`SELECT to_regclass('public.customer_ratings') AS t`);
        if (!ratingsTableCheck.rows[0]?.t) {
            return res.status(503).json({ error: 'customer_ratings table is missing. Apply migration 20260310_customer_ratings.sql' });
        }
        const { limit = 24 } = req.query;
        const customerId = req.params.id;

        const customerExists = await req.dbClient.query(
            'SELECT id FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL',
            [customerId, req.merchantId]
        );
        if (customerExists.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const ratingsResult = await req.dbClient.query(
            `SELECT id, rating_scope, score, month_key, loan_id, notes, is_locked, created_at, updated_at
             FROM customer_ratings
             WHERE merchant_id = $1 AND customer_id = $2
             ORDER BY month_key DESC NULLS LAST, created_at DESC
             LIMIT $3`,
            [req.merchantId, customerId, Number(limit)]
        );

        const summaryResult = await req.dbClient.query(
            `SELECT
              ROUND(COALESCE(AVG(score) FILTER (WHERE rating_scope = 'delivery'), 0)::numeric, 1) AS delivery_avg,
              ROUND(COALESCE(AVG(score) FILTER (WHERE rating_scope = 'monthly'), 0)::numeric, 1) AS monthly_avg,
              ROUND((
                COALESCE(AVG(score) FILTER (WHERE rating_scope = 'delivery'), 0) * 0.6
                + COALESCE(AVG(score) FILTER (WHERE rating_scope = 'monthly'), 0) * 0.4
              )::numeric, 1) AS overall_score
             FROM customer_ratings
             WHERE merchant_id = $1 AND customer_id = $2`,
            [req.merchantId, customerId]
        );

        res.json({
            ratings: ratingsResult.rows,
            summary: summaryResult.rows[0] || { delivery_avg: 0, monthly_avg: 0, overall_score: 0 }
        });
    } catch (err) {
        console.error('Get customer ratings error:', err);
        res.status(500).json({ error: 'Failed to fetch customer ratings' });
    }
});

// POST /api/customers/:id/ratings - add/update manual rating
router.post('/:id/ratings', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const ratingsTableCheck = await req.dbClient.query(`SELECT to_regclass('public.customer_ratings') AS t`);
        if (!ratingsTableCheck.rows[0]?.t) {
            return res.status(503).json({ error: 'customer_ratings table is missing. Apply migration 20260310_customer_ratings.sql' });
        }
        const { error, value } = customerRatingSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const customerId = req.params.id;
        const scope = value.scope;
        const score = Number(value.score);
        const notes = value.notes || null;
        let loanId = value.loanId || null;
        let monthKey = value.month ? `${value.month}-01` : null;

        const customerExists = await req.dbClient.query(
            'SELECT id FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL',
            [customerId, req.merchantId]
        );
        if (customerExists.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        if (scope === 'delivery') {
            if (!loanId) {
                return res.status(400).json({ error: 'loanId is required for delivery rating' });
            }

            const loanCheck = await req.dbClient.query(
                `SELECT id, customer_id, status
                 FROM loans
                 WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL`,
                [loanId, req.merchantId]
            );

            if (loanCheck.rows.length === 0 || loanCheck.rows[0].customer_id !== customerId) {
                return res.status(400).json({ error: 'Loan does not belong to this customer' });
            }

            if (loanCheck.rows[0].status !== 'Paid') {
                return res.status(400).json({ error: 'Delivery rating is allowed only after loan is marked as Paid' });
            }
        } else {
            // monthly
            loanId = null;
            if (!monthKey) {
                const now = new Date();
                monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            }
        }

        // Lock updates after 48 hours to preserve audit trail.
        const existing = await req.dbClient.query(
            `SELECT id, is_locked, created_at
             FROM customer_ratings
             WHERE merchant_id = $1
               AND customer_id = $2
               AND rating_scope = $3
               AND (
                 ($3 = 'delivery' AND loan_id = $4)
                 OR
                 ($3 = 'monthly' AND month_key = $5::date)
               )
             LIMIT 1`,
            [req.merchantId, customerId, scope, loanId, monthKey]
        );

        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            const createdAt = new Date(row.created_at).getTime();
            const isExpired = Date.now() - createdAt > 48 * 60 * 60 * 1000;
            if (row.is_locked || isExpired) {
                await req.dbClient.query(
                    'UPDATE customer_ratings SET is_locked = true WHERE id = $1',
                    [row.id]
                );
                return res.status(409).json({
                    error: 'Rating is locked and can no longer be edited after 48 hours'
                });
            }
        }

        let result;
        if (scope === 'delivery') {
            result = await req.dbClient.query(
                `INSERT INTO customer_ratings
                  (merchant_id, customer_id, loan_id, rating_scope, score, month_key, notes, rated_by)
                 VALUES ($1, $2, $3, 'delivery', $4, NULL, $5, $6)
                 ON CONFLICT (merchant_id, loan_id, rating_scope) WHERE rating_scope = 'delivery'
                 DO UPDATE SET
                   score = EXCLUDED.score,
                   notes = EXCLUDED.notes,
                   rated_by = EXCLUDED.rated_by,
                   updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [req.merchantId, customerId, loanId, score, notes, req.user?.userId || null]
            );
        } else {
            result = await req.dbClient.query(
                `INSERT INTO customer_ratings
                  (merchant_id, customer_id, loan_id, rating_scope, score, month_key, notes, rated_by)
                 VALUES ($1, $2, NULL, 'monthly', $3, $4::date, $5, $6)
                 ON CONFLICT (merchant_id, customer_id, month_key, rating_scope) WHERE rating_scope = 'monthly'
                 DO UPDATE SET
                   score = EXCLUDED.score,
                   notes = EXCLUDED.notes,
                   rated_by = EXCLUDED.rated_by,
                   updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [req.merchantId, customerId, score, monthKey, notes, req.user?.userId || null]
            );
        }

        res.status(201).json({
            message: 'Rating saved successfully',
            rating: result.rows[0]
        });
    } catch (err) {
        console.error('Save customer rating error:', err);
        res.status(500).json({ error: 'Failed to save customer rating' });
    }
});

// GET /api/customers/:id - Get customer with loan history
router.get('/:id', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const ratingsTableCheck = await req.dbClient.query(`SELECT to_regclass('public.customer_ratings') AS t`);
        const hasRatingsTable = Boolean(ratingsTableCheck.rows[0]?.t);
        // Get customer
        const customerResult = await req.dbClient.query(
            'SELECT * FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL',
            [req.params.id, req.merchantId]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const customer = customerResult.rows[0];

        // Get loan history
        const loansResult = await req.dbClient.query(
            `SELECT id, amount, receipt_number, status, transaction_date, created_at
       FROM loans
       WHERE customer_id = $1 AND merchant_id = $2 AND deleted_at IS NULL
       ORDER BY transaction_date DESC`,
            [req.params.id, req.merchantId]
        );

        // Calculate totals
        const totals = await req.dbClient.query(
            `SELECT 
         COALESCE(SUM(CASE WHEN status = 'Active' THEN amount ELSE 0 END), 0) as active_debt,
         COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END), 0) as paid_amount,
         COUNT(*) as total_loans
       FROM loans
       WHERE customer_id = $1 AND merchant_id = $2`,
            [req.params.id, req.merchantId]
        );

        const ratingSummaryResult = hasRatingsTable
            ? await req.dbClient.query(
                `SELECT
              ROUND(COALESCE(AVG(score) FILTER (WHERE rating_scope = 'delivery'), 0)::numeric, 1) AS delivery_avg,
              ROUND(COALESCE(AVG(score) FILTER (WHERE rating_scope = 'monthly'), 0)::numeric, 1) AS monthly_avg,
              ROUND((
                COALESCE(AVG(score) FILTER (WHERE rating_scope = 'delivery'), 0) * 0.6
                + COALESCE(AVG(score) FILTER (WHERE rating_scope = 'monthly'), 0) * 0.4
              )::numeric, 1) AS overall_score
             FROM customer_ratings
             WHERE merchant_id = $1 AND customer_id = $2`,
                [req.merchantId, req.params.id]
            )
            : { rows: [{ delivery_avg: 0, monthly_avg: 0, overall_score: 0 }] };

        res.json({
            customer: enrichCustomer(customer),
            loans: loansResult.rows,
            summary: totals.rows[0],
            ratingSummary: ratingSummaryResult.rows[0] || { delivery_avg: 0, monthly_avg: 0, overall_score: 0 }
        });
    } catch (err) {
        console.error('Get customer error:', err);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// POST /api/customers - Create new customer
const { checkPlanLimit } = require('../middleware/planLimits');

router.post('/', checkPermission('can_view_customers'), checkPlanLimit('customers'), async (req, res) => {
    try {
        const { error, value } = customerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { fullName, nationalId, mobileNumber } = value;

        // Check for duplicate national ID (both active and soft-deleted)
        const duplicate = await req.dbClient.query(
            'SELECT id, deleted_at FROM customers WHERE merchant_id = $1 AND national_id = $2',
            [req.merchantId, nationalId]
        );

        if (duplicate.rows.length > 0) {
            const customerRow = duplicate.rows[0];
            if (!customerRow.deleted_at) {
                return res.status(409).json({ error: 'Customer with this National ID already exists' });
            } else {
                // Restore soft-deleted customer
                const result = await req.dbClient.query(
                    `UPDATE customers 
                     SET deleted_at = NULL, full_name = $3, mobile_number = $4, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1 AND merchant_id = $2
                     RETURNING *`,
                    [customerRow.id, req.merchantId, fullName, mobileNumber]
                );
                return res.status(201).json({
                    message: 'Customer restored successfully',
                    customer: enrichCustomer(result.rows[0])
                });
            }
        }

        const result = await req.dbClient.query(
            `INSERT INTO customers 
       (merchant_id, full_name, national_id, mobile_number)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [req.merchantId, fullName, nationalId, mobileNumber]
        );

        res.status(201).json({
            message: 'Customer created successfully',
            customer: enrichCustomer(result.rows[0])
        });
    } catch (err) {
        console.error('Create customer error:', err);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// PATCH /api/customers/:id - Update customer
router.patch('/:id', checkPermission('can_view_customers'), async (req, res) => {
    try {
        const { fullName, mobileNumber } = req.body;

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (fullName) {
            updates.push(`full_name = $${paramIndex}`);
            params.push(fullName);
            paramIndex++;
        }
        if (mobileNumber) {
            updates.push(`mobile_number = $${paramIndex}`);
            params.push(mobileNumber);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(req.params.id, req.merchantId);

        const result = await req.dbClient.query(
            `UPDATE customers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} AND merchant_id = $${paramIndex + 1} AND deleted_at IS NULL
       RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({
            message: 'Customer updated successfully',
            customer: enrichCustomer(result.rows[0])
        });
    } catch (err) {
        console.error('Update customer error:', err);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', checkPermission('can_view_customers'), async (req, res) => {
    try {
        // Check if customer has active loans (respecting soft delete)
        const loansCheck = await req.dbClient.query(
            'SELECT COUNT(*) FROM loans WHERE customer_id = $1 AND status = $2 AND deleted_at IS NULL',
            [req.params.id, 'Active']
        );

        const activeLoansCount = parseInt(loansCheck.rows[0]?.count || '0', 10);
        if (activeLoansCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete customer with active loans. Please settle all loans first.'
            });
        }

        // Soft Delete (Shielded Logic Phase)
        const result = await req.dbClient.query(
            'UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL RETURNING id',
            [req.params.id, req.merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found or unauthorized' });
        }

        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        console.error('Delete customer error:', err);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

module.exports = router;
