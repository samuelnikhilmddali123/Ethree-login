const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Attendance = require('./models/Attendance');

dotenv.config();

async function checkAttendance() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const records = await Attendance.find({ emp_no: 'EMP005' }).sort({ date: -1 }).limit(10);
        console.log('Attendance Records for EMP005 (nikhil):');
        console.table(records.map(r => ({
            date: r.date,
            login_time: r.login_time,
            logout_time: r.logout_time
        })));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.connection.close();
    }
}

checkAttendance();
