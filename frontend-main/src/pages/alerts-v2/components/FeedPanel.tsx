import { useState } from 'react';
import type { ActiveFilters, Incident, Signal } from '../types';
import { AlertFeed } from './AlertFeed';
import { IncidentModal } from './IncidentModal';
import { IncidentTable } from './IncidentTable';

export type FeedTab = 'alerts' | 'incidents';

interface FeedPanelProps {
  alerts: Signal[];
  incidents: Incident[];
  selectedAlertId: string | null;
  onSelectAlert: (id: string | null) => void;
  initialTab?: FeedTab;
  loading?: boolean;
  onRefresh?: () => void;
  filters?: ActiveFilters;
  onFiltersChange?: (filters: ActiveFilters) => void;
  availableCountryIso3s?: string[] | null;
  activeCountry?: string | null;
  onClearCountry?: () => void;
}

export function FeedPanel({
  alerts,
  incidents,
  selectedAlertId,
  onSelectAlert,
  initialTab = 'alerts',
  loading = false,
  onRefresh,
  filters,
  onFiltersChange,
  availableCountryIso3s,
  activeCountry,
  onClearCountry,
}: FeedPanelProps) {
  const [tab, setTab] = useState<FeedTab>(initialTab);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);

  return (
    <div className="flex h-full flex-col" data-testid="feed-panel">
      <div
        className="flex gap-1 bg-white/[0.03] p-1"
        role="tablist"
        aria-label="feed tabs"
      >
        <TabButton
          label={`Alerts (${alerts.length})`}
          active={tab === 'alerts'}
          onClick={() => setTab('alerts')}
          testId="feed-panel-tab-alerts"
        />
        <TabButton
          label={`Incidents (${incidents.length})`}
          active={tab === 'incidents'}
          onClick={() => setTab('incidents')}
          testId="feed-panel-tab-incidents"
        />
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'alerts' ? (
          <AlertFeed
            alerts={alerts}
            selectedAlertId={selectedAlertId}
            onSelectAlert={onSelectAlert}
            loading={loading}
            onRefresh={onRefresh}
            filters={filters}
            onFiltersChange={onFiltersChange}
            availableCountryIso3s={availableCountryIso3s}
            activeCountry={activeCountry}
            onClearCountry={onClearCountry}
          />
        ) : (
          <IncidentTable incidents={incidents} onIncidentClick={setActiveIncident} />
        )}
      </div>

      {activeIncident ? (
        <IncidentModal incident={activeIncident} onClose={() => setActiveIncident(null)} />
      ) : null}
    </div>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}

function TabButton({ label, active, onClick, testId }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  );
}
