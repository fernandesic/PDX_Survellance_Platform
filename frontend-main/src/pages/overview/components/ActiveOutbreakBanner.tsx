/**
 * Active Outbreak Banner — Overview Page
 *
 * Fetches active outbreaks (suspected/confirmed) and renders a compact,
 * high-visibility banner at the top of the Overview tab.
 *
 * Layout:
 *   Primary   — Suspected cases/deaths from Ministry/WHO sitrep (Outbreak row).
 *   Secondary — Latest Reported from signal MAX (cross-check, clearly labelled).
 *   as_of     — Prominent date badge so the user knows how fresh the numbers are.
 *
 * Clicking the banner navigates to /outbreak/:id.
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchOutbreaks, fetchOutbreakStats, fetchOutbreak } from '@/pages/outbreak/services/outbreakApi';
import { useOutbreakCapacity } from '@/pages/outbreak/hooks/useOutbreakCapacity';
import {
  AlertTriangle,
  ArrowRight,
  Activity,
  Skull,
  Percent,
  Users,
  Radio,
  Globe2,
  Biohazard,
  Syringe
} from 'lucide-react';

// ─── ISO3 → human name (subset for AFRO region) ──────────────
const ISO3_NAMES: Record<string, string> = {
  AGO: 'Angola', BEN: 'Benin', BWA: 'Botswana', BFA: 'Burkina Faso',
  BDI: 'Burundi', CPV: 'Cabo Verde', CMR: 'Cameroon',
  CAF: 'Central African Republic', TCD: 'Chad', COM: 'Comoros',
  COG: 'Congo', CIV: "Côte d'Ivoire", COD: 'DR Congo',
  GNQ: 'Equatorial Guinea', ERI: 'Eritrea', SWZ: 'Eswatini',
  ETH: 'Ethiopia', GAB: 'Gabon', GMB: 'Gambia', GHA: 'Ghana',
  GIN: 'Guinea', GNB: 'Guinea-Bissau', KEN: 'Kenya', LSO: 'Lesotho',
  LBR: 'Liberia', MDG: 'Madagascar', MWI: 'Malawi', MLI: 'Mali',
  MRT: 'Mauritania', MUS: 'Mauritius', MOZ: 'Mozambique', NAM: 'Namibia',
  NER: 'Niger', NGA: 'Nigeria', RWA: 'Rwanda', SEN: 'Senegal',
  SYC: 'Seychelles', SLE: 'Sierra Leone', ZAF: 'South Africa',
  SSD: 'South Sudan', TZA: 'Tanzania', TGO: 'Togo', UGA: 'Uganda',
  ZMB: 'Zambia', ZWE: 'Zimbabwe', DZA: 'Algeria',
};

interface Props {
  isLight: boolean;
}

export default function ActiveOutbreakBanner({ isLight }: Props) {
  const navigate = useNavigate();

  // Fetch active outbreaks (suspected + confirmed)
  const { data: outbreaks } = useQuery({
    queryKey: ['outbreaks-active-banner'],
    queryFn: fetchOutbreaks,
    refetchInterval: 60_000,
  });

  // Filter to active only
  const active = (outbreaks ?? []).filter(
    (o) => o.status === 'suspected' || o.status === 'confirmed'
  );

  // Show banner for the first (most recent) active outbreak
  const outbreak = active[0];

  // Fetch full details of the active outbreak (to get latest_tracker, etc.)
  const { data: fullOutbreak } = useQuery({
    queryKey: ['outbreak-detail-banner', outbreak?.id],
    queryFn: () => fetchOutbreak(outbreak!.id),
    enabled: !!outbreak,
    refetchInterval: 60_000,
  });

  const currentOutbreak = fullOutbreak ?? outbreak;

  // Fetch stats for that outbreak
  const { data: stats } = useQuery({
    queryKey: ['outbreak-stats-banner', outbreak?.id],
    queryFn: () => fetchOutbreakStats(outbreak!.id),
    enabled: !!outbreak,
    refetchInterval: 60_000,
  });

  // Fetch capacity for that outbreak (used for Spillover tile)
  const { data: capacity } = useOutbreakCapacity(outbreak?.id);

  if (!outbreak) return null;

  const countryName = ISO3_NAMES[currentOutbreak.iso3] || currentOutbreak.iso3;
  const pathogenName = currentOutbreak.pathogen?.name || currentOutbreak.pathogen_name || 'Unknown';
  
  const severityColors: Record<string, string> = {
    critical: 'from-red-950/80 to-red-900/40 border-red-500/40',
    high: 'from-orange-950/60 to-orange-900/30 border-orange-500/30',
    moderate: 'from-amber-950/50 to-amber-900/20 border-amber-500/25',
    low: 'from-slate-800/60 to-slate-700/30 border-slate-500/20',
  };
  const severityGlow: Record<string, string> = {
    critical: 'shadow-red-500/10',
    high: 'shadow-orange-500/8',
    moderate: 'shadow-amber-500/5',
    low: '',
  };
  const bgClass = severityColors[currentOutbreak.severity] || severityColors.moderate;
  const glowClass = severityGlow[currentOutbreak.severity] || '';

  // ─── Outbreak workspace header replica resolution logic ───
  const t = currentOutbreak.latest_tracker;

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

  // Spillover resolution
  const sp = capacity?.spillover;
  const score = sp?.score ?? null;
  let spilloverTone: Tone = 'muted';
  let bandLabel = 'no data';
  if (score != null) {
    if (score >= 70) { spilloverTone = 'red'; bandLabel = 'HIGH'; }
    else if (score >= 50) { spilloverTone = 'amber'; bandLabel = 'ELEVATED'; }
    else if (score >= 30) { spilloverTone = 'amber'; bandLabel = 'WATCH'; }
    else { spilloverTone = 'default'; bandLabel = 'LOW'; }
  }
  const p30 = sp?.p_spillover_30d;
  const spilloverSub = score == null
    ? (sp?.data_available ? 'engine returned no score' : 'engine unreachable')
    : (p30 != null ? `${bandLabel} · 30d P ${(p30 * 100).toFixed(1)}%` : bandLabel);

  // Vaccine resolution
  const profile = (currentOutbreak.pathogen?.profile_json ?? {}) as Record<string, unknown>;
  const strains = (profile.strains as Record<string, Record<string, unknown>> | undefined) ?? {};
  const primaryStrainKey = (profile.primary_strain as string | undefined)
    ?? (Object.keys(strains)[0] || '');
  const strainInfo = primaryStrainKey ? strains[primaryStrainKey] : undefined;
  const strainLabel = primaryStrainKey
    ? primaryStrainKey.charAt(0).toUpperCase() + primaryStrainKey.slice(1)
    : '';

  const strainVaccineAvailable = strainInfo?.vaccine_available as boolean | undefined;
  const strainVaccineName = strainInfo?.vaccine_name as string | null | undefined;
  const vaccineAvailable = strainVaccineAvailable !== undefined
    ? strainVaccineAvailable
    : !!currentOutbreak.pathogen?.vaccine_available;
  const vaccineDisplayName = vaccineAvailable
    ? (strainVaccineName || (currentOutbreak.pathogen?.profile_json as { vaccine_name?: string } | undefined)?.vaccine_name || 'AVAILABLE')
    : 'NONE';
  const vaccineDetail = vaccineAvailable
    ? `Approved vaccine for ${strainLabel || pathogenName}`
    : `No approved vaccine for ${strainLabel || pathogenName}`;

  return (
    <div
      className={`
        group relative rounded-xl border bg-gradient-to-r ${bgClass}
        p-4 mb-4 cursor-pointer transition-all duration-300
        hover:scale-[1.005] hover:shadow-lg ${glowClass}
      `}
      onClick={() => navigate(`/outbreak/${currentOutbreak.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/outbreak/${currentOutbreak.id}`)}
    >
      {/* ── Top bar: badge + pathogen + country + status ──── */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className="inline-flex items-center gap-1.5 bg-red-500/90 text-white text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          ACTIVE OUTBREAK
        </span>
        <h3 className="text-white font-bold text-base tracking-tight">
          {pathogenName}
          {strainLabel && <span className="text-orange-400 font-normal text-xs ml-1">({strainLabel})</span>}
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          isLight ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-300'
        }`}>
          {countryName}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
          currentOutbreak.status === 'confirmed'
            ? 'bg-red-500/20 text-red-400'
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {currentOutbreak.status}
        </span>
        <span className="text-[11px] text-gray-400 ml-auto hidden sm:inline">
          Declared {new Date(currentOutbreak.declared_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* ── Metrics Grid (10-Tile replica of outbreak workspace header) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-2 mb-3">
        <MetricTile
          icon={<Activity className="w-4 h-4" />}
          value={confirmedCases}
          label="Confirmed cases"
          sub={deltaSub(t?.new_confirmed_cases)}
          tone={confirmedCases == null ? 'muted' : 'default'}
          fallback="Pending"
          isLight={isLight}
        />
        <MetricTile
          icon={<Activity className="w-4 h-4" />}
          value={suspectedCases}
          label="Suspected cases"
          sub={deltaSub(t?.new_suspected_cases)}
          tone={suspectedCases == null ? 'muted' : 'default'}
          fallback="Pending"
          isLight={isLight}
        />
        <MetricTile
          icon={<Skull className="w-4 h-4" />}
          value={confirmedDeaths}
          label="Confirmed deaths"
          sub={deltaSub(t?.new_confirmed_deaths)}
          tone={
            confirmedDeaths == null ? 'muted'
            : confirmedDeaths > 0 ? 'red' : 'default'
          }
          fallback="Pending"
          isLight={isLight}
        />
        <MetricTile
          icon={<Skull className="w-4 h-4" />}
          value={suspectedDeaths}
          label="Suspected deaths"
          sub={deltaSub(t?.new_suspected_deaths)}
          tone={
            suspectedDeaths == null ? 'muted'
            : suspectedDeaths > 0 ? 'red' : 'default'
          }
          fallback="Pending"
          isLight={isLight}
        />
        <MetricTile
          icon={<Percent className="w-4 h-4" />}
          value={cfr != null ? `${cfr.toFixed(1)}%` : 'n/a'}
          label="CFR (confirmed)"
          sub={cfrSub}
          tone={cfrTone}
          isLight={isLight}
        />
        <MetricTile
          icon={<Users className="w-4 h-4" />}
          value={contacts}
          label="Contacts followed"
          sub={deltaSub(t?.new_contacts)}
          tone={contacts == null ? 'muted' : 'default'}
          fallback="Pending"
          isLight={isLight}
        />
        <MetricTile
          icon={<Radio className="w-4 h-4" />}
          value={stats?.total_events ?? 0}
          label="Signals"
          sub={`+${(stats?.events_24h ?? 0).toLocaleString()} 24h · ${(stats?.events_7d ?? 0).toLocaleString()} 7d`}
          tone={(stats?.events_24h ?? 0) > 0 ? 'amber' : 'default'}
          isLight={isLight}
        />
        <MetricTile
          icon={<Globe2 className="w-4 h-4" />}
          value={stats?.countries_detected?.length ?? 0}
          label="Countries"
          sub={stats?.countries_detected?.slice(0, 6).join(', ') || 'none'}
          isLight={isLight}
        />
        <MetricTile
          icon={<Biohazard className="w-4 h-4" />}
          value={score != null ? Math.round(score) : '—'}
          label="Spillover"
          sub={spilloverSub}
          tone={spilloverTone}
          isLight={isLight}
        />
        <MetricTile
          icon={<Syringe className="w-4 h-4" />}
          value={vaccineDisplayName}
          label="Vaccine"
          sub={vaccineDetail}
          tone={vaccineAvailable ? 'default' : 'red'}
          isLight={isLight}
        />
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 mt-1.5 text-xs text-gray-400">
        <div className="flex items-center gap-3">
          {currentOutbreak.confirmed_as_of && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Data As of</span>
              <span className="font-bold text-white text-[11px]">
                {new Date(currentOutbreak.confirmed_as_of).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-white transition-colors">
          <span className="font-bold text-[10px] tracking-widest uppercase">Open Workspace</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}

// ─── Unified Metric Tile Component ─────────────────────────────

type Tone = 'default' | 'muted' | 'amber' | 'red';

interface MetricTileProps {
  icon: React.ReactNode;
  value: number | string | null;
  label: string;
  sub?: string;
  tone?: Tone;
  fallback?: string;
  isLight: boolean;
}

function MetricTile({
  icon,
  value,
  label,
  sub,
  tone = 'default',
  fallback = '—',
  isLight,
}: MetricTileProps) {
  const display =
    value === null || value === undefined
      ? fallback
      : typeof value === 'number'
      ? value.toLocaleString()
      : value;

  let valueColorClass = 'text-slate-100';
  let leftBorderClass = '';

  if (tone === 'muted') {
    valueColorClass = 'text-gray-500 font-semibold text-[11px]';
  } else if (tone === 'red') {
    leftBorderClass = 'border-l-[3px] border-l-red-500 pl-2';
    valueColorClass = 'text-red-400';
  } else if (tone === 'amber') {
    leftBorderClass = 'border-l-[3px] border-l-orange-500 pl-2';
    valueColorClass = 'text-orange-400';
  }

  const tileBg = isLight ? 'bg-white/10' : 'bg-white/[0.04]';
  const borderClass = 'border-white/[0.06]';

  return (
    <div className={`flex flex-col justify-between p-2.5 rounded border ${borderClass} ${tileBg} ${leftBorderClass} min-h-[78px] transition-all duration-200`}>
      <div className="flex items-center gap-1.5 text-gray-400">
        <span className="inline-flex shrink-0 text-gray-500">{icon}</span>
        <span className="text-[9px] uppercase tracking-wider font-bold truncate" title={label}>{label}</span>
      </div>
      <div className={`text-base font-extrabold leading-tight mt-1.5 tabular-nums ${valueColorClass}`}>
        {display}
      </div>
      {sub ? (
        <div className="text-[10px] text-gray-500 truncate mt-1 leading-normal" title={sub}>
          {sub}
        </div>
      ) : (
        <div className="h-3.5" />
      )}
    </div>
  );
}
