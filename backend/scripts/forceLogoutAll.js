const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const { getISTTime } = require('../controllers/utilsController');

const forceLogoutAll = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const { datetime } = getISTTime();

        // 1. Auth Sessions
        const activeAuthSessions = await Session.countDocuments({ is_active: true });
        console.log(`Found ${activeAuthSessions} active authentication sessions.`);

        const authResult = await Session.updateMany(
            { is_active: true },
            { $set: { is_active: false } }
        );
        console.log(`Invalidated ${authResult.modifiedCount} authentication sessions.`);

        // 2. Attendance Records
        const openAttendance = await Attendance.countDocuments({ logout_time: null });
        console.log(`Found ${openAttendance} open attendance records.`);

        const attendanceResult = await Attendance.updateMany(
            { logout_time: null },
            { $set: { logout_time: datetime } }
        );
        console.log(`Closed ${attendanceResult.modifiedCount} attendance records.`);

        process.exit(0);
    } catch (error) {
        console.error('Error forcing logout:', error);
        process.exit(1);
    }
};

forceLogoutAll();
