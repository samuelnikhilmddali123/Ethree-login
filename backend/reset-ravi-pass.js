const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('./models/Employee');

dotenv.config();

async function resetPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const emp_no = 'EMP004';
        const newPassword = 'password123';

        const employee = await Employee.findOne({ emp_no });

        if (!employee) {
            console.log(`No employee found with emp_no: ${emp_no}`);
            return;
        }

        console.log(`Setting password for ${employee.name} (${employee.emp_no}) to: ${newPassword}`);

        // Hashing will happen automatically in the pre-save hook
        employee.password = newPassword;
        await employee.save();

        console.log('✅ Password reset successful!');

    } catch (err) {
        console.error('❌ Error resetting password:', err.message);
    } finally {
        await mongoose.connection.close();
    }
}

resetPassword();
