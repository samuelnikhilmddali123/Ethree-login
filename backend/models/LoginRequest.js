const mongoose = require('mongoose');

const loginRequestSchema = new mongoose.Schema({
    emp_no: {
        type: String,
        required: true,
        ref: 'Employee'
    },
    request_time: {
        type: Date,
        default: Date.now
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    device_info: {
        type: String,
        default: 'Unknown'
    },
    approved_by: {
        type: String,
        ref: 'Employee',
        default: null
    },
    approval_time: {
        type: Date,
        default: null
    },
    expiry_time: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Index for performance
loginRequestSchema.index({ emp_no: 1, status: 1 });

const LoginRequest = mongoose.model('LoginRequest', loginRequestSchema);
module.exports = LoginRequest;
