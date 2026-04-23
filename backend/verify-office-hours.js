const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Employee = require('./models/Employee');
const LoginRequest = require('./models/LoginRequest');
const Attendance = require('./models/Attendance');
const { getISTTime } = require('./controllers/utilsController');

dotenv.config({ path: path.resolve(__dirname, './.env') });

async function verifyLogic() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const istTime = getISTTime();
        const currentHourIST = parseInt(istTime.datetime.split('T')[1].split(':')[0]);
        console.log(`Current IST Hour: ${currentHourIST}`);

        // 1. Check if we can find an employee
        const emp = await Employee.findOne({ role: 'employee' });
        if (!emp) {
            console.log('❌ No employee found to test with.');
            return;
        }
        console.log(`Testing with employee: ${emp.emp_no}`);

        // 2. Check LoginRequest model
        const newRequest = new LoginRequest({
            emp_no: emp.emp_no,
            reason: 'Test Reason',
            status: 'Pending'
        });
        await newRequest.save();
        console.log('✅ LoginRequest model created successfully.');

        // 3. Check Attendance model update
        const testAttendance = new Attendance({
            emp_no: emp.emp_no,
            login_time: new Date(),
            date: istTime.date,
            session_status: 'Auto Logout'
        });
        await testAttendance.save();
        console.log('✅ Attendance model updated with "Auto Logout" status successfully.');

        // Clean up
        await LoginRequest.deleteOne({ _id: newRequest._id });
        await Attendance.deleteOne({ _id: testAttendance._id });
        console.log('✅ Clean up completed.');

    } catch (err) {
        console.error('❌ Error during verification:', err.message);
    } finally {
        await mongoose.connection.close();
    }
}

verifyLogic();
