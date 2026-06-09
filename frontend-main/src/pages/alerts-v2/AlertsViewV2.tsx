import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, RotateCw, Bell } from 'lucide-react';
import { AlertMap } from './components/AlertMap';
import { AlertRibbon } from './components/AlertRibbon';
import { AutoDetectionPopup } from './components/AutoDetectionPopup';
import { AlertsKPI } from './components/AlertsKPI';
import { FeedPanel } from './components/FeedPanel';
import { AgentConsole } from './components/AgentConsole/AgentConsole';
import type { ActiveFilters, Incident, Signal, AutoDetection } from './types';

interface AlertsViewV2Props {
  alerts: Signal[];
  globalDetections: AutoDetection[];
  selectedAlertId: string | null;
  incidents: Incident[];
  filters: ActiveFilters;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  availableCountryIso3s?: string[] | null;
  onSelectAlert: (id: string | null) => void;
  onFiltersChange: (filters: ActiveFilters) => void;
  onRetry: () => void;
  onRefresh?: () => void;
}

export function AlertsViewV2({
  alerts,
  globalDetections,
  selectedAlertId,
  incidents,
  filters,
  loading,
  error,
  lastUpdatedAt,
  availableCountryIso3s = null,
  onSelectAlert,
  onFiltersChange,
  onRetry,
  onRefresh,
}: AlertsViewV2Props) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);

  const detections = useMemo(
    () => globalDetections.filter((d) => !dismissedIds.has(d.id)),
    [globalDetections, dismissedIds],
  );

  const handleDetectionClose = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const handleToggleHidden = useCallback(() => {
    setHidden((h) => {
      // When un-hiding, reset dismissed IDs so all detections reappear
      if (h) setDismissedIds(new Set());
      return !h;
    });
  }, []);


  const handleCountryClick = useCallback((iso3: string) => {
    // Toggle: if already filtering by this country, clear it
    if (filters.countries.includes(iso3)) {
      onFiltersChange({ ...filters, countries: [] });
    } else {
      onFiltersChange({ ...filters, countries: [iso3] });
    }
  }, [filters, onFiltersChange]);

  const handleClearCountry = useCallback(() => {
    onFiltersChange({ ...filters, countries: [] });
  }, [filters, onFiltersChange]);

  const activeCountryLabel = filters.countries.length === 1 ? filters.countries[0] : null;

  return (
    <div
      className="flex flex-col bg-[#0B1120] text-white"
      style={{ height: 'calc(100vh - 56px)' }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-white/[0.04]">
        <AlertsKPI 
          alerts={alerts} 
          incidents={incidents} 
          autoDetectionsCount={globalDetections.length} 
        />

        {/* AI Detection Toggle */}
        <button
          type="button"
          onClick={handleToggleHidden}
          title={hidden ? 'Show AI detections' : 'Hide AI detections'}
          className={`
            relative flex items-center justify-center h-8 w-8 rounded-full
            transition-all duration-200 border
            ${hidden
              ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-700/40 hover:text-slate-300'
              : 'border-slate-600 bg-slate-700/50 text-slate-200 hover:bg-slate-600/60'
            }
          `}
        >
          <Bell className="h-4 w-4" />
          {hidden && globalDetections.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border border-[#0B1120]">
              {globalDetections.length}
            </span>
          )}
        </button>
      </div>



      {error ? (
        <div
          role="alert"
          data-testid="alerts-v2-error-banner"
          className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>Could not load alerts: {error}</span>
          </span>
          <button
            type="button"
            onClick={onRetry}
            data-testid="alerts-v2-error-retry"
            className="inline-flex items-center gap-1 rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-200 hover:bg-red-500/20"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 p-4 grid-cols-[7fr_3fr]">
        <section className="relative min-h-0 rounded-2xl border border-white/5 bg-[#070B14] overflow-hidden" aria-label="map">
          <AlertMap
            signals={alerts}
            selectedAlertId={selectedAlertId}
            onSelectAlert={onSelectAlert}
            onCountryClick={handleCountryClick}
          />
        </section>
        <section aria-label="feed" className="min-h-0 flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/5 bg-[#070B14] p-3">
          <div className="flex-1 min-h-0 overflow-hidden">
            <FeedPanel
              alerts={alerts}
              incidents={incidents}
              selectedAlertId={selectedAlertId}
              onSelectAlert={onSelectAlert}
              loading={loading}
              onRefresh={onRefresh}
              filters={filters}
              onFiltersChange={onFiltersChange}
              availableCountryIso3s={availableCountryIso3s}
              activeCountry={activeCountryLabel}
              onClearCountry={handleClearCountry}
            />
          </div>
          <AgentConsole
            onSelectAlert={onSelectAlert}
            activeCountry={activeCountryLabel}
            onClearCountry={handleClearCountry}
          />
        </section>
      </div>

      <AlertRibbon alerts={alerts} lastUpdatedAt={lastUpdatedAt} />

      <AutoDetectionPopup
        detections={hidden ? [] : detections}
        onClose={handleDetectionClose}
        hidden={hidden}
      />
    </div>
  );
}
