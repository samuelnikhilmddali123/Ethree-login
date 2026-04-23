const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    let connection;

    try {
        // Create connection using .env credentials
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'work_monitoring_db',
            port: process.env.DB_PORT || 3306,
            multipleStatements: true
        });

        console.log('Connected to database...');

        // Read migration SQL file (database folder is at root level)
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '../../database/migration.sql'),
            'utf8'
        );

        console.log('Running migration...');

        // Execute migration
        const [results] = await connection.query(migrationSQL);

        console.log('✅ Migration completed successfully!');

        // Show results
        if (Array.isArray(results)) {
            results.forEach((result, index) => {
                if (result && result.length > 0) {
                    console.log(`\nResult ${index + 1}:`, result);
                }
            });
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\nDatabase connection closed.');
        }
    }
}

runMigration();
