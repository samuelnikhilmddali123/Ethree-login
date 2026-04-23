const cron = require('node-cron');
const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');
const Session = require('./models/Session');
const { getISTTime } = require('./controllers/utilsController');

const initScheduler = (io) => {
    // Run daily at 7:00 PM IST (13:30 UTC)
    cron.schedule('30 13 * * *', async () => {
        console.log('[SCHEDULER] Running daily 7 PM IST auto-logout...');
        try {
            const istTime = getISTTime();
            const nowStr = istTime.datetime;
            const attendees = await Attendance.find({ logout_time: null, session_status: 'Active' });

            for (const record of attendees) {
                const employee = await Employee.findOne({ emp_no: record.emp_no });
                if (employee && employee.role === 'employee') {
                    record.logout_time = nowStr;
                    record.session_status = 'Auto Logout';
                    record.logout_reason = 'Office hours ended';
                    await record.save();

                    await Session.updateMany({ emp_no: employee.emp_no, is_active: true }, { is_active: false });
                    if (io) io.to(employee.emp_no).emit('force_logout', { message: 'Office hours ended.' });
                }
            }
        } catch (error) { console.error('[SCHEDULER] Auto-logout failed:', error); }
    });

    // Enterprise Presence Tracking: Auto-Offline every 30 seconds
    setInterval(async () => {
        try {
            // If no heartbeat for 60 seconds, mark as offline
            const timeout = new Date(Date.now() - 60 * 1000);
            const timedOutEmployees = await Employee.find({
                presence_status: 'online',
                last_seen: { $lt: timeout }
            });

            for (const emp of timedOutEmployees) {
                emp.presence_status = 'offline';
                await emp.save();
                console.log(`[PRESENCE] ${emp.emp_no} timed out -> OFFLINE`);
                if (io) io.emit('employeeStatusUpdate', { employeeId: emp.emp_no, status: 'offline' });
            }
        } catch (err) { console.error('[PRESENCE-ERROR] Job failed:', err); }
    }, 30000);

    console.log('[SCHEDULER] Scheduler initialized (Presence Tracking Active)');
};

module.exports = initScheduler;
