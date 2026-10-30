const { fetchCombinedTelemetry, fetchGridTelemetry } = require('../services/ingestionService');

const getGridTelemetry = async (req, res) => {
  const locations = req.body && req.body.locations;
  if (!Array.isArray(locations) || locations.length === 0 || locations.length > 200) {
    return res.status(400).json({ success: false, error: 'Between 1 and 200 map grid locations are required.' });
  }

  const validLocations = locations.every((location) => (
    location
    && Number.isFinite(location.lat)
    && Number.isFinite(location.lng)
    && Math.abs(location.lat) <= 90
    && Math.abs(location.lng) <= 180
  ));
  if (!validLocations) {
    return res.status(400).json({ success: false, error: 'Grid locations must contain valid latitude and longitude values.' });
  }

  try {
    const readings = await fetchGridTelemetry(locations);
    res.json({ success: true, readings });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
};

const getPointMicroclimate = async (req, res) => {
  if (req.query.lat === undefined || req.query.lng === undefined || req.query.lat === '' || req.query.lng === '') {
    return res.status(400).json({ success: false, error: 'Valid latitude and longitude query parameters are required.' });
  }
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ success: false, error: 'Valid latitude and longitude query parameters are required.' });
  }

  try {
    const data = await fetchCombinedTelemetry(lat, lng);
    res.json({ success: true, data });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
};

const getRegionalStations = async (req, res) => {
  if (req.query.lat === undefined || req.query.lng === undefined || req.query.lat === '' || req.query.lng === '') {
    return res.status(400).json({ success: false, error: 'Valid latitude and longitude query parameters are required.' });
  }
  const baseLat = Number(req.query.lat);
  const baseLng = Number(req.query.lng);
  if (!Number.isFinite(baseLat) || !Number.isFinite(baseLng) || Math.abs(baseLat) > 90 || Math.abs(baseLng) > 180) {
    return res.status(400).json({ success: false, error: 'Valid latitude and longitude query parameters are required.' });
  }

  try {
    const stationOffsets = [
      { name: 'North nearby grid', dLat: 0.035, dLng: 0.012 },
      { name: 'South nearby grid', dLat: -0.032, dLng: -0.018 },
      { name: 'East nearby grid', dLat: 0.012, dLng: 0.042 },
      { name: 'West nearby grid', dLat: -0.018, dLng: -0.038 }
    ];

    const results = await Promise.allSettled(stationOffsets.map(async (offset, index) => {
      const data = await fetchCombinedTelemetry(baseLat + offset.dLat, baseLng + offset.dLng);
      return {
        ...data,
        id: index + 1,
        location: { ...data.location, name: offset.name }
      };
    }));
    const stations = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    if (stations.length === 0) {
      throw new Error('Nearby air-quality data is unavailable.');
    }

    res.json({ success: true, stations });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
};

module.exports = {
  getGridTelemetry,
  getPointMicroclimate,
  getRegionalStations
};