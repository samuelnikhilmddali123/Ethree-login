const express = require('express');
const router = express.Router();
const {
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
    getMonthlyAttendance,
    updateMonthlyAttendance,
    getSettings,
    updateSettings,
    detectWifiSettings,
    getEmployeesStatus,
    getProxyAttempts,
    deleteProxyAttempt,
    clearProxyAttempts
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/auth');

router.get('/employees', protect, admin, getEmployees);
router.get('/employees/status', protect, admin, getEmployeesStatus);
router.post('/employees', protect, admin, createEmployee);
router.put('/employees/:emp_no', protect, admin, updateEmployee);
router.delete('/employees/:emp_no', protect, admin, deleteEmployee);
router.get('/reports/daily', protect, admin, getDailyReports);
router.get('/reports/monthly', protect, admin, getMonthlyAttendance);
router.put('/reports/monthly', protect, admin, updateMonthlyAttendance);
router.get('/analytics', protect, admin, getAnalytics);
router.post('/tasks/assign', protect, admin, assignTask);
router.get('/tasks', protect, admin, getAdminTasks);
router.post('/tasks/respond/:id', protect, admin, respondToDecline);
router.delete('/tasks/:id', protect, admin, deleteTask);

router.get('/login-requests', protect, admin, getLoginRequests);
router.post('/handle-login-request/:id', protect, admin, handleLoginRequest);
router.post('/force-logout-all', protect, admin, forceLogoutAll);
router.post('/force-logout/:emp_no', protect, admin, forceLogoutEmployee);
router.get('/settings', protect, admin, getSettings);
router.post('/settings', protect, admin, updateSettings);
router.get('/detect-wifi', protect, admin, detectWifiSettings);

router.get('/proxy-attempts', protect, admin, getProxyAttempts);
router.delete('/proxy-attempts/:id', protect, admin, deleteProxyAttempt);
router.delete('/proxy-attempts', protect, admin, clearProxyAttempts);


module.exports = router;
