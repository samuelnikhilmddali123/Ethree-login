const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Session = require('../models/Session');
const { getISTTime } = require('../controllers/utilsController');

const seedActiveSession = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const emp_no = 'EMP001'; // Ensure this employee exists and has role 'employee'
        const employee = await Employee.findOne({ emp_no });

        if (!employee) {
            console.log(`Employee ${emp_no} not found. Please create it first.`);
            process.exit(1);
        }

        const istTime = getISTTime();
        const today = istTime.date;
        const now = istTime.datetime;

        // 1. Create an active attendance record
        await Attendance.deleteMany({ emp_no, logout_time: null });
        const attendance = new Attendance({
            emp_no,
            login_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            date: today,
            session_status: 'Active',
            device_info: 'Test Device'
        });
        await attendance.save();
        console.log(`Active attendance record created for ${emp_no}`);

        // 2. Create an active session
        await Session.deleteMany({ emp_no, is_active: true });
        await Session.create({
            emp_no,
            session_token: 'test-token-123',
            device_info: 'Test Device',
            login_time: new Date(),
            is_active: true
        });
        console.log(`Active auth session created for ${emp_no}`);

        process.exit(0);
    } catch (error) {
        console.error('Error seeding active session:', error);
        process.exit(1);
    }
};

seedActiveSession();
