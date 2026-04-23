const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    emp_no: {
        type: String,
        required: true,
        ref: 'Employee'
    },
    session_token: {
        type: String,
        required: true,
        unique: true
    },
    device_info: {
        type: String, // You might want to store more detailed info (OS, Browser, etc.)
        required: true
    },
    login_time: {
        type: Date,
        default: Date.now,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },
    last_activity: {
        type: Date,
        default: Date.now
    }
});

// Update last activity on every access
sessionSchema.methods.updateActivity = function () {
    this.last_activity = Date.now();
    return this.save();
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
