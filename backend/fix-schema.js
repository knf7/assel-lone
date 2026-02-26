const { Client } = require('pg');

const hosts = ['postgres', 'loan-management-db', 'localhost'];
const dbPassword = process.env.DB_PASSWORD || 'CHANGE_THIS_PASSWORD_IN_PRODUCTION';

async function connect(host) {
    console.log(`Trying to connect to ${host} with password ${dbPassword}...`);
    const client = new Client({
        connectionString: `postgresql://postgres:${dbPassword}@${host}:5432/loan_management`,
        connectionTimeoutMillis: 2000
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
        console.log('Adding notes column to loans...');
        await client.query('ALTER TABLE loans ADD COLUMN IF NOT EXISTS notes TEXT;');
        console.log('✅ notes column added');

        console.log('Checking customers table schema regarding uniqueness...');
        // Check constraints
        const res = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'customers'::regclass
        `);
        console.log('Customers constraints:', res.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
