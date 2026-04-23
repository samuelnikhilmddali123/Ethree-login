const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

async function testConnection() {
    console.log('--- Database Connection Diagnostic ---');
    console.log(`Attempting to connect with:`);
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`Port: ${process.env.DB_PORT || 3306}`);
    console.log('--------------------------------------');

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 3306
        });

        console.log('✅ SUCCESS: Connected to the database successfully!');

        const [rows] = await connection.execute('SELECT 1 + 1 AS solution');
        console.log('✅ SUCCESS: Query execution works! (1 + 1 = ' + rows[0].solution + ')');

        await connection.end();
    } catch (error) {
        console.error('❌ FAILURE: Could not connect to the database.');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 SUGGESTIONS:');
            console.log('1. Check if your MySQL/MariaDB service is STARTED.');
            console.log('2. Check if the Port is correct (Try 3307 if 3306 fails).');
            console.log('3. Ensure no firewall is blocking the connection.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n💡 SUGGESTIONS:');
            console.log('1. Check if DB_USER and DB_PASSWORD are correct.');
            console.log('2. Ensure the user has permissions to access this database.');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('\n💡 SUGGESTIONS:');
            console.log(`1. The database "${process.env.DB_NAME}" does not exist.`);
            console.log('2. Create it using: CREATE DATABASE ' + process.env.DB_NAME + ';');
        }
    }
}

testConnection();
