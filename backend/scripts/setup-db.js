const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function setupDatabase() {
    console.log('Setting up database...');
    
    // Connect without specifying database (to create it)
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD?.replace(/^"|"$/g, '') || process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT) || 3306
    });

    try {
        await connection.query('CREATE DATABASE IF NOT EXISTS work_monitoring_db');
        console.log('✅ Database work_monitoring_db created or already exists');
        
        // Switch to the database
        await connection.query('USE work_monitoring_db');

        // Create tables directly with explicit SQL
        console.log('Creating tables...');
        
        // Employees Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                emp_no VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'employee') DEFAULT 'employee',
                status ENUM('active', 'inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ Created table: employees');

        // Attendance Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                emp_no VARCHAR(20) NOT NULL,
                login_time DATETIME NOT NULL,
                logout_time DATETIME DEFAULT NULL,
                date DATE NOT NULL,
                FOREIGN KEY (emp_no) REFERENCES employees(emp_no) ON DELETE CASCADE
            )
        `);
        console.log('   ✅ Created table: attendance');

        // Tasks Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                emp_no VARCHAR(20) NOT NULL,
                date DATE NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                completion_percentage INT DEFAULT 0,
                status ENUM('completed', 'in_progress') DEFAULT 'in_progress',
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (emp_no) REFERENCES employees(emp_no) ON DELETE CASCADE
            )
        `);
        console.log('   ✅ Created table: tasks');

        // Verify tables were created
        const [tables] = await connection.query("SHOW TABLES");
        console.log('\n✅ All tables verified:');
        tables.forEach(table => {
            console.log(`   - ${Object.values(table)[0]}`);
        });
    } finally {
        await connection.end();
    }
}

setupDatabase().catch(err => {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
});
