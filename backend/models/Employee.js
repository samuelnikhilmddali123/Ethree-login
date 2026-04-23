const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
    emp_no: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    full_name: {
        type: String,
        trim: true
    },
    profile_picture: {
        type: String,
        default: null
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'employee'],
        default: 'employee'
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    face_descriptor: {
        type: [Number],
        default: []
    },
    is_face_enabled: {
        type: Boolean,
        default: false
    },
    is_wifi_login_enabled: {
        type: Boolean,
        default: true
    },
    presence_status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    last_seen: {
        type: Date,
        default: null
    }
});

// Hash password before saving
employeeSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare passwords
employeeSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const Employee = mongoose.model('Employee', employeeSchema);
module.exports = Employee;
