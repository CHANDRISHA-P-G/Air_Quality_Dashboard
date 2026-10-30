import React, { useState } from 'react';
import {
  Globe,
  UserCheck,
  Sliders,
  Footprints,
  Car,
  Flame,
  ShieldCheck,
  HeartPulse,
  Maximize2,
  Minimize2
} from 'lucide-react';
import './CitizenHealthPanel.css';

/* Minimalist SVG Line Art Vectors */
const ShieldVector = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ActivityVector = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const VulnerableVector = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7" r="4" />
    <path d="M5.5 21v-2a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2" />
  </svg>
);

const VentilationVector = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
);

/* Sub-Block Unique Vector Line Icons for Dynamic Metrics */
const ClockVector = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const DustVector = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M8 19h1" />
    <path d="M12 19h2" />
    <path d="M16 19h1" />
  </svg>
);

const WaterVector = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const FilterVector = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#70e6c5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const CitizenHealthPanel = ({ activeData, isExpanded, onToggleExpand }) => {
  const [subMode, setSubMode] = useState('general');
  const [userAge, setUserAge] = useState(30);
  const [activity, setActivity] = useState('walk');
  const [healthConditions, setHealthConditions] = useState({
    asthma: false,
    cardio: false,
    eyes: false
  });

  const metrics = activeData?.metrics || {};
  const aqi = Number.isFinite(metrics.aqi) ? metrics.aqi : 50;
  const pm25 = Number.isFinite(metrics.pm25) ? metrics.pm25 : 22;

  const handleConditionToggle = (key) => {
    setHealthConditions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /* Highly Dynamic Mathematical Model for Personalization */
  const calculatePersonalizedRisk = () => {
    let breathMultiplier = 1.0;
    if (activity === 'travel') breathMultiplier = 0.6;
    if (activity === 'workout') breathMultiplier = 2.8;

    let ageFactor = userAge <= 12 ? 1.5 : userAge >= 60 ? 1.4 : 1.0;
    let conditionCount = Object.values(healthConditions).filter(Boolean).length;
    let sensitivityFactor = 1 + (conditionCount * 0.35);

    let totalRiskMultiplier = breathMultiplier * ageFactor * sensitivityFactor;

    const safeMins = Math.max(3, Math.round(150 / (pm25 * (totalRiskMultiplier / 12))));
    const inhaledDust = Math.round(pm25 * breathMultiplier * ageFactor * 10);
    const extraWaterMl = Math.round(inhaledDust * 1.8 + (conditionCount * 150));
    const filterStandard = pm25 > 75 ? 'True HEPA (H13)' : pm25 > 35 ? 'HEPA Standard' : 'Fine Mesh Filter';

    return { safeMins, inhaledDust, extraWaterMl, filterStandard, totalRiskMultiplier };
  };

  const dynamic = calculatePersonalizedRisk();

  // 4-Point General Advisory Data
  const getGeneralAdvisories = () => {
    if (aqi <= 50) {
      return {
        color: '#22c55e',
        mask: 'No protection needed. Air is pristine and fresh.',
        athletics: 'Unrestricted outdoor exercise and running.',
        vulnerable: 'Completely safe for children and seniors.',
        ventilation: 'Keep windows wide open for natural air exchange.'
      };
    }
    if (aqi <= 100) {
      return {
        color: '#eab308',
        mask: 'Optional surgical mask for sensitive individuals.',
        athletics: 'Safe for most people; take regular breathers if exerting.',
        vulnerable: 'Sensitive groups should limit long outdoor exertion.',
        ventilation: 'Good to air out rooms during low traffic hours.'
      };
    }
    if (aqi <= 150) {
      return {
        mask: 'N95 Respirator recommended if staying outside.',
        athletics: 'Move rigorous workouts indoors or shorten sessions.',
        vulnerable: 'Children and older adults should stay indoors.',
        ventilation: 'Keep windows shut during peak morning/evening traffic.',
        color: '#f97316'
      };
    }
    return {
      mask: 'Mandatory N95/KN95 respirator for any outdoor movement.',
      athletics: 'Strictly avoid all outdoor exercise and heavy sports.',
      vulnerable: 'High-risk lockdown conditions for vulnerable brackets.',
      ventilation: 'Seal room drafts and run indoor air purifiers.',
      color: '#ef4444'
    };
  };

  const general = getGeneralAdvisories();

  const getSimpleAdvice = () => {
    if (aqi <= 50) return { mask: 'No mask needed. Enjoy the clean air!', color: '#22c55e', status: 'GREAT' };
    if (aqi <= 100) return { mask: 'Optional regular mask if you feel sensitive.', color: '#eab308', status: 'MODERATE' };
    if (aqi <= 150) return { mask: 'Wear an N95 mask if you are outdoors long.', color: '#f97316', status: 'SENSITIVE GROUPS' };
    return { mask: 'Stay indoors! Wear an N95/KN95 mask if you must go out.', color: '#ef4444', status: 'UNHEALTHY AIR' };
  };

  const advice = getSimpleAdvice();

  return (
    <div className="citizen-health-panel">
      <div className="panel-top-bar">
        <div className="submode-tab-bar" role="tablist">
          <button
            type="button"
            className={`submode-btn ${subMode === 'general' ? 'active' : ''}`}
            onClick={() => setSubMode('general')}
          >
            <Globe size={13} /> General
          </button>
          <button
            type="button"
            className={`submode-btn ${subMode === 'personalized' ? 'active' : ''}`}
            onClick={() => setSubMode('personalized')}
          >
            <UserCheck size={13} /> Personalized
          </button>
        </div>
        <button
          type="button"
          className="expand-toggle-btn"
          onClick={onToggleExpand}
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* GENERAL MODE: 4-Point Advisory Stack with Vector Line Art */}
      {subMode === 'general' && (
        <div className="general-advisory-stack">
          <div className="health-card glass-card vector-card">
            <div className="card-top">
              <span className="card-heading">
                <ShieldVector color={general.color} /> Mask & Protection Standard
              </span>
            </div>
            <strong>{general.mask}</strong>
          </div>

          <div className="health-card glass-card vector-card">
            <div className="card-top">
              <span className="card-heading">
                <ActivityVector color="#38bdf8" /> Outdoor Exertion Limits
              </span>
            </div>
            <strong>{general.athletics}</strong>
          </div>

          <div className="health-card glass-card vector-card">
            <div className="card-top">
              <span className="card-heading">
                <VulnerableVector color="#f43f5e" /> Vulnerable Demographics
              </span>
            </div>
            <strong>{general.vulnerable}</strong>
          </div>

          <div className="health-card glass-card vector-card">
            <div className="card-top">
              <span className="card-heading">
                <VentilationVector color="#a855f7" /> Indoor Ventilation Rules
              </span>
            </div>
            <strong>{general.ventilation}</strong>
          </div>
        </div>
      )}

      {/* PERSONALIZED MODE VIEW (Fully Dynamic with Separated Sub-Blocks) */}
      {subMode === 'personalized' && (
        <div className="personalized-advisory-stack">
          <div className="personalized-controls-card">
            <div className="control-row">
              <div className="label-group">
                <Sliders size={13} />
                <span>Your Age: <strong>{userAge} Years</strong></span>
              </div>
              <input
                type="range"
                min="5"
                max="85"
                value={userAge}
                onChange={(e) => setUserAge(Number(e.target.value))}
                className="age-slider"
              />
            </div>

            <div className="control-row">
              <span className="control-label">What are you doing?</span>
              <div className="activity-switch">
                <button type="button" className={`act-btn ${activity === 'walk' ? 'active' : ''}`} onClick={() => setActivity('walk')}><Footprints size={12} /> Walking</button>
                <button type="button" className={`act-btn ${activity === 'travel' ? 'active' : ''}`} onClick={() => setActivity('travel')}><Car size={12} /> Driving</button>
                <button type="button" className={`act-btn ${activity === 'workout' ? 'active' : ''}`} onClick={() => setActivity('workout')}><Flame size={12} /> Working Out</button>
              </div>
            </div>

            <div className="control-row">
              <span className="control-label">Health conditions:</span>
              <div className="conditions-checkboxes">
                <label className="checkbox-pill">
                  <input type="checkbox" checked={healthConditions.asthma} onChange={() => handleConditionToggle('asthma')} />
                  <span>Asthma</span>
                </label>
                <label className="checkbox-pill">
                  <input type="checkbox" checked={healthConditions.cardio} onChange={() => handleConditionToggle('cardio')} />
                  <span>Heart Issues</span>
                </label>
                <label className="checkbox-pill">
                  <input type="checkbox" checked={healthConditions.eyes} onChange={() => handleConditionToggle('eyes')} />
                  <span>Sensitive Eyes</span>
                </label>
              </div>
            </div>
          </div>

          <div className="health-card glass-card">
            <div className="card-top">
              <span className="card-heading"><ShieldCheck size={15} /> Tailored Protection Requirement</span>
              <span className="status-tag" style={{ color: advice.color, borderColor: advice.color }}>{advice.status}</span>
            </div>
            <strong>{advice.mask}</strong>
            <p>Dynamically calculated for AQI {aqi}, age {userAge} ({activity}), and selected conditions.</p>
          </div>

          {/* SEPARATED DYNAMIC METRIC SUB-BLOCKS WITH UNIQUE VECTORS */}
          <div className="dynamic-sub-blocks-grid">
            <div className="health-card glass-card sub-metric-card" style={{ borderColor: 'rgba(56, 189, 248, 0.25)' }}>
              <div className="card-top">
                <span className="card-heading"><ClockVector /> Safe Outdoor Time</span>
              </div>
              <strong style={{ fontSize: '15px', color: '#f1f5f9' }}>~{dynamic.safeMins} Mins</strong>
            </div>

            <div className="health-card glass-card sub-metric-card" style={{ borderColor: 'rgba(244, 63, 94, 0.25)' }}>
              <div className="card-top">
                <span className="card-heading"><DustVector /> Est. Dust Inhaled</span>
              </div>
              <strong style={{ fontSize: '15px', color: '#f1f5f9' }}>~{dynamic.inhaledDust} µg/hr</strong>
            </div>

            <div className="health-card glass-card sub-metric-card" style={{ borderColor: 'rgba(56, 189, 248, 0.25)' }}>
              <div className="card-top">
                <span className="card-heading"><WaterVector /> Extra Hydration</span>
              </div>
              <strong style={{ fontSize: '15px', color: '#38bdf8' }}>+{dynamic.extraWaterMl} ml</strong>
            </div>

            <div className="health-card glass-card sub-metric-card" style={{ borderColor: 'rgba(112, 230, 197, 0.25)' }}>
              <div className="card-top">
                <span className="card-heading"><FilterVector /> Indoor Filter Need</span>
              </div>
              <strong style={{ fontSize: '13px', color: '#70e6c5' }}>{dynamic.filterStandard}</strong>
            </div>
          </div>

          <div className="health-card glass-card">
            <div className="card-top">
              <span className="card-heading"><HeartPulse size={15} /> Physiological Impact Summary</span>
            </div>
            <p style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
              {aqi > 100 || dynamic.totalRiskMultiplier > 1.8
                ? `Your profile configuration (Age ${userAge} + ${activity}) significantly increases respiratory sensitivity. Limit outdoor exertion to avoid strain.`
                : 'Your customized profile indicates minimal risk under current ambient air conditions. Enjoy your day safely!'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenHealthPanel;