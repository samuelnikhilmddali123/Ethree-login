const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Employee = require('../models/Employee');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');

// Connect to DB with cached logic sim
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('DB Connection Error:', err);
        process.exit(1);
    }
};

const deactivateSonali = async () => {
    await connectDB();

    try {
        // 1. Find User
        // Using strict regex for "Sonali Kumari" or just "Sonali" if user meant that.
        // Assuming "Sonali Kumari" is the name or close to it.
        const user = await Employee.findOne({ name: { $regex: /Sonali/i } });

        if (!user) {
            console.log('User "Sonali" not found.');
            process.exit(1);
        }

        console.log(`Found user: ${user.name} (${user.emp_no})`);

        // 2. Set Inactive
        user.status = 'inactive';
        await user.save();
        console.log(`User ${user.emp_no} status set to 'inactive'.`);

        // 3. Invalidate Sessions
        const sessionResult = await Session.updateMany(
            { emp_no: user.emp_no, is_active: true },
            { is_active: false }
        );
        console.log(`Invalidated ${sessionResult.modifiedCount} active sessions.`);

        // 4. Close Attendance
        const now = new Date();
        // Adjust for IST roughly if needed or just use current server time
        // Actually better to use our util but for script simplicity plain Date is fine as DB stores ISO
        // But let's try to match logic:
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);

        const attendResult = await Attendance.updateMany(
            { emp_no: user.emp_no, logout_time: null },
            {
                logout_time: istTime,
                session_status: 'Forced Logout',
                logout_reason: 'Admin Deactivated'
            }
        );
        console.log(`Closed ${attendResult.modifiedCount} open attendance records.`);

    } catch (err) {
        console.error('Error during deactivation:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

deactivateSonali();
