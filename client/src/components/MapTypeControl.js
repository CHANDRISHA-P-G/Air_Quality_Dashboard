import React from 'react';
import './MapTypeControl.css';

const MapTypeControl = ({ mapType, setMapType }) => (
  <div className="map-type-switcher" role="group" aria-label="Map layer">
    <button
      type="button"
      className={`switcher-card ${mapType === 'air' ? 'active' : ''}`}
      aria-pressed={mapType === 'air'}
      onClick={() => setMapType('air')}
    >
      <span className="layer-swatch air-preview" aria-hidden="true" />
      <span>Air quality</span>
    </button>
    <button
      type="button"
      className={`switcher-card ${mapType === 'map' ? 'active' : ''}`}
      aria-pressed={mapType === 'map'}
      onClick={() => setMapType('map')}
    >
      <span className="layer-swatch map-preview" aria-hidden="true" />
      <span>Streets</span>
    </button>
  </div>
);

export default MapTypeControl;
