/**
 * Outbreak Workspace — The god-level page
 *
 * /outbreak/:id — Three time-panes (Past / Now / Ahead),
 * fused event stream, PHEIC header with live metrics.
 *
 * Per arc.md: every number has evidence trail, no fake data,
 * empty state with "no data" is correct.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Skull, Percent, Radio, Globe2, Biohazard, Syringe,
  RefreshCw, AlertTriangle, Download, Users,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Line, ComposedChart, BarChart, Bar, Cell,
} from 'recharts';
import OutbreakSeverityStrip from './widgets/OutbreakSeverityStrip';
import PoEReadinessCard from './widgets/PoEReadinessCard';
import OneHealthSpilloverPanel from './widgets/OneHealthSpilloverPanel';
import CrossBorderSummaryCard from './widgets/CrossBorderSummaryCard';
import { countryName, ISO3_NAMES as ISO3_NAMES_SHARED } from './utils/countryNames';
import {
  fetchOutbreak,
  fetchOutbreakEvents,
  fetchOutbreakStats,
  fetchEpiCurve,
  fetchHistory,
  triggerIngest,
} from './services/outbreakApi';
import type {
  Outbreak,
  OutbreakEvent,
  OutbreakStats,
  EpiCurvePoint,
  HistoricalEpisode,
  OutbreakCapacity,
} from './services/outbreakApi';
import { useOutbreakCapacity } from './hooks/useOutbreakCapacity';
import { useOutbreakStream } from './hooks/useOutbreakStream';
import CanWeRespondCard from './widgets/CanWeRespondCard';
import ReadinessCard from './widgets/ReadinessCard';
import IhrCapacityCard from './widgets/IhrCapacityCard';
import ChwDeploymentCard from './widgets/ChwDeploymentCard';
import SeasonalSpilloverCard from './widgets/SeasonalSpilloverCard';
import HotZoneMap from './widgets/HotZoneMap';
import { WIDGET_REGISTRY, widgetsFor } from './widgets/registry';
import LlmAssistant from './panels/LlmAssistant';
import EvidenceDrawer from './panels/EvidenceDrawer';
import DecisionLog from './panels/DecisionLog';
import NotificationConsole from './panels/NotificationConsole';
import AdaptorHealthBar from './panels/AdaptorHealthBar';
import SitrepPanel from './panels/SitrepPanel';
import './OutbreakWorkspace.css';

// Re-export shared map for any consumer that imported ISO3_NAMES from
// this module historically; new code should import from ./utils/countryNames.
const ISO3_NAMES = ISO3_NAMES_SHARED;

// ─── Tab type ──────────────────────────────────────────────────

type Pane = 'past' | 'now' | 'ahead' | 'ops';

// ─── Main Component ────────────────────────────────────────────

export default function OutbreakWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  // Parse explicitly — `Number('abc') || 1` silently masks bad URLs and routes
  // users to outbreak #1 thinking they hit what they asked for. Surface invalid
  // IDs as an error state below.
  const parsedId = id !== undefined ? Number(id) : NaN;
  const outbreakId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

  const activeTab = (searchParams.get('tab') as Pane) || 'now';
  const asOf = searchParams.get('as_of') || '';
  const setActiveTab = (tab: Pane) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };
  const setAsOf = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('as_of', value);
    else next.delete('as_of');
    setSearchParams(next);
  };

  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);

  // SSE — keep the events cache fresh in real time.
  useOutbreakStream(outbreakId ?? undefined);

  // ── Data fetching ─────────────────────────────────────────
  // All queries are gated on a valid outbreakId so we don't fire a request
  // for `/outbreak/NaN/` — the invalid-id branch below renders an error UI.

  const queryEnabled = outbreakId !== null;

  const { data: outbreak, isLoading: loadingOutbreak } = useQuery({
    queryKey: ['outbreak', outbreakId],
    queryFn: () => fetchOutbreak(outbreakId as number),
    refetchInterval: 60_000,
    enabled: queryEnabled,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['outbreak-stats', outbreakId],
    queryFn: () => fetchOutbreakStats(outbreakId as number),
    refetchInterval: 30_000,
    enabled: queryEnabled,
  });

  const { data: events = [], isLoading: loadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['outbreak-events', outbreakId, asOf],
    queryFn: () => fetchOutbreakEvents(outbreakId as number, { limit: 200, as_of: asOf || undefined }),
    refetchInterval: asOf ? false : 30_000,
    enabled: queryEnabled,
  });

  const { data: epiCurve = [], isLoading: loadingEpiCurve } = useQuery({
    queryKey: ['outbreak-epicurve', outbreakId, asOf],
    queryFn: () => fetchEpiCurve(outbreakId as number),
    refetchInterval: asOf ? false : 60_000,
    enabled: queryEnabled,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['outbreak-history', outbreakId],
    queryFn: () => fetchHistory(outbreakId as number),
    enabled: queryEnabled,
  });

  const { data: capacity, isLoading: loadingCapacity } = useOutbreakCapacity(outbreakId ?? undefined);

  // ── Ingest trigger ────────────────────────────────────────

  const [ingesting, setIngesting] = useState(false);
  const handleIngest = async () => {
    if (outbreakId === null) return;
    setIngesting(true);
    try {
      await triggerIngest(outbreakId);
      setTimeout(() => {
        refetchEvents();
        setIngesting(false);
      }, 15_000);
    } catch {
      setIngesting(false);
    }
  };

  // Auto-refresh signals every 4 hours. Background ingest keeps the feed
  // current without requiring the analyst to click the icon. setInterval
  // is cleared on unmount; the in-flight `ingesting` flag prevents the
  // tick from stacking concurrent runs.
  useEffect(() => {
    if (outbreakId === null) return;
    const tick = () => {
      if (!ingesting) void handleIngest();
    };
    const id = setInterval(tick, 4 * 60 * 60 * 1000);
    return () => clearInterval(id);
    // handleIngest closes over the latest outbreakId via the null guard,
    // ingesting is read each tick — no need to re-bind the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outbreakId]);

  // ── Invalid-id error state ───────────────────────────────
  if (outbreakId === null) {
    return (
      <div className="ob-empty">
        <h2>Invalid outbreak ID</h2>
        <p>
          The URL <code>/outbreak/{id ?? ''}</code> is not a valid outbreak reference.
          Open an outbreak from the listing or check the link you followed.
        </p>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────

  if (loadingOutbreak && !outbreak) {
    return (
      <div className="ob-workspace">
        <div className="ob-header" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ob-loading-spinner" />
        </div>
      </div>
    );
  }

  if (!outbreak) {
    return (
      <div className="ob-empty">
        <h2>No outbreak found</h2>
        <p>Outbreak ID {outbreakId} does not exist or you lack access.</p>
      </div>
    );
  }

  const profileJson = outbreak.pathogen?.profile_json as Record<string, unknown> || {};
  const keyWarning = profileJson.key_warning as string || '';
  const strains = profileJson.strains as Record<string, Record<string, unknown>> || {};

  return (
    <div className="ob-workspace">
      {/* ── PHEIC Header ─────────────────────────────────── */}
      <PHEICHeader
        outbreak={outbreak}
        stats={stats}
        capacity={capacity}
        keyWarning={keyWarning}
        onIngest={handleIngest}
        ingesting={ingesting}
      />

      {/* ── Tab Navigation ───────────────────────────────── */}
      <div className="ob-tabs">
        <button
          className={`ob-tab ${activeTab === 'past' ? 'ob-tab--active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <span className="ob-tab-icon">&#x1F4DA;</span> Past
        </button>
        <button
          className={`ob-tab ${activeTab === 'now' ? 'ob-tab--active' : ''}`}
          onClick={() => setActiveTab('now')}
        >
          <span className="ob-tab-icon">&#x26A0;</span> Now
        </button>
        <button
          className={`ob-tab ${activeTab === 'ahead' ? 'ob-tab--active' : ''}`}
          onClick={() => setActiveTab('ahead')}
        >
          <span className="ob-tab-icon">&#x1F52E;</span> Ahead
        </button>
        <button
          className={`ob-tab ${activeTab === 'ops' ? 'ob-tab--active' : ''}`}
          onClick={() => setActiveTab('ops')}
        >
          <span className="ob-tab-icon">&#x1F4DC;</span> Ops
        </button>

        {/* Time-machine bar (T-061) */}
        <div className="ob-asof">
          <label htmlFor="ob-asof-input">As of:</label>
          <input
            id="ob-asof-input"
            type="datetime-local"
            value={asOf ? asOf.slice(0, 16) : ''}
            onChange={(e) => setAsOf(e.target.value ? `${e.target.value}:00` : '')}
          />
          {asOf && (
            <button type="button" className="ob-asof-clear" onClick={() => setAsOf('')}>
              live
            </button>
          )}
        </div>
      </div>

      {/* ── Pane Content ─────────────────────────────────── */}
      <div className="ob-pane-content">
        {activeTab === 'past' && (
          <PastPane 
            history={history} 
            strains={strains} 
            loadingHistory={loadingHistory} 
            outbreakName={outbreak.pathogen.name}
          />
        )}
        {activeTab === 'now' && (
          <NowPane
            events={events}
            stats={stats}
            epiCurve={epiCurve}
            outbreak={outbreak}
            capacity={capacity}
            loadingStats={loadingStats}
            loadingEvents={loadingEvents}
            loadingEpiCurve={loadingEpiCurve}
            loadingCapacity={loadingCapacity}
            onCitationClick={setSelectedCitation}
          />
        )}
        {activeTab === 'ahead' && (
          <AheadPane outbreak={outbreak} events={events} />
        )}
        {activeTab === 'ops' && (
          <OpsPane
            outbreakId={outbreakId}
            onCitationClick={setSelectedCitation}
          />
        )}
      </div>

      <EvidenceDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
        events={events}
        capacity={capacity}
        outbreak={outbreak}
      />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// OPS PANE — decisions, sitrep, notifications, LLM audit, export
// ═══════════════════════════════════════════════════════════════

function OpsPane({
  outbreakId, onCitationClick,
}: {
  outbreakId: number;
  onCitationClick: (c: string) => void;
}) {
  return (
    <div className="ob-ops">
      <SitrepPanel outbreakId={outbreakId} onCitationClick={onCitationClick} />
      <DecisionLog outbreakId={outbreakId} onCitationClick={onCitationClick} />
      <NotificationConsole outbreakId={outbreakId} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// PHEIC HEADER
// ═══════════════════════════════════════════════════════════════

function PHEICHeader({
  outbreak,
  stats,
  capacity,
  keyWarning,
  onIngest,
  ingesting,
}: {
  outbreak: Outbreak;
  stats?: OutbreakStats;
  capacity?: OutbreakCapacity;
  keyWarning: string;
  onIngest: () => void;
  ingesting: boolean;
}) {
  const severityClass = `ob-severity--${outbreak.severity}`;

  // Resolve strain + vaccine display from the pathogen profile rather than
  // hardcoded BDBV strings. `profile_json.primary_strain` is the dominant
  // strain for this pathogen; fall back to the first key in `strains` or
  // omit the strain badge entirely if no strain data is available.
  const profile = (outbreak.pathogen?.profile_json ?? {}) as Record<string, unknown>;
  const strains = (profile.strains as Record<string, Record<string, unknown>> | undefined) ?? {};
  const primaryStrainKey = (profile.primary_strain as string | undefined)
    ?? (Object.keys(strains)[0] || '');
  const strainInfo = primaryStrainKey ? strains[primaryStrainKey] : undefined;
  const strainLabel = primaryStrainKey
    ? primaryStrainKey.charAt(0).toUpperCase() + primaryStrainKey.slice(1)
    : '';

  // Strain-level vaccine info wins (e.g. Ervebo protects Zaire but NOT BDBV).
  // Fall back to the pathogen-level `vaccine_available` flag if no strain data.
  const strainVaccineAvailable = strainInfo?.vaccine_available as boolean | undefined;
  const strainVaccineName = strainInfo?.vaccine_name as string | null | undefined;
  const vaccineAvailable = strainVaccineAvailable !== undefined
    ? strainVaccineAvailable
    : !!outbreak.pathogen?.vaccine_available;
  const vaccineDisplayName = vaccineAvailable
    ? (strainVaccineName || (outbreak.pathogen?.profile_json as { vaccine_name?: string } | undefined)?.vaccine_name || 'AVAILABLE')
    : 'NONE';
  const vaccineDetail = vaccineAvailable
    ? `Approved vaccine for ${strainLabel || outbreak.pathogen.name}`
    : `No approved vaccine for ${strainLabel || outbreak.pathogen.name}`;

  return (
    <header className={`ob-header ${severityClass}`}>
      <div className="ob-header-top">
        <div className="ob-header-badge">PHEIC</div>
        <h1 className="ob-header-title">
          {outbreak.pathogen.name}
          {strainLabel && (
            <span className="ob-header-strain"> ({strainLabel})</span>
          )}
        </h1>
        <div className="ob-header-meta">
          {/* `epicenter` qualifier makes it clear DRC is where the outbreak
              was declared — not the only affected country. Spillover into
              other countries is surfaced in the Countries tile below. */}
          <span className="ob-header-country">
            {ISO3_NAMES[outbreak.iso3] || outbreak.iso3}
            <span className="ob-header-country__role"> · epicenter</span>
          </span>
          <span className="ob-header-status">{outbreak.status.toUpperCase()}</span>
          <span className="ob-header-date">
            Declared {new Date(outbreak.declared_at).toLocaleDateString()}
          </span>
          <button
            className="ob-refresh-ghost"
            onClick={onIngest}
            disabled={ingesting}
            title={ingesting ? 'Ingesting…' : 'Refresh signals now (auto every 4h)'}
            aria-label="Refresh signals"
          >
            <RefreshCw size={14} className={ingesting ? 'ob-spin' : ''} />
          </button>
        </div>
      </div>

      {keyWarning && (
        <div className="ob-header-warning">
          <AlertTriangle size={14} className="ob-warning-icon" />
          <span>{keyWarning}</span>
        </div>
      )}

      {/* ── Unified metric strip — equal cards, dense.
          No source attribution: numbers come from the manually
          uploaded tracker workbook and the page deliberately doesn't
          surface the provenance to the floor reader. */}
      <div className="ob-metric-strip">
        <CaseTiles outbreak={outbreak} stats={stats} />
        <MetricTile
          icon={<Radio size={16} />}
          value={stats?.total_events ?? 0}
          label="Signals"
          sub={`+${(stats?.events_24h ?? 0).toLocaleString()} 24h · ${(stats?.events_7d ?? 0).toLocaleString()} 7d`}
          tone={(stats?.events_24h ?? 0) > 0 ? 'amber' : 'default'}
        />
        <MetricTile
          icon={<Globe2 size={16} />}
          value={stats?.countries_detected?.length ?? 0}
          label="Countries"
          sub={stats?.countries_detected?.slice(0, 6).join(', ') || 'none'}
        />
        <SpilloverTile capacity={capacity} />
        <MetricTile
          icon={<Syringe size={16} />}
          value={vaccineDisplayName}
          label="Vaccine"
          sub={vaccineDetail}
          tone={vaccineAvailable ? 'default' : 'red'}
        />
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
// BANNER SUB-COMPONENTS — unified metric strip
//
// Design constraints:
//  - All tiles are equal width / height (CSS grid). No "hero" tiles.
//  - One row of source context (`MetricStripContext`) above the strip,
//    not repeated per tile.
//  - Numerics are large, labels small-caps muted, sub-text 11px muted.
//  - Color reserved for severity (deaths > 0 = red, no vaccine = red,
//    spillover band, 24h activity = amber). Default is slate.
//  - Icons from lucide-react, single line-weight, never emoji.
// ═══════════════════════════════════════════════════════════════

// ─── Helpers ──────────────────────────────────────────────────

function formatAsOf(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type Tone = 'default' | 'muted' | 'amber' | 'red';

interface MetricTileProps {
  icon: React.ReactNode;
  value: number | string | null;
  label: string;
  sub?: string;
  tone?: Tone;
  fallback?: string;
}

function MetricTile({ icon, value, label, sub, tone = 'default', fallback = '—' }: MetricTileProps) {
  const display =
    value === null || value === undefined
      ? fallback
      : typeof value === 'number'
      ? value.toLocaleString()
      : value;
  return (
    <div className={`ob-tile ob-tile--${tone}`}>
      <div className="ob-tile__head">
        <span className="ob-tile__icon">{icon}</span>
        <span className="ob-tile__label">{label}</span>
      </div>
      <div className="ob-tile__value">{display}</div>
      {sub && <div className="ob-tile__sub">{sub}</div>}
    </div>
  );
}

/**
 * CaseTiles — the case/death matrix + CFR + contacts, sourced from
 * `outbreak.latest_tracker` (the manually uploaded sitrep workbook).
 *
 * Sub-lines on each tile show today's delta when the sheet reports one,
 * never source attribution.
 */
function CaseTiles({ outbreak, stats }: { outbreak: Outbreak; stats?: OutbreakStats }) {
  const t = outbreak.latest_tracker;

  const confirmedCases  = t?.confirmed_cases  ?? stats?.confirmed_cases  ?? null;
  const confirmedDeaths = t?.confirmed_deaths ?? stats?.confirmed_deaths ?? null;
  const suspectedCases  = t?.suspected_cases  ?? stats?.latest_reported_cases  ?? null;
  const suspectedDeaths = t?.suspected_deaths ?? stats?.latest_reported_deaths ?? null;
  const contacts        = t?.total_contacts   ?? null;

  const cfr = t?.cfr_pct
    ?? ((confirmedCases != null && confirmedDeaths != null && confirmedCases > 0)
      ? (confirmedDeaths / confirmedCases) * 100 : null);
  let cfrTone: Tone = 'muted';
  let cfrSub = 'awaiting confirmed cases & deaths';
  if (cfr != null) {
    if (cfr >= 50)      { cfrTone = 'red';   cfrSub = 'extremely high'; }
    else if (cfr >= 25) { cfrTone = 'red';   cfrSub = 'very high'; }
    else if (cfr >= 10) { cfrTone = 'amber'; cfrSub = 'high'; }
    else                { cfrTone = 'default'; cfrSub = 'moderate'; }
    cfrSub += ' · confirmed only';
  }

  const deltaSub = (delta: number | null | undefined) =>
    delta == null ? '' : delta > 0 ? `+${delta} today` : 'no change today';

  return (
    <>
      <MetricTile
        icon={<Activity size={16} />}
        value={confirmedCases}
        label="Confirmed cases"
        sub={deltaSub(t?.new_confirmed_cases)}
        tone={confirmedCases == null ? 'muted' : 'default'}
        fallback="Pending"
      />
      <MetricTile
        icon={<Activity size={16} />}
        value={suspectedCases}
        label="Suspected cases"
        sub={deltaSub(t?.new_suspected_cases)}
        tone={suspectedCases == null ? 'muted' : 'default'}
        fallback="Pending"
      />
      <MetricTile
        icon={<Skull size={16} />}
        value={confirmedDeaths}
        label="Confirmed deaths"
        sub={deltaSub(t?.new_confirmed_deaths)}
        tone={
          confirmedDeaths == null ? 'muted'
          : confirmedDeaths > 0 ? 'red' : 'default'
        }
        fallback="Pending"
      />
      <MetricTile
        icon={<Skull size={16} />}
        value={suspectedDeaths}
        label="Suspected deaths"
        sub={deltaSub(t?.new_suspected_deaths)}
        tone={
          suspectedDeaths == null ? 'muted'
          : suspectedDeaths > 0 ? 'red' : 'default'
        }
        fallback="Pending"
      />
      <MetricTile
        icon={<Percent size={16} />}
        value={cfr != null ? `${cfr.toFixed(1)}%` : 'n/a'}
        label="CFR (confirmed)"
        sub={cfrSub}
        tone={cfrTone}
      />
      <MetricTile
        icon={<Users size={16} />}
        value={contacts}
        label="Contacts followed"
        sub={deltaSub(t?.new_contacts)}
        tone={contacts == null ? 'muted' : 'default'}
        fallback="Pending"
      />
    </>
  );
}

/**
 * TrackerBreakdownPanel — per-zone case-load visual.
 *
 * Two-tier display:
 *   1. Province summary cards (totals per affected province).
 *   2. Horizontal stacked bar chart: one row per health zone,
 *      stacked confirmed + suspected, sorted by impact. Hovering
 *      reveals deaths and contacts.
 *
 * Reads `outbreak.tracker_breakdown` (daily_cumul_counts sheet, latest
 * row per zone). The backend already drops junk rows and reattributes
 * orphan-province zones to the country's primary province.
 */
function TrackerBreakdownPanel({ outbreak }: { outbreak: Outbreak }) {
  const rows = outbreak.tracker_breakdown ?? [];
  if (rows.length === 0) return null;

  // Group by province for the summary cards + bar colouring.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.province || 'Unattributed';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const provinces = Array.from(groups.entries()).map(([name, zs]) => ({
    name,
    zones: zs.length,
    confirmed: zs.reduce((s, z) => s + (z.confirmed_cases ?? 0), 0),
    suspected: zs.reduce((s, z) => s + (z.suspected_cases ?? 0), 0),
    deaths: zs.reduce((s, z) => s + (z.confirmed_deaths ?? 0) + (z.suspected_deaths ?? 0), 0),
    contacts: zs.reduce((s, z) => s + (z.contacts ?? 0), 0),
  })).sort((a, b) => (b.confirmed + b.suspected) - (a.confirmed + a.suspected));

  // Build chart data: one row per zone, prefixed by province for grouping.
  // Backend already sorts by impact, so we keep that order and add a
  // 'province' field so the colour palette can map by it.
  const provColors: Record<string, string> = {};
  const palette = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#f472b6'];
  provinces.forEach((p, i) => { provColors[p.name] = palette[i % palette.length]; });

  const chartData = rows
    .filter((r) => (r.confirmed_cases ?? 0) + (r.suspected_cases ?? 0) > 0)
    .map((r) => ({
      label: `${r.province} · ${r.health_zone || '—'}`,
      province: r.province,
      zone: r.health_zone,
      confirmed: r.confirmed_cases ?? 0,
      suspected: r.suspected_cases ?? 0,
      deaths: (r.confirmed_deaths ?? 0) + (r.suspected_deaths ?? 0),
      confirmed_deaths: r.confirmed_deaths ?? 0,
      contacts: r.contacts ?? 0,
    }));

  // Dynamic height: each bar ~22px + chrome.
  const chartHeight = Math.max(220, chartData.length * 24 + 40);

  return (
    <>
      <SectionHeader
        title="Geographic breakdown"
        hint="Cumulative case load by province and health zone."
      />

      {/* Province summary cards */}
      <div className="ob-prov-cards">
        {provinces.map((p) => (
          <div key={p.name} className="ob-prov-card" style={{ borderColor: provColors[p.name] }}>
            <div className="ob-prov-card__name" style={{ color: provColors[p.name] }}>
              {p.name}
            </div>
            <div className="ob-prov-card__zones">{p.zones} zones affected</div>
            <div className="ob-prov-card__row">
              <span className="ob-prov-card__metric">
                <span className="ob-prov-card__val">{p.confirmed.toLocaleString()}</span>
                <span className="ob-prov-card__lbl">confirmed</span>
              </span>
              <span className="ob-prov-card__metric">
                <span className="ob-prov-card__val">{p.suspected.toLocaleString()}</span>
                <span className="ob-prov-card__lbl">suspected</span>
              </span>
            </div>
            <div className="ob-prov-card__row ob-prov-card__row--sub">
              <span className="ob-prov-card__sub">
                {p.deaths > 0 ? `${p.deaths} deaths` : 'no deaths'}
              </span>
              {p.contacts > 0 && (
                <span className="ob-prov-card__sub">
                  · {p.contacts.toLocaleString()} contacts
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Horizontal stacked bar chart */}
      <div className="ob-card ob-zone-chart">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#9ba1ac', fontSize: 11 }}
              stroke="rgba(255,255,255,0.15)"
            />
            <YAxis
              type="category"
              dataKey="label"
              width={170}
              tick={{ fill: '#e7e8eb', fontSize: 11 }}
              stroke="rgba(255,255,255,0.15)"
              interval={0}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: '#0f1115',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: '#e7e8eb', fontWeight: 600 }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  confirmed: 'Confirmed',
                  suspected: 'Suspected',
                };
                return [value.toLocaleString(), labels[name] ?? name];
              }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: '#0f1115', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    <div style={{ color: '#e7e8eb', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ color: '#ef4444' }}>Confirmed: {d.confirmed.toLocaleString()}</div>
                    <div style={{ color: '#f59e0b' }}>Suspected: {d.suspected.toLocaleString()}</div>
                    {d.deaths > 0 && <div style={{ color: '#9ba1ac' }}>Deaths: {d.deaths.toLocaleString()} ({d.confirmed_deaths} confirmed)</div>}
                    {d.contacts > 0 && <div style={{ color: '#9ba1ac' }}>Contacts: {d.contacts.toLocaleString()}</div>}
                  </div>
                );
              }}
            />
            <Bar dataKey="confirmed" stackId="a" name="confirmed">
              {chartData.map((d, i) => (
                <Cell key={i} fill={provColors[d.province] || '#ef4444'} />
              ))}
            </Bar>
            <Bar dataKey="suspected" stackId="a" name="suspected" fill="#3a3a44" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="ob-zone-chart__legend">
          <span><span className="dot" style={{ background: '#ef4444' }} /> Confirmed (coloured by province)</span>
          <span><span className="dot" style={{ background: '#3a3a44' }} /> Suspected</span>
          <span className="hint">Hover bars for deaths and contacts.</span>
        </div>
      </div>
    </>
  );
}

/**
 * LabTestingPanel — daily lab throughput from the manual tracker.
 * Hidden when no lab row has been uploaded.
 */
function LabTestingPanel({ outbreak }: { outbreak: Outbreak }) {
  const lab = outbreak.latest_lab;
  if (!lab) return null;
  return (
    <>
      <SectionHeader
        title="Laboratory testing"
        hint="Daily lab throughput and positivity."
      />
      <div className="ob-card ob-lab-grid">
        <LabStat label="Samples received" value={lab.samples_received} />
        <LabStat label="Samples analyzed" value={lab.samples_analyzed} />
        <LabStat label="Positive samples" value={lab.positive_samples} tone={(lab.positive_samples ?? 0) > 0 ? 'red' : 'default'} />
        <LabStat
          label="Positivity"
          value={lab.positivity_pct != null ? `${lab.positivity_pct.toFixed(1)}%` : null}
          tone={(lab.positivity_pct ?? 0) >= 30 ? 'red' : (lab.positivity_pct ?? 0) >= 10 ? 'amber' : 'default'}
        />
        <LabStat label="Daily throughput" value={lab.daily_throughput} />
        <LabStat label="Backlog" value={lab.backlog} tone={(lab.backlog ?? 0) > 0 ? 'amber' : 'default'} />
      </div>
    </>
  );
}

function LabStat({ label, value, tone = 'default' }: { label: string; value: number | string | null; tone?: Tone }) {
  const display = value === null || value === undefined ? '—' :
    typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <div className={`ob-lab-stat ob-lab-stat--${tone}`}>
      <div className="ob-lab-stat__label">{label}</div>
      <div className="ob-lab-stat__value">{display}</div>
    </div>
  );
}

function SpilloverTile({ capacity }: { capacity?: OutbreakCapacity }) {
  const sp = capacity?.spillover;
  const score = sp?.score ?? null;
  let tone: Tone = 'muted';
  let bandLabel = 'no data';
  if (score != null) {
    if (score >= 70) { tone = 'red'; bandLabel = 'HIGH'; }
    else if (score >= 50) { tone = 'amber'; bandLabel = 'ELEVATED'; }
    else if (score >= 30) { tone = 'amber'; bandLabel = 'WATCH'; }
    else { tone = 'default'; bandLabel = 'LOW'; }
  }
  const p30 = sp?.p_spillover_30d;
  const sub = score == null
    ? (sp?.data_available ? 'engine returned no score' : 'engine unreachable')
    : (p30 != null ? `${bandLabel} · 30d P ${(p30 * 100).toFixed(1)}%` : bandLabel);
  return (
    <MetricTile
      icon={<Biohazard size={16} />}
      value={score != null ? Math.round(score) : '—'}
      label="Spillover"
      sub={sub}
      tone={tone}
    />
  );
}


// ═══════════════════════════════════════════════════════════════
// PAST PANE — Historical episodes timeline
// ═══════════════════════════════════════════════════════════════

function PastPane({
  history,
  strains,
  outbreakName,
  loadingHistory,
}: {
  history: HistoricalEpisode[];
  strains: Record<string, Record<string, unknown>>;
  outbreakName: string;
  loadingHistory: boolean;
}) {
  return (
    <div className="ob-past">
      {/* Strain comparison — always show if available */}
      {Object.keys(strains).length > 0 && (
        <div className="ob-strain-grid">
          <h3 className="ob-section-title">Strain Intelligence</h3>
          <div className="ob-strain-cards">
            {Object.entries(strains).map(([name, info]) => (
              <div
                key={name}
                className={`ob-strain-card ${name === 'bundibugyo' ? 'ob-strain-card--active' : ''}`}
              >
                <h4>{name.charAt(0).toUpperCase() + name.slice(1)}</h4>
                <div className="ob-strain-detail">
                  <span>CFR:</span> {(info.cfr_range as number[])?.join('–') || '?'}%
                </div>
                <div className="ob-strain-detail">
                  <span>Vaccine:</span>{' '}
                  <span className={info.vaccine_available ? 'ob-yes' : 'ob-no'}>
                    {info.vaccine_available ? (info.vaccine_name as string) : 'NONE'}
                  </span>
                </div>
                {Array.isArray(info.therapeutics) && info.therapeutics.length > 0 && (
                  <div className="ob-strain-detail">
                    <span>Tx:</span> {(info.therapeutics as string[]).join(', ')}
                  </div>
                )}
                {Boolean(info.note) && (
                  <div className="ob-strain-note">{String(info.note)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="ob-card">
        <h3 className="ob-card-title">Outbreak History — {outbreakName}</h3>
        {loadingHistory ? (
          <div className="ob-loading" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="ob-loading-spinner" />
          </div>
        ) : history.length === 0 ? (
          <div className="ob-empty-state">
            <span className="ob-empty-icon">&#x1F4DC;</span>
            <h4>No historical timeline available</h4>
            <p>Historical outbreak episodes are being loaded from WHO Disease Outbreak News archives.</p>
          </div>
        ) : (
          <div className="ob-timeline">
            {history.map((ep) => {
              const cfr = ep.cases > 0 ? ((ep.deaths / ep.cases) * 100).toFixed(1) : '?';
              const yearLabel = ep.year_end && ep.year_end !== ep.year_start
                ? `${ep.year_start}–${ep.year_end}`
                : `${ep.year_start}`;

              return (
                <div key={ep.id} className="ob-timeline-item">
                  <div className="ob-timeline-dot" />
                  <div className="ob-timeline-card">
                    <div className="ob-timeline-header">
                      <span className="ob-timeline-year">{yearLabel}</span>
                      <span className="ob-timeline-country">{ep.country}</span>
                    </div>
                    <div className="ob-timeline-stats">
                      <span>{ep.cases.toLocaleString()} cases</span>
                      <span className="ob-timeline-sep">|</span>
                      <span>{ep.deaths.toLocaleString()} deaths</span>
                      <span className="ob-timeline-sep">|</span>
                      <span>CFR {cfr}%</span>
                    </div>
                    {ep.response_summary && (
                      <p className="ob-timeline-text">{ep.response_summary}</p>
                    )}
                    {ep.lessons && (
                      <div className="ob-timeline-lessons">
                        <strong>Lessons:</strong> {ep.lessons}
                      </div>
                    )}
                    {ep.source_urls.length > 0 && (
                      <div className="ob-timeline-sources">
                        {ep.source_urls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ob-source-link"
                          >
                            Source {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// NOW PANE — Live event feed + epi curve + country risk
// ═══════════════════════════════════════════════════════════════

function NowPane({
  events,
  stats,
  epiCurve,
  outbreak,
  capacity,
  loadingStats,
  loadingEvents,
  loadingEpiCurve,
  loadingCapacity,
  onCitationClick,
}: {
  events: OutbreakEvent[];
  stats?: OutbreakStats;
  epiCurve: EpiCurvePoint[];
  outbreak: Outbreak;
  capacity?: OutbreakCapacity;
  loadingStats?: boolean;
  loadingEvents?: boolean;
  loadingEpiCurve?: boolean;
  loadingCapacity?: boolean;
  onCitationClick?: (c: string) => void;
}) {
  const [kindFilter, setKindFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');

  // ── Capacity scope ─────────────────────────────────────────
  // Workspace-level `capacity` is always the epicenter (COD for BDBV).
  // When the officer clicks a non-epicenter country chip in the
  // Geographic Spread grid, fetch a parallel capacity payload for THAT
  // iso3 so the readiness cards reflect the neighbor. Epicenter cache
  // stays warm — toggling back is instant.
  const epicenterIso = (outbreak.iso3 || '').toUpperCase();
  const overrideIso = countryFilter && countryFilter.toUpperCase() !== epicenterIso
    ? countryFilter.toUpperCase()
    : '';
  const { data: overrideCapacity, isLoading: loadingOverride } = useOutbreakCapacity(
    overrideIso ? outbreak.id : undefined,
    overrideIso || undefined,
  );
  const scopedCapacity = overrideIso ? overrideCapacity : capacity;
  const scopedIso = overrideIso || epicenterIso;
  const scopedLoading = overrideIso ? loadingOverride : loadingCapacity;

  // Combined filter for the right-rail live feed.
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (kindFilter && e.kind !== kindFilter) return false;
      if (countryFilter) {
        const iso = (e.payload_json?.country_iso as string) || '';
        if (iso.toUpperCase() !== countryFilter.toUpperCase()) return false;
      }
      if (sourceFilter && e.source !== sourceFilter) return false;
      return true;
    });
  }, [events, kindFilter, countryFilter, sourceFilter]);

  // Aggregate countries from signals (used by the geographic section).
  const countrySignals = useMemo(() => {
    const map: Record<string, { count: number; latest: string }> = {};
    for (const evt of events) {
      const iso = (evt.payload_json?.country_iso as string) || '';
      if (!iso) continue;
      if (!map[iso]) map[iso] = { count: 0, latest: evt.ts };
      map[iso].count++;
      if (evt.ts > map[iso].latest) map[iso].latest = evt.ts;
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [events]);

  const hasActiveFilter = !!(kindFilter || countryFilter || sourceFilter);
  const clearFilters = () => {
    setKindFilter('');
    setCountryFilter('');
    setSourceFilter('');
  };

  return (
    <div className="ob-now">
      {/* ═══════════════════════════════════════════════════════════
          UPPER 2-COLUMN — only the "where is it" context shares the
          page with the sticky AI/Brief/Feed rail. Everything below
          (trajectory, capacity, drivers, audit) goes full-width so
          dense data displays use all available horizontal space.
          ═══════════════════════════════════════════════════════════ */}
      <div className="ob-now--split">
      <div className="ob-now-main">

        {/* 1. SEVERITY — the honest headline ─────────────────── */}
        <OutbreakSeverityStrip outbreak={outbreak} stats={stats} />

        {/* 2. GEOGRAPHIC SPREAD ────────────────────────────── */}
        <SectionHeader
          title="Geographic spread"
          hint="Countries mentioned in signals. Click a country to filter the live feed."
        />
        <div className="ob-card">
          {loadingEvents ? (
            <div className="ob-loading" style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="ob-loading-spinner" />
            </div>
          ) : countrySignals.length === 0 ? (
            <p className="ob-no-data">No country data detected in signals.</p>
          ) : (
            <div className="ob-country-grid">
              {countrySignals.map(([iso, data]) => {
                const isEpicenter = iso === outbreak.iso3;
                const isNeighbor = outbreak.neighbor_iso3s?.includes(iso);
                const statusClass = isEpicenter
                  ? 'ob-country--epicenter'
                  : isNeighbor
                  ? 'ob-country--neighbor'
                  : 'ob-country--other';
                const isActive = countryFilter.toUpperCase() === iso.toUpperCase();
                const name = countryName(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`ob-country-card ${statusClass} ${isActive ? 'ob-country--active' : ''}`}
                    onClick={() => setCountryFilter(isActive ? '' : iso)}
                    title={isActive ? `Clear ${name} filter` : `${iso} · Click to filter feed to ${name}`}
                  >
                    <div className="ob-country-iso">{iso}</div>
                    <div className="ob-country-name">{name}</div>
                    <div className="ob-country-count">{data.count}</div>
                    <div className="ob-country-label">
                      {isEpicenter ? 'EPICENTER' : isNeighbor ? 'AT RISK' : 'MENTIONED'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <HotZoneMap events={events} outbreak={outbreak} />

        {/* 3. BY HEALTH ZONE — from manual tracker ─────────────── */}
        <TrackerBreakdownPanel outbreak={outbreak} />

        {/* 4. LAB TESTING — from manual tracker ─────────────── */}
        <LabTestingPanel outbreak={outbreak} />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT RAIL — sticky AI assistant + brief + live feed.
          Sits beside Severity / Geographic spread only; below the
          trajectory the page goes full-width.
          ═══════════════════════════════════════════════════════════ */}
      <aside className="ob-now-rail">
        <div className="ob-rail-section ob-rail-section--chat">
          <LlmAssistant
            outbreakId={outbreak.id}
            onCitationClick={(c) => onCitationClick?.(c)}
            defaultExpanded={true}
          />
        </div>

        <OutbreakBriefCard outbreak={outbreak} />

        <div className="ob-rail-section ob-rail-section--feed">
          <div className="ob-card ob-feed-card">
            <div className="ob-feed-header">
              <h3 className="ob-card-title">Live signal feed</h3>
              <select
                className="ob-feed-filter"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
              >
                <option value="">All kinds</option>
                <option value="signal">Signal</option>
                <option value="forecast">Forecast</option>
                <option value="burial">Burial</option>
                <option value="hcw_infection">HCW infection</option>
                <option value="silence_anomaly">Silence</option>
                <option value="mobility">Mobility</option>
              </select>
            </div>
            {hasActiveFilter && (
              <div className="ob-feed-filters">
                {countryFilter && (
                  <button type="button" className="ob-filter-chip" onClick={() => setCountryFilter('')}>
                    country: {countryFilter} ×
                  </button>
                )}
                {sourceFilter && (
                  <button type="button" className="ob-filter-chip" onClick={() => setSourceFilter('')}>
                    source: {sourceFilter} ×
                  </button>
                )}
                {kindFilter && (
                  <button type="button" className="ob-filter-chip" onClick={() => setKindFilter('')}>
                    kind: {kindFilter} ×
                  </button>
                )}
                <button type="button" className="ob-filter-clear" onClick={clearFilters}>
                  clear all
                </button>
              </div>
            )}
            <div className="ob-feed-list">
              {loadingEvents ? (
                <div className="ob-loading" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="ob-loading-spinner" />
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="ob-feed-empty">
                  {hasActiveFilter ? (
                    <>
                      <div className="ob-feed-empty__icon">
                        <Radio size={28} strokeWidth={1.4} />
                      </div>
                      <div className="ob-feed-empty__title">No signals match these filters</div>
                      <div className="ob-feed-empty__hint">
                        Try removing one of the active filters above, or ask the assistant
                        on the left for a summary of what's currently coming in.
                      </div>
                      <button
                        type="button"
                        className="ob-feed-empty__action"
                        onClick={clearFilters}
                      >
                        Clear all filters
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="ob-feed-empty__icon">
                        <Radio size={28} strokeWidth={1.4} />
                      </div>
                      <div className="ob-feed-empty__title">No signals yet</div>
                      <div className="ob-feed-empty__hint">
                        Click the refresh icon in the banner to pull a fresh batch,
                        or wait for the next 4-hour auto-refresh.
                      </div>
                    </>
                  )}
                </div>
              ) : (
                filteredEvents.map((evt) => (
                  <SignalCard
                    key={evt.id}
                    event={evt}
                    onCountryClick={(iso) => setCountryFilter(iso)}
                    onSourceClick={(src) => setSourceFilter(src)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </aside>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          FULL-WIDTH SECTION — trajectory chart through audit.
          Below this point the page uses all available width; no rail.
          ═══════════════════════════════════════════════════════════ */}
      <div className="ob-now-wide">

        {/* 3. TRAJECTORY ──────────────────────────────────── */}
        <SectionHeader
          title="Trajectory"
          hint="Daily signal volume (filled) vs running cumulative (dashed). Watch for slope changes."
        />
        <div className="ob-card">
          {loadingEpiCurve ? (
            <div className="ob-loading" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="ob-loading-spinner" />
            </div>
          ) : epiCurve.length === 0 ? (
            <p className="ob-no-data">No signal data to chart yet.</p>
          ) : (
            <EpiCurveChart data={epiCurve} />
          )}
        </div>

        {/* 4. RESPONSE READINESS ─────────────────────────────
            The old "Can We Respond?" composite. Reframed as a
            CAPACITY score — what we have to fight back with. The
            severity verdict above already told the officer how bad
            things are; this answers the second question.
            All cards here read `scopedCapacity` / `scopedIso` so they
            follow the country chip click in Geographic Spread. */}
        <SectionHeader
          title="Response readiness"
          hint={overrideIso
            ? `Capacity for ${countryName(scopedIso)} — what an at-risk neighbor has to respond with.`
            : 'Capacity — what we have to respond with. Red sub-scores are the bottlenecks slowing response.'}
        />
        {overrideIso && (
          <div className="ob-scope-pill">
            <span className="ob-scope-pill__label">Viewing capacity for</span>
            <strong>{countryName(scopedIso)}</strong>
            <span className="ob-scope-pill__iso">({scopedIso})</span>
            <button
              type="button"
              className="ob-scope-pill__back"
              onClick={() => setCountryFilter('')}
              title={`Back to epicenter (${countryName(epicenterIso)})`}
            >
              back to epicenter ×
            </button>
          </div>
        )}
        <CanWeRespondCard capacity={scopedCapacity} loading={scopedLoading} />
        <div className="ob-capacity-grid">
          <ReadinessCard
            capacity={scopedCapacity}
            pathogenName={outbreak.pathogen.name}
            iso3={scopedIso}
          />
          <SeasonalSpilloverCard capacity={scopedCapacity} outbreak={outbreak} />
        </div>
        <div className="ob-capacity-grid">
          <IhrCapacityCard capacity={scopedCapacity} iso3={scopedIso} />
          <ChwDeploymentCard capacity={scopedCapacity} iso3={scopedIso} />
        </div>
        <PoEReadinessCard iso3={scopedIso} capacity={scopedCapacity} />

        {/* 5. TRANSMISSION DRIVERS ──────────────────────────── */}
        <SectionHeader
          title="Transmission drivers"
          hint="What's actively pushing spread — unsafe burials, HCW infections, animal mortality, environmental triggers."
        />
        {/* Full One Health spillover assessment for this pathogen — peer
            countries, recommended actions, signal breakdown. Sits at top
            of the drivers section because spillover IS the upstream driver
            for zoonotic outbreaks. */}
        <OneHealthSpilloverPanel
          capacity={scopedCapacity}
          epicenterIso={epicenterIso}
          neighbourIsos={outbreak.neighbor_iso3s || []}
        />
        <div className="ob-widget-grid">
          {widgetsFor(outbreak)
            .filter((key) => key !== 'capacity' && key !== 'spillover' && WIDGET_REGISTRY[key])
            .map((key) => {
              const Widget = WIDGET_REGISTRY[key];
              return (
                <Widget
                  key={key}
                  events={events}
                  outbreak={outbreak}
                  onSelectEvent={(id) => onCitationClick?.(`evt:${id}`)}
                />
              );
            })}
        </div>

        {/* 6. AUDIT ─────────────────────────────────────────── */}
        <SectionHeader
          title="Source audit"
          hint="Provenance — which adaptors are alive and which sources contributed."
        />
        {loadingStats ? (
          <div className="ob-card">
            <h3 className="ob-card-title">Sources Reporting</h3>
            <div className="ob-loading" style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="ob-loading-spinner" />
            </div>
          </div>
        ) : stats?.by_source && (
          <div className="ob-card">
            <h3 className="ob-card-title">Sources reporting · click to filter feed</h3>
            <div className="ob-source-grid">
              {Object.entries(stats.by_source).map(([src, count]) => {
                const isActive = sourceFilter === src;
                return (
                  <button
                    key={src}
                    type="button"
                    className={`ob-source-item ${isActive ? 'ob-source-item--active' : ''}`}
                    onClick={() => setSourceFilter(isActive ? '' : src)}
                  >
                    <span className="ob-source-name">{src}</span>
                    <span className="ob-source-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <AdaptorHealthBar outbreakId={outbreak.id} />
      </div>
    </div>
  );
}

// ─── Section header — outcome-framed label + one-line "why I care" ──
function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="ob-section-head">
      <h2 className="ob-section-head__title">{title}</h2>
      {hint && <span className="ob-section-head__hint">{hint}</span>}
    </div>
  );
}

// ─── Compact "Outbreak brief" — pinned to bottom of right rail ────────
// Three lines of always-true context (focal point · declared date · short
// summary) so the rail never trails off into blank space below the live
// feed. Cheap to render — just reads props the page already has.
function OutbreakBriefCard({ outbreak }: { outbreak: Outbreak }) {
  const declared = new Date(outbreak.declared_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const summary = (outbreak.summary || '').trim();
  const focal = (outbreak.lead_focal_point || '').trim();
  return (
    <div className="ob-rail-section ob-rail-section--brief">
      <div className="ob-card ob-brief-card">
        <h3 className="ob-card-title" style={{ marginBottom: 6 }}>Brief</h3>
        <div className="ob-brief-row">
          <span className="ob-brief-label">Declared</span>
          <span>{declared}</span>
        </div>
        {focal && (
          <div className="ob-brief-row">
            <span className="ob-brief-label">Focal point</span>
            <span>{focal}</span>
          </div>
        )}
        <div className="ob-brief-row">
          <span className="ob-brief-label">Status</span>
          <span className={`ob-brief-status ob-brief-status--${outbreak.status}`}>
            {outbreak.status.toUpperCase()}
          </span>
        </div>
        {summary && (
          <p className="ob-brief-summary" title={summary}>
            {summary.length > 220 ? summary.slice(0, 217) + '…' : summary}
          </p>
        )}
      </div>
    </div>
  );
}




// ─── Epi Curve Chart (pure CSS bars — no chart library needed) ──

function EpiCurveChart({ data }: { data: EpiCurvePoint[] }) {
  const totalSignals = data.reduce((sum, d) => sum + d.signals, 0);
  // Recharts area chart with a secondary cumulative line on a hidden axis.
  // X-axis shows day-of-month; Y is daily signal count. Tooltip shows both.
  const formatted = data.map((d) => ({
    ...d,
    day: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));
  return (
    <div className="ob-epicurve">
      <div className="ob-epicurve-summary">
        <span>{totalSignals.toLocaleString()} total signals</span>
        <span>{data.length} days tracked</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={formatted} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="ob-epi-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ob-orange)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--ob-orange)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.10)" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="var(--ob-text-dim)"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            yAxisId="daily"
            stroke="var(--ob-text-dim)"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            stroke="var(--ob-text-dim)"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--ob-surface)',
              border: '1px solid var(--ob-border)',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--ob-text)' }}
            cursor={{ stroke: 'rgba(148,163,184,0.25)' }}
          />
          <Area
            yAxisId="daily"
            type="monotone"
            dataKey="signals"
            name="Daily signals"
            stroke="var(--ob-orange)"
            strokeWidth={2}
            fill="url(#ob-epi-fill)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulative"
            name="Cumulative"
            stroke="var(--ob-blue)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}


// ─── Signal Card ────────────────────────────────────────────────

// Many ingested headlines arrive as "<native script> | <English>".
// Officers don't read 30 languages, and the English half is almost always
// present alongside the original. Pick the chunk with the highest Latin-
// alphabet density so the feed stays readable; fall back to the original
// when there's only one chunk.
function preferLatinHeadline(raw: string): { display: string; original: string | null } {
  if (!raw) return { display: raw, original: null };
  const parts = raw.split(/\s*\|\s*|\s+—\s+|\s+--\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { display: raw, original: null };
  const latinScore = (s: string) => {
    const letters = s.replace(/[^\p{L}]/gu, '');
    if (!letters) return 0;
    const latin = letters.match(/[A-Za-z]/g)?.length ?? 0;
    return latin / letters.length;
  };
  const ranked = [...parts].sort((a, b) => latinScore(b) - latinScore(a));
  const best = ranked[0];
  const rest = parts.filter((p) => p !== best).join(' | ');
  // Only count as "translated" if the best half is meaningfully more Latin
  // than the rest; otherwise both halves are roughly the same script.
  if (latinScore(best) > 0.7 && latinScore(rest) < 0.5) {
    return { display: best, original: rest };
  }
  return { display: raw, original: null };
}

function SignalCard({
  event,
  onCountryClick,
  onSourceClick,
}: {
  event: OutbreakEvent;
  onCountryClick?: (iso: string) => void;
  onSourceClick?: (source: string) => void;
}) {
  const payload = event.payload_json || {};
  const rawHeadline = (payload.headline as string) || 'No headline';
  const { display: headline, original: originalText } = preferLatinHeadline(rawHeadline);
  const countryIso = (payload.country_iso as string) || '';
  // Prefer the looked-up English country name; fall back to whatever the
  // signal carried, then to the iso code. Officers shouldn't have to memorise
  // 3-letter codes to read the feed.
  const country = countryIso ? countryName(countryIso) : (payload.country as string) || '';
  const priority = (payload.priority as string) || '';
  const sourceName = (payload.source_name as string) || event.source;
  const sourceUrl = (payload.source_url as string) || '';

  const priorityClass = priority ? `ob-priority--${priority.toLowerCase()}` : '';
  const timeAgo = getTimeAgo(event.ts);

  return (
    <div className="ob-signal-card">
      <div className="ob-signal-header">
        {priority && <span className={`ob-signal-priority ${priorityClass}`}>{priority}</span>}
        {country && (
          <button
            type="button"
            className="ob-signal-country ob-signal-chip"
            onClick={() => countryIso && onCountryClick?.(countryIso)}
            title={countryIso ? `${countryIso} · Click to filter feed to ${country}` : country}
            disabled={!countryIso || !onCountryClick}
          >
            {country}
          </button>
        )}
        <span className="ob-signal-time">{timeAgo}</span>
      </div>
      <p className="ob-signal-headline" title={originalText ? `Original: ${originalText}` : undefined}>
        {headline}
      </p>
      <div className="ob-signal-footer">
        <button
          type="button"
          className="ob-signal-source ob-signal-chip"
          onClick={() => onSourceClick?.(event.source)}
          title={`Filter feed to ${sourceName}`}
          disabled={!onSourceClick}
        >
          {sourceName}
        </button>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ob-signal-link"
          >
            Source
          </a>
        )}
        <span className="ob-signal-id">EVT-{event.id}</span>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// SCENARIO RUNNER — SEIRDV projections via wbepi engine
// ═══════════════════════════════════════════════════════════════

// Generic fallback defaults — used only when a pathogen profile has not
// shipped its own `scenario_defaults`. Calibrated for BDBV historically;
// today every supported pathogen should override via profile_json.
const FALLBACK_SCENARIO_DEFAULTS = {
  beta: 0.18,       // Transmission rate (R0 ~1.7 for BDBV)
  sigma: 1 / 8,     // Incubation rate (8 days mean)
  gamma: 1 / 12,    // Recovery rate (12 days mean)
  mu: 0.30,         // CFR ~30% for BDBV
  interv_delay: 14, // Days before intervention kicks in
  interv_efficacy: 0.4,  // IPC effectiveness
  n_populations: 3,
  ini_S: [500000, 200000, 100000],
  ini_I: [10, 2, 0],
  time: 180,
  n_sims: 5,
  population_labels: ['Population 1', 'Population 2', 'Population 3'],
};

interface ScenarioDefaults {
  beta: number;
  sigma: number;
  gamma: number;
  mu: number;
  interv_delay: number;
  interv_efficacy: number;
  n_populations: number;
  ini_S: number[];
  ini_I: number[];
  time: number;
  n_sims: number;
  population_labels: string[];
}

function resolveScenarioDefaults(outbreak: Outbreak): ScenarioDefaults {
  const profile = (outbreak.pathogen?.profile_json ?? {}) as Record<string, unknown>;
  const fromProfile = (profile.scenario_defaults ?? {}) as Partial<ScenarioDefaults>;
  // Merge pathogen-specific values on top of the fallback so missing keys
  // don't crash the runner; arrays from the profile replace fallback arrays
  // wholesale rather than being concatenated.
  return { ...FALLBACK_SCENARIO_DEFAULTS, ...fromProfile } as ScenarioDefaults;
}

interface ScenarioResult {
  status: string;
  id: number;
  summary_stats?: Record<string, unknown>;
  error_message?: string;
}

function ScenarioRunner({ outbreak }: { outbreak: Outbreak }) {
  const defaults = useMemo(() => resolveScenarioDefaults(outbreak), [outbreak]);
  // Strain label for the title; falls back to bare pathogen name when no
  // strain info is on the profile.
  const profile = (outbreak.pathogen?.profile_json ?? {}) as Record<string, unknown>;
  const strains = (profile.strains as Record<string, Record<string, unknown>> | undefined) ?? {};
  const primaryStrainKey = (profile.primary_strain as string | undefined) ?? Object.keys(strains)[0] ?? '';
  const strainLabel = primaryStrainKey
    ? primaryStrainKey.charAt(0).toUpperCase() + primaryStrainKey.slice(1)
    : '';
  const titleLabel = strainLabel
    ? `${outbreak.pathogen.name} (${strainLabel})`
    : outbreak.pathogen.name;
  const popLabels = defaults.population_labels;

  const [params, setParams] = useState({
    beta: defaults.beta,
    mu: defaults.mu,
    interv_efficacy: defaults.interv_efficacy,
    interv_delay: defaults.interv_delay,
    time: defaults.time,
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRanRef = useRef(false);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadCharts = async () => {
    if (!chartsRef.current || downloading) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(chartsRef.current, {
        backgroundColor: '#0b1220',
        scale: 2,
      });
      canvas.toBlob((blob) => {
        if (blob) {
          const date = new Date().toISOString().split('T')[0];
          saveAs(
            blob,
            `spillover-simulation-${(outbreak.iso3 || 'outbreak').toLowerCase()}-${date}.png`,
          );
        }
        setDownloading(false);
      });
    } catch (e) {
      console.error('Chart download failed', e);
      setDownloading(false);
    }
  };

  // Clear any in-flight poll if the component unmounts or pathogen changes.
  // Without this the interval keeps firing after navigation and triggers
  // React "state update on unmounted component" warnings.
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // If the pathogen changes, reset the form to its new defaults and
  // trigger a fresh auto-run so the page never shows an empty chart pane.
  useEffect(() => {
    setParams({
      beta: defaults.beta,
      mu: defaults.mu,
      interv_efficacy: defaults.interv_efficacy,
      interv_delay: defaults.interv_delay,
      time: defaults.time,
    });
    autoRanRef.current = false;
  }, [defaults]);

  // Auto-run on first mount (and when pathogen changes via the reset above).
  // Guarded by autoRanRef so the user can manually re-run via the button
  // without re-firing this effect on every render. Defined inline so the
  // ref toggle and call sit next to each other.
  useEffect(() => {
    if (autoRanRef.current || running || result) return;
    autoRanRef.current = true;
    void handleRun();
    // handleRun is stable enough for the on-mount fire; deps intentionally
    // omitted to avoid re-firing when params change (slider drags).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults]);

  const r0Estimate = (params.beta / defaults.gamma).toFixed(2);

  const handleRun = async () => {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const { api } = await import('@/lib/api');
      // Use sync mode so result comes back immediately
      const { data } = await api.post(
        'predictions/scenario-runs/adhoc/?sync=true',
        {
          seed: 42,
          parameters: {
            ...defaults,
            beta: params.beta,
            mu: params.mu,
            interv_efficacy: params.interv_efficacy,
            interv_delay: params.interv_delay,
            time: params.time,
          },
        }
      );
      setResult(data);

      if (data.status === 'SUCCESS' || data.status === 'FAILED') {
        setRunning(false);
      } else if (data.status === 'PENDING' || data.status === 'RUNNING') {
        pollForResult(api, data.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scenario run failed';
      setError(msg);
      setRunning(false);
    }
  };

  const pollForResult = (apiInstance: typeof import('@/lib/api')['api'], runId: number) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    let attempts = 0;
    const maxAttempts = 30;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const { data } = await apiInstance.get(`predictions/scenario-runs/${runId}/`);
        if (data.status === 'SUCCESS' || data.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setResult(data);
          setRunning(false);
          return;
        }
      } catch {
        // ignore polling errors; retries continue until maxAttempts
      }
      if (attempts >= maxAttempts) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setRunning(false);
        setError('Run timed out after 60s. Check scenario-runs for results.');
      }
    }, 2000);
  };

  // Extract chart data from summary_stats
  const chartData = result?.summary_stats as {
    compartments?: string[];
    populations?: number[];
    steps?: number[];
    quantiles?: Record<string, { median: number[]; q05: number[]; q25: number[]; q75: number[]; q95: number[] }>;
  } | null;

  const chartsReady = result?.status === 'SUCCESS' && !!chartData?.quantiles && !!chartData.steps;

  return (
    <div className="ob-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h3 className="ob-card-title" style={{ flex: 1 }}>
          SEIRDV Scenario Forecasting — {titleLabel}
        </h3>
        <button
          type="button"
          className="ob-ingest-btn"
          onClick={handleDownloadCharts}
          disabled={!chartsReady || downloading}
          title={chartsReady ? 'Download charts as PNG' : 'Run a scenario first'}
          aria-label="Download charts"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', fontSize: 12,
            opacity: chartsReady ? 1 : 0.5, cursor: chartsReady ? 'pointer' : 'not-allowed',
          }}
        >
          <Download size={14} />
          {downloading ? 'Saving…' : 'Download charts'}
        </button>
      </div>
      <p className="ob-card-desc" style={{ marginBottom: '1.5rem' }}>
        Stochastic SEIRDV epidemic projections via wbepi engine.
        Parameters from <code>pathogen.profile_json.scenario_defaults</code>.
        Runs synchronously — results appear below.
      </p>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        {/* LEFT: RESULTS */}
        <div style={{ flex: 1 }}>
          {!result && !running && (
            <div className="ob-empty-state" style={{ height: '300px', border: '1px dashed var(--ob-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ob-text-muted)' }}>
              Configure parameters on the right and click Run Scenario.
            </div>
          )}
          {running && (
            <div className="ob-empty-state" style={{ height: '300px', border: '1px dashed var(--ob-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ob-text-muted)' }}>
              <div className="ob-loading-spinner" style={{ marginRight: '1rem' }} /> Running simulation...
            </div>
          )}
          {result?.status === 'SUCCESS' && chartData?.quantiles && chartData.steps && (
            <div className="ob-scenario-charts" ref={chartsRef}>
              {/* Render one I-chart per population in scenario_defaults.population_labels.
                  Colors cycle through the palette; populations beyond the
                  palette length share the last color (harmless fallback). */}
              {(() => {
                const colors = ['var(--ob-red)', 'var(--ob-orange)', 'var(--ob-yellow)', 'var(--ob-blue)'];
                const charts: React.ReactNode[] = [];
                for (let i = 0; i < popLabels.length; i++) {
                  const key = `I[${i + 1}]`;
                  const q = chartData.quantiles?.[key];
                  if (!q) continue;
                  const label = popLabels[i];
                  const suffix = i === 0 ? '' : ' spillover';
                  charts.push(
                    <SEIRDVChart
                      key={key}
                      title={`Infected (I) — ${label}${suffix}`}
                      data={q}
                      steps={chartData.steps!}
                      color={colors[Math.min(i, colors.length - 1)]}
                    />,
                  );
                }
                // Deaths chart for the epicenter population only.
                const dEpi = chartData.quantiles?.['D[1]'];
                if (dEpi) {
                  charts.push(
                    <SEIRDVChart
                      key="D[1]"
                      title={`Deaths (D) — ${popLabels[0] ?? 'epicenter'}`}
                      data={dEpi}
                      steps={chartData.steps!}
                      color="var(--ob-purple)"
                    />,
                  );
                }
                return charts;
              })()}
              {/* Peak stats summary — one row per population, labels from defaults */}
              <div className="ob-scenario-summary">
                {popLabels.map((label, i) => {
                  const key = `I[${i + 1}]`;
                  const q = chartData.quantiles?.[key];
                  if (!q) return null;
                  const peakIdx = q.median.indexOf(Math.max(...q.median));
                  return (
                    <div key={key} className="ob-peak-stat">
                      <div className="ob-peak-label">{label} Peak Infected</div>
                      <div className="ob-peak-value">{Math.round(q.median[peakIdx]).toLocaleString()}</div>
                      <div className="ob-peak-range">
                        Day {chartData.steps?.[peakIdx]} (90% CI: {Math.round(q.q05[peakIdx])}–{Math.round(q.q95[peakIdx])})
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: PARAMETERS */}
        <div style={{ width: '320px', flexShrink: 0, borderLeft: '1px solid var(--ob-border)', paddingLeft: '2rem' }}>
          <div className="ob-scenario-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', gridTemplateColumns: '1fr' }}>
            <div className="ob-scenario-param">
              <label>
                Transmission rate (β): {params.beta.toFixed(3)}
                <span className="ob-param-note">R₀ ≈ {r0Estimate}</span>
              </label>
              <input
                type="range" min="0.05" max="0.40" step="0.01"
                value={params.beta}
                onChange={(e) => setParams({ ...params, beta: +e.target.value })}
              />
            </div>

            <div className="ob-scenario-param">
              <label>
                Case Fatality Rate (μ): {(params.mu * 100).toFixed(0)}%
              </label>
              <input
                type="range" min="0.10" max="0.60" step="0.01"
                value={params.mu}
                onChange={(e) => setParams({ ...params, mu: +e.target.value })}
              />
            </div>

            <div className="ob-scenario-param">
              <label>
                IPC Efficacy: {(params.interv_efficacy * 100).toFixed(0)}%
              </label>
              <input
                type="range" min="0.0" max="0.80" step="0.05"
                value={params.interv_efficacy}
                onChange={(e) => setParams({ ...params, interv_efficacy: +e.target.value })}
              />
            </div>

            <div className="ob-scenario-param">
              <label>
                Intervention Delay: {params.interv_delay} days
              </label>
              <input
                type="range" min="3" max="60" step="1"
                value={params.interv_delay}
                onChange={(e) => setParams({ ...params, interv_delay: +e.target.value })}
              />
            </div>

            <div className="ob-scenario-param">
              <label>
                Projection: {params.time} days
              </label>
              <input
                type="range" min="30" max="365" step="30"
                value={params.time}
                onChange={(e) => setParams({ ...params, time: +e.target.value })}
              />
            </div>
          </div>

          <div className="ob-scenario-actions" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              className="ob-ingest-btn"
              onClick={handleRun}
              disabled={running}
              style={{ width: '100%' }}
            >
              {running ? 'Running SEIRDV...' : 'Run Scenario'}
            </button>
            {result && (
              <span className={`ob-scenario-status ${result.status === 'SUCCESS' ? '' : 'ob-scenario-status--pending'}`} style={{ marginLeft: 0 }}>
                Run #{result.id} — {result.status}
                {result.status === 'FAILED' && result.error_message && `: ${result.error_message}`}
              </span>
            )}
            {error && <div className="ob-scenario-error" style={{ marginLeft: 0 }}>{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── SEIRDV Compartment Chart (pure CSS) ────────────────────────

function SEIRDVChart({
  title,
  data,
  steps,
  color,
}: {
  title: string;
  data?: { median: number[]; q05: number[]; q25: number[]; q75: number[]; q95: number[] };
  steps: number[];
  color: string;
}) {
  if (!data || !data.median.length) return null;

  const maxVal = Math.max(...data.q95, 1);
  const barWidth = Math.max(100 / steps.length, 2);

  return (
    <div className="ob-seirdv-chart">
      <div className="ob-seirdv-title">{title}</div>
      <div className="ob-seirdv-meta">
        Peak: {Math.round(Math.max(...data.median)).toLocaleString()} (median)
      </div>
      <div className="ob-seirdv-bars">
        {data.median.map((val, i) => {
          const medH = (val / maxVal) * 100;
          const q95H = (data.q95[i] / maxVal) * 100;
          const q05H = (data.q05[i] / maxVal) * 100;
          return (
            <div
              key={i}
              className="ob-seirdv-bar-wrap"
              style={{ width: `${barWidth}%` }}
              title={`Day ${steps[i]}: ${Math.round(val)} (90% CI: ${Math.round(data.q05[i])}–${Math.round(data.q95[i])})`}
            >
              {/* 90% CI band */}
              <div
                className="ob-seirdv-ci"
                style={{
                  height: `${q95H - q05H}%`,
                  bottom: `${q05H}%`,
                  backgroundColor: color,
                  opacity: 0.15,
                }}
              />
              {/* Median line */}
              <div
                className="ob-seirdv-median"
                style={{
                  height: `${Math.max(medH, 1)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// AHEAD PANE — Spillover risk with real signal counts + protocols
// ═══════════════════════════════════════════════════════════════

function AheadPane({ outbreak, events = [] }: { outbreak: Outbreak; events?: OutbreakEvent[] }) {
  // Compute signal counts per neighbor
  const neighborCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const iso of outbreak.neighbor_iso3s || []) {
      counts[iso] = 0;
    }
    for (const evt of events) {
      const iso = (evt.payload_json?.country_iso as string) || '';
      if (iso && counts[iso] !== undefined) {
        counts[iso]++;
      }
    }
    return counts;
  }, [events, outbreak.neighbor_iso3s]);

  // Risk level based on signal count
  const getRisk = (count: number) => {
    if (count >= 20) return { label: 'HIGH RISK', cls: 'ob-risk--high' };
    if (count >= 5) return { label: 'ELEVATED', cls: 'ob-risk--elevated' };
    if (count > 0) return { label: 'SIGNAL DETECTED', cls: 'ob-risk--signal' };
    return { label: 'MONITORING', cls: 'ob-risk--monitoring' };
  };

  // Sort neighbors by signal count descending
  const sortedNeighbors = [...(outbreak.neighbor_iso3s || [])].sort(
    (a, b) => (neighborCounts[b] || 0) - (neighborCounts[a] || 0)
  );

  return (
    <div className="ob-ahead">
      <div className="ob-card">
        <h3 className="ob-card-title">Spillover Risk Assessment — Neighboring Countries</h3>
        <p className="ob-card-desc">
          Signal intelligence from {events.length} events analyzed. Countries ranked by
          signal volume. Risk level derived from outbreak signals mentioning each country.
        </p>
        <div className="ob-neighbor-grid">
          {sortedNeighbors.map((iso) => {
            const count = neighborCounts[iso] || 0;
            const risk = getRisk(count);
            return (
              <div key={iso} className={`ob-neighbor-card ${risk.cls}`}>
                <div className="ob-neighbor-iso">{iso}</div>
                <div className="ob-neighbor-count">{count}</div>
                <div className="ob-neighbor-label">signals</div>
                <div className="ob-neighbor-status">{risk.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <ScenarioRunner outbreak={outbreak} />

      <CrossBorderSummaryCard outbreak={outbreak} events={events} />

      <ResponseProtocols outbreak={outbreak} />
    </div>
  );
}

// ─── Response Protocols — read from pathogen.profile_json (T-098) ───

interface ProtocolEntry {
  label: string;
  priority?: string;
  text: string;
}

function ResponseProtocols({ outbreak }: { outbreak: Outbreak }) {
  const profile = (outbreak.pathogen?.profile_json ?? {}) as Record<string, unknown>;
  const protocols = (profile.response_protocols as ProtocolEntry[] | undefined) ?? [];

  return (
    <div className="ob-card">
      <h3 className="ob-card-title">Response Protocols — {outbreak.pathogen.name}</h3>
      {protocols.length === 0 ? (
        <p className="ob-no-data">
          No response protocols recorded in <code>pathogen.profile_json.response_protocols</code> for {outbreak.pathogen.name}.
        </p>
      ) : (
        <div className="ob-protocol-list">
          {protocols.map((p, i) => (
            <div
              key={`${p.label}-${i}`}
              className={`ob-protocol ${p.priority === 'critical' ? 'ob-protocol--critical' : ''}`}
            >
              <strong>{p.label}{p.priority === 'critical' ? '' : ':'}</strong>{' '}
              {p.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Utility ────────────────────────────────────────────────────

function getTimeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
