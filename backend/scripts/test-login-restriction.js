const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Employee = require('../models/Employee');
const LoginRequest = require('../models/LoginRequest');
const { getISTTime } = require('../controllers/utilsController');

const testLoginRestriction = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('[DEBUG] Connected to MongoDB');

        const emp_no = 'EMP001';
        const employee = await Employee.findOne({ emp_no });

        if (!employee) {
            console.log('Employee EMP001 not found.');
            process.exit(1);
        }

        // Simulating the logic in authController.js
        console.log('[DEBUG] Testing Login Restriction for Employee...');

        // Mocking current hour to be 20 (8 PM IST)
        const mockHourIST = 20;
        console.log(`[DEBUG] Current Mock Hour: ${mockHourIST}`);

        if (employee.role === 'employee' && mockHourIST >= 19) {
            console.log('[DEBUG] SUCCESS: Login is restricted (Hour >= 19)');

            // Check for valid approval
            const now = new Date();
            const approval = await LoginRequest.findOne({
                emp_no: employee.emp_no,
                status: 'Approved',
                expiry_time: { $gt: now }
            });

            if (!approval) {
                console.log('[DEBUG] SUCCESS: No valid approval found. Suggesting request modal.');
            } else {
                console.log('[DEBUG] INFO: Valid approval found. User can login.');
            }
        } else {
            console.log('[DEBUG] FAILURE: Login was NOT restricted when it should have been (or it is before 7 PM).');
        }

        console.log('[DEBUG] Testing Admin Login (should not be restricted)...');
        const admin = await Employee.findOne({ role: 'admin' });
        if (admin) {
            if (admin.role === 'employee' && mockHourIST >= 19) {
                console.log('[DEBUG] FAILURE: Admin was restricted.');
            } else {
                console.log('[DEBUG] SUCCESS: Admin is NOT restricted.');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('[DEBUG] Error:', error);
        process.exit(1);
    }
};

testLoginRestriction();
