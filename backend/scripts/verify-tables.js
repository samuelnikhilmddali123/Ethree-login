const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function verifyTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD?.replace(/^"|"$/g, '') || process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT) || 3306
    });

    try {
        const [tables] = await connection.query("SHOW TABLES");
        console.log('\n📊 Current tables in database:');
        if (tables.length === 0) {
            console.log('   ❌ No tables found!');
        } else {
            tables.forEach(table => {
                console.log(`   ✅ ${Object.values(table)[0]}`);
            });
        }

        // Check each required table
        const requiredTables = ['employees', 'attendance', 'tasks'];
        console.log('\n🔍 Checking required tables:');
        for (const tableName of requiredTables) {
            try {
                const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                console.log(`   ✅ ${tableName} exists (${rows[0].count} rows)`);
            } catch (err) {
                console.log(`   ❌ ${tableName} does NOT exist`);
            }
        }
    } finally {
        await connection.end();
    }
}

verifyTables().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
