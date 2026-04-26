const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LoginRequest = require('../models/LoginRequest');
const jwt = require('jsonwebtoken');
const { getISTTime, getServerTime } = require('./utilsController');
const crypto = require('crypto');
const Session = require('../models/Session');
const Settings = require('../models/Settings');
const ProxyAttempt = require('../models/ProxyAttempt');

// @desc    Register a new employee
// @route   POST /api/auth/register
const registerEmployee = async (req, res) => {
    const { emp_no, name, email, password, role } = req.body;

    try {
        // Check if employee exists
        const existingEmp = await Employee.findOne({ $or: [{ emp_no }, { email }] });
        if (existingEmp) {
            return res.status(400).json({ message: 'Employee with this ID or email already exists' });
        }

        // Create employee (Mongoose middleware handles hashing)
        const employee = new Employee({
            emp_no,
            name,
            email,
            password,
            role: role || 'employee'
        });

        await employee.save();
        res.status(201).json({ message: 'Employee registered successfully' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({
            message: 'Server error during registration',
            error: error.message
        });
    }
};

// @desc    Login employee & get token
// @route   POST /api/auth/login
const loginEmployee = async (req, res) => {
    const { emp_no, password, device_info, wifi_ssid, face_descriptor } = req.body;
    const cleanEmpNo = emp_no?.trim().toUpperCase();

    try {
        console.log(`[AUTH] Login attempt: "${emp_no}" -> "${cleanEmpNo}"`);

        const employee = await Employee.findOne({
            $or: [
                { emp_no: cleanEmpNo },
                { email: emp_no?.toLowerCase().trim() }
            ]
        });

        if (!employee) {
            console.log(`[AUTH] User not found: "${cleanEmpNo}"`);
            return res.status(401).json({ message: 'Invalid Employee ID' });
        }

        console.log(`[AUTH] Comparing password for ${employee.emp_no}...`);
        const isMatch = await employee.comparePassword(password);
        console.log(`[AUTH] Match result: ${isMatch}`);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (employee.role !== 'admin' && employee.is_wifi_login_enabled) {
            try {
                const settings = await Settings.findOne();
                const allowedSsid = settings?.office_wifi_ssid;
                const allowedIp = settings?.office_public_ip;

                const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim();

                if (wifi_ssid && wifi_ssid !== 'NATIVE_BOUND') {
                    if (allowedSsid && allowedSsid !== 'Your_Office_WiFi_Name') {
                        if (wifi_ssid.trim() !== allowedSsid.trim()) {
                            return res.status(403).json({
                                message: 'Login Denied: You must be connected to the authorized Office Wi-Fi network.',
                                error: 'SSID_MISMATCH'
                            });
                        }
                    }
                } else if (allowedIp && allowedIp.trim() !== '') {
                    const isLocal = clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('localhost');
                    // This handles browsers without SSID info AND Native Apps using NATIVE_BOUND fallback
                    if (clientIp !== allowedIp.trim() && !isLocal) {
                        return res.status(403).json({
                            message: 'Login Denied: Unauthorized network. Mobile browser users must be on Office WiFi.',
                            error: 'IP_MISMATCH'
                        });
                    }
                }
            } catch (settingsErr) {
                console.warn('[AUTH] Network settings check failed:', settingsErr.message);
            }
        }

        // --- Face Verification Check ---
        if (employee.is_face_enabled && face_descriptor) {
            if (!employee.face_descriptor || employee.face_descriptor.length === 0) {
                return res.status(400).json({ message: 'Face data not found for your account. Please contact admin.' });
            }

            // Simple Euclidean Distance Check (threshold 0.55)
            const descriptor1 = Array.isArray(face_descriptor) ? face_descriptor : Object.values(face_descriptor);
            const descriptor2 = employee.face_descriptor;
            
            let sum = 0;
            const len = Math.min(descriptor1.length, descriptor2.length, 128);
            for (let i = 0; i < len; i++) {
                const diff = (descriptor1[i] || 0) - (descriptor2[i] || 0);
                sum += diff * diff;
            }
            const distance = Math.sqrt(sum);

            console.log(`[AUTH] Face check for "${cleanEmpNo}": Distance = ${distance.toFixed(4)}`);
            if (distance > 0.60) {
                // Log Proxy Attempt
                try {
                    const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
                    
                    // Optional: Find who the face actually belongs to
                    let detectedEmpId = 'Unknown Face';
                    let detectedEmpName = 'Unknown';
                    
                    const allUsers = await Employee.find({ face_descriptor: { $exists: true, $ne: [] } });
                    for(const u of allUsers) {
                        // Use a slightly stricter threshold for auto-detection
                        let sumD = 0;
                        const d1 = descriptor1;
                        const d2 = u.face_descriptor;
                        const lenD = Math.min(d1.length, d2.length, 128);
                        for(let i=0; i<lenD; i++) {
                            const diff = (d1[i] || 0) - (d2[i] || 0);
                            sumD += diff * diff;
                        }
                        if(Math.sqrt(sumD) < 0.55) {
                            detectedEmpId = u.emp_no;
                            detectedEmpName = u.full_name || u.name;
                            break;
                        }
                    }

                    await ProxyAttempt.create({
                        login_employee_id: employee.emp_no,
                        login_employee_name: employee.full_name || employee.name,
                        detected_face_employee_id: detectedEmpId,
                        detected_employee_name: detectedEmpName,
                        image_data: req.body.image_data || '', 
                        device_info: device_info || 'Unknown',
                        ip_address: clientIp,
                        timestamp: new Date()
                    });
                } catch (proxyErr) {
                    console.error('[AUTH] Failed to log proxy attempt:', proxyErr.message);
                }

                return res.status(403).json({ message: 'Face verification failed. Access denied.' });
            }
        } else if (employee.is_face_enabled && !face_descriptor) {
            // Generate token early (like Efour version) to allow frontend to handle verification
            const token = jwt.sign({ id: employee._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
            
            return res.json({ 
                message: 'Face verification required.', 
                face_required: true,
                token,
                user: {
                    emp_no: employee.emp_no,
                    name: employee.name,
                    full_name: employee.full_name,
                    face_descriptor: employee.face_descriptor,
                    is_face_enabled: employee.is_face_enabled,
                    role: employee.role
                }
            });
        }

        // OFFICE HOURS CHECK (Employee Only)
        const istTimeNow = getISTTime();
        let isRestricted = false;

        if (employee.role === 'employee' && (new Date() >= istTimeNow.sevenPM || istTimeNow.hour >= 19)) {
            // Check for valid approval
            const now = new Date();
            const approval = await LoginRequest.findOne({
                emp_no: employee.emp_no,
                status: 'Approved',
                expiry_time: { $gt: now }
            });

            if (!approval) {
                // Instead of blocking, allow restricted login
                isRestricted = true;
            }
        }

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is missing');
        }

        // GENERATE SESSION TOKEN
        const session_token = !isRestricted ? crypto.randomBytes(32).toString('hex') : null;

        // SINGLE DEVICE ENFORCEMENT FOR EMPLOYEES (Only if not restricted)
        if (employee.role === 'employee' && !isRestricted) {
            // 1. Mark all previous active sessions as inactive
            await Session.updateMany(
                { emp_no: employee.emp_no, is_active: true },
                { is_active: false }
            );

            // 2. Emit force_logout event
            const io = req.app.get('io');
            if (io) {
                io.to(employee.emp_no).emit('force_logout', {
                    message: 'Your account has been logged in from another device.'
                });
            }
        }

        // Create new session (Only if not restricted)
        if (!isRestricted) {
            await Session.create({
                emp_no: employee.emp_no,
                session_token: session_token,
                device_info: device_info || 'unknown',
                login_time: new Date(),
                is_active: true
            });
        }

        const token = jwt.sign(
            {
                id: employee._id,
                emp_no: employee.emp_no,
                role: employee.role,
                session_token: session_token, // Embed session token in JWT
                isRestricted: isRestricted
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '24h' }
        );

        const istTime = getISTTime();
        const today = istTime.date;
        const now = istTime.datetime;

        // CLOSE PREVIOUS ATTENDANCE SESSION IF OPEN (Only if not restricted)
        if (!isRestricted) {
            try {
                await Attendance.updateMany(
                    { emp_no: employee.emp_no, logout_time: null },
                    {
                        $set: {
                            logout_time: now,
                            session_status: 'Forced Logout',
                            logout_reason: 'Logged in from another device'
                        }
                    }
                );
            } catch (prevErr) {
                console.error('[AUTH] Failed to close previous sessions:', prevErr.message);
            }

            // Record login time (don't block login if this fails)
            // Create a NEW record for every login to track multiple sessions in a day
            try {
                const attendance = new Attendance({
                    emp_no: employee.emp_no,
                    login_time: now,
                    date: today,
                    session_status: 'Active',
                    device_info: device_info || 'Unknown Device'
                });
                await attendance.save();
            } catch (attErr) {
                console.error('[AUTH] Attendance log failed:', attErr.message);
            }
        }

        res.json({
            token,
            session_token, // Send explicitly if needed by frontend outside JWT
            isRestricted,
            user: {
                id: employee._id,
                emp_no: employee.emp_no,
                name: employee.name,
                role: employee.role,
                login_time: now,
                isRestricted,
                is_face_enabled: employee.is_face_enabled,
                is_wifi_login_enabled: employee.is_wifi_login_enabled
            }
        });
    } catch (error) {
        console.error('[AUTH] Login Error:', error);
        res.status(500).json({
            message: 'Server error during login',
            error: error.message
        });
    }
};

// @desc    Logout employee
// @route   POST /api/auth/logout
const logoutEmployee = async (req, res) => {
    const { emp_no } = req.user;
    const { statusUpdates } = req.body; // Expecting [{ taskId, completion_percentage, reason }]

    try {
        const istTime = getISTTime();
        const nowStr = istTime.datetime;
        const today = istTime.date;

        // 1. Process Task Updates if any
        if (statusUpdates && Array.isArray(statusUpdates)) {
            const Task = require('../models/Task');
            for (const update of statusUpdates) {
                const { taskId, completion_percentage, reason } = update;
                const task = await Task.findOne({ _id: taskId, emp_no });
                if (task) {
                    const pct = parseInt(completion_percentage);
                    if (!isNaN(pct)) {
                        task.completion_percentage = pct;
                        if (pct === 100) {
                            task.status = 'completed';
                            task.completed_date = today;
                        } else if (pct > 0) {
                            task.status = 'in_progress';
                        }
                    }
                    if (reason) {
                        task.reason = reason;
                    }
                    await task.save();
                }
            }
        }

        // 2. Find and close the latest active attendance record
        const record = await Attendance.findOne({
            emp_no,
            date: today,
            logout_time: null
        }).sort({ login_time: -1 });

        let duration = null;
        if (record) {
            record.logout_time = nowStr;
            record.session_status = 'Completed';
            record.logout_reason = 'User Logout';
            await record.save();

            // Calculate duration correctly
            const loginTime = new Date(record.login_time);
            const logoutTime = new Date(nowStr);
            const diffMs = logoutTime - loginTime;

            if (diffMs > 0) {
                const diffHrs = Math.floor(diffMs / 3600000);
                const diffMins = Math.floor((diffMs % 3600000) / 60000);
                duration = {
                    hours: diffHrs,
                    minutes: diffMins,
                    formatted: `${diffHrs}h ${diffMins}m`
                };
            }
        }

        res.json({
            message: 'Logged out successfully',
            duration: duration
        });
    } catch (error) {
        console.error('Logout Error:', error);
        res.status(500).json({
            message: 'Server error during logout',
            error: error.message
        });
    }
};

// @desc    Change password
// @route   PUT /api/auth/password
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { emp_no } = req.user;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        const employee = await Employee.findOne({ emp_no });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const isMatch = await employee.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        employee.password = newPassword; // Mongoose middleware will hash this
        await employee.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({
            message: 'Server error during password change',
            error: error.message
        });
    }
};

// @desc    Request login permission after hours
// @route   POST /api/auth/login-request
const requestLoginPermission = async (req, res) => {
    const { emp_no, reason, device_info } = req.body;
    const cleanEmpNo = emp_no?.trim().toUpperCase();

    try {
        const employee = await Employee.findOne({ emp_no: cleanEmpNo });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Check for existing pending request
        const existingRequest = await LoginRequest.findOne({
            emp_no: cleanEmpNo,
            status: 'Pending'
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'You already have a pending login request.' });
        }

        const loginRequest = new LoginRequest({
            emp_no: cleanEmpNo,
            reason: reason || 'Late work requirement',
            device_info: device_info || 'Unknown'
        });

        await loginRequest.save();
        res.status(201).json({ message: 'Login request submitted successfully. Please wait for admin approval.' });
    } catch (error) {
        console.error('Login Request Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
const getMe = async (req, res) => {
    try {
        const employee = await Employee.findById(req.user.id).select('-password');
        if (!employee) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(employee);
    } catch (error) {
        console.error('Get Me Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { registerEmployee, loginEmployee, logoutEmployee, changePassword, requestLoginPermission, getMe };

