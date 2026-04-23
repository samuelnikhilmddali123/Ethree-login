const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const portsToTry = [3306, 3307, 3308, 8889]; // Common MySQL/MariaDB ports

async function scanPorts() {
    console.log('--- 🛡️ Quick MySQL Port Scanner 🛡️ ---');
    console.log(`Checking Host: ${process.env.DB_HOST || '127.0.0.1'}`);
    console.log('--------------------------------------');

    for (const port of portsToTry) {
        process.stdout.write(`Checking port ${port}... `);
        try {
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST || '127.0.0.1',
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                port: port,
                connectTimeout: 2000
            });
            console.log('✅ OPEN!');
            console.log(`\n🎉 FOUND IT! Your MySQL is running on port: ${port}`);
            console.log(`Please update your .env to: DB_PORT=${port}`);
            await connection.end();
            return;
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.log('❌ Closed');
            } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                console.log('✅ OPEN (but Access Denied)');
                console.log(`\n🎉 FOUND IT! Port ${port} is open, but your password/user is wrong.`);
                return;
            } else {
                console.log(`❌ Error: ${error.code}`);
            }
        }
    }

    console.log('\n😭 No MySQL service found on common ports.');
    console.log('Please check your XAMPP/MySQL Control Panel to see which port is active.');
}

scanPorts();
