require('dotenv').config({ path: __dirname + '/../../.env' });
const db = require('../../config/database');

async function fixExpiries() {
    try {
        const result = await db.query(
            `UPDATE merchants 
             SET expiry_date = created_at + INTERVAL '30 days' 
             WHERE subscription_plan = 'Free' AND expiry_date IS NULL`
        );
        console.log(`Updated ${result.rowCount} merchants to have a 30-day expiry.`);
        process.exit(0);
    } catch (err) {
        console.error('Error fixed expiries:', err);
        process.exit(1);
    }
}
fixExpiries();
