const Joi = require('joi');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { checkPlanLimit } = require('../middleware/planLimits');

const employeeSchema = Joi.object({
    fullName: Joi.string().trim().required().min(3).max(100),
    email: Joi.string().trim().email().required(),
    password: Joi.string().min(8).required(),
    permissions: Joi.object({
        can_view_dashboard: Joi.boolean().default(true),
        can_view_loans: Joi.boolean().default(true),
        can_add_loans: Joi.boolean().default(true),
        can_upload_loans: Joi.boolean().default(false),
        can_view_customers: Joi.boolean().default(true),
        can_view_analytics: Joi.boolean().default(false),
        can_view_najiz: Joi.boolean().default(true),
        can_view_settings: Joi.boolean().default(false)
    }).default()
});

const updateEmployeeSchema = Joi.object({
    fullName: Joi.string().trim().min(3).max(100),
    email: Joi.string().trim().email(),
    password: Joi.string().min(8).optional(),
    permissions: Joi.object({
        can_view_dashboard: Joi.boolean(),
        can_view_loans: Joi.boolean(),
        can_add_loans: Joi.boolean(),
        can_upload_loans: Joi.boolean(),
        can_view_customers: Joi.boolean(),
        can_view_analytics: Joi.boolean(),
        can_view_najiz: Joi.boolean(),
        can_view_settings: Joi.boolean()
    })
});

exports.listEmployees = async (req, res) => {
    try {
        const { includeInactive = 'true' } = req.query;
        const includeDeleted = String(includeInactive).toLowerCase() === 'true';
        const result = await req.dbClient.query(
            `SELECT id, full_name, email, permissions, created_at, deleted_at,
                    CASE WHEN deleted_at IS NULL THEN true ELSE false END AS is_active
             FROM merchant_employees
             WHERE merchant_id = $1
               AND ($2::boolean = true OR deleted_at IS NULL)
             ORDER BY created_at DESC`,
            [req.merchantId, includeDeleted]
        );
        res.json({ employees: result.rows });
    } catch (err) {
        console.error('List employees error:', err);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
};

exports.createEmployee = async (req, res) => {
    try {
        const { error, value } = employeeSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { fullName, email, password, permissions } = value;

        // Check if email exists (in merchants or employees)
        const existingMerchant = await req.dbClient.query('SELECT id FROM merchants WHERE email = $1', [email]);
        const existingEmployee = await req.dbClient.query('SELECT id, merchant_id, deleted_at FROM merchant_employees WHERE email = $1', [email]);

        if (existingMerchant.rows.length > 0) {
            return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }

        if (existingEmployee.rows.length > 0) {
            const oldEmployee = existingEmployee.rows[0];
            if (oldEmployee.merchant_id !== req.merchantId || oldEmployee.deleted_at === null) {
                return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
            }
            // Restore disabled employee under same merchant with new password/permissions.
            const passwordHash = await bcrypt.hash(password, 10);
            const restored = await req.dbClient.query(
                `UPDATE merchant_employees
                 SET full_name = $1,
                     password_hash = $2,
                     permissions = $3,
                     deleted_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4 AND merchant_id = $5
                 RETURNING id, full_name, email, permissions, created_at, deleted_at,
                           CASE WHEN deleted_at IS NULL THEN true ELSE false END AS is_active`,
                [fullName, passwordHash, JSON.stringify(permissions), oldEmployee.id, req.merchantId]
            );
            return res.status(201).json({ message: 'Employee restored successfully', employee: restored.rows[0] });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await req.dbClient.query(
            `INSERT INTO merchant_employees (merchant_id, full_name, email, password_hash, permissions)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, full_name, email, permissions, created_at, deleted_at,
                       CASE WHEN deleted_at IS NULL THEN true ELSE false END AS is_active`,
            [req.merchantId, fullName, email, passwordHash, JSON.stringify(permissions)]
        );

        res.status(201).json({ message: 'Employee created successfully', employee: result.rows[0] });
    } catch (err) {
        console.error('Create employee error:', err);
        res.status(500).json({ error: 'Failed to create employee' });
    }
};

exports.updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateEmployeeSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { fullName, email, password, permissions } = value;
        const updates = [];
        const params = [];
        let i = 1;

        if (fullName) { updates.push(`full_name = $${i++}`); params.push(fullName); }
        if (email) {
            // Check if email taken by someone else
            const check = await req.dbClient.query(
                'SELECT id FROM merchants WHERE email = $1 UNION SELECT id FROM merchant_employees WHERE email = $1 AND id != $2',
                [email, id]
            );
            if (check.rows.length > 0) return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
            updates.push(`email = $${i++}`); params.push(email);
        }
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${i++}`); params.push(passwordHash);
        }
        if (permissions) { updates.push(`permissions = $${i++}`); params.push(JSON.stringify(permissions)); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(id, req.merchantId);
        const result = await req.dbClient.query(
            `UPDATE merchant_employees 
             SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${i} AND merchant_id = $${i + 1} AND deleted_at IS NULL
             RETURNING id, full_name, email, permissions, created_at, deleted_at,
                       CASE WHEN deleted_at IS NULL THEN true ELSE false END AS is_active`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found or unauthorized' });

        res.json({ message: 'Employee updated successfully', employee: result.rows[0] });
    } catch (err) {
        console.error('Update employee error:', err);
        res.status(500).json({ error: 'Failed to update employee' });
    }
};

exports.activateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await req.dbClient.query(
            `UPDATE merchant_employees
             SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NOT NULL
             RETURNING id, full_name, email, permissions, created_at, deleted_at,
                       CASE WHEN deleted_at IS NULL THEN true ELSE false END AS is_active`,
            [id, req.merchantId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found or already active' });
        res.json({ message: 'Employee activated successfully', employee: result.rows[0] });
    } catch (err) {
        console.error('Activate employee error:', err);
        res.status(500).json({ error: 'Failed to activate employee' });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft disable employee
        const result = await req.dbClient.query(
            `UPDATE merchant_employees
             SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL
             RETURNING id, full_name, email, permissions, created_at, deleted_at,
                       CASE WHEN deleted_at IS NULL THEN true ELSE false END AS is_active`,
            [id, req.merchantId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found or unauthorized' });

        res.json({ message: 'Employee disabled successfully', employee: result.rows[0] });
    } catch (err) {
        console.error('Delete employee error:', err);
        res.status(500).json({ error: 'Failed to delete employee' });
    }
};
