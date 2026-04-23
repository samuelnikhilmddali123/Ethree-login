require('dotenv').config();
const pool = require('../config/db');
const { getISTTime } = require('../controllers/utilsController');

async function test() {
    try {
        const today = getISTTime().date;
        console.log('Today:', today);

        const query = `
            SELECT 
                id, emp_no, assigned_date, due_date, completed_date, title,
                completion_percentage, status, reason, created_at, updated_at,
                CASE 
                    WHEN status = 'completed' THEN 'completed'
                    WHEN due_date < ? AND status != 'completed' THEN 'overdue'
                    WHEN completion_percentage > 0 AND status != 'completed' THEN 'in_progress'
                    ELSE 'pending'
                END as calculated_status
            FROM tasks
            WHERE emp_no = ?
            ORDER BY due_date ASC
        `;

        const [tasks] = await pool.execute(query, [today, 'EMP001']);
        console.log('Tasks fetched:', tasks.length);
        console.log(JSON.stringify(tasks, null, 2));
        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

test();
