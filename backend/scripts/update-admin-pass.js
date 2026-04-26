const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Employee = require('../models/Employee');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function updateAdminPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const emp_no = 'ADMIN001';
        const newPassword = 'admin123';

        const admin = await Employee.findOne({ emp_no });

        if (!admin) {
            console.log(`No admin found with emp_no: ${emp_no}`);
            return;
        }

        console.log(`Updating password for Admin (${admin.emp_no}) to: ${newPassword}`);

        admin.password = newPassword;
        await admin.save();

        console.log('✅ Admin password updated to admin123 successfully!');

    } catch (err) {
        console.error('❌ Error updating password:', err.message);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

updateAdminPassword();
