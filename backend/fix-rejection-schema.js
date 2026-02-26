const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' }); // Adjust if using .env.production

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'loan_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function run() {
    console.log('Migration: Adding rejection_reason to merchants table...');
    try {
        await pool.query('ALTER TABLE merchants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;');
        console.log('✅ Successfully added rejection_reason.');
    } catch (err) {
        console.error('❌ Failed:', err.message);
    } finally {
        pool.end();
    }
}

run();
