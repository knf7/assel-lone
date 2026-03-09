const { Client } = require('pg');

const client = new Client({
    host: 'postgres',
    port: 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
    database: process.env.DB_NAME || 'loan_management',
});

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to DB');

        // Create platform_settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_settings (
                key VARCHAR(100) PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table platform_settings created or already exists.');

        // Insert default bank details if not exists
        await client.query(`
            INSERT INTO platform_settings (key, value)
            VALUES ('bank_details', '{"iban": "SA 0000 0000 0000 0000 0000", "bank_name": "مصرف الراجحي", "account_holder": "مؤسسة أصيل المالي"}')
            ON CONFLICT (key) DO NOTHING;
        `);

        // Insert default global alert if not exists
        await client.query(`
            INSERT INTO platform_settings (key, value)
            VALUES ('global_alert', '{"active": false, "message": "نظام أصيل يخضع للصيانة المجدولة غداً في الساعة 3 فجراً", "type": "warning"}')
            ON CONFLICT (key) DO NOTHING;
        `);

        console.log('Migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
