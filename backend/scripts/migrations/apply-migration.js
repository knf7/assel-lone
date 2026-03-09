const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const hosts = ['localhost', 'postgres', 'loan-management-db'];

async function connect(host) {
    const client = new Client({
        connectionString: `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${host}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'loan_management'}`,
        connectionTimeoutMillis: 2000
    });
    try {
        await client.connect();
        return client;
    } catch (err) {
        return null;
    }
}

async function applyMigration() {
    const migrationPath = path.join(__dirname, '../database/migrations/005_add_employees_and_najiz_fields.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    let client = null;
    for (const host of hosts) {
        client = await connect(host);
        if (client) {
            console.log(`✅ Connected to ${host}`);
            break;
        }
    }

    if (!client) {
        console.error('❌ Could not connect to database on any host');
        process.exit(1);
    }

    try {
        console.log('Applying migration...');
        await client.query(sql);
        console.log('✅ Migration applied successfully');
    } catch (err) {
        console.error('❌ Error applying migration:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
