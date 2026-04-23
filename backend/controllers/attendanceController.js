const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const { getISTTime } = require('./utilsController');

// Helper to format attendance records
const formatAttendanceRecords = (attendanceRows) => {
    const istTime = getISTTime();
    const sevenPMIST = istTime.sevenPM;
    const now = new Date();

    return attendanceRows.map(record => {
        let duration = null;
        const login = new Date(record.login_time);

        // Use logout_time if available, otherwise if it's past 7pm use 7pm, otherwise use current time
        let logout = record.logout_time ? new Date(record.logout_time) : (now > sevenPMIST ? sevenPMIST : null);

        if (login && logout) {
            try {
                if (!isNaN(login.getTime()) && !isNaN(logout.getTime())) {
                    // Cap end time at 7 PM IST
                    const effectiveLogout = logout > sevenPMIST ? sevenPMIST : logout;
                    const diffMs = effectiveLogout - login;
                    if (diffMs > 0) {
                        const diffHrs = Math.floor(diffMs / 3600000);
                        const diffMins = Math.floor((diffMs % 3600000) / 60000);
                        duration = `${diffHrs}h ${diffMins}m`;
                    } else {
                        duration = "0h 0m";
                    }
                }
            } catch (e) {
                console.error('Duration calculation error:', e);
            }
        }
        return {
            id: record._id,
            emp_no: record.emp_no,
            login_time: record.login_time,
            logout_time: record.logout_time,
            date: record.date,
            duration: duration || (record.login_time && !record.logout_time && now < sevenPMIST ? "Running" : (duration || "N/A")),
            session_status: record.session_status || (record.logout_time ? 'Completed' : (now > sevenPMIST ? 'Frozen' : 'Active')),
            logout_reason: record.logout_reason,
            device_info: record.device_info
        };
    });
};

// @desc    Get attendance history for logged-in employee
// @route   GET /api/attendance/history
const getAttendanceHistory = async (req, res) => {
    const { emp_no } = req.user;

    try {
        const attendanceRows = await Attendance.find({ emp_no }).sort({ date: -1, login_time: -1 });
        const taskRows = await Task.find({ emp_no }).sort({ assigned_date: -1 });

        const records = formatAttendanceRecords(attendanceRows);

        res.json({ attendance: records, tasks: taskRows });
    } catch (error) {
        console.error('Error fetching attendance history:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get attendance history for any employee (Admin only)
// @route   GET /api/attendance/admin/history/:emp_no
const getEmployeeAttendanceForAdmin = async (req, res) => {
    const { emp_no } = req.params;

    try {
        const attendanceRows = await Attendance.find({ emp_no }).sort({ date: -1, login_time: -1 });
        const taskRows = await Task.find({ emp_no }).sort({ assigned_date: -1 });

        const records = formatAttendanceRecords(attendanceRows);

        res.json({ attendance: records, tasks: taskRows });
    } catch (error) {
        console.error('Error fetching employee attendance history for admin:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get total work duration for today (in milliseconds)
// @route   GET /api/attendance/duration
const getWorkDuration = async (req, res) => {
    const { emp_no } = req.user;

    try {
        const istTime = getISTTime();
        const today = istTime.date;
        const sevenPMIST = istTime.sevenPM;

        // Find all attendance records for today
        const attendanceRows = await Attendance.find({
            emp_no,
            date: today
        }).sort({ login_time: 1 });

        if (attendanceRows.length === 0) {
            return res.json({ totalMilliseconds: 0 });
        }

        const now = new Date();
        const effectiveNow = now > sevenPMIST ? sevenPMIST : now;

        const intervals = attendanceRows.map(record => {
            const start = new Date(record.login_time).getTime();
            let end = record.logout_time ? new Date(record.logout_time).getTime() : effectiveNow.getTime();

            // Cap start time if it was somehow after 7 PM (shouldn't happen but for safety)
            const effectiveStart = Math.min(start, sevenPMIST.getTime());
            // Cap end time at 7 PM IST
            const effectiveEnd = Math.min(end, sevenPMIST.getTime());

            return { start: effectiveStart, end: effectiveEnd };
        }).filter(interval => !isNaN(interval.start) && !isNaN(interval.end));

        if (intervals.length === 0) {
            return res.json({ totalMilliseconds: 0 });
        }

        // Merge overlapping intervals
        const mergedIntervals = [];
        let currentInterval = intervals[0];

        for (let i = 1; i < intervals.length; i++) {
            const nextInterval = intervals[i];

            if (nextInterval.start <= currentInterval.end) {
                // Overlap: merge by extending the end time if necessary
                currentInterval.end = Math.max(currentInterval.end, nextInterval.end);
            } else {
                // No overlap: push current and start a new one
                mergedIntervals.push(currentInterval);
                currentInterval = nextInterval;
            }
        }
        mergedIntervals.push(currentInterval);

        // Sum durations of merged intervals
        let totalMilliseconds = 0;
        mergedIntervals.forEach(interval => {
            const diff = interval.end - interval.start;
            if (diff > 0) {
                totalMilliseconds += diff;
            }
        });

        // Sort by login_time to be absolutely sure attendanceRows[0] is the earliest
        attendanceRows.sort((a, b) => new Date(a.login_time) - new Date(b.login_time));

        res.json({
            totalMilliseconds,
            firstLoginTime: attendanceRows[0].login_time
        });
    } catch (error) {
        console.error('Error fetching work duration:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getAttendanceHistory, getEmployeeAttendanceForAdmin, getWorkDuration };
