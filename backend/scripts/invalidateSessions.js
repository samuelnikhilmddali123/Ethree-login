const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Session = require('../models/Session');

const invalidateAllSessions = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await Session.updateMany(
            { is_active: true },
            { $set: { is_active: false } }
        );

        console.log(`Successfully invalidated ${result.modifiedCount} active sessions.`);
        console.log('All users will be forced to log in again on their next request.');
        process.exit(0);
    } catch (error) {
        console.error('Error invalidating sessions:', error);
        process.exit(1);
    }
};

invalidateAllSessions();
