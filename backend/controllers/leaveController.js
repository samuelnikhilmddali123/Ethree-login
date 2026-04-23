const Leave = require('../models/Leave');
const Employee = require('../models/Employee');

// @desc    Apply for leave
// @route   POST /api/leaves/apply
const applyLeave = async (req, res) => {
    try {
        const { type, start_date, end_date, reason } = req.body;
        const { emp_no } = req.user;

        if (!type || !start_date || !reason) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        if (type === 'multiple' && !end_date) {
            return res.status(400).json({ message: 'End date is required for multiple days leave' });
        }

        const newLeave = new Leave({
            emp_no,
            type,
            start_date,
            end_date: type === 'single' ? start_date : end_date,
            reason,
            status: 'pending',
            applied_by: 'employee'
        });

        await newLeave.save();
        res.status(201).json({ message: 'Leave application submitted successfully', leave: newLeave });
    } catch (error) {
        console.error('Error applying for leave:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get leave history for logged-in employee
// @route   GET /api/leaves/my-leaves
const getMyLeaves = async (req, res) => {
    try {
        const { emp_no } = req.user;
        const leaves = await Leave.find({ emp_no }).sort({ start_date: -1 });
        res.json(leaves);
    } catch (error) {
        console.error('Error fetching my leaves:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all leave requests (Admin only)
// @route   GET /api/leaves/admin/all
const getAllLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find().sort({ createdAt: -1 });

        // Populate employee names manually or via populate if ref is set up correctly
        // Since we have emp_no as String, we might need to fetch employees separately or use aggregation
        const leavesWithDetails = await Promise.all(leaves.map(async (leave) => {
            const employee = await Employee.findOne({ emp_no: leave.emp_no }).select('name');
            return {
                ...leave._doc,
                employeeName: employee ? employee.name : 'Unknown'
            };
        }));

        res.json(leavesWithDetails);
    } catch (error) {
        console.error('Error fetching all leaves:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update leave status (Admin only)
// @route   PUT /api/leaves/admin/update/:id
const updateLeaveStatus = async (req, res) => {
    try {
        const { status, admin_note } = req.body;
        const { id } = req.params;

        if (!['approved', 'declined'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const leave = await Leave.findById(id);
        if (!leave) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        leave.status = status;
        leave.admin_note = admin_note || '';
        await leave.save();

        res.json({ message: `Leave ${status} successfully`, leave });
    } catch (error) {
        console.error('Error updating leave status:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Grant leave directly (Admin only)
// @route   POST /api/leaves/admin/grant
const grantLeaveByAdmin = async (req, res) => {
    try {
        const { emp_no, type, start_date, end_date, reason } = req.body;

        if (!emp_no || !type || !start_date || !reason) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const newLeave = new Leave({
            emp_no,
            type,
            start_date,
            end_date: type === 'single' ? start_date : end_date,
            reason,
            status: 'approved',
            applied_by: 'admin'
        });

        await newLeave.save();
        res.status(201).json({ message: 'Leave granted successfully', leave: newLeave });
    } catch (error) {
        console.error('Error granting leave:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    applyLeave,
    getMyLeaves,
    getAllLeaves,
    updateLeaveStatus,
    grantLeaveByAdmin
};
