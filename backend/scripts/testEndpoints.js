require('dotenv').config();
const pool = require('../config/db');

async function test() {
    const filterDate = '2026-02-18';
    try {
        // Test getDailyReports query
        const query = `
      SELECT 
        e.emp_no, e.name, 
        COALESCE(DATE_FORMAT(a.login_time, '%H:%i:%s'), 'N/A') as login_time, 
        COALESCE(DATE_FORMAT(a.logout_time, '%H:%i:%s'), 'N/A') as logout_time, 
        COALESCE(t.title, 'No Task') as title, 
        COALESCE(t.status, 'N/A') as status, 
        COALESCE(t.completion_percentage, 0) as completion_percentage,
        COALESCE(DATE_FORMAT(t.assigned_date, '%Y-%m-%d'), 'N/A') as assigned_date,
        COALESCE(DATE_FORMAT(t.due_date, '%Y-%m-%d'), 'N/A') as due_date,
        COALESCE(DATE_FORMAT(t.completed_date, '%Y-%m-%d'), 'N/A') as completed_date,
        CASE 
          WHEN a.logout_time IS NOT NULL THEN TIMEDIFF(a.logout_time, a.login_time)
          ELSE 'Running'
        END as working_hours
      FROM employees e
      LEFT JOIN attendance a ON e.emp_no = a.emp_no AND a.date = ?
      LEFT JOIN tasks t ON e.emp_no = t.emp_no AND (t.due_date = ? OR t.assigned_date = ?)
      WHERE e.role = 'employee'
      ORDER BY e.emp_no ASC
    `;
        const [reports] = await pool.execute(query, [filterDate, filterDate, filterDate]);
        console.log('getDailyReports OK:', reports.length, 'rows');
    } catch (e) {
        console.error('getDailyReports ERROR:', e.message);
    }

    // Test getAnalytics
    try {
        const [avgCompletion] = await pool.execute('SELECT AVG(completion_percentage) as avg_completion FROM tasks');
        console.log('getAnalytics OK:', avgCompletion[0]);
    } catch (e) {
        console.error('getAnalytics ERROR:', e.message);
    }

    // Test getEmployees
    try {
        const today = '2026-02-18';
        const query = `
            SELECT e.id, e.emp_no, e.name, e.email, e.role,
                CASE 
                    WHEN a.login_time IS NOT NULL AND a.logout_time IS NULL THEN 'active'
                    ELSE 'inactive'
                END as status
            FROM employees e
            LEFT JOIN attendance a ON e.emp_no = a.emp_no AND a.date = ?
        `;
        const [employees] = await pool.execute(query, [today]);
        console.log('getEmployees OK:', employees.length, 'rows');
    } catch (e) {
        console.error('getEmployees ERROR:', e.message);
    }

    process.exit(0);
}

test();
