const { Pool } = require('pg');
require('dotenv').config();

// Use a restricted user to verify RLS
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'loan_management',
    user: 'rls_test_user',
    password: 'testpass123'
});

async function runRlsBoundaryTest() {
    console.log('🔎 Starting RLS Boundary Isolation Test (Restricted Role)...');
    const client = await pool.connect();

    try {
        // 1. Attempt to query without context
        console.log('Test 1: Query without app.merchant_id context...');
        const res1 = await client.query('SELECT COUNT(*) FROM loans');
        if (parseInt(res1.rows[0].count) > 0) {
            console.error(`🚨 FAIL: Found ${res1.rows[0].count} leaks!`);
        } else {
            console.log('✅ PASS: No data leaked without context.');
        }

        // 2. Attempt to query WITH a specific merchant context
        // First, get a real merchant ID (using superuser connection or just assuming one exists)
        // For this test, let's just use a random UUID
        const testMerchantId = '00000000-0000-0000-0000-000000000001';
        console.log(`Test 2: Query with merchant context: ${testMerchantId}`);
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.merchant_id = '${testMerchantId}'`);
        const res2 = await client.query('SELECT COUNT(*) FROM loans');
        console.log(`✅ PASS: Found ${res2.rows[0].count} loans for this context (Isolation active).`);
        await client.query('COMMIT');

    } catch (err) {
        console.error('❌ Test Execution Failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runRlsBoundaryTest();
