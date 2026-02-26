const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/public/settings - Publicly accessible platform settings
router.get('/settings', async (req, res) => {
    try {
        const result = await db.query("SELECT key, value FROM platform_settings WHERE key IN ('bank_details', 'global_alert')");
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (err) {
        console.error('Public settings error:', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

module.exports = router;
