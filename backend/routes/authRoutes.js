const express = require('express');
const router = express.Router();
const { registerEmployee, loginEmployee, logoutEmployee, changePassword, requestLoginPermission, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.get('/me', protect, getMe);
router.post('/register', registerEmployee);
router.post('/login', loginEmployee);
router.post('/login-request', requestLoginPermission);
router.post('/logout', protect, logoutEmployee);
router.put('/password', protect, changePassword);

module.exports = router;

