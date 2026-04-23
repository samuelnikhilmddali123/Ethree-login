const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    office_wifi_ssid: {
        type: String,
        default: 'Your_Office_WiFi_Name'
    },
    office_public_ip: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
