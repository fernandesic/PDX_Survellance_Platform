import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Languages,
  MapPin,
  Clock,
  Loader2,
  ChevronDown,
  RotateCw,
  X,
  Filter,
  Check,
} from 'lucide-react';
import { AgentBadge } from './AgentBadge';
import type { ActiveFilters, AlertLevel, DateRange, ProcessedAlert, Signal } from '../types';
import { EMPTY_FILTERS } from '../types';
import {
  filterBySearch,
  formatRelativeTime,
  groupByPriority,
  toProcessedAlert,
} from './alertFeedUtils';
import { AlertDetail } from './AlertDetail';
import { useAlertTranslation } from './useAlertTranslation';
import { localLanguageForCountry } from './feedLanguages';
import { useDebounce } from '@/utils';
import { AFRO_COUNTRIES, DISEASE_KEYWORDS } from '../constants';
import { countActiveFilters } from './alertFiltersUtils';

interface AlertFeedProps {
  alerts: Signal[];
  selectedAlertId: string | null;
  onSelectAlert: (id: string | null) => void;
  loading?: boolean;
  onRefresh?: () => void;
  filters?: ActiveFilters;
  onFiltersChange?: (filters: ActiveFilters) => void;
  availableCountryIso3s?: string[] | null;
  activeCountry?: string | null;
  onClearCountry?: () => void;
}

const DATE_RANGES: DateRange[] = ['24h', '3d', '7d', '30d', 'all'];
const PRIORITY_LEVELS: AlertLevel[] = ['P1', 'P2', 'P3', 'P4'];

export function AlertFeed({
  alerts,
  selectedAlertId,
  onSelectAlert,
  loading = false,
  onRefresh,
  filters,
  onFiltersChange,
  availableCountryIso3s,
  activeCountry,
  onClearCountry,
}: AlertFeedProps) {
  const [search, setSearch] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const debouncedSearch = useDebounce(search, 250);
  const scrollRef = useRef<HTMLDivElement>(null);

  const processed = useMemo(() => alerts.map(toProcessedAlert), [alerts]);
  const filtered = useMemo(() => filterBySearch(processed, debouncedSearch), [processed, debouncedSearch]);
  const groups = useMemo(() => groupByPriority(filtered), [filtered]);
  const totalVisible = groups.critical.length + groups.high.length + groups.monitoring.length;
  const activeFilterCount = filters ? countActiveFilters(filters) : 0;

  useEffect(() => {
    if (!selectedAlertId || !debouncedSearch) return;
    const visible = filtered.some((a) => a.id === selectedAlertId);
    if (!visible) onSelectAlert(null);
  }, [selectedAlertId, filtered, debouncedSearch, onSelectAlert]);

  useEffect(() => {
    if (!selectedAlertId || !scrollRef.current) return;
    const container = scrollRef.current;
    const el = container.querySelector<HTMLElement>(
      `[data-alert-id="${CSS.escape(selectedAlertId)}"]`,
    );
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const fullyVisible =
      elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom;
    if (fullyVisible) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedAlertId]);

  const handleDateRange = useCallback((range: DateRange) => {
    if (filters && onFiltersChange) {
      onFiltersChange({ ...filters, dateRange: range });
    }
  }, [filters, onFiltersChange]);

  const handleDisease = useCallback((code: string) => {
    if (filters && onFiltersChange) {
      onFiltersChange({ ...filters, diseases: code ? [code] : [] });
    }
  }, [filters, onFiltersChange]);

  const handleCountry = useCallback((iso3: string) => {
    if (filters && onFiltersChange) {
      onFiltersChange({ ...filters, countries: iso3 ? [iso3] : [] });
    }
  }, [filters, onFiltersChange]);

  const handlePriority = useCallback((level: AlertLevel) => {
    if (!filters || !onFiltersChange) return;
    const exists = filters.priorities.includes(level);
    const priorities = exists
      ? filters.priorities.filter((p) => p !== level)
      : [...filters.priorities, level];
    onFiltersChange({ ...filters, priorities });
  }, [filters, onFiltersChange]);

  const handleReset = useCallback(() => {
    if (onFiltersChange) onFiltersChange({ ...EMPTY_FILTERS });
    setSearch('');
  }, [onFiltersChange]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-[#0B1120]"
      data-testid="alert-feed"
    >
      {/* ── Header: Search + Fetch + Filter toggle ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search disease, country…"
            aria-label="search alerts"
            className="w-full rounded-lg bg-white/[0.04] py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-600 focus:bg-white/[0.06] focus:outline-none"
          />
        </div>
        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-colors ${filtersExpanded || activeFilterCount > 0
              ? 'bg-sky-500/10 text-sky-400'
              : 'text-slate-500 hover:text-slate-300'
            }`}
          title="Toggle filters"
        >
          <Filter className="h-3 w-3" />
          {activeFilterCount > 0 ? (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500/20 px-1 text-[9px] font-bold text-sky-300">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          title="Fetch latest"
          className="inline-flex items-center rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
        >
          <RotateCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Compact filters (collapsed by default) ── */}
      {filtersExpanded && filters && onFiltersChange ? (
        <div className="space-y-2 px-3 pb-2" data-testid="alert-filters">
          {/* Row 1: Date range chips */}
          <div className="flex items-center gap-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => handleDateRange(range)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${filters.dateRange === range
                    ? 'bg-white/[0.08] text-white'
                    : 'text-slate-600 hover:text-slate-400'
                  }`}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
            {activeCountry ? (
              <button
                type="button"
                onClick={onClearCountry}
                data-testid="country-filter-badge"
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                <MapPin className="h-2.5 w-2.5" />
                {activeCountry}
                <X className="h-2 w-2" />
              </button>
            ) : null}
          </div>

          {/* Row 2: Disease + Country dropdowns */}
          <div className="flex gap-1.5">
            <CompactSelect
              value={filters.diseases[0] ?? ''}
              onChange={handleDisease}
              placeholder="All diseases"
              options={DISEASE_KEYWORDS.map((d) => ({ value: d.code, label: d.name }))}
              testId="alert-filters-disease"
            />
            <CompactSelect
              value={filters.countries[0] ?? ''}
              onChange={handleCountry}
              placeholder="All countries"
              options={AFRO_COUNTRIES.map((c) => ({ value: c.iso3, label: `${c.flag} ${c.name}` }))}
              testId="alert-filters-country"
            />
          </div>

          {/* Row 3: Priority toggles + reset */}
          <div className="flex items-center gap-1" data-testid="alert-filters-severity">
            {PRIORITY_LEVELS.map((level) => {
              const active = filters.priorities.includes(level);
              const dotColor = level === 'P1' ? 'bg-red-500' : level === 'P2' ? 'bg-orange-500' : level === 'P3' ? 'bg-amber-500' : 'bg-slate-500';
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => handlePriority(level)}
                  data-testid={`alert-filters-severity-${level}`}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${active
                      ? 'bg-white/[0.08] text-slate-200'
                      : 'text-slate-600 hover:text-slate-400'
                    }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? dotColor : 'bg-slate-700'}`} />
                  {level}
                </button>
              );
            })}
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleReset}
              disabled={activeFilterCount === 0}
              data-testid="alert-filters-reset"
              className="text-[9px] font-semibold text-slate-600 transition-colors hover:text-red-400 disabled:opacity-25"
            >
              Reset
            </button>
          </div>
        </div>
      ) : filters ? (
        /* When filters collapsed, just show date chips in one slim row */
        <div className="flex items-center gap-1 px-3 pb-1.5" data-testid="time-filter-bar">
          {DATE_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => handleDateRange(range)}
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${filters.dateRange === range
                  ? 'bg-white/[0.08] text-white'
                  : 'text-slate-600 hover:text-slate-400'
                }`}
            >
              {range === 'all' ? 'All' : range}
            </button>
          ))}
          {activeCountry ? (
            <button
              type="button"
              onClick={onClearCountry}
              data-testid="country-filter-badge"
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 hover:bg-emerald-500/20"
            >
              <MapPin className="h-2.5 w-2.5" />
              {activeCountry}
              <X className="h-2 w-2" />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── Feed list ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && alerts.length === 0 ? (
          <FeedSkeleton />
        ) : totalVisible === 0 ? (
          <div
            className="flex h-full min-h-[200px] items-center justify-center p-8 text-center text-[11px] text-slate-600"
            data-testid="alert-feed-empty"
          >
            {alerts.length === 0 ? 'No alerts' : 'No alerts match your filters'}
          </div>
        ) : (
          <ContinuousFeed
            alerts={[...groups.critical, ...groups.high, ...groups.monitoring]}
            allSignals={alerts}
            selectedAlertId={selectedAlertId}
            onSelectAlert={onSelectAlert}
            onRefresh={onRefresh}
          />
        )}
      </div>
    </div>
  );
}

/* ── Compact dropdown for filters ── */
interface CompactSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  testId?: string;
}

function CompactSelect({ value, onChange, options, placeholder, testId }: CompactSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        type="button"
        data-testid={testId}
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[10px] text-slate-300 transition-colors hover:bg-white/[0.06] ${open ? 'bg-white/[0.06]' : ''}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`h-2.5 w-2.5 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg bg-[#0f172a] py-0.5 shadow-xl ring-1 ring-white/[0.06]">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[10px] transition-colors ${!value ? 'text-sky-400' : 'text-slate-400 hover:bg-white/[0.04]'
              }`}
          >
            {!value ? <Check className="h-2.5 w-2.5" /> : <span className="w-2.5" />}
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[10px] transition-colors ${value === opt.value ? 'text-sky-400' : 'text-slate-400 hover:bg-white/[0.04]'
                }`}
            >
              {value === opt.value ? <Check className="h-2.5 w-2.5" /> : <span className="w-2.5" />}
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Continuous feed ── */
interface ContinuousFeedProps {
  alerts: ProcessedAlert[];
  allSignals: Signal[];
  selectedAlertId: string | null;
  onSelectAlert: (id: string | null) => void;
  onRefresh?: () => void;
}

const GROUP_INITIAL_RENDER = 50;
const GROUP_RENDER_STEP = 50;

function ContinuousFeed({
  alerts,
  allSignals,
  selectedAlertId,
  onSelectAlert,
  onRefresh,
}: ContinuousFeedProps) {
  const [visibleCount, setVisibleCount] = useState(GROUP_INITIAL_RENDER);

  useEffect(() => {
    if (!selectedAlertId) return;
    const idx = alerts.findIndex((a) => a.id === selectedAlertId);
    if (idx >= 0 && idx >= visibleCount) setVisibleCount(idx + 1);
  }, [selectedAlertId, alerts, visibleCount]);

  const firstId = alerts[0]?.id;
  useEffect(() => { setVisibleCount(GROUP_INITIAL_RENDER); }, [firstId]);

  if (alerts.length === 0) return null;
  const visibleAlerts = alerts.slice(0, visibleCount);
  const hidden = alerts.length - visibleAlerts.length;

  return (
    <section aria-label="all alerts" className="p-2">
      <ul data-testid="alert-feed-list" className="space-y-2">
        {visibleAlerts.map((alert) => (
          <React.Fragment key={alert.id}>
            <AlertCard
              alert={alert}
              selected={alert.id === selectedAlertId}
              onSelect={onSelectAlert}
            />
            {alert.id === selectedAlertId ? (
              <li className="list-none overflow-hidden rounded-xl border border-sky-500/30 bg-[#070B14]">
                <AlertDetail
                  signal={alert.raw}
                  allSignals={allSignals}
                  onClose={() => onSelectAlert(null)}
                  onUpdate={onRefresh}
                />
              </li>
            ) : null}
          </React.Fragment>
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + GROUP_RENDER_STEP)}
          data-testid="alert-feed-show-more"
          className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:text-slate-400"
        >
          <ChevronDown className="h-3 w-3" />
          Show {Math.min(hidden, GROUP_RENDER_STEP)} more
          <span className="text-slate-700">· {hidden} hidden</span>
        </button>
      ) : null}
    </section>
  );
}

/* ── Alert card ── */
interface AlertCardProps {
  alert: ProcessedAlert;
  selected: boolean;
  onSelect: (id: string | null) => void;
}

const PRIORITY_STYLE: Record<ProcessedAlert['priority'], { dot: string; text: string; label: string }> = {
  P1: { dot: 'bg-red-500', text: 'text-red-400', label: 'CRITICAL' },
  P2: { dot: 'bg-orange-500', text: 'text-orange-400', label: 'HIGH' },
  P3: { dot: 'bg-amber-500', text: 'text-amber-400', label: 'MEDIUM' },
  P4: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'LOW' },
};

const AlertCard = React.memo(function AlertCard({
  alert,
  selected,
  onSelect,
}: AlertCardProps) {
  const [translationRequested, setTranslationRequested] = useState(false);

  const sourceLang = (alert.originalLanguage || 'en').toLowerCase();
  const localLang = localLanguageForCountry(alert.countryIso3);
  const targetLang = sourceLang === 'en' ? localLang : 'en';
  const canTranslate = sourceLang !== targetLang && (alert.originalText || alert.title || '').length >= 3;

  const translationSource = alert.originalText || alert.title;
  const translation = useAlertTranslation({
    text: translationRequested ? translationSource : '',
    sourceLang: translationRequested ? sourceLang : 'en',
    targetLang: translationRequested ? targetLang : 'en',
    initialTranslation: translationRequested && targetLang === 'en' ? alert.translatedText ?? null : null,
  });

  const showingTranslated = translationRequested && translation.view === 'translated' && translation.translated;
  const displayTitle = showingTranslated ? translation.translated! : alert.title;

  const priority = PRIORITY_STYLE[alert.priority];
  const sourceLangLabel = sourceLang.slice(0, 2).toUpperCase();
  const targetLangLabel = targetLang.slice(0, 2).toUpperCase();

  const handleTranslate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!translationRequested) {
      setTranslationRequested(true);
      return;
    }
    if (showingTranslated) {
      translation.showOriginal();
    } else {
      void translation.translate();
    }
  };

  useEffect(() => {
    if (translationRequested && !translation.translated && !translation.loading) {
      void translation.translate();
    }
  }, [translationRequested]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasTags =
    (alert.aiClassification && alert.aiClassification !== 'no_alert') || !!alert.aiSeverity;

  return (
    <li
      className={`block w-full overflow-hidden rounded-xl border transition-all ${selected
          ? 'border-sky-500/50 bg-sky-500/10 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
        }`}
      onClick={() => onSelect(selected ? null : alert.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(selected ? null : alert.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      data-testid="alert-card"
      data-alert-id={alert.id}
    >
      <div className="space-y-1.5 px-3 py-2.5">
        {/* Row 1 — priority + Tier 0 ground-truth badge */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em]">
          <div className={`flex items-center gap-1.5 ${priority.text}`}>
            <span className={`h-2 w-2 rounded-full ${priority.dot}`} />
            <span>{priority.label}</span>
          </div>
          {alert.sourceTier === 0 ? (
            <span
              data-testid="tier0-badge"
              title="Field Intelligence — Community Health Worker ground-truth report"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-300 ring-1 ring-emerald-500/30"
            >
              🏥 TIER 0 · FIELD
            </span>
          ) : null}
        </div>

        {/* Translate button — only when non-English */}
        {canTranslate ? (
          <button
            type="button"
            onClick={handleTranslate}
            disabled={translation.loading}
            data-testid="alert-card-translate"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-500 transition-colors hover:bg-white/[0.06] disabled:opacity-60"
          >
            {translation.loading ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Languages className="h-2.5 w-2.5" />
            )}
            {sourceLangLabel} → {targetLangLabel}
          </button>
        ) : null}

        {/* Headline */}
        <p
          className="text-[13px] font-semibold leading-snug text-white"
          data-testid="alert-card-title"
        >
          {displayTitle}
        </p>

        {/* AI badge */}
        {hasTags ? (
          <AgentBadge
            aiClassification={alert.aiClassification}
            aiSeverity={alert.aiSeverity}
            confidence={alert.confidenceScore}
            aiReasoning={alert.raw.ai_reasoning}
          />
        ) : null}

        {/* Footer meta */}
        <div className="flex items-center gap-2 pt-1.5 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />
            {alert.countryName}
          </span>
          <span>·</span>
          <span className="truncate">{alert.sourceName}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-2.5 w-2.5" />
            {formatRelativeTime(alert.publishedAt)}
          </span>
        </div>
      </div>
    </li>
  );
});

function FeedSkeleton() {
  return (
    <div data-testid="alert-feed-skeleton" aria-busy="true" className="p-3">
      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="px-3 py-3">
            <div className="space-y-2">
              <div className="h-2.5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-white/[0.04]" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
