const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Settings = require('../models/Settings');

// @desc    Update employee heartbeat/presence
// @route   POST /api/utils/heartbeat
const heartbeat = async (req, res) => {
    // req.user contains { id, emp_no, role } from protect middleware
    const { emp_no } = req.user;
    const { is_on_wifi } = req.body;

    try {
        const now = new Date();
        const employee = await Employee.findOne({ emp_no });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const oldStatus = employee.presence_status;
        employee.last_seen = now;

        // Employee is "online" ONLY if they are sending heartbeats (active app)
        employee.presence_status = 'online';
        await employee.save();

        // Update Attendance Duration if on WiFi
        const attendance = await Attendance.findOne({
            emp_no,
            logout_time: null,
            session_status: 'Active'
        }).sort({ login_time: -1 });

        if (attendance) {
            const lastPing = attendance.last_ping || attendance.login_time;
            const diffMs = now - lastPing;

            // Track WiFi Status Changes in history
            const currentWifiStatus = is_on_wifi ? 'Connected' : 'Disconnected';
            const lastHistoryEntry = attendance.wifi_history?.[attendance.wifi_history.length - 1];

            if (!lastHistoryEntry || lastHistoryEntry.status !== currentWifiStatus) {
                attendance.wifi_history.push({
                    status: currentWifiStatus,
                    timestamp: now
                });
            }

            // Accumulate duration only if on WiFi
            // Interval constraint (e.g., 15s) to guard against device sleep jumps
            if (is_on_wifi && diffMs > 0 && diffMs <= 20000) {
                attendance.total_duration_ms = (attendance.total_duration_ms || 0) + diffMs;
            }

            attendance.last_ping = now;
            attendance.is_on_wifi = !!is_on_wifi;
            await attendance.save();
        }

        if (oldStatus !== employee.presence_status) {
            const io = req.app.get('io');
            if (io) {
                io.emit('employeeStatusUpdate', {
                    employeeId: emp_no,
                    status: 'online'
                });
            }
        }

        res.json({ success: true, presence_status: employee.presence_status });
    } catch (error) {
        console.error('[PRESENCE-ERROR] Heartbeat failed:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const checkNetworkStatus = async (req) => {
    try {
        const settings = await Settings.findOne();
        if (!settings) return true;

        const allowedSsid = settings.office_wifi_ssid;
        const allowedIp = settings.office_public_ip;
        const wifi_ssid = req.body.wifi_ssid || req.query.wifi_ssid;

        const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
        const isLocal = clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('localhost');

        if (isLocal) return true;

        if (wifi_ssid && allowedSsid) {
            return wifi_ssid.trim() === allowedSsid.trim();
        } else if (allowedIp && allowedIp.trim() !== '') {
            return clientIp === allowedIp.trim();
        }

        return true; 
    } catch (err) {
        console.error('[NETWORK-CHECK-ERROR]', err);
        return true;
    }
};

// @desc    Poll active network status
// @route   POST /api/utils/network-check
const networkCheck = async (req, res) => {
    const is_on_wifi = await checkNetworkStatus(req);
    res.json({ is_on_wifi });
};

module.exports = { heartbeat, networkCheck };
