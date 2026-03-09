const { pool } = require('../config/database');
const logger = require('./logger');

/**
 * Audit Log Utility for tracking sensitive actions
 * @param {Object} params
 * @param {string} [params.merchantId] - The ID of the merchant
 * @param {string} [params.userId] - The ID of the user performing the action
 * @param {string} params.action - The action performed (e.g., 'LOGIN', 'CREATE_LOAN')
 * @param {string} params.entity - The entity affected (e.g., 'Loan', 'Customer')
 * @param {string} [params.entityId] - The ID of the affected entity
 * @param {Object} [params.details] - Additional JSON details
 * @param {string} [params.ipAddress] - IP Address of the user
 */
const logAudit = async ({ merchantId = null, userId = null, action, entity, entityId = null, details = {}, ipAddress = null }) => {
    try {
        const query = `
            INSERT INTO audit_logs (merchant_id, user_id, action, entity, entity_id, details, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        const values = [merchantId, userId, action, entity, entityId, JSON.stringify(details), ipAddress];

        await pool.query(query, values);

        // Also log to Pino
        logger.info(`[AUDIT] ${action} on ${entity} ${entityId || ''} by User: ${userId}`, { details, ipAddress });
    } catch (err) {
        logger.error('❌ Failed to insert Audit Log:', err);
    }
};

module.exports = { logAudit };
