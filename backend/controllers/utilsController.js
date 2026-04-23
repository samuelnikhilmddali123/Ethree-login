// Helper function to get current IST time
const getISTTime = () => {
    const now = new Date();
    // Using Intl to get Asia/Kolkata date parts
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find(p => p.type === type).value;

    const year = parseInt(getPart('year'));
    const month = parseInt(getPart('month')) - 1; // 0-indexed
    const day = parseInt(getPart('day'));
    const hour = parseInt(getPart('hour'));

    const formattedDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const formattedDateTime = `${formattedDate}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}+05:30`;

    // 19:00 IST is always 13:30 UTC of the same local day
    const sevenPM = new Date(Date.UTC(year, month, day, 13, 30, 0));

    return {
        date: formattedDate,
        datetime: formattedDateTime,
        sevenPM: sevenPM,
        hour: hour,
        timestamp: now
    };
};

// @desc    Get current server time in IST
// @route   GET /api/utils/time
const getServerTime = (req, res) => {
    const now = new Date();
    // Asia/Kolkata is UTC+5:30
    res.json({
        serverTime: now.toISOString(),
        timezone: 'Asia/Kolkata',
        offset: '+05:30'
    });
};

module.exports = {
    getServerTime,
    getISTTime
};
