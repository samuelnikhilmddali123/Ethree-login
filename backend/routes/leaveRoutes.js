const express = require('express');
const router = express.Router();
const {
    applyLeave,
    getMyLeaves,
    getAllLeaves,
    updateLeaveStatus,
    grantLeaveByAdmin
} = require('../controllers/leaveController');
const { protect, admin } = require('../middleware/auth');

// Employee routes
router.post('/apply', protect, applyLeave);
router.get('/my-leaves', protect, getMyLeaves);

// Admin routes
router.get('/admin/all', protect, admin, getAllLeaves);
router.put('/admin/update/:id', protect, admin, updateLeaveStatus);
router.post('/admin/grant', protect, admin, grantLeaveByAdmin);

module.exports = router;
