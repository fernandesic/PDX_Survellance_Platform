import { useEffect, useMemo, useState, useRef } from 'react';
import { Filter, X, ChevronDown, Check } from 'lucide-react';
import type { ActiveFilters, AlertLevel, DateRange } from '../types';
import { EMPTY_FILTERS } from '../types';
import { AFRO_COUNTRIES, DISEASE_KEYWORDS, PRIORITY_LABELS } from '../constants';
import { countActiveFilters, DATE_RANGE_LABELS } from './alertFiltersUtils';

interface AlertFiltersProps {
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  /**
   * When a disease is selected, this is the set of ISO3 codes for countries
   * that have at least one signal for that disease. `null` means "no
   * scoping" (no disease selected, or scope still loading) — show all.
   */
  availableCountryIso3s?: string[] | null;
}

const PRIORITY_LEVELS: AlertLevel[] = ['P1', 'P2', 'P3', 'P4'];
const DATE_RANGES: DateRange[] = ['all', '24h', '3d', '7d', '30d'];

const PRIORITY_TONE: Record<AlertLevel, { active: string; dot: string }> = {
  P1: {
    active: 'bg-red-500/15 text-red-400 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.15)]',
    dot: 'bg-red-500',
  },
  P2: {
    active: 'bg-orange-500/15 text-orange-400 border-orange-500/50 shadow-[0_0_8px_rgba(249,115,22,0.15)]',
    dot: 'bg-orange-500',
  },
  P3: {
    active: 'bg-amber-500/15 text-amber-400 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.15)]',
    dot: 'bg-amber-500',
  },
  P4: {
    active: 'bg-slate-500/15 text-slate-300 border-slate-500/50 shadow-[0_0_8px_rgba(148,163,184,0.1)]',
    dot: 'bg-slate-500',
  },
};

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: React.ReactNode }[];
  placeholder: string;
  ariaLabel?: string;
  testId?: string;
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  testId,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        data-testid={testId}
        onClick={() => setIsOpen(!isOpen)}
        className={`h-8 flex items-center rounded-lg border border-white/[0.08] bg-white/[0.04] pl-3 pr-8 text-[12px] font-medium text-slate-200 transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.06] focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/25 cursor-pointer whitespace-nowrap ${
          isOpen ? 'border-white/[0.15] bg-white/[0.06]' : ''
        }`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-2.5 h-3 w-3 text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 z-50 max-h-64 w-max min-w-full overflow-y-auto rounded-lg border border-slate-700/60 bg-[#0f172a] py-1 shadow-xl shadow-black/40 ring-1 ring-white/5">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={`flex w-full items-center px-3 py-2 text-left text-[12px] transition-colors ${
              !value ? 'bg-sky-500/10 text-sky-400 font-medium' : 'text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            <span className="w-4 mr-1 flex justify-center">{!value && <Check className="h-3 w-3" />}</span>
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-left text-[12px] transition-colors ${
                value === opt.value ? 'bg-sky-500/10 text-sky-400 font-medium' : 'text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              <span className="w-4 mr-1 flex justify-center">
                {value === opt.value && <Check className="h-3 w-3" />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AlertFilters({
  filters,
  onChange,
  availableCountryIso3s = null,
}: AlertFiltersProps) {
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  const countries = useMemo(() => {
    const sorted = [...AFRO_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
    if (!availableCountryIso3s) return sorted;
    const allow = new Set(availableCountryIso3s);
    return sorted.filter((c) => allow.has(c.iso3));
  }, [availableCountryIso3s]);
  const diseases = useMemo(
    () => [...DISEASE_KEYWORDS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  // If the disease scoping removed the currently-selected country from the
  // list, clear it so the user isn't stuck on an invalid value.
  const selectedCountry = filters.countries[0];
  useEffect(() => {
    if (!availableCountryIso3s || !selectedCountry) return;
    if (!availableCountryIso3s.includes(selectedCountry)) {
      onChange({ ...filters, countries: [] });
    }
    // We intentionally only re-run when the scope or selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCountryIso3s, selectedCountry]);

  const setSingle = <K extends keyof ActiveFilters>(key: K, value: ActiveFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const togglePriority = (level: AlertLevel) => {
    const exists = filters.priorities.includes(level);
    const priorities = exists
      ? filters.priorities.filter((p) => p !== level)
      : [...filters.priorities, level];
    onChange({ ...filters, priorities });
  };

  const setCountry = (iso3: string) => {
    setSingle('countries', iso3 ? [iso3] : []);
  };

  const setDisease = (code: string) => {
    setSingle('diseases', code ? [code] : []);
  };

  const reset = () => onChange({ ...EMPTY_FILTERS });

  return (
    <div
      aria-label="alert filters"
      data-testid="alert-filters"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 backdrop-blur-sm"
    >
      {/* ── Label ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pr-2 border-r border-white/[0.08]">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-sky-500/10">
          <Filter className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Filters
        </span>
        {activeCount > 0 ? (
          <span
            data-testid="alert-filters-active-count"
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500/20 px-1.5 text-[10px] font-bold text-sky-300 ring-1 ring-sky-500/30"
          >
            {activeCount}
          </span>
        ) : null}
      </div>

      {/* ── Disease dropdown ──────────────────────────────────── */}
      <CustomSelect
        ariaLabel="disease"
        testId="alert-filters-disease"
        value={filters.diseases[0] ?? ''}
        onChange={setDisease}
        placeholder="All diseases"
        options={diseases.map((d) => ({
          value: d.code,
          label: d.name,
        }))}
      />

      {/* ── Country dropdown ──────────────────────────────────── */}
      <CustomSelect
        ariaLabel="country"
        testId="alert-filters-country"
        value={filters.countries[0] ?? ''}
        onChange={setCountry}
        placeholder="All countries"
        options={countries.map((c) => ({
          value: c.iso3,
          label: (
            <span className="flex items-center gap-1.5">
              <span>{c.flag}</span>
              <span>{c.name}</span>
            </span>
          ),
        }))}
      />

      {/* ── Separator ─────────────────────────────────────────── */}
      <div className="h-5 w-px bg-white/[0.08]" aria-hidden="true" />

      {/* ── Priority toggles ─────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label="severity"
        data-testid="alert-filters-severity"
      >
        {PRIORITY_LEVELS.map((level) => {
          const active = filters.priorities.includes(level);
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              data-testid={`alert-filters-severity-${level}`}
              onClick={() => togglePriority(level)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all duration-200 ${
                active
                  ? PRIORITY_TONE[level].active
                  : 'border-white/[0.06] bg-transparent text-slate-500 hover:border-white/[0.12] hover:text-slate-300'
              }`}
              title={PRIORITY_LABELS[level]}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  active ? PRIORITY_TONE[level].dot : 'bg-slate-600'
                }`}
              />
              {level}
            </button>
          );
        })}
      </div>

      {/* ── Separator ─────────────────────────────────────────── */}
      <div className="h-5 w-px bg-white/[0.08]" aria-hidden="true" />

      {/* ── Date range dropdown ───────────────────────────────── */}
      <CustomSelect
        ariaLabel="date range"
        testId="alert-filters-daterange"
        value={filters.dateRange}
        onChange={(val) => setSingle('dateRange', val as DateRange)}
        placeholder="All time"
        options={DATE_RANGES.map((r) => ({
          value: r,
          label: DATE_RANGE_LABELS[r],
        }))}
      />

      {/* ── Spacer ────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Reset button ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={reset}
        disabled={activeCount === 0}
        data-testid="alert-filters-reset"
        className="group inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:pointer-events-none disabled:opacity-25"
      >
        <X className="h-3 w-3 transition-transform duration-200 group-hover:rotate-90" aria-hidden="true" />
        Reset
      </button>
    </div>
  );
}
