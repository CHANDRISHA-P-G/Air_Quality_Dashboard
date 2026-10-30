import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  Droplets,
  LocateFixed,
  MapPin,
  ShieldAlert,
  Thermometer,
  Wind,
  HeartPulse,
  LayoutDashboard
} from 'lucide-react';
import MapView from './MapView';
import CitizenHealthPanel from './CitizenHealthPanel';
import './Dashboard.css';

const DEFAULT_COORD = { lat: 28.6139, lng: 77.2090 };
const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api/microclimate'}`;
const UNAVAILABLE_RISK = {
  tier: 'Unavailable',
  color: '#64748b',
  action: 'Live air-quality data is not available for this location right now.'
};

const makeUnavailableData = (lat, lng) => ({
  location: { lat, lng, name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})` },
  metrics: { aqi: null, mainPollutant: '—', pm25: null, pm10: null, temp: null, humidity: null, wind: null },
  risk: UNAVAILABLE_RISK
});

const displayValue = (value, suffix = '') => (
  Number.isFinite(value) ? `${value}${suffix}` : '—'
);

const AirHealthIllustration = ({ aqi }) => {
  const wearingMask = Number.isFinite(aqi) && aqi > 100;
  const respirator = Number.isFinite(aqi) && aqi > 200;
  const description = respirator
    ? 'Person wearing a respirator for hazardous air'
    : wearingMask
      ? 'Person wearing a protective mask'
      : aqi !== null && aqi <= 50
        ? 'Healthy person breathing fresh air'
        : 'Person in moderate air quality';

  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={description}>
      <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.12" />
      <path d="M12 59c1-11 8-17 20-17s19 6 20 17" fill="currentColor" opacity="0.78" />
      <path d="M20 23c0-9 5-15 12-15s12 6 12 15v8c0 8-5 13-12 13s-12-5-12-13z" fill="#f2c7a5" />
      <path d="M19 24c0-11 5-17 13-17 8 0 14 6 14 16-3-1-6-4-8-7-4 4-11 7-19 8z" fill="#314452" />
      <circle cx="27" cy="28" r="1.4" fill="#34404a" />
      <circle cx="37" cy="28" r="1.4" fill="#34404a" />
      {!wearingMask && <path d="M27 35c3 3 7 3 10 0" fill="none" stroke="#9b5c50" strokeWidth="1.8" strokeLinecap="round" />}
      {wearingMask && (
        <>
          <path d="M21 31c3 1 5 2 11 2s8-1 11-2v8c-3 4-7 6-11 6s-8-2-11-6z" fill={respirator ? '#657b88' : '#e9f3f2'} stroke="#607a82" strokeWidth="1.2" />
          <path d="M21 33c-4-1-5-3-6-5m28 5c4-1 5-3 6-5" fill="none" stroke="#607a82" strokeWidth="1.3" strokeLinecap="round" />
          {respirator && (
            <>
              <circle cx="22" cy="38" r="3.1" fill="#d9e5e7" stroke="#526a76" strokeWidth="1" />
              <circle cx="42" cy="38" r="3.1" fill="#d9e5e7" stroke="#526a76" strokeWidth="1" />
              <path d="M27 41h10" stroke="#526a76" strokeWidth="1.2" strokeLinecap="round" />
            </>
          )}
        </>
      )}
    </svg>
  );
};

const Dashboard = () => {
  const [activeData, setActiveData] = useState(null);
  const [activeSource, setActiveSource] = useState('regional');
  const [userLocation, setUserLocation] = useState(null);
  const [droppedPin, setDroppedPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPoint, setLoadingPoint] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mapType, setMapType] = useState('air');
  const [overlays, setOverlays] = useState({ aqiBadges: true, wind: false });

  const [sidebarTab, setSidebarTab] = useState('overview');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const pinRequestId = useRef(0);

  const fetchPointData = useCallback(async (lat, lng) => {
    const response = await axios.get(`${API_URL}/point`, { params: { lat, lng }, timeout: 12000 });
    if (!response.data || !response.data.success || !response.data.data) {
      throw new Error(response.data?.error || 'Air-quality data is unavailable.');
    }
    const data = response.data.data;
    return { ...data, location: { ...data.location, lat: Number(lat), lng: Number(lng) } };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let geoTimeout;
    let locationResolved = false;
    const initialRequestId = pinRequestId.current + 1;
    pinRequestId.current = initialRequestId;

    const loadData = async (lat, lng, isUserGps = false) => {
      try {
        const pointData = await fetchPointData(lat, lng);
        if (isMounted) {
          if (isUserGps) setUserLocation(pointData);
          if (initialRequestId === pinRequestId.current) {
            setActiveData(pointData);
            setActiveSource(isUserGps ? 'user' : 'regional');
            setErrorMessage('');
            setLoading(false);
          }
        }
      } catch {
        if (isMounted && initialRequestId === pinRequestId.current) {
          const unavailable = makeUnavailableData(lat, lng);
          if (isUserGps) setUserLocation(unavailable);
          setActiveData(unavailable);
          setActiveSource(isUserGps ? 'user' : 'regional');
          setErrorMessage('Live AQI could not be loaded.');
          setLoading(false);
        }
      }
    };

    const loadDefaultLocation = () => {
      if (locationResolved) return;
      locationResolved = true;
      if (geoTimeout) clearTimeout(geoTimeout);
      loadData(DEFAULT_COORD.lat, DEFAULT_COORD.lng);
    };

    if ('geolocation' in navigator) {
      geoTimeout = setTimeout(loadDefaultLocation, 5000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (locationResolved) return;
          locationResolved = true;
          clearTimeout(geoTimeout);
          loadData(pos.coords.latitude, pos.coords.longitude, true);
        },
        loadDefaultLocation,
        { timeout: 5000, maximumAge: 60000 }
      );
    } else {
      loadDefaultLocation();
    }

    return () => {
      isMounted = false;
      if (geoTimeout) clearTimeout(geoTimeout);
    };
  }, [fetchPointData]);

  const handleSelectLocation = async (lat, lng, type, pointData, placeName) => {
    if (type === 'nearby') {
      const requestId = pinRequestId.current + 1;
      pinRequestId.current = requestId;
      if (pointData) {
        setActiveData({ ...pointData, location: { ...pointData.location, lat, lng } });
      } else {
        setActiveData(makeUnavailableData(lat, lng));
      }
      setActiveSource('nearby');
      setLoadingPoint(true);
      setErrorMessage('');
      try {
        const data = await fetchPointData(lat, lng);
        if (requestId === pinRequestId.current) {
          setActiveData({ ...data, location: { ...data.location, lat, lng } });
          setActiveSource('nearby');
        }
      } catch {
        if (requestId === pinRequestId.current) {
          setErrorMessage('Live AQI details unavailable for this grid point.');
        }
      } finally {
        if (requestId === pinRequestId.current) setLoadingPoint(false);
      }
      return;
    }

    if (pointData && type !== 'custom') {
      pinRequestId.current += 1;
      setLoadingPoint(false);
      setActiveData(pointData);
      setActiveSource(type);
      setErrorMessage('');
      return;
    }

    const requestId = pinRequestId.current + 1;
    pinRequestId.current = requestId;
    const pendingPin = makeUnavailableData(lat, lng);
    if (placeName) pendingPin.location.name = placeName;
    setDroppedPin(pendingPin);
    setActiveData(pendingPin);
    setActiveSource('pin');
    setLoadingPoint(true);
    setErrorMessage('');

    try {
      const data = await fetchPointData(lat, lng);
      if (requestId === pinRequestId.current) {
        const selectedData = { ...data, location: { ...data.location, lat, lng, ...(placeName ? { name: placeName } : {}) } };
        setDroppedPin(selectedData);
        setActiveData(selectedData);
      }
    } catch {
      if (requestId === pinRequestId.current) {
        setErrorMessage('Live AQI unavailable for this pin.');
      }
    } finally {
      if (requestId === pinRequestId.current) setLoadingPoint(false);
    }
  };

  if (loading || !activeData) {
    return <div className="loading-screen"><Activity size={22} /> Loading your air-quality map…</div>;
  }

  const activeRisk = activeData.risk || UNAVAILABLE_RISK;
  const metrics = activeData.metrics || {};
  const aqi = Number.isFinite(metrics.aqi) ? metrics.aqi : null;
  const userAqi = userLocation?.metrics?.aqi;
  const alertAqi = aqi > 100 ? aqi : null;
  const showUserLocationAlert = activeSource !== 'user' && userAqi > 100 && userLocation?.location;
  const alertLocation = activeSource === 'user' ? 'your current location' : activeSource === 'pin' ? 'your dropped pin' : 'this selected map area';

  const guidanceTitle = aqi === null
    ? 'Live guidance unavailable'
    : aqi <= 50
      ? 'Enjoy the fresh air'
      : aqi <= 100
        ? 'A little extra care'
        : aqi <= 150
          ? 'Protect sensitive lungs'
          : aqi <= 200
            ? 'Reduce outdoor exposure'
            : 'Stay indoors if possible';

  const locationLabel = activeSource === 'user' ? 'Your current location' : activeSource === 'pin' ? 'Dropped pin' : activeSource === 'nearby' ? 'Nearby AQI grid' : 'Regional overview';

  return (
    <div className="dashboard-container">
      <aside className={`sidebar-panel ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
        <header className="sidebar-header">
          <div className="brand-row">
            <div className="brand-mark"><Activity size={19} /></div>
            <div>
              <p className="eyebrow">LIVE ENVIRONMENT</p>
              <h1>Air quality</h1>
            </div>
          </div>
          <span className="location-tag">
            <MapPin size={13} /> {locationLabel}
          </span>
          <h2>{activeData.location.name}</h2>
          <p className="coords-text">
            {Math.abs(activeData.location.lat).toFixed(4)}° {activeData.location.lat >= 0 ? 'N' : 'S'}
            {' · '}
            {Math.abs(activeData.location.lng).toFixed(4)}° {activeData.location.lng >= 0 ? 'E' : 'W'}
          </p>
        </header>

        <section className="hero-aqi-card" style={{ '--aqi-color': activeRisk.color }}>
          <div className="aqi-score">
            <span className="aqi-num">{displayValue(metrics.aqi)}</span>
            <span className="aqi-label">US AQI</span>
          </div>
          <div className="aqi-details">
            <span className="live-indicator"><span /> LIVE READING</span>
            <h3>{activeRisk.tier}</h3>
            <p>Main pollutant <strong>{metrics.mainPollutant || '—'}</strong></p>
          </div>
        </section>

        {activeData.monitor && (
          <p className="monitor-source">
            Nearest live monitor: <strong>{activeData.monitor.name}</strong>
          </p>
        )}

        <div className="sidebar-tab-bar" role="tablist">
          <button
            type="button"
            className={`tab-item ${sidebarTab === 'overview' ? 'active' : ''}`}
            onClick={() => setSidebarTab('overview')}
          >
            <LayoutDashboard size={14} />
            <span>Overview</span>
          </button>
          <button
            type="button"
            className={`tab-item ${sidebarTab === 'health' ? 'active' : ''}`}
            onClick={() => setSidebarTab('health')}
          >
            <HeartPulse size={14} />
            <span>Citizen Health</span>
          </button>
        </div>

        {alertAqi !== null && (
          <section className="aqi-alert" role="alert">
            <ShieldAlert size={21} />
            <div>
              <strong>High AQI health alert · {alertAqi}</strong>
              <p>At {alertLocation}. {alertAqi > 150 ? 'Limit outdoor activity and wear a mask.' : 'Sensitive groups should take care.'}</p>
            </div>
          </section>
        )}

        {showUserLocationAlert && (
          <section className="aqi-alert aqi-alert-location" role="status">
            <ShieldAlert size={19} />
            <div>
              <strong>Your current location also has high AQI · {userAqi}</strong>
              <button
                type="button"
                className="aqi-alert-location-action"
                onClick={() => handleSelectLocation(userLocation.location.lat, userLocation.location.lng, 'user', userLocation)}
              >
                View your location
              </button>
            </div>
          </section>
        )}

        {errorMessage && <div className="data-notice" role="status">{errorMessage}</div>}
        {loadingPoint && <div className="data-notice loading-notice" role="status">Loading AQI details…</div>}

        {sidebarTab === 'overview' ? (
          <>
            <section className="protocol-box" style={{ '--guidance-color': activeRisk.color }}>
              <div className="guidance-header">
                <div className="guidance-illustration"><AirHealthIllustration aqi={aqi} /></div>
                <div className="guidance-title">
                  <p className="section-label">AIR QUALITY GUIDANCE</p>
                  <h3>{guidanceTitle}</h3>
                </div>
                <span className="severity-pill">{activeRisk.tier}</span>
              </div>
              <p className="guidance-action">{activeRisk.action}</p>
            </section>

            <section className="metrics-section">
              <div className="section-heading">
                <div>
                  <p className="section-label">CURRENT CONDITIONS</p>
                  <h3>Local readings</h3>
                </div>
                <span className="live-dot" aria-label="Live data" />
              </div>
              <div className="metrics-grid">
                <div className="metric-cell"><span><Activity size={14} /> PM2.5</span><strong>{displayValue(metrics.pm25, ' µg/m³')}</strong></div>
                <div className="metric-cell"><span><Activity size={14} /> PM10</span><strong>{displayValue(metrics.pm10, ' µg/m³')}</strong></div>
                <div className="metric-cell"><span><Thermometer size={14} /> Temp</span><strong>{displayValue(metrics.temp, '°C')}</strong></div>
                <div className="metric-cell"><span><Droplets size={14} /> Humidity</span><strong>{displayValue(metrics.humidity, '%')}</strong></div>
                <div className="metric-cell metric-wide"><span><Wind size={14} /> Wind speed</span><strong>{displayValue(metrics.wind, ' km/h')}</strong></div>
              </div>
            </section>
          </>
        ) : (
          <CitizenHealthPanel
            activeData={activeData}
            isExpanded={isSidebarExpanded}
            onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
          />
        )}

        {sidebarTab === 'overview' && (
          <button
            type="button"
            className="expand-sidebar-main-btn"
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          >
            {isSidebarExpanded ? 'Collapse Sidebar View' : 'Expand Sidebar'}
          </button>
        )}

        {userLocation?.metrics?.aqi && activeSource !== 'user' && (
          <button
            className="my-location-button"
            onClick={() => handleSelectLocation(userLocation.location.lat, userLocation.location.lng, 'user', userLocation)}
          >
            <LocateFixed size={17} /> Back to my location
          </button>
        )}

        <p className="data-source">
          {activeData.monitor ? 'Observed monitor AQI via WAQI · weather via Open-Meteo' : 'AQI model estimate via Open-Meteo CAMS.'}
        </p>
      </aside>

      <main className="map-section">
        <MapView
          center={activeData.location}
          userLocation={userLocation}
          droppedPin={droppedPin}
          onSelectLocation={handleSelectLocation}
          mapType={mapType}
          setMapType={setMapType}
          overlays={overlays}
          setOverlays={setOverlays}
          activeData={activeData}
          isExpanded={isSidebarExpanded}
        />
      </main>
    </div>
  );
};

export default Dashboard;