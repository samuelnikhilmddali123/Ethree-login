const express = require('express');
const router = express.Router();
const { getServerTime } = require('../controllers/utilsController');
const { heartbeat, networkCheck } = require('../controllers/statusController');
const { protect } = require('../middleware/auth');

router.get('/time', getServerTime);
router.post('/heartbeat', protect, heartbeat);
router.get('/network-check', protect, networkCheck);

module.exports = router;
