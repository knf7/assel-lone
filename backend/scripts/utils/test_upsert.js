require('dotenv').config({ path: __dirname + '/../../.env' });
const db = require('../../config/database');

async function run() {
    const client = await db.pool.connect();
    try {
        const merchantRes = await client.query('SELECT id FROM merchants LIMIT 1');
        if (merchantRes.rows.length === 0) {
            console.log("No merchants found");
            return;
        }
        const mid = merchantRes.rows[0].id;
        console.log("Using merchant ID:", mid);

        const natIds = ['9999999991'];
        const names = ['Test Name'];
        const mobiles = ['0500000000'];
        const mids = [mid];

        const customerRes = await client.query(
            `INSERT INTO customers (merchant_id, national_id, full_name, mobile_number)
         SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::text[])
           AS t(merchant_id, national_id, full_name, mobile_number)
         ON CONFLICT (merchant_id, national_id) DO UPDATE
           SET full_name = COALESCE(customers.full_name, EXCLUDED.full_name),
               mobile_number = COALESCE(customers.mobile_number, EXCLUDED.mobile_number)
         RETURNING id, national_id`,
            [mids, natIds, names, mobiles]
        );
        console.log("SUCCESS:", customerRes.rows);
    } catch (err) {
        console.error("FAIL:", err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

run();
