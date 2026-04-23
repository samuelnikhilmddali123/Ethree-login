const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LoginRequest = require('../models/LoginRequest');
const Task = require('../models/Task');
const Settings = require('../models/Settings');
const bcrypt = require('bcryptjs');
const { getISTTime } = require('./utilsController');
const { exec } = require('child_process');

// AI Feature Vector Matcher (Euclidean Distance fallback for 128-d face embeddings)
const calculateFaceSimilarity = (descriptor1, descriptor2) => {
    try {
        const a1 = Array.isArray(descriptor1) ? descriptor1 : Object.values(descriptor1 || {});
        const a2 = Array.isArray(descriptor2) ? descriptor2 : Object.values(descriptor2 || {});

        if (a1.length === 0 || a2.length === 0) return 999;

        let sum = 0;
        const len = Math.min(a1.length, a2.length, 128);
        for (let i = 0; i < len; i++) {
            const val1 = Number(a1[i]) || 0;
            const val2 = Number(a2[i]) || 0;
            const diff = val1 - val2;
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    } catch (e) {
        console.error("AI Matcher Error:", e);
        return 999;
    }
};

// @desc    Get all employees
// @route   GET /api/admin/employees
const getEmployees = async (req, res) => {
    try {
        const istTime = getISTTime();
        const today = istTime.date;

        const employees = await Employee.find({});
        const sevenPMIST = istTime.sevenPM;
        const now = new Date();
        const isPastSevenPM = now >= sevenPMIST || istTime.hour >= 19;

        // Cleanup: If past 7pm, close any active today's sessions
        if (isPastSevenPM) {
            await Attendance.updateMany(
                { date: today, logout_time: null },
                {
                    $set: {
                        logout_time: sevenPMIST.toISOString(),
                        session_status: 'Auto Logout',
                        logout_reason: 'Office hours ended'
                    }
                }
            );
        }

        const activeAttendance = isPastSevenPM
            ? []
            : await Attendance.find({ date: today, logout_time: null });
        
        const activeSessionMap = activeAttendance.reduce((acc, a) => {
            acc[a.emp_no] = { is_on_wifi: a.is_on_wifi };
            return acc;
        }, {});

        const result = employees.map(e => ({
            id: e._id,
            emp_no: e.emp_no,
            name: e.name,
            full_name: e.full_name,
            profile_picture: e.profile_picture,
            email: e.email,
            role: e.role,
            status: activeSessionMap[e.emp_no] ? 'active' : 'inactive',
            presence_status: e.presence_status || 'offline',
            is_on_wifi: activeSessionMap[e.emp_no]?.is_on_wifi || false,
            is_face_enabled: e.is_face_enabled,
            has_face_descriptor: e.face_descriptor && e.face_descriptor.length > 0,
            is_wifi_login_enabled: e.is_wifi_login_enabled
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get daily reports
// @route   GET /api/admin/reports/daily
const getDailyReports = async (req, res) => {
    const { date } = req.query;
    const istTime = getISTTime();
    const filterDate = date || istTime.date;
    const isFilterToday = filterDate === istTime.date;

    const sevenPMIST = istTime.sevenPM;
    const now = new Date();
    const isPastSevenPM = now >= sevenPMIST || istTime.hour >= 19;

    try {
        // Silent cleanup: If it's past 7 PM, close any active sessions in the background
        if (isFilterToday && isPastSevenPM) {
            await Attendance.updateMany(
                { date: filterDate, logout_time: null },
                {
                    $set: {
                        logout_time: sevenPMIST.toISOString(),
                        session_status: 'Auto Logout',
                        logout_reason: 'Office hours ended'
                    }
                }
            );
        }

        const employees = await Employee.find({ role: 'employee' }).sort({ emp_no: 1 });
        const attendances = await Attendance.find({ date: filterDate });
        const tasksQuery = isFilterToday
            ? {
                $or: [
                    { due_date: filterDate },
                    { assigned_date: filterDate },
                    {
                        due_date: { $lt: filterDate },
                        status: { $in: ['pending', 'in_progress'] }
                    }
                ]
            }
            : {
                $or: [
                    { due_date: filterDate },
                    { assigned_date: filterDate }
                ]
            };
        const tasks = await Task.find(tasksQuery);

        const reports = employees.map(e => {
            const empAttendances = attendances.filter(a => a.emp_no === e.emp_no);
            const empTasks = tasks.filter(t => t.emp_no === e.emp_no);

            const t = empTasks[0] || {};
            const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB') : 'N/A';

            let totalMs = 0;
            const sessions = empAttendances.map(att => {
                let loginTime = new Date(att.login_time);
                let logoutTime = att.logout_time ? new Date(att.logout_time) : (isFilterToday && isPastSevenPM ? sevenPMIST : null);

                let durationMs = 0;
                if (loginTime && logoutTime) {
                    // Cap duration at 7 PM
                    const effectiveLogout = logoutTime > sevenPMIST && isFilterToday ? sevenPMIST : logoutTime;
                    durationMs = effectiveLogout - loginTime;
                    if (durationMs < 0) durationMs = 0;
                    totalMs += att.total_duration_ms || durationMs;
                } else if (loginTime && isFilterToday && !isPastSevenPM) {
                    // Active session, use accumulated duration so far
                    totalMs += att.total_duration_ms || (now - loginTime);
                }

                return {
                    login: formatTime(att.login_time),
                    logout: att.logout_time ? formatTime(att.logout_time) : (isFilterToday && isPastSevenPM ? formatTime(sevenPMIST) : 'N/A'),
                    is_active: !att.logout_time && !(isFilterToday && isPastSevenPM)
                };
            });

            let working_hours = 'N/A';
            let is_half_day = false;
            if (empAttendances.length > 0) {
                const hasActive = empAttendances.some(a => !a.logout_time && !(isFilterToday && isPastSevenPM));

                if (totalMs > 0 || !hasActive) {
                    const hrs = Math.floor(totalMs / 3600000);
                    const mins = Math.floor((totalMs % 3600000) / 60000);
                    is_half_day = totalMs > 0 && totalMs < 5 * 3600000;

                    working_hours = `${hrs}:${mins.toString().padStart(2, '0')}:00`;
                    if (is_half_day) working_hours += ' (Half Day)';
                    if (hasActive) working_hours += ' (Active)';
                } else if (hasActive) {
                    working_hours = 'Running';
                } else {
                    working_hours = '0:00:00';
                }
            }
            // ... rest of mapping

            return {
                emp_no: e.emp_no,
                name: e.name,
                full_name: e.full_name,
                profile_picture: e.profile_picture,
                login_time: sessions.length > 0 ? sessions[0].login : 'N/A',
                logout_time: sessions.length > 0 ? sessions[sessions.length - 1].logout : 'N/A',
                sessions, // Added sessions list
                title: t.title || 'No Task',
                status: t.status || 'N/A',
                completion_percentage: t.completion_percentage || 0,
                assigned_date: t.assigned_date || 'N/A',
                due_date: t.due_date || 'N/A',
                completed_date: t.completed_date || 'N/A',
                is_self_assigned: t.is_self_assigned || false,
                presence_status: e.presence_status,
                is_on_wifi: empAttendances.some(a => a.logout_time === null && a.is_on_wifi),
                working_hours,
                is_half_day // Added half-day flag
            };
        });

        res.json(reports);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get analytics
// @route   GET /api/admin/analytics
const getAnalytics = async (req, res) => {
    try {
        const tasks = await Task.find({});
        const attendances = await Attendance.find({ logout_time: { $ne: null } });

        const avgCompletion = tasks.length > 0
            ? tasks.reduce((acc, t) => acc + t.completion_percentage, 0) / tasks.length
            : 0;

        const empWorkingHours = {};
        attendances.forEach(a => {
            const diffHrs = (new Date(a.logout_time) - new Date(a.login_time)) / 3600000;
            empWorkingHours[a.emp_no] = (empWorkingHours[a.emp_no] || 0) + diffHrs;
        });

        const workingHoursArray = Object.keys(empWorkingHours).map(emp_no => ({
            emp_no,
            total_hours: empWorkingHours[emp_no].toFixed(2)
        }));

        const statusCounts = {};
        tasks.forEach(t => {
            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        });

        const taskStats = Object.keys(statusCounts).map(status => ({
            status,
            count: statusCounts[status]
        }));

        res.json({
            avgCompletion,
            workingHours: workingHoursArray,
            taskStats
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create employee (Admin only)
const createEmployee = async (req, res) => {
    const { emp_no, name, full_name, email, password, role, face_descriptor, is_face_enabled, is_wifi_login_enabled } = req.body;

    try {
        if (!emp_no || !name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingEmp = await Employee.findOne({ $or: [{ emp_no }, { email }] });
        if (existingEmp) {
            return res.status(400).json({ message: 'Employee ID or email already exists' });
        }

        // Face Uniqueness Check
        if (face_descriptor && Object.keys(face_descriptor).length > 0) {
            const allUsers = await Employee.find({});
            const allFaceUsers = allUsers.filter(u => u.face_descriptor && u.face_descriptor.length > 0);
            
            for (const existingUser of allFaceUsers) {
                const distance = calculateFaceSimilarity(face_descriptor, existingUser.face_descriptor);
                if (distance < 0.60) {
                    return res.status(400).json({ 
                        message: `Face Uniqueness Error: This face is already enrolled under employee "${existingUser.full_name || existingUser.name}" (ID: ${existingUser.emp_no}).` 
                    });
                }
            }
        }

        const employee = new Employee({ 
            emp_no, 
            name, 
            full_name: full_name || '', 
            email, 
            password, 
            role: role || 'employee',
            face_descriptor: Array.isArray(face_descriptor) ? face_descriptor : (face_descriptor && Object.keys(face_descriptor).length > 0 ? Object.values(face_descriptor) : []),
            is_face_enabled: is_face_enabled || false,
            is_wifi_login_enabled: is_wifi_login_enabled !== undefined ? is_wifi_login_enabled : true
        });
        await employee.save();

        res.status(201).json({ message: 'Employee created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Assign task to employee (Admin only)
const assignTask = async (req, res) => {
    const { emp_no, title, description, task_type, due_date } = req.body;

    try {
        if (!emp_no || !title || !task_type) {
            return res.status(400).json({ message: 'Required fields missing' });
        }

        const istTime = getISTTime();
        const today = istTime.date;
        const finalDueDate = task_type === 'daily' ? today : due_date;

        if (task_type === 'custom' && finalDueDate < today) {
            return res.status(400).json({ message: 'Due date cannot be in the past' });
        }

        const employee = await Employee.findOne({ emp_no });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const task = new Task({
            emp_no,
            task_type,
            assigned_date: today,
            due_date: finalDueDate,
            title,
            description: description || '',
            completion_percentage: 0,
            status: 'pending'
        });

        await task.save();
        res.status(201).json({ message: 'Task assigned successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all tasks assigned by admin
const getAdminTasks = async (req, res) => {
    try {
        const { date } = req.query;
        let query = {};
        if (date) {
            const isToday = (date === getISTTime().date);
            query = {
                $or: [
                    { due_date: date },
                    { assigned_date: date },
                    { completed_date: date }
                ]
            };
            if (isToday) {
                query.$or.push({
                    due_date: { $lt: date },
                    status: { $in: ['pending', 'in_progress'] }
                });
            }
        }

        const tasks = await Task.find(query).sort({ createdAt: -1 });
        const employees = await Employee.find({});
        const empMap = employees.reduce((acc, e) => {
            acc[e.emp_no] = {
                name: e.name,
                full_name: e.full_name,
                profile_picture: e.profile_picture
            };
            return acc;
        }, {});

        const result = tasks.map(t => {
            const empInfo = empMap[t.emp_no] || {};
            return {
                id: t._id,
                emp_no: t.emp_no,
                emp_name: empInfo.full_name || empInfo.name || 'Unknown',
                profile_picture: empInfo.profile_picture,
                task_type: t.task_type,
                title: t.title,
                description: t.description,
                status: t.status,
                completion_percentage: t.completion_percentage,
                reason: t.reason,
                assigned_date: t.assigned_date,
                due_date: t.due_date,
                completed_date: t.completed_date,
                is_self_assigned: t.is_self_assigned,
                created_at: t.createdAt
            };
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Admin responds to employee's decline (approve or reject)
const respondToDecline = async (req, res) => {
    const { id } = req.params;
    const { action, note } = req.body;

    try {
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (action === 'approve') {
            await Task.findByIdAndDelete(id);
            return res.json({ message: 'Task removed successfully' });
        } else if (action === 'reject') {
            task.status = 'pending';
            task.admin_note = note || 'Decline rejected by admin. Please complete the task.';
            // Keep the employee's original reason in 'reason' but clear it from being "declined"
            await task.save();
            return res.json({ message: 'Decline rejected. Task sent back to employee.', task });
        } else {
            return res.status(400).json({ message: 'Invalid action. Use approve or reject.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete employee (Admin only)
const deleteEmployee = async (req, res) => {
    const { emp_no } = req.params;
    try {
        const employee = await Employee.findOne({ emp_no });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        if (employee.role === 'admin') {
            return res.status(403).json({ message: 'Cannot delete admin accounts' });
        }

        await Employee.deleteOne({ emp_no });
        // Optionally delete tasks and attendance too
        await Task.deleteMany({ emp_no });
        await Attendance.deleteMany({ emp_no });

        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete task (Admin only)
const deleteTask = async (req, res) => {
    const { id } = req.params;
    try {
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        await Task.findByIdAndDelete(id);
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all login requests (Admin only)
const getLoginRequests = async (req, res) => {
    try {
        const LoginRequest = require('../models/LoginRequest');
        const employees = await Employee.find({});
        const empMap = employees.reduce((acc, e) => {
            acc[e.emp_no] = {
                name: e.name,
                full_name: e.full_name,
                profile_picture: e.profile_picture
            };
            return acc;
        }, {});

        const requests = await LoginRequest.find({}).sort({ createdAt: -1 });

        const result = requests.map(r => ({
            id: r._id,
            emp_no: r.emp_no,
            emp_name: empMap[r.emp_no]?.full_name || empMap[r.emp_no]?.name || 'Unknown',
            request_time: r.request_time,
            reason: r.reason,
            status: r.status,
            device_info: r.device_info,
            approved_by: r.approved_by,
            approval_time: r.approval_time,
            expiry_time: r.expiry_time
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Approve or reject login request (Admin only)
const handleLoginRequest = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'Approved' or 'Rejected'
    const admin_emp_no = req.user.emp_no;

    try {
        const LoginRequest = require('../models/LoginRequest');
        const request = await LoginRequest.findById(id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (action === 'Approved') {
            request.status = 'Approved';
            request.approved_by = admin_emp_no;
            request.approval_time = new Date();
            // Approval valid for 1 hour
            request.expiry_time = new Date(Date.now() + 60 * 60 * 1000);
        } else if (action === 'Rejected') {
            request.status = 'Rejected';
            request.approved_by = admin_emp_no;
            request.approval_time = new Date();
        } else {
            return res.status(400).json({ message: 'Invalid action' });
        }

        await request.save();

        // Notify employee via socket
        const io = req.app.get('io');
        if (io) {
            io.to(request.emp_no).emit('login_request_result', {
                status: action,
                message: action === 'Approved' ? 'Your login request has been approved.' : 'Your login request has been rejected.'
            });
        }

        res.json({ message: `Login request ${action.toLowerCase()} successfully`, request });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Force logout all active employees
const forceLogoutAll = async (req, res) => {
    try {
        const Session = require('../models/Session');
        const istTime = getISTTime();
        const now = istTime.datetime;

        // 1. Find and close ALL active attendance records (even if from previous days)
        const activeRecords = await Attendance.find({
            logout_time: null
        });

        for (const record of activeRecords) {
            // If it's today's record and it's past 7 PM, use 7 PM as logout time
            // Otherwise use current IST time
            record.logout_time = (record.date === istTime.date && new Date() > istTime.sevenPM)
                ? istTime.sevenPM.toISOString()
                : now;
            record.session_status = 'Forced Logout';
            record.logout_reason = 'Terminated by Admin';
            await record.save();
        }

        // 2. Deactivate all active sessions in the database
        await Session.updateMany({ is_active: true }, { is_active: false });

        // 3. Notify all employees via socket
        const io = req.app.get('io');
        if (io) {
            io.emit('force_logout', {
                message: 'Administrator has ended all active working sessions.'
            });
        }

        res.json({ message: 'All active sessions have been terminated successfully.' });
    } catch (error) {
        console.error('Force logout all failed:', error);
        res.status(500).json({ message: 'Server error while terminating sessions' });
    }
};

// @desc    Force logout a specific employee
const forceLogoutEmployee = async (req, res) => {
    const { emp_no } = req.params;
    try {
        const Session = require('../models/Session');
        const istTime = getISTTime();
        const now = istTime.datetime;
        const today = istTime.date;

        // 1. Find and close any active attendance record for this employee (any date)
        const record = await Attendance.findOne({
            emp_no,
            logout_time: null
        }).sort({ login_time: -1 });

        if (record) {
            const isToday = record.date === istTime.date;
            const pastSeven = new Date() > istTime.sevenPM;

            record.logout_time = (isToday && pastSeven) ? istTime.sevenPM.toISOString() : now;
            record.session_status = 'Forced Logout';
            record.logout_reason = 'Terminated by Admin';
            await record.save();
        }

        // 2. Deactivate active sessions for this employee
        await Session.updateMany({ emp_no, is_active: true }, { is_active: false });

        // 3. Notify the employee via specific socket room
        const io = req.app.get('io');
        if (io) {
            io.to(emp_no).emit('force_logout', {
                message: 'Administrator has ended your active working session.'
            });
        }

        res.json({ success: true, message: `Session for employee #${emp_no} has been terminated.` });
    } catch (error) {
        console.error(`Force logout for ${emp_no} failed:`, error);
        res.status(500).json({ message: 'Server error while terminating session' });
    }
};

// @desc    Get monthly attendance reports
// @route   GET /api/admin/reports/monthly
const getMonthlyAttendance = async (req, res) => {
    try {
        const { date } = req.query; // Expecting YYYY-MM format
        if (!date) {
            return res.status(400).json({ message: 'Month and year are required (YYYY-MM)' });
        }

        const [yearStr, monthStr] = date.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr) - 1; // 0-indexed month for Date

        // Find all active employees
        const employees = await Employee.find({ role: 'employee' }).sort({ emp_no: 1 });

        // Find all attendances for the given month
        // We can match date string starting with 'YYYY-MM' since date is stored as YYYY-MM-DD
        const monthPrefix = `${yearStr}-${monthStr}`;
        const attendances = await Attendance.find({ date: { $regex: `^${monthPrefix}` } });

        // Number of days in the month
        const numDays = new Date(year, month + 1, 0).getDate();

        // Today's date to avoid marking future dates as Absent
        const istTime = getISTTime();
        const todayDateStr = istTime.date; // YYYY-MM-DD
        const currentYearMonth = todayDateStr.substring(0, 7);
        const currentDay = parseInt(todayDateStr.substring(8, 10));

        const isCurrentMonth = (date === currentYearMonth);
        const isFutureMonth = (date > currentYearMonth);

        const reports = employees.map(e => {
            const empAttendances = attendances.filter(a => a.emp_no === e.emp_no);

            const attendanceRecord = {};
            let presentCount = 0;
            let absentCount = 0;
            let halfDayCount = 0;

            for (let day = 1; day <= numDays; day++) {
                const dayStr = day.toString().padStart(2, '0');
                const currentDateStr = `${monthPrefix}-${dayStr}`;

                // Determine if date is in the future
                let isFuture = false;
                if (isFutureMonth) {
                    isFuture = true;
                } else if (isCurrentMonth && day > currentDay) {
                    isFuture = true;
                }

                if (isFuture) {
                    attendanceRecord[day] = 'N/A';
                    continue;
                }

                // Get all sessions for this day
                const daySessions = empAttendances.filter(a => a.date === currentDateStr);

                // If there is ANY record for this day with a manual_status, use it immediately
                const manualRecord = daySessions.find(a => a.manual_status !== null);
                if (manualRecord) {
                    attendanceRecord[day] = manualRecord.manual_status;

                    if (manualRecord.manual_status === 'P') presentCount++;
                    else if (manualRecord.manual_status === 'A') absentCount++;
                    else if (manualRecord.manual_status === 'H') halfDayCount++;

                    continue; // Skip the time calculation below
                }

                if (daySessions.length === 0) {
                    // Check if it's a weekend (Sunday)
                    // Date.getDay() 0 is Sunday
                    const dateObj = new Date(year, month, day);
                    if (dateObj.getDay() === 0) {
                        attendanceRecord[day] = 'W'; // Weekend
                    } else {
                        attendanceRecord[day] = 'A'; // Absent
                        absentCount++;
                    }
                } else {
                    // Calculate total duration for the day
                    let totalMs = 0;
                    daySessions.forEach(session => {
                        let loginTime = new Date(session.login_time);
                        // If logout is missing, check if it's today and past 7pm
                        let logoutTime = null;
                        if (session.logout_time) {
                            logoutTime = new Date(session.logout_time);
                        } else if (currentDateStr === todayDateStr && (new Date() > istTime.sevenPM || istTime.hour >= 19)) {
                            logoutTime = istTime.sevenPM;
                        }

                        if (loginTime && logoutTime) {
                            const effectiveLogout = (logoutTime > istTime.sevenPM && currentDateStr === todayDateStr) ? istTime.sevenPM : logoutTime;
                            let durationMs = effectiveLogout - loginTime;
                            if (durationMs > 0) totalMs += durationMs;
                        }
                    });

                    // Logic from existing half-day requirement: < 5 hours is Half Day
                    if (totalMs > 0 && totalMs < 5 * 3600000) {
                        attendanceRecord[day] = 'H'; // Half Day
                        halfDayCount++;
                    } else if (totalMs >= 5 * 3600000 || daySessions.some(s => !s.logout_time)) {
                        attendanceRecord[day] = 'P'; // Present
                        presentCount++;
                    } else {
                        attendanceRecord[day] = 'A'; // Absent
                        absentCount++;
                    }
                }
            }

            return {
                emp_no: e.emp_no,
                name: e.name,
                full_name: e.full_name,
                attendance: attendanceRecord,
                summary: {
                    present: presentCount,
                    absent: absentCount,
                    halfDay: halfDayCount
                }
            };
        });

        res.json(reports);
    } catch (error) {
        console.error('Error fetching monthly attendance:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update a specific cell for monthly attendance (Google Sheets style)
// @route   PUT /api/admin/reports/monthly
const updateMonthlyAttendance = async (req, res) => {
    try {
        const { emp_no, date, status } = req.body;

        if (!emp_no || !date || !status) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Validate status enum
        if (!['P', 'A', 'H', 'Holiday', null].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const employee = await Employee.findOne({ emp_no });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Find existing record(s) for this employee on this date
        // Since an employee might have multiple sessions in a day, we update the first one or create a new 'override' record
        let attendances = await Attendance.find({ emp_no, date }).sort({ created_at: 1 });

        if (attendances.length > 0) {
            // Update the manual_status of the first record found for that day
            const recordToUpdate = attendances[0];
            recordToUpdate.manual_status = status;
            await recordToUpdate.save();
        } else {
            // No attendance record exists for this day yet. Need to create a placeholder record.
            // Create a record with a dummy login_time (e.g. 00:00:00) so we have a physical row to store manual_status
            const dummyLoginTime = new Date(`${date}T00:00:00.000Z`);

            const newRecord = new Attendance({
                emp_no,
                date,
                login_time: dummyLoginTime,
                logout_time: dummyLoginTime, // instantly closed
                session_status: 'Completed',
                logout_reason: 'System Override / Empty Day',
                manual_status: status
            });
            await newRecord.save();
        }

        res.json({ success: true, message: 'Attendance updated successfully' });
    } catch (error) {
        console.error('Error updating monthly attendance:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update employee details (Admin only)
const updateEmployee = async (req, res) => {
    const { emp_no } = req.params;
    const { name, full_name, email, role, password, face_descriptor, is_face_enabled, is_wifi_login_enabled } = req.body;

    try {
        const employee = await Employee.findOne({ emp_no });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        if (name) employee.name = name;
        if (full_name) employee.full_name = full_name;
        if (email) employee.email = email;
        if (role) employee.role = role;
        if (password && password.trim() !== '') {
            employee.password = password;
        }
        if (face_descriptor !== undefined) {
            if (Object.keys(face_descriptor).length === 0) {
                employee.face_descriptor = [];
            } else {
                // Uniqueness check for face update
                const allUsers = await Employee.find({ emp_no: { $ne: emp_no } });
                const otherFaceUsers = allUsers.filter(u => u.face_descriptor && u.face_descriptor.length > 0);
                
                for (const other of otherFaceUsers) {
                    const dist = calculateFaceSimilarity(face_descriptor, other.face_descriptor);
                    if (dist < 0.60) {
                        return res.status(400).json({ message: `Face match found with ${other.full_name || other.name} (ID: ${other.emp_no})` });
                    }
                }
                // Handle object to array conversion just in case
                employee.face_descriptor = Array.isArray(face_descriptor) ? face_descriptor : Object.values(face_descriptor);
            }
        }
        if (is_face_enabled !== undefined) employee.is_face_enabled = is_face_enabled;
        if (is_wifi_login_enabled !== undefined) employee.is_wifi_login_enabled = is_wifi_login_enabled;

        await employee.save();
        res.json({ message: 'Employee updated successfully', employee });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get application settings
// @route   GET /api/admin/settings
const getSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne({});
        const currentIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Return empty settings if none exist, plus the current IP hint
        res.json({
            ...(settings ? settings.toObject() : {}),
            current_ip: currentIp
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update application settings
// @route   POST /api/admin/settings
const updateSettings = async (req, res) => {
    try {
        const { office_wifi_ssid, office_public_ip } = req.body;

        let settings = await Settings.findOne({});
        if (!settings) {
            settings = new Settings({});
        }

        if (office_wifi_ssid !== undefined) settings.office_wifi_ssid = office_wifi_ssid;
        if (office_public_ip !== undefined) settings.office_public_ip = office_public_ip;

        await settings.save();
        res.json({ message: 'Settings updated successfully', settings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Detect current server Wi-Fi SSID (PowerShell fallback)
// @route   GET /api/admin/detect-wifi
const detectWifiSettings = async (req, res) => {
    try {
        // Use PowerShell to get the connection profile name (which is usually the SSID)
        exec('powershell -Command "(Get-NetConnectionProfile -InterfaceAlias Wi-Fi).Name"', (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return res.status(500).json({ message: 'Failed to detect Wi-Fi on server.' });
            }
            
            const ssid = stdout.trim();
            if (ssid) {
                return res.json({ ssid });
            }
            
            res.status(404).json({ message: 'No active Wi-Fi connection found on server.' });
        });
    } catch (error) {
        console.error('Error detecting wifi:', error);
        res.status(500).json({ message: 'Server error during Wi-Fi detection' });
    }
};

module.exports = {
    getEmployees,
    getDailyReports,
    getAnalytics,
    createEmployee,
    updateEmployee,
    assignTask,
    getAdminTasks,
    respondToDecline,
    deleteEmployee,
    deleteTask,
    getLoginRequests,
    handleLoginRequest,
    forceLogoutAll,
    forceLogoutEmployee,
    getSettings,
    updateSettings,
    detectWifiSettings,
    getMonthlyAttendance,
    updateMonthlyAttendance
};
