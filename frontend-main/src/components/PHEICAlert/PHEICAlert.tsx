/**
 * PHEICAlert — Emergency popup overlay
 *
 * Per spec: "a popup will arrive about Ebola and then redirect to /outbreak-ebola"
 *
 * Behavior:
 * - Fetches active critical outbreaks from API on mount
 * - If a CRITICAL outbreak exists, shows a full-screen alert overlay
 * - User can dismiss (sets sessionStorage flag) or click "Enter Workspace"
 * - Dismissed for the current session only — returns on next session
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import './PHEICAlert.css';

interface OutbreakPathogenSummary {
  vaccine_available?: boolean;
  profile_json?: {
    primary_strain?: string;
    strains?: Record<string, { vaccine_available?: boolean; vaccine_name?: string | null }>;
    vaccine_name?: string;
  };
}

interface OutbreakSummary {
  id: number;
  pathogen_name: string;
  pathogen?: OutbreakPathogenSummary;
  iso3: string;
  status: string;
  severity: string;
  event_count: number;
  summary: string;
  declared_at: string;
}

const DISMISS_KEY = 'pheic_alert_dismissed';

export default function PHEICAlert() {
  const navigate = useNavigate();
  const [outbreak, setOutbreak] = useState<OutbreakSummary | null>(null);
  const [visible, setVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const fetchCritical = async () => {
      try {
        const { data } = await api.get('outbreak/outbreaks/', {
          params: { status: 'confirmed' },
        });
        // Find the most critical active outbreak
        const critical = (data as OutbreakSummary[]).find(
          (o) => o.severity === 'critical'
        );
        if (critical) {
          setOutbreak(critical);
          // Delay to let the page render first
          setTimeout(() => {
            setVisible(true);
            requestAnimationFrame(() => setFadeIn(true));
          }, 800);
        }
      } catch {
        // Silently fail — don't block the app for a popup
      }
    };

    fetchCritical();
  }, []);

  const handleDismiss = useCallback(() => {
    setFadeIn(false);
    setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(DISMISS_KEY, '1');
    }, 400);
  }, []);

  const handleEnter = useCallback(() => {
    if (!outbreak) return;
    sessionStorage.setItem(DISMISS_KEY, '1');
    setFadeIn(false);
    setTimeout(() => {
      setVisible(false);
      navigate(`/outbreak/${outbreak.id}`);
    }, 300);
  }, [outbreak, navigate]);

  if (!visible || !outbreak) return null;

  const declaredDate = new Date(outbreak.declared_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Resolve vaccine status from pathogen profile (strain-level wins), falling
  // back to the pathogen-level flag. Never hardcode strings here — different
  // pathogens / strains have different vaccine availability.
  const strains = outbreak.pathogen?.profile_json?.strains ?? {};
  const primaryStrainKey = outbreak.pathogen?.profile_json?.primary_strain ?? Object.keys(strains)[0];
  const strainInfo = primaryStrainKey ? strains[primaryStrainKey] : undefined;
  const strainHasVaccineField = strainInfo?.vaccine_available !== undefined;
  const vaccineAvailable = strainHasVaccineField
    ? !!strainInfo?.vaccine_available
    : !!outbreak.pathogen?.vaccine_available;
  const vaccineDisplay = vaccineAvailable
    ? (strainInfo?.vaccine_name || outbreak.pathogen?.profile_json?.vaccine_name || 'AVAILABLE')
    : 'NONE';

  return (
    <div className={`pheic-overlay ${fadeIn ? 'pheic-overlay--visible' : ''}`}>
      <div className={`pheic-modal ${fadeIn ? 'pheic-modal--visible' : ''}`}>
        {/* Pulsing danger ring */}
        <div className="pheic-ring">
          <div className="pheic-ring-inner">
            <span className="pheic-ring-icon">!</span>
          </div>
        </div>

        <div className="pheic-badge">PUBLIC HEALTH EMERGENCY OF INTERNATIONAL CONCERN</div>

        <h1 className="pheic-title">
          {outbreak.pathogen_name || 'Outbreak'}
        </h1>
        <p className="pheic-subtitle">
          {outbreak.iso3} &mdash; Declared {declaredDate}
        </p>

        <p className="pheic-summary">{outbreak.summary}</p>

        <div className="pheic-stats">
          <div className="pheic-stat">
            <div className="pheic-stat-value">{outbreak.event_count}</div>
            <div className="pheic-stat-label">Signals Tracked</div>
          </div>
          <div className={`pheic-stat ${vaccineAvailable ? '' : 'pheic-stat--danger'}`}>
            <div className="pheic-stat-value">{vaccineDisplay}</div>
            <div className="pheic-stat-label">Approved Vaccine</div>
          </div>
          <div className="pheic-stat">
            <div className="pheic-stat-value">{outbreak.severity.toUpperCase()}</div>
            <div className="pheic-stat-label">Severity Level</div>
          </div>
        </div>

        <div className="pheic-actions">
          <button className="pheic-btn pheic-btn--primary" onClick={handleEnter}>
            Enter Outbreak Workspace
          </button>
          <button className="pheic-btn pheic-btn--ghost" onClick={handleDismiss}>
            Dismiss for now
          </button>
        </div>
      </div>
    </div>
  );
}
