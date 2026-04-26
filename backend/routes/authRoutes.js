const express = require('express');
const router = express.Router();
const { registerEmployee, loginEmployee, logoutEmployee, changePassword, requestLoginPermission, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile details
 *       401:
 *         description: Not authorized
 */
router.get('/me', protect, getMe);
router.post('/register', registerEmployee);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login employee
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emp_no
 *               - password
 *             properties:
 *               emp_no:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginEmployee);
router.post('/login-request', requestLoginPermission);
router.post('/logout', protect, logoutEmployee);
router.put('/password', protect, changePassword);

module.exports = router;

