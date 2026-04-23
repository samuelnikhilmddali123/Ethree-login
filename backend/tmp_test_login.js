const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const MONGO_URI = 'mongodb+srv://shubhamsid1:53Y6vU24Qh3HkO9f@cluster0.pgh80.mongodb.net/stackvil_tracker?retryWrites=true&w=majority&appName=Cluster0';

async function test() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const Employee = require('./backend/models/Employee');
        const Attendance = require('./backend/models/Attendance');
        const Session = require('./backend/models/Session');
        const { getISTTime } = require('./backend/controllers/utilsController');

        const employee = await Employee.findOne({ role: 'employee' });
        if (!employee) {
            console.log('No employee found to test with.');
            process.exit(0);
        }

        console.log('Testing with employee:', employee.emp_no);

        const istTimeNow = getISTTime();
        let isRestricted = (new Date() >= istTimeNow.sevenPM || istTimeNow.hour >= 19);
        console.log('Is Restricted:', isRestricted);

        const session_token = !isRestricted ? crypto.randomBytes(32).toString('hex') : null;

        if (employee.role === 'employee' && !isRestricted) {
            console.log('Would update sessions and emit logic.');
        }

        if (!isRestricted) {
            console.log('Would create session.');
        }

        const token = jwt.sign(
            { id: employee._id, emp_no: employee.emp_no, role: employee.role, session_token, isRestricted },
            'secret',
            { expiresIn: '24h' }
        );
        console.log('Token generated.');

        const istTime = getISTTime();
        const today = istTime.date;
        const now = istTime.datetime;

        if (!isRestricted) {
            console.log('Attempting attendance update...');
            await Attendance.updateMany(
                { emp_no: employee.emp_no, logout_time: null },
                { $set: { logout_time: now, session_status: 'Forced Logout', logout_reason: 'Test' } }
            );
            console.log('Attendance updated.');
        }

        console.log('ALL TESTS PASSED.');
        process.exit(0);
    } catch (err) {
        console.error('TEST FAILED:', err);
        process.exit(1);
    }
}

test();
