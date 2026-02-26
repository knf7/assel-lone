const Joi = require('joi');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { checkPlanLimit } = require('../middleware/planLimits');

const employeeSchema = Joi.object({
    fullName: Joi.string().trim().required().min(3).max(100),
    email: Joi.string().trim().email().required(),
    password: Joi.string().min(8).required(),
    permissions: Joi.object({
        can_view_loans: Joi.boolean().default(true),
        can_add_loans: Joi.boolean().default(true),
        can_view_customers: Joi.boolean().default(true),
        can_view_analytics: Joi.boolean().default(false)
    }).default()
});

const updateEmployeeSchema = Joi.object({
    fullName: Joi.string().trim().min(3).max(100),
    email: Joi.string().trim().email(),
    password: Joi.string().min(8).optional(),
    permissions: Joi.object({
        can_view_loans: Joi.boolean(),
        can_add_loans: Joi.boolean(),
        can_view_customers: Joi.boolean(),
        can_view_analytics: Joi.boolean()
    })
});

exports.listEmployees = async (req, res) => {
    try {
        const result = await req.dbClient.query(
            'SELECT id, full_name, email, permissions, created_at FROM merchant_employees WHERE merchant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
            [req.merchantId]
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
        // Check if email exists (in merchants or ACTIVE employees)
        const existingMerchant = await req.dbClient.query('SELECT id FROM merchants WHERE email = $1', [email]);
        const existingEmployee = await req.dbClient.query('SELECT id FROM merchant_employees WHERE email = $1 AND deleted_at IS NULL', [email]);

        if (existingMerchant.rows.length > 0 || existingEmployee.rows.length > 0) {
            return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await req.dbClient.query(
            `INSERT INTO merchant_employees (merchant_id, full_name, email, password_hash, permissions)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, full_name, email, permissions, created_at`,
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
             RETURNING id, full_name, email, permissions, created_at`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found or unauthorized' });

        res.json({ message: 'Employee updated successfully', employee: result.rows[0] });
    } catch (err) {
        console.error('Update employee error:', err);
        res.status(500).json({ error: 'Failed to update employee' });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft Delete (Shielded Logic Phase)
        const result = await req.dbClient.query(
            'UPDATE merchant_employees SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL RETURNING id',
            [id, req.merchantId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found or unauthorized' });

        res.json({ message: 'Employee deleted successfully (Soft Delete)' });
    } catch (err) {
        console.error('Delete employee error:', err);
        res.status(500).json({ error: 'Failed to delete employee' });
    }
};
