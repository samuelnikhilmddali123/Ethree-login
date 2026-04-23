const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    emp_no: {
        type: String,
        required: true,
        ref: 'Employee'
    },
    type: {
        type: String,
        enum: ['single', 'multiple'],
        default: 'single'
    },
    start_date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    end_date: {
        type: String, // YYYY-MM-DD
        required: function () { return this.type === 'multiple'; }
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'declined'],
        default: 'pending'
    },
    admin_note: {
        type: String,
        default: ''
    },
    applied_by: {
        type: String,
        enum: ['employee', 'admin'],
        default: 'employee'
    }
}, { timestamps: true });

// Index for filtering
leaveSchema.index({ emp_no: 1, start_date: 1 });

const Leave = mongoose.model('Leave', leaveSchema);
module.exports = Leave;
