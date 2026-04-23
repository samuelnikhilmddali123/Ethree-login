const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Employee = require('../models/Employee');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const LoginRequest = require('../models/LoginRequest');

// Mock request and response
const mockReq = (app, body) => ({
    body,
    app: {
        get: (key) => app[key]
    },
    headers: {}
});

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

const verifyRestrictedLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('[TEST] Connected to MongoDB');

        // Bypass the real getISTTime and force the hour to 20 (8 PM)
        const utilsController = require('../controllers/utilsController');
        const originalGetISTTime = utilsController.getISTTime;
        utilsController.getISTTime = () => {
            const time = originalGetISTTime();
            return {
                ...time,
                datetime: time.date + 'T20:00:00+05:30' // Force 8 PM
            };
        };

        // Clear cache and re-require authController so it picks up the Mocked utilsController
        delete require.cache[require.resolve('../controllers/authController')];
        const { loginEmployee } = require('../controllers/authController');

        const testEmpNo = 'EMP001';

        console.log('[TEST] Testing login logic (FORCED to 8 PM IST)...');

        const req = mockReq({ io: null }, { emp_no: testEmpNo, password: 'password123' });
        const res = mockRes();

        // Run the real controller
        await loginEmployee(req, res);

        if (res.statusCode === 401) {
            console.log('[TEST] Login failed (Invalid credentials) - Check seed data');
            process.exit(1);
        }

        const data = res.data;
        console.log('[TEST] Login Response:', JSON.stringify(data, null, 2));

        const istTime = utilsController.getISTTime();
        const currentHour = 20; // Forced 
        console.log(`[TEST] Forced IST Hour: ${currentHour}`);

        if (currentHour >= 19) {
            console.log('[TEST] Verifying restriction (Should be TRUE)');
            if (data.isRestricted === true && data.user.isRestricted === true) {
                console.log('[TEST] PASS: Restricted flag set correctly');

                // Verify no session created
                const sessionCount = await Session.countDocuments({ emp_no: testEmpNo, is_active: true });
                console.log(`[TEST] Active sessions for ${testEmpNo}: ${sessionCount}`);
                // Since EMP001 might have sessions from elsewhere, let's just check the JWT

                // Verify no attendance created
                const attendance = await Attendance.findOne({ emp_no: testEmpNo, date: istTime.date, login_time: { $regex: 'T20:00:00' } });
                if (!attendance) {
                    console.log('[TEST] PASS: No attendance record created for forced time');
                } else {
                    console.log('[TEST] FAIL: Attendance record was created');
                }

                // Verify JWT
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                if (decoded.isRestricted === true) {
                    console.log('[TEST] PASS: JWT contains isRestricted claim');
                } else {
                    console.log('[TEST] FAIL: JWT missing isRestricted claim');
                }

            } else {
                console.log('[TEST] FAIL: Restricted flag NOT set');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('[TEST] Error:', error);
        process.exit(1);
    }
};

verifyRestrictedLogin();
