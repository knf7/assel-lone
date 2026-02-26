const db = require('./config/database');

async function migrate() {
    try {
        console.log('Creating subscription_requests table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS subscription_requests (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
                plan VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
                receipt_url TEXT NOT NULL,
                admin_notes TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_subs_req_merchant ON subscription_requests(merchant_id);
            CREATE INDEX IF NOT EXISTS idx_subs_req_status ON subscription_requests(status);
        `);
        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
