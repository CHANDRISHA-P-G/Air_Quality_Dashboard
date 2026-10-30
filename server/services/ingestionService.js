const axios = require('axios');
const NodeCache = require('node-cache');

// Cache data for 10 minutes (600 seconds)
const telemetryCache = new NodeCache({ stdTTL: 600 });
const gridCache = new NodeCache({ stdTTL: 600 });
const waqiToken = process.env.WAQI_API_TOKEN;
const waqiMaxStationDistanceKm = 75;

const getDistanceKm = (firstLat, firstLng, secondLat, secondLng) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(secondLat - firstLat);
  const longitudeDelta = toRadians(secondLng - firstLng);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(firstLat))
    * Math.cos(toRadians(secondLat))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const getWaqiPoint = async (latitude, longitude) => {
  if (!waqiToken) return null;

  try {
    const response = await axios.get(`https://api.waqi.info/feed/geo:${latitude};${longitude}/`, {
      params: { token: waqiToken },
      timeout: 8000
    });
    const data = response.data && response.data.status === 'ok' ? response.data.data : null;
    const aqi = data && Number(data.aqi);
    if (!Number.isFinite(aqi)) return null;

    const geo = data.city && Array.isArray(data.city.geo) ? data.city.geo : [];
    if (geo.length < 2 || geo[0] === null || geo[1] === null) return null;
    const stationLat = Number(geo[0]);
    const stationLng = Number(geo[1]);
    if (
      !Number.isFinite(stationLat)
      || !Number.isFinite(stationLng)
      || Math.abs(stationLat) > 90
      || Math.abs(stationLng) > 180
      || getDistanceKm(latitude, longitude, stationLat, stationLng) > waqiMaxStationDistanceKm
    ) {
      return null;
    }

    return {
      aqi,
      station: data.city && data.city.name ? data.city.name : 'Nearest WAQI monitor',
      stationLat,
      stationLng,
      mainPollutant: data.dominentpol ? data.dominentpol.toUpperCase() : '—',
      pm25: data.iaqi && data.iaqi.pm25 && Number.isFinite(data.iaqi.pm25.v) ? data.iaqi.pm25.v : null,
      pm10: data.iaqi && data.iaqi.pm10 && Number.isFinite(data.iaqi.pm10.v) ? data.iaqi.pm10.v : null,
      timestamp: data.time && data.time.iso ? data.time.iso : new Date().toISOString()
    };
  } catch (error) {
    console.warn('WAQI point notice:', error.message);
    return null;
  }
};

const getAQISeverity = (aqi) => {
  if (aqi <= 50) {
    return {
      tier: 'Good',
      color: '#22c55e',
      textColor: '#ffffff',
      action: 'Air quality is satisfactory. Enjoy outdoor activities.'
    };
  } else if (aqi <= 100) {
    return {
      tier: 'Moderate',
      color: '#eab308',
      textColor: '#000000',
      action: 'Sensitive individuals should limit prolonged outdoor exertion.'
    };
  } else if (aqi <= 150) {
    return {
      tier: 'Unhealthy for Sensitive Groups',
      color: '#f97316',
      textColor: '#ffffff',
      action: 'Children, seniors, and respiratory patients should wear masks outdoors.'
    };
  } else if (aqi <= 200) {
    return {
      tier: 'Unhealthy',
      color: '#ef4444',
      textColor: '#ffffff',
      action: 'General public should avoid strenuous outdoor exertion.'
    };
  } else if (aqi <= 300) {
    return {
      tier: 'Very Unhealthy',
      color: '#a855f7',
      textColor: '#ffffff',
      action: 'Health warning: Enforce industrial emission controls and traffic caps.'
    };
  } else {
    return {
      tier: 'Hazardous',
      color: '#7e0023',
      textColor: '#ffffff',
      action: 'Emergency alert: Serious health risks. Remain indoors.'
    };
  }
};

const fetchCombinedTelemetry = async (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const cacheKey = `telemetry_${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  const cachedData = telemetryCache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const [airResult, weatherResult] = await Promise.allSettled([
    axios.get(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm10,pm2_5,us_aqi`,
      { timeout: 8000 }
    ),
    axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`,
      { timeout: 8000 }
    )
  ]);

  const observed = await getWaqiPoint(latitude, longitude);
  const curAir = airResult.status === 'fulfilled'
    ? airResult.value.data && airResult.value.data.current
    : null;
  if (!observed && (!curAir || !Number.isFinite(curAir.us_aqi))) {
    const detail = airResult.status === 'rejected' ? ` ${airResult.reason.message}` : '';
    throw new Error(`Air-quality data is unavailable for this location.${detail}`);
  }
  if (weatherResult.status === 'rejected') {
    console.warn('Open-Meteo weather notice:', weatherResult.reason.message);
  }
  if (airResult.status === 'rejected' && observed) {
    console.warn('Open-Meteo AQI notice; using WAQI monitoring data:', airResult.reason.message);
  }

  const curWeather = weatherResult.status === 'fulfilled'
    ? weatherResult.value.data && weatherResult.value.data.current
    : null;

  const aqi = observed ? observed.aqi : curAir.us_aqi;
  const pm25 = observed && observed.pm25 !== null
    ? observed.pm25
    : curAir && Number.isFinite(curAir.pm2_5) ? curAir.pm2_5 : null;
  const pm10 = observed && observed.pm10 !== null
    ? observed.pm10
    : curAir && Number.isFinite(curAir.pm10) ? curAir.pm10 : null;
  const mainPollutant = observed && observed.mainPollutant !== '—'
    ? observed.mainPollutant
    : pm25 === null && pm10 === null
      ? '—'
      : pm25 !== null && (pm10 === null || pm25 >= pm10) ? 'PM2.5' : 'PM10';
  const severity = getAQISeverity(aqi);

  const result = {
    location: { lat: latitude, lng: longitude, name: `Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})` },
    ...(observed ? {
      monitor: { name: observed.station, lat: observed.stationLat, lng: observed.stationLng }
    } : {}),
    metrics: {
      aqi: Math.round(aqi),
      mainPollutant,
      pm25: pm25 === null ? null : Number(pm25.toFixed(1)),
      pm10: pm10 === null ? null : Number(pm10.toFixed(1)),
      temp: curWeather && Number.isFinite(curWeather.temperature_2m) ? Math.round(curWeather.temperature_2m) : null,
      humidity: curWeather && Number.isFinite(curWeather.relative_humidity_2m) ? curWeather.relative_humidity_2m : null,
      wind: curWeather && Number.isFinite(curWeather.wind_speed_10m) ? Math.round(curWeather.wind_speed_10m) : null,
      windDirection: curWeather && Number.isFinite(curWeather.wind_direction_10m) ? curWeather.wind_direction_10m : null
    },
    risk: severity,
    sources: [observed ? 'WAQI nearest monitoring station' : 'Open-Meteo CAMS air-quality model'],
    timestamp: observed ? observed.timestamp : new Date().toISOString()
  };

  telemetryCache.set(cacheKey, result);
  return result;
};

const fetchGridTelemetry = async (locations) => {
  if (waqiToken && locations.length > 0) {
    try {
      const latitudes = locations.map((location) => location.lat);
      const longitudes = locations.map((location) => location.lng);
      const response = await axios.get('https://api.waqi.info/map/bounds/', {
        params: {
          latlng: `${Math.min(...latitudes)},${Math.min(...longitudes)},${Math.max(...latitudes)},${Math.max(...longitudes)}`,
          token: waqiToken
        },
        timeout: 12000
      });
      const stations = response.data && response.data.status === 'ok' && Array.isArray(response.data.data)
        ? response.data.data
        : [];
      const observedReadings = stations
        .filter((station) => (
          Number.isFinite(Number(station.aqi))
          && Number.isFinite(station.lat)
          && Number.isFinite(station.lon)
        ))
        .map((station) => ({
          id: `waqi-${station.uid}`,
          location: {
            lat: station.lat,
            lng: station.lon,
            name: station.station && station.station.name ? station.station.name : 'WAQI monitoring station'
          },
          metrics: { aqi: Math.round(Number(station.aqi)) },
          risk: getAQISeverity(Number(station.aqi)),
          sources: ['WAQI live monitoring station'],
          timestamp: new Date().toISOString()
        }));

      if (observedReadings.length > 0) return observedReadings;
    } catch (error) {
      console.warn('WAQI map notice:', error.message);
    }
  }

  const uniqueLocations = Array.from(
    new Map(locations.map(({ lat, lng }) => {
      const latitude = Number(lat);
      const longitude = Number(lng);
      return [`${latitude.toFixed(4)}_${longitude.toFixed(4)}`, { lat: latitude, lng: longitude }];
    })).values()
  );
  const grid = new Map();
  const uncachedLocations = [];

  uniqueLocations.forEach((location) => {
    const key = `grid_query_${location.lat.toFixed(4)}_${location.lng.toFixed(4)}`;
    const cached = gridCache.get(key);
    if (cached) grid.set(key, cached);
    else uncachedLocations.push(location);
  });

  for (let offset = 0; offset < uncachedLocations.length; offset += 50) {
    const batch = uncachedLocations.slice(offset, offset + 50);
    const params = {
      latitude: batch.map((location) => location.lat).join(','),
      longitude: batch.map((location) => location.lng).join(','),
      current: 'us_aqi',
      timezone: 'UTC'
    };
    const [airResult, weatherResult] = await Promise.allSettled([
      axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
        params: { ...params, current: 'us_aqi' },
        timeout: 15000
      }),
      axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: params.latitude,
          longitude: params.longitude,
          current: 'wind_speed_10m,wind_direction_10m',
          timezone: 'UTC'
        },
        timeout: 15000
      })
    ]);
    if (airResult.status === 'rejected') {
      throw new Error(`Map-wide air-quality readings are unavailable: ${airResult.reason.message}`);
    }
    const results = Array.isArray(airResult.value.data) ? airResult.value.data : [airResult.value.data];
    const weatherResults = weatherResult.status === 'fulfilled'
      ? Array.isArray(weatherResult.value.data) ? weatherResult.value.data : [weatherResult.value.data]
      : [];
    if (weatherResult.status === 'rejected') {
      console.warn('Open-Meteo map wind notice:', weatherResult.reason.message);
    }

    if (results.length !== batch.length) {
      throw new Error('The air-quality provider returned an incomplete grid response.');
    }

    results.forEach((result, index) => {
      const currentAqi = result && result.current && result.current.us_aqi;
      if (!Number.isFinite(currentAqi)) return;

      const requestLocation = batch[index];
      const latitude = Number.isFinite(result.latitude) ? result.latitude : requestLocation.lat;
      const longitude = Number.isFinite(result.longitude) ? result.longitude : requestLocation.lng;
      const modelKey = `grid_model_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
      const queryKey = `grid_query_${requestLocation.lat.toFixed(4)}_${requestLocation.lng.toFixed(4)}`;
      const reading = {
        id: modelKey,
        location: { lat: latitude, lng: longitude, name: 'Open-Meteo model grid' },
        metrics: {
          aqi: Math.round(currentAqi),
          wind: weatherResults[index] && weatherResults[index].current
            && Number.isFinite(weatherResults[index].current.wind_speed_10m)
            ? Math.round(weatherResults[index].current.wind_speed_10m)
            : null,
          windDirection: weatherResults[index] && weatherResults[index].current
            && Number.isFinite(weatherResults[index].current.wind_direction_10m)
            ? weatherResults[index].current.wind_direction_10m
            : null
        },
        risk: getAQISeverity(currentAqi),
        sources: ['Open-Meteo CAMS air-quality model'],
        timestamp: new Date().toISOString()
      };
      gridCache.set(queryKey, reading);
      grid.set(queryKey, reading);
    });
  }

  return Array.from(new Map(
    Array.from(grid.values()).map((reading) => [reading.id, reading])
  ).values());
};

module.exports = { fetchCombinedTelemetry, fetchGridTelemetry };