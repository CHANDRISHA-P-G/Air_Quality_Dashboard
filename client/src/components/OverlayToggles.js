import React from 'react';
import { BadgeCheck, Wind } from 'lucide-react';
import './OverlayToggles.css';

const OverlayToggles = ({ overlays, setOverlays }) => (
  <div className="overlay-toggles-container">
    <button
      type="button"
      className={`pill-toggle ${overlays.aqiBadges ? 'active' : ''}`}
      aria-pressed={overlays.aqiBadges}
      onClick={() => setOverlays((previous) => ({ ...previous, aqiBadges: !previous.aqiBadges }))}
    >
      <BadgeCheck size={15} />
      <span>AQI badges</span>
      <span className="toggle-indicator" />
    </button>
    <button
      type="button"
      className={`pill-toggle ${overlays.wind ? 'active' : ''}`}
      aria-pressed={overlays.wind}
      onClick={() => setOverlays((previous) => ({ ...previous, wind: !previous.wind }))}
    >
      <Wind size={15} />
      <span>Wind</span>
      <span className="toggle-indicator" />
    </button>
  </div>
);

export default OverlayToggles;
