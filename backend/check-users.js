const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('./models/Employee');

dotenv.config();

async function checkUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await Employee.find({}, { name: 1, role: 1, emp_no: 1, login_time: 1 });
        console.log('All Users:');
        console.table(users.map(u => ({
            name: u.name,
            role: u.role,
            emp_no: u.emp_no,
            login_time: u.login_time
        })));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.connection.close();
    }
}

checkUser();
