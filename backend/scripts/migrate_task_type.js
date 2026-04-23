const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../.env' });

async function migrate() {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 3306
        });

        console.log('Connected to database...');

        // Add task_type column if not exists
        try {
            await conn.execute(
                "ALTER TABLE tasks ADD COLUMN task_type ENUM('daily', 'custom') DEFAULT 'daily' AFTER emp_no"
            );
            console.log('[OK] task_type column added');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('[SKIP] task_type column already exists');
            } else {
                throw e;
            }
        }

        // Update status ENUM to include declined
        await conn.execute(
            "ALTER TABLE tasks MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'overdue', 'declined') DEFAULT 'pending'"
        );
        console.log('[OK] status ENUM updated with declined');

        console.log('\nMigration complete!');
    } catch (e) {
        console.error('Migration error:', e.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();
