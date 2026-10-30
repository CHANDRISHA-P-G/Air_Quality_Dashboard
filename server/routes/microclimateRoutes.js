const express = require('express');
const router = express.Router();
const { getGridTelemetry, getPointMicroclimate, getRegionalStations } = require('../controllers/microclimateController');

router.post('/grid', getGridTelemetry);
router.get('/point', getPointMicroclimate);
router.get('/stations', getRegionalStations);

module.exports = router;