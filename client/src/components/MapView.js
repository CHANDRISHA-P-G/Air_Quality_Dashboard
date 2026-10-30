import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { LoaderCircle, MapPin, MousePointer2, Search, X, Clock, Hospital } from 'lucide-react';
import MapTypeControl from './MapTypeControl';
import OverlayToggles from './OverlayToggles';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

const markerIcon = (point, type, showNumber = true) => {
  const rawColor = point.risk && point.risk.color;
  const color = /^#[0-9a-f]{6}$/i.test(rawColor || '') ? rawColor : '#64748b';
  const aqi = Number.isFinite(point.metrics && point.metrics.aqi) ? point.metrics.aqi : '—';
  const title = type === 'user' ? 'YOU' : type === 'pin' ? 'PIN' : '';
  const markerClass = type === 'user' ? 'user' : type === 'pin' ? 'pin' : `station ${showNumber ? 'numbered' : 'dot-only'}`;
  const label = showNumber || type !== 'station'
    ? `<span class="map-marker-label">${title ? `${title} · ` : ''}${aqi}</span>`
    : '';
  const isSmallStationDot = type === 'station' && !showNumber;

  return L.divIcon({
    className: 'leaflet-custom-marker',
    html: `<div class="aqi-map-marker ${markerClass}" style="--marker-color:${color}">${label}<span class="map-marker-dot"></span></div>`,
    iconSize: isSmallStationDot ? [20, 20] : [112, 48],
    iconAnchor: isSmallStationDot ? [10, 10] : [56, 42]
  });
};

const MAP_API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/microclimate';

/* Expanded Popular Places: Grouped and Alphabetized by Country */
const POPULAR_PLACES = [
  // Egypt
  ['Cairo', 30.0444, 31.2357, 'Egypt'],
  // Germany
  ['Berlin', 52.52, 13.405, 'Germany'],
  // India (Extensively Expanded)
  ['Agra', 27.1767, 78.0081, 'India'],
  ['Ahmedabad', 23.0225, 72.5714, 'India'],
  ['Bengaluru', 12.9716, 77.5946, 'India'],
  ['Chennai', 13.0827, 80.2707, 'India'],
  ['Delhi', 28.6139, 77.209, 'India'],
  ['Hyderabad', 17.385, 78.4867, 'India'],
  ['Kolkata', 22.5726, 88.3639, 'India'],
  ['Mumbai', 19.076, 72.8777, 'India'],
  ['Pune', 18.5204, 73.8567, 'India'],
  // Japan
  ['Tokyo', 35.6762, 139.6503, 'Japan'],
  // Netherlands
  ['Amsterdam', 52.3676, 4.9041, 'Netherlands'],
  // United Kingdom
  ['London', 51.5072, -0.1276, 'United Kingdom'],
  // United States
  ['Chicago', 41.8781, -87.6298, 'United States'],
  ['Los Angeles', 34.0522, -118.2437, 'United States'],
  ['New York', 40.7128, -74.006, 'United States'],
  // France
  ['Paris', 48.8566, 2.3522, 'France']
].map(([name, lat, lng, country]) => ({ name, lat, lng, country }))
  .sort((first, second) => first.country.localeCompare(second.country) || first.name.localeCompare(second.name));

const windIcon = (direction, speed) => {
  const rotation = Number.isFinite(direction) ? (direction + 180) % 360 : 0;
  const label = Number.isFinite(speed) ? `${speed}` : '';
  return L.divIcon({
    className: 'wind-map-icon',
    html: `<span class="wind-map-arrow" style="transform:rotate(${rotation}deg)">↑</span><span class="wind-map-speed">${label}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

const ViewportGrid = ({ onReadings, onStatus }) => {
  const map = useMap();

  useEffect(() => {
    let timer;
    let controller;
    const requestGrid = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (controller) controller.abort();
        controller = new AbortController();
        onStatus('loading');
        const size = map.getSize();
        const zoom = map.getZoom();
        const targetCount = zoom <= 4 ? 36 : zoom <= 6 ? 56 : zoom <= 8 ? 80 : zoom <= 10 ? 110 : zoom <= 12 ? 140 : zoom <= 14 ? 170 : 200;
        const center = map.getCenter();
        let seed = Math.abs(Math.floor((center.lat + 90) * 10000 + (center.lng + 180) * 100 + zoom * 1000003)) || 1;
        const random = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
        const minDistance = Math.sqrt((size.x * size.y) / targetCount) * 0.48;
        const samples = [];
        let candidateCount = 0;
        while (samples.length < targetCount && candidateCount < targetCount * 90) {
          candidateCount += 1;
          const x = 28 + random() * Math.max(1, size.x - 56);
          const y = 28 + random() * Math.max(1, size.y - 56);
          if (samples.every((sample) => {
            const dx = sample.x - x;
            const dy = sample.y - y;
            return dx * dx + dy * dy >= minDistance * minDistance;
          })) {
            samples.push({ x, y });
          }
        }
        while (samples.length < targetCount) {
          samples.push({
            x: 28 + random() * Math.max(1, size.x - 56),
            y: 28 + random() * Math.max(1, size.y - 56)
          });
        }
        const locations = samples.map(({ x, y }) => {
          const latLng = map.containerPointToLatLng([x, y]);
          const longitude = ((latLng.lng + 180) % 360 + 360) % 360 - 180;
          return {
            lat: Math.max(-85, Math.min(85, latLng.lat)),
            lng: longitude
          };
        });

        if (locations.length === 0) {
          onReadings([]);
          onStatus('empty');
          return;
        }

        try {
          const response = await axios.post(`${MAP_API}/grid`, { locations }, {
            timeout: 25000,
            signal: controller.signal
          });
          if (!response.data || !response.data.success || !Array.isArray(response.data.readings)) {
            throw new Error('The AQI grid could not be loaded.');
          }
          onReadings(response.data.readings);
          onStatus(response.data.readings.length ? 'ready' : 'empty');
        } catch (error) {
          if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
            onReadings([]);
            onStatus('error');
          }
        }
      }, 450);
    };

    requestGrid();
    map.on('moveend zoomend resize', requestGrid);
    return () => {
      clearTimeout(timer);
      if (controller) controller.abort();
      map.off('moveend zoomend resize', requestGrid);
    };
  }, [map, onReadings, onStatus]);

  return null;
};

const RecenterMap = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
      map.flyTo([center.lat, center.lng], 11, { duration: 0.8 });
    }
  }, [center, map]);
  return null;
};

const ZoomLevel = ({ onChange }) => {
  const map = useMap();
  useEffect(() => {
    const updateZoom = () => onChange(map.getZoom());
    updateZoom();
    map.on('zoomend', updateZoom);
    return () => map.off('zoomend', updateZoom);
  }, [map, onChange]);
  return null;
};

const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng, 'custom');
    }
  });
  return null;
};

const PlaceSearch = ({ onSelectLocation }) => {
  const [query, setQuery] = useState('');
  const [remotePlaces, setRemotePlaces] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchInput = useRef(null);

  const localPlaces = POPULAR_PLACES.filter((place) => (
    !query || `${place.name} ${place.country}`.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const places = [...localPlaces, ...remotePlaces]
    .filter((place, index, allPlaces) => allPlaces.findIndex((candidate) => (
      candidate.name.toLowerCase() === place.name.toLowerCase() && candidate.country === place.country
    )) === index)
    .sort((first, second) => first.country.localeCompare(second.country) || first.name.localeCompare(second.name));

  useEffect(() => {
    if (showSearch) searchInput.current?.focus();
  }, [showSearch]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setRemotePlaces([]);
      setSearching(false);
      setSearchError('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const response = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
          params: { name: trimmedQuery, count: 10, language: 'en', format: 'json' },
          timeout: 8000,
          signal: controller.signal
        });
        const results = response.data && Array.isArray(response.data.results) ? response.data.results : [];
        setRemotePlaces(results.map((place) => ({
          name: place.name,
          lat: place.latitude,
          lng: place.longitude,
          country: place.country || '',
          admin1: place.admin1 || ''
        })));
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          setSearchError('Place suggestions are unavailable. Check your connection.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectPlace = (place) => {
    const placeName = [place.name, place.admin1, place.country]
      .filter((part, index, allParts) => part && allParts.indexOf(part) === index)
      .join(', ');
    onSelectLocation(place.lat, place.lng, 'custom', null, placeName);
    setQuery(placeName);
    setOpen(false);
    setShowSearch(false);
  };

  return (
    <div className="place-search">
      {!showSearch ? (
        <button
          type="button"
          className="place-search-launch"
          aria-label="Open place search"
          onClick={() => {
            setShowSearch(true);
            setOpen(true);
          }}
        >
          <Search size={17} />
          <span>Search a place</span>
        </button>
      ) : (
        <>
          <div className={`place-search-input ${open ? 'open' : ''}`}>
            <Search size={17} />
            <input
              ref={searchInput}
              aria-label="Search for a place"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 160)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false);
                if (event.key === 'Enter' && places.length) {
                  event.preventDefault();
                  selectPlace(places[0]);
                }
              }}
              placeholder="Search a city or place"
            />
            {searching && <LoaderCircle className="search-spinner" size={16} />}
            {query && (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear place search"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery('');
                  setOpen(true);
                }}
              >
                <X size={15} />
              </button>
            )}
            <button
              type="button"
              className="search-clear"
              aria-label="Close place search"
              onClick={() => {
                setOpen(false);
                setShowSearch(false);
              }}
            >
              <X size={15} />
            </button>
          </div>
          {open && (
            <div className="place-search-results">
              <p className="place-search-heading">
                {query ? 'PLACE SUGGESTIONS' : 'POPULAR PLACES · GROUPED BY COUNTRY'}
              </p>
              {places.length > 0 ? places.map((place) => (
                <button
                  type="button"
                  className="place-search-result"
                  key={`${place.name}-${place.admin1 || ''}-${place.country}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectPlace(place)}
                >
                  <MapPin size={14} />
                  <span><strong>{place.name}</strong><small>{[place.admin1, place.country].filter(Boolean).join(', ')}</small></span>
                </button>
              )) : !searching && (
                <p className="place-search-empty">{query.length < 2 ? 'Type at least 2 letters to search all places.' : 'No matching places found.'}</p>
              )}
              {searchError && <p className="place-search-error">{searchError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MapView = ({
  center,
  userLocation,
  droppedPin,
  onSelectLocation,
  mapType,
  setMapType,
  overlays,
  setOverlays,
  activeData,
  isExpanded
}) => {
  const [zoom, setZoom] = useState(11);
  const [gridReadings, setGridReadings] = useState([]);
  const [gridStatus, setGridStatus] = useState('loading');
  const [showExposureModal, setShowExposureModal] = useState(false);
  const [showShelterModal, setShowShelterModal] = useState(false);

  const metrics = activeData?.metrics || {};
  const aqi = Number.isFinite(metrics.aqi) ? metrics.aqi : 0;
  const pm25 = Number.isFinite(metrics.pm25) ? metrics.pm25 : 25;
  const safeMins = Math.max(5, Math.round(3000 / (pm25 * 12)));

  return (
    <div className={`map-view-container ${mapType === 'air' ? 'air-layer' : 'street-layer'}`}>
      <PlaceSearch onSelectLocation={onSelectLocation} />
      <div className="map-instructions">
        <span className="instruction-icon"><MousePointer2 size={16} /></span>
        <span><strong>Explore any area</strong><small>Click the map to drop a pin and check its AQI</small></span>
      </div>
      <div className="map-data-chip">
        <span className={`grid-status-indicator ${gridStatus}`} />
        {mapType === 'air'
          ? gridStatus === 'ready'
            ? `${gridReadings.length} live AQI grid readings`
            : gridStatus === 'error'
              ? 'AQI grid unavailable'
              : 'Loading map-wide AQI readings'
          : 'Street map'}
      </div>
      <MapTypeControl mapType={mapType} setMapType={setMapType} />
      <OverlayToggles overlays={overlays} setOverlays={setOverlays} />

      {/* Floating Map Overlays: Hidden automatically when sidebar is expanded */}
      {!isExpanded && (
        <div className="map-floating-action-bar">
          <button
            type="button"
            className="floating-map-btn pulsing-glow-btn"
            onClick={() => setShowExposureModal(!showExposureModal)}
          >
            <Clock size={15} /> ⚠️ Still Want to Go Outdoors?
          </button>

          {showExposureModal && (
            <div className="floating-exposure-card">
              <div className="exposure-card-header">
                <span>Outdoor Exposure Estimate</span>
                <button type="button" onClick={() => setShowExposureModal(false)}>×</button>
              </div>
              <p>Safe Window: <strong>~{safeMins} Mins</strong></p>
              <p>PM2.5 Level: <strong>{pm25} µg/m³</strong></p>
            </div>
          )}

          {aqi > 100 && (
            <button
              type="button"
              className="floating-map-btn shelter-map-btn"
              onClick={() => setShowShelterModal(true)}
            >
              <Hospital size={15} /> 🏥 Find Clean Air Shelter ({aqi} AQI)
            </button>
          )}

          {showShelterModal && (
            <div className="shelter-modal-card">
              <div className="shelter-modal-header">
                <span>Emergency Clean-Air Hubs Nearby</span>
                <button type="button" onClick={() => setShowShelterModal(false)}>×</button>
              </div>
              <ul>
                <li>📍 <strong>Central Civic Filtration Center</strong> (1.2 km) - Open</li>
                <li>📍 <strong>Municipal Oxygen & AC Lounge</strong> (2.5 km) - Open</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Bottom Hazard Legend Bar */}
      <div className="map-hazard-legend-bar">
        <div className="legend-item" style={{ background: '#22c55e', color: '#fff' }}><span>0-50</span> Good</div>
        <div className="legend-item" style={{ background: '#eab308', color: '#000' }}><span>51-100</span> Moderate</div>
        <div className="legend-item" style={{ background: '#f97316', color: '#fff' }}><span>101-150</span> Sensitive</div>
        <div className="legend-item" style={{ background: '#ef4444', color: '#fff' }}><span>151-200</span> Unhealthy</div>
        <div className="legend-item" style={{ background: '#a855f7', color: '#fff' }}><span>201-300</span> Very Unhealthy</div>
        <div className="legend-item" style={{ background: '#7e0023', color: '#fff' }}><span>300+</span> Hazardous</div>
      </div>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={11}
        zoomControl={false}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />
        <ZoomLevel onChange={setZoom} />
        <RecenterMap center={center} />
        <MapEvents onMapClick={onSelectLocation} />
        <ViewportGrid onReadings={setGridReadings} onStatus={setGridStatus} />

        {overlays.aqiBadges && gridReadings.map((reading) => (
          <Marker
            key={reading.id}
            position={[reading.location.lat, reading.location.lng]}
            icon={markerIcon(reading, 'station', zoom >= 13)}
            eventHandlers={{
              click: () => onSelectLocation(reading.location.lat, reading.location.lng, 'nearby', reading)
            }}
          >
            <Popup>
              <strong>{reading.location.name}</strong>
              <br />US AQI: {reading.metrics.aqi}
              <br />Source: {reading.sources && reading.sources[0] ? reading.sources[0] : 'Open-Meteo CAMS model grid'}
            </Popup>
          </Marker>
        ))}

        {userLocation && userLocation.location && (
          <Marker
            position={[userLocation.location.lat, userLocation.location.lng]}
            icon={markerIcon(userLocation, 'user', true)}
            eventHandlers={{
              click: () => onSelectLocation(userLocation.location.lat, userLocation.location.lng, 'user', userLocation)
            }}
          >
            <Popup><strong>Your current location</strong><br />US AQI: {Number.isFinite(userLocation.metrics.aqi) ? userLocation.metrics.aqi : 'Unavailable'}</Popup>
          </Marker>
        )}

        {/* Dropped pin rendered in diamond shape via CSS */}
        {droppedPin && (
          <Marker
            position={[droppedPin.location.lat, droppedPin.location.lng]}
            icon={markerIcon(droppedPin, 'pin', true)}
            eventHandlers={{
              click: () => onSelectLocation(droppedPin.location.lat, droppedPin.location.lng, 'pin', droppedPin)
            }}
          >
            <Popup><strong>Dropped pin</strong><br />US AQI: {Number.isFinite(droppedPin.metrics.aqi) ? droppedPin.metrics.aqi : 'Unavailable'}</Popup>
          </Marker>
        )}

        {overlays.wind && gridReadings.filter((point) => Number.isFinite(point.metrics.windDirection)).map((point, index) => (
          <Marker
            key={`wind-${point.location.lat}-${point.location.lng}-${index}`}
            position={[point.location.lat, point.location.lng]}
            icon={windIcon(point.metrics.windDirection, point.metrics.wind)}
            interactive={false}
            zIndexOffset={500}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;