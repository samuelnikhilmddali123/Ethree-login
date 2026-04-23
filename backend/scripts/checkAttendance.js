const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

const checkAttendance = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const records = await Attendance.find({ emp_no: 'EMP001' })
            .sort({ login_time: -1 })
            .limit(5);

        console.log('Recent Attendance Records for EMP001:');
        records.forEach(r => {
            console.log(`ID: ${r._id}, Login: ${r.login_time}, Logout: ${r.logout_time}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error checking attendance:', error);
        process.exit(1);
    }
};

checkAttendance();
