const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Session = require('../models/Session');
const { getISTTime } = require('../controllers/utilsController');

const testAutoLogout = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('[DEBUG] Connected to MongoDB');

        const istTime = getISTTime();
        const nowStr = istTime.datetime;
        const today = istTime.date;

        console.log(`[DEBUG] Current IST Time: ${nowStr}`);

        // 1. Find all active attendance records for employees
        const attendees = await Attendance.find({ logout_time: null });
        console.log(`[DEBUG] Found ${attendees.length} active attendance records.`);

        for (const record of attendees) {
            const employee = await Employee.findOne({ emp_no: record.emp_no });

            if (employee && employee.role === 'employee') {
                console.log(`[DEBUG] Auto-logging out employee: ${employee.emp_no}`);

                // Update attendance record
                record.logout_time = nowStr;
                record.session_status = 'Auto Logout';
                record.logout_reason = 'Office hours ended (DEBUG)';
                await record.save();

                // Deactivate auth sessions
                await Session.updateMany(
                    { emp_no: employee.emp_no, is_active: true },
                    { is_active: false }
                );

                console.log(`[DEBUG] Success for ${employee.emp_no}`);
            }
        }

        console.log('[DEBUG] Auto-logout test completed.');
        process.exit(0);
    } catch (error) {
        console.error('[DEBUG] Error during auto-logout test:', error);
        process.exit(1);
    }
};

testAutoLogout();
