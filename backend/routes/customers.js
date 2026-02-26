const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken, injectMerchantId, injectRlsContext } = require('../middleware/auth');

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
    fullName: Joi.string().required().min(3).max(100),
    nationalId: Joi.string().required().pattern(/^[0-9]{10}$/),
    mobileNumber: Joi.string().required().pattern(/^[0-9]{10,15}$/)
});

// GET /api/customers - List all customers
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;

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
            `SELECT c.*, 
              COALESCE(SUM(CASE WHEN l.status = 'Active' AND l.deleted_at IS NULL THEN l.amount ELSE 0 END), 0) as total_debt,
              COALESCE(COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL), 0) as total_loans
       FROM customers c
       LEFT JOIN loans l ON c.id = l.customer_id
       WHERE ${whereClause}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        );

        res.json({
            customers: result.rows.map(enrichCustomer),
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

// GET /api/customers/:id - Get customer with loan history
router.get('/:id', async (req, res) => {
    try {
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

        res.json({
            customer: enrichCustomer(customer),
            loans: loansResult.rows,
            summary: totals.rows[0]
        });
    } catch (err) {
        console.error('Get customer error:', err);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// POST /api/customers - Create new customer
const { checkPlanLimit } = require('../middleware/planLimits');
const { checkPermission } = require('../middleware/auth');

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

        if (parseInt(loansCheck.rows[0].count) > 0) {
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

        res.json({ message: 'Customer deleted successfully (Soft Delete)' });
    } catch (err) {
        console.error('Delete customer error:', err);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

module.exports = router;
