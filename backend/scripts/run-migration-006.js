const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const hosts = ['localhost', 'postgres', 'loan-management-db'];

async function connect(host) {
    const client = new Client({
        connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${host}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
        connectionTimeoutMillis: 2000
    });
    try {
        await client.connect();
        return client;
    } catch (err) {
        return null;
    }
}

async function runMigration() {
    const migrationPath = path.join(__dirname, '../../database/migrations/006_add_najiz_collected_amount.sql');
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
        const fallback = 'postgresql://postgres:postgres123@localhost:5432/loan_management';
        console.log(`Trying fallback connection: ${fallback}`);
        client = new Client({ connectionString: fallback });
        try {
            await client.connect();
            console.log('✅ Connected via fallback');
        } catch (e) {
            console.error('❌ Could not connect to database');
            process.exit(1);
        }
    }

    try {
        console.log('Applying migration 006...');
        await client.query(sql);
        console.log('✅ Migration 006 (najiz_collected_amount) applied successfully');
    } catch (err) {
        console.error('❌ Error applying migration:', err.message);
    } finally {
        await client.end();
    }
}

runMigration();
