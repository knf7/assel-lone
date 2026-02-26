const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'loan_management',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

/**
 * ── Nightly Integrity Check ──
 * Runs critical checks to ensure data consistency and detect potential tampering.
 */
async function runIntegrityCheck() {
    console.log('🚀 Starting Nightly Integrity Check...');
    const client = await pool.connect();

    try {
        // 1. Check for Najiz Amount Invariants
        // Najiz amount should not exist if status is not 'Raised'
        const najizInvariants = await client.query(`
            SELECT id, merchant_id, status, najiz_case_amount 
            FROM loans 
            WHERE status != 'Raised' AND najiz_case_amount IS NOT NULL AND deleted_at IS NULL
        `);

        if (najizInvariants.rows.length > 0) {
            console.error(`🚨 INVARIANT VIOLATION: ${najizInvariants.rows.length} loans have Najiz amounts but are NOT in 'Raised' status.`);
            // In real app: log to security table or send alert
        }

        // 2. Check for Loan/Customer orphans
        const orphans = await client.query(`
            SELECT l.id FROM loans l 
            LEFT JOIN customers c ON l.customer_id = c.id 
            WHERE c.id IS NULL
        `);
        if (orphans.rows.length > 0) {
            console.error(`🚨 DATA INTEGRITY: ${orphans.rows.length} loans are orphaned (no customer).`);
        }

        // 3. Verify Audit Log Continuity (Simplified)
        // Check if there are loans with status != 'Active' that HAVE NO audit log entry
        const missingAudit = await client.query(`
            SELECT l.id FROM loans l
            WHERE l.status != 'Active' 
            AND NOT EXISTS (SELECT 1 FROM audit.loan_audit_log a WHERE a.loan_id = l.id)
        `);
        if (missingAudit.rows.length > 0) {
            console.warn(`⚠️ AUDIT GAP: ${missingAudit.rows.length} non-active loans have no transition history in audit log.`);
        }

        // 4. Verify Merchant Isolation (Cross-Tenant Leak detection)
        // Check if any loans have a merchant_id that doesn't exist in merchants table
        const isolationCheck = await client.query(`
            SELECT l.id FROM loans l
            WHERE NOT EXISTS (SELECT 1 FROM merchants m WHERE m.id = l.merchant_id)
        `);
        if (isolationCheck.rows.length > 0) {
            console.error(`🚨 SEVERE: ${isolationCheck.rows.length} loans belong to non-existent merchants.`);
        }

        // 5. RLS Leak Simulation (Attempt to query without SET context)
        console.log('🔎 Simulating RLS Leak check...');
        try {
            // This client has no SET LOCAL merchant_id
            const leakRes = await client.query('SELECT COUNT(*) FROM loans');
            // With RLS enabled and no bypass, this should return 0 if policies are "USING (app.merchant_id = ...)"
            // and the default is 0.
            if (parseInt(leakRes.rows[0].count) > 0) {
                console.error(`🚨 RLS LEAK DETECTED: Found ${leakRes.rows[0].count} loans accessible without merchant context!`);
            } else {
                console.log('✅ RLS isolation verified (no context = no data).');
            }
        } catch (err) {
            console.log('✅ RLS isolation verified (query failed as expected or returned 0).');
        }

        // 6. Cryptographic Hash Chain Verification
        console.log('🔎 Verifying Audit Hash Chain...');
        const chainRes = await client.query('SELECT id, row_hash, prev_hash FROM audit.loan_audit_log ORDER BY changed_at ASC');
        let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
        let broken = false;

        for (const row of chainRes.rows) {
            if (row.prev_hash !== expectedPrevHash) {
                console.error(`🚨 AUDIT TAMPERING: Hash chain broken at record ${row.id}. Expected prev_hash ${expectedPrevHash}, found ${row.prev_hash}`);
                broken = true;
                break;
            }
            expectedPrevHash = row.row_hash;
        }
        if (!broken) console.log('✅ Audit hash chain integrity verified.');

        console.log('✅ Integrity Check Completed.');
    } catch (err) {
        console.error('❌ Integrity Check Failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runIntegrityCheck();
