const mongoose = require('mongoose');

const proxyAttemptSchema = new mongoose.Schema({
    login_employee_id: { type: String, required: true },
    login_employee_name: { type: String, required: true },
    detected_face_employee_id: { type: String, default: 'Unknown Face' },
    detected_employee_name: { type: String, default: 'Unknown' },
    image_data: { type: String, required: true }, // Base64 or URL
    device_info: { type: String, default: 'Unknown' },
    ip_address: { type: String, default: 'Unknown' },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('ProxyAttempt', proxyAttemptSchema);
