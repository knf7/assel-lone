const { Client } = require('pg');
require('dotenv').config();

const hosts = ['postgres', 'loan-management-db', 'localhost'];
const dbPassword = process.env.DB_PASSWORD || 'postgres123';
const dbName = process.env.DB_NAME || 'loan_management';
const dbUser = process.env.DB_USER || 'postgres';

async function connect(host) {
    console.log(`Trying to connect to ${host}...`);
    const client = new Client({
        connectionString: `postgresql://${dbUser}:${dbPassword}@${host}:5432/${dbName}`,
        connectionTimeoutMillis: 5000
    });
    try {
        await client.connect();
        console.log(`✅ Connected to ${host}`);
        return client;
    } catch (err) {
        console.log(`❌ Failed to connect to ${host}:`, err.message);
        return null;
    }
}

async function run() {
    let client = null;
    for (const host of hosts) {
        client = await connect(host);
        if (client) break;
    }

    if (!client) {
        console.error('Could not connect to database on any host');
        process.exit(1);
    }

    try {
        console.log('Adding security columns to merchants table...');

        await client.query(`
            ALTER TABLE merchants 
            ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
            ADD COLUMN IF NOT EXISTS session_version INT DEFAULT 1;
        `);

        console.log('✅ Security columns added successfully');

    } catch (err) {
        console.error('❌ Error during migration:', err);
    } finally {
        await client.end();
    }
}

run();
