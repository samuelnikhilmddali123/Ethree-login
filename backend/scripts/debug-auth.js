const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Employee = require('../models/Employee');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function debugAuth() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const emp_no = 'ADMIN001';
        const password = 'admin123';

        const employee = await Employee.findOne({ emp_no });
        if (!employee) {
            console.log('❌ Employee not found');
            return;
        }

        console.log('👤 Employee found:', employee.emp_no);
        console.log('🔑 Hashed Password in DB:', employee.password);

        const isMatch = await employee.comparePassword(password);
        console.log('❓ Password Match Result:', isMatch);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

debugAuth();
