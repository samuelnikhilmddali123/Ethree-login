const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { getISTTime } = require('../controllers/utilsController');

const logoutAllEmployees = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const { datetime, timestamp } = getISTTime();

        // 1. Update all employees to status 'inactive'
        const empUpdate = await Employee.updateMany(
            { status: 'active' },
            { $set: { status: 'inactive' } }
        );
        console.log(`Updated ${empUpdate.modifiedCount} employees to inactive.`);

        // 2. Close any open attendance records (logout_time: null)
        const openSessions = await Attendance.updateMany(
            { logout_time: null },
            { $set: { logout_time: timestamp } }
        );
        console.log(`Closed ${openSessions.modifiedCount} open attendance sessions.`);

        console.log('All employees logged out successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error logging out employees:', error);
        process.exit(1);
    }
};

logoutAllEmployees();
