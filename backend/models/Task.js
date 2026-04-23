const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    emp_no: {
        type: String,
        required: true,
        ref: 'Employee'
    },
    assigned_date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    due_date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    completed_date: {
        type: String, // YYYY-MM-DD
        default: null
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String
    },
    completion_percentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'overdue', 'declined'],
        default: 'pending'
    },
    task_type: {
        type: String,
        enum: ['daily', 'custom'],
        default: 'daily'
    },
    reason: {
        type: String,
        default: null
    },
    admin_note: {
        type: String,
        default: null
    },
    is_self_assigned: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Indexes for performance
taskSchema.index({ emp_no: 1, status: 1 });
taskSchema.index({ due_date: 1 });

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
