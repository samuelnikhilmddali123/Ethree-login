const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Employee = require('./models/Employee');

dotenv.config();

async function findEmployee() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const employees = await Employee.find({
            $or: [
                { name: /raavi/i },
                { full_name: /raavi/i },
                { name: /ravi/i },
                { full_name: /ravi/i }
            ]
        }, { name: 1, full_name: 1, emp_no: 1, email: 1 });

        if (employees.length === 0) {
            console.log('No employee found matching "raavi" or "ravi".');
        } else {
            console.log('Found Employees:');
            console.table(employees.map(e => ({
                name: e.name,
                full_name: e.full_name,
                emp_no: e.emp_no,
                email: e.email
            })));
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.connection.close();
    }
}

findEmployee();
