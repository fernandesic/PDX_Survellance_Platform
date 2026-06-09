import { Circle, RefreshCw, Radio, ShieldCheck, Clock, ChevronLeft, ChevronRight, Languages, MapPin, AlertTriangle, ExternalLink } from "lucide-react";
import { useLiveFeedWatchlistContext } from "@/contexts/LiveFeedWatchlistContext";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useMemo, useEffect } from "react";
import type { LiveFeed } from "@/types/liveFeed";
import type { OverviewResponse } from "@/types";
import type { Signal } from "@/pages/alerts/types";
import { translateText, getCachedTranslation } from "@/pages/alerts/services/translationService";

// ── Page context ──
type PageContext = 'alerts' | 'overview' | 'ihr' | 'readiness' | 'stardata' | 'poe' | 'chw' | 'generic';

const PAGE_CONTEXT_MAP: Record<string, PageContext> = {
  '/': 'overview', '/overview': 'overview', '/ihr': 'ihr', '/readiness': 'readiness',
  '/star_tracker': 'stardata', '/poe': 'poe', '/chw': 'chw', '/alerts': 'alerts',
};

const CONTEXT_KEYWORDS: Record<PageContext, string[]> = {
  alerts: [],
  overview: [],
  ihr: ['ihr', 'health regulation', 'compliance', 'capacity', 'surveillance', 'laboratory', 'spar',
    'preparedness', 'public health', 'notification', 'health system', 'health security',
    'response', 'detection', 'reporting', 'confirmed', 'monitoring', 'risk assessment',
    'who', 'ministry of health', 'health authority', 'epidemiological', 'disease surveillance'],
  readiness: ['cholera', 'measles', 'mpox', 'marburg', 'ebola', 'meningitis', 'yellow fever', 'lassa',
    'rift valley', 'dengue', 'cyclone', 'flood', 'drought', 'disaster', 'vaccination', 'outbreak',
    'polio', 'malaria', 'typhoid', 'hepatitis', 'diphtheria', 'plague', 'anthrax', 'chikungunya',
    'influenza', 'tuberculosis', 'covid', 'disease', 'epidemic', 'pandemic'],
  stardata: ['outbreak', 'incident', 'hazard', 'emergency', 'alert', 'surge', 'epidemic',
    'cases', 'fatality', 'confirmed', 'deaths', 'suspected', 'reported', 'active',
    'critical', 'response', 'cluster', 'spread', 'transmission'],
  poe: ['border', 'port', 'airport', 'entry', 'travel', 'cross-border', 'screening', 'quarantine',
    'refugee', 'migration', 'displacement', 'displaced', 'transit', 'international',
    'import', 'export', 'movement', 'transport', 'flight', 'ship', 'crossing'],
  chw: ['community', 'community health', 'chw', 'rural', 'primary care', 'immunization',
    'vaccination', 'maternal', 'malaria', 'village', 'clinic', 'health worker',
    'outreach', 'household', 'child health', 'nutrition', 'antenatal'],
  generic: [],
};

const PAGE_HEADERS: Record<PageContext, { subtitle: string }> = {
  alerts: { subtitle: 'All active signals' },
  overview: { subtitle: 'Latest combined feed' },
  ihr: { subtitle: 'Health regulation signals' },
  readiness: { subtitle: 'Hazard watch' },
  stardata: { subtitle: 'Active outbreak signals' },
  poe: { subtitle: 'Border intel signals' },
  chw: { subtitle: 'Community health signals' },
  generic: { subtitle: 'Active signals' },
};

const PAGE_EMPTY_MESSAGES: Record<PageContext, string> = {
  alerts: 'No active signals',
  overview: 'No active signals',
  ihr: 'No IHR-specific signals right now',
  readiness: 'No hazard or disease signals right now',
  stardata: 'No active outbreak signals right now',
  poe: 'No border or travel signals right now',
  chw: 'No community health signals right now',
  generic: 'No active signals',
};

const LANG_NAMES: Record<string, string> = {
  en: 'English', fr: 'Français', pt: 'Português', ar: 'العربية',
  sw: 'Kiswahili', ha: 'Hausa', yo: 'Yorùbá', am: 'አማርኛ',
  mg: 'Malagasy', ln: 'Lingála', sn: 'ChiShona', rw: 'Kinyarwanda',
  zu: 'isiZulu', xh: 'isiXhosa', so: 'Soomaali', ti: 'ትግርኛ',
};

const LANG_CODES: Record<string, string> = {
  en: 'EN', fr: 'FR', pt: 'PT', ar: 'AR', sw: 'SW', ha: 'HA',
  yo: 'YO', am: 'AM', mg: 'MG', ln: 'LN', sn: 'SN', rw: 'RW',
  zu: 'ZU', xh: 'XH', so: 'SO', ti: 'TI',
};

const COUNTRY_LOCAL_LANGS: Record<string, string> = {
  'TZA': 'sw', 'KEN': 'sw', 'UGA': 'sw', 'RWA': 'rw', 'BDI': 'fr',
  'COD': 'fr', 'ETH': 'am', 'NGA': 'ha', 'SEN': 'fr', 'CIV': 'fr',
  'GNB': 'pt', 'AGO': 'pt', 'MOZ': 'pt', 'BFA': 'fr', 'MLI': 'fr',
  'NER': 'fr', 'TCD': 'fr', 'CAF': 'fr', 'GIN': 'fr', 'TGO': 'fr',
  'BEN': 'fr', 'GAB': 'fr', 'COG': 'fr', 'MDG': 'fr', 'MRT': 'ar',
  'CMR': 'fr', 'SOM': 'so', 'DJI': 'fr', 'SSD': 'ar',
};

type SeverityColor = 'red' | 'amber' | 'green' | 'purple' | 'blue';
interface ProgramWatchItem { label: string; value: string | number; detail: string; severity: SeverityColor; sortOrder: number; }

function normalizeLang(lang: string | undefined | null): string {
  if (!lang) return 'en';
  const l = lang.toLowerCase().trim();
  if (l === 'en' || l === 'english') return 'en';
  if (l === 'fr' || l === 'french' || l === 'français') return 'fr';
  if (l === 'pt' || l === 'portuguese') return 'pt';
  if (l === 'ar' || l === 'arabic') return 'ar';
  if (l === 'sw' || l === 'swahili' || l === 'kiswahili') return 'sw';
  if (l === 'ha' || l === 'hausa') return 'ha';
  if (l === 'yo' || l === 'yoruba') return 'yo';
  if (l === 'am' || l === 'amharic') return 'am';
  if (l === 'so' || l === 'somali') return 'so';
  if (l.length === 2) return l;
  return 'en';
}

function textsAreSame(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.toLowerCase().replace(/\s+/g, ' ').trim() === b.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── Priority config ──
const PRIORITY_CONFIG: Record<string, { dot: string; label: string; text: string }> = {
  P1: { dot: 'bg-red-500', label: 'Critical', text: 'text-red-400' },
  P2: { dot: 'bg-orange-400', label: 'High', text: 'text-orange-400' },
  P3: { dot: 'bg-amber-400', label: 'Medium', text: 'text-amber-400' },
  P4: { dot: 'bg-slate-500', label: 'Low', text: 'text-slate-500' },
};

// ── Signal Card ──
function SignalCard({
  item,
  isLight,
  isAlertsPage,
  onSignalSelect,
}: {
  item: LiveFeed & { iso3?: string; country_iso?: string; original_signal?: any };
  isLight: boolean;
  isAlertsPage: boolean;
  onSignalSelect?: (s: Signal) => void;
}) {
  const iso3 = (item.iso3 || item.country_iso || '').toUpperCase();
  const targetLang = COUNTRY_LOCAL_LANGS[iso3] || null;
  const origLang = normalizeLang(item.original_language);
  const originalText = item.original_text || '';
  const translatedText = item.translated_text || '';
  const headline = item.headline || item.title || 'Unknown Signal';

  // What text do we show in English vs local?
  const englishText = (origLang !== 'en' && translatedText && !textsAreSame(translatedText, originalText))
    ? translatedText
    : (originalText && originalText.length > headline.length ? originalText : headline);

  const nativeLocalText = (origLang !== 'en' && originalText && !textsAreSame(originalText, englishText))
    ? originalText
    : null;

  const hasLocalLang = !!targetLang && targetLang !== 'en';

  // Language toggle state: 'en' or the local lang
  const [activeLang, setActiveLang] = useState<'en' | 'local'>('en');
  const [localTranslation, setLocalTranslation] = useState<string | null>(nativeLocalText);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);

  // Cache key for translation
  const textToTranslate = originalText || headline;
  const cacheKey = `${iso3}|${textToTranslate.substring(0, 60)}`;

  // Check cache on mount
  useEffect(() => {
    if (!hasLocalLang || nativeLocalText) return;
    const cached = getCachedTranslation(textToTranslate, targetLang!, 'en');
    if (cached) setLocalTranslation(cached);
  }, []);

  const handleLangToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeLang === 'en') {
      // Switch to local
      if (localTranslation) {
        setActiveLang('local');
        return;
      }
      if (!hasLocalLang) return;
      // Need to translate
      setTranslating(true);
      setActiveLang('local');
      try {
        const result = await translateText(textToTranslate, targetLang!, 'en');
        if (result) setLocalTranslation(result);
        else setTranslationError(true);
      } finally {
        setTranslating(false);
      }
    } else {
      setActiveLang('en');
    }
  };

  const priority = item.priority || 'P4';
  const pc = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['P4'];
  const origSignal = item.original_signal;
  const confidence = origSignal?.confidence_score ?? 75;
  const tier = origSignal?.source_tier ?? 3;
  const tierLabel = tier === 1 ? 'Official' : tier === 2 ? 'Verified' : 'Intel';
  const tierColor = tier === 1 ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : tier === 2 ? 'text-blue-400' : 'text-slate-500';
  const cases = item.reported_cases || 0;
  const deaths = item.reported_deaths || 0;

  // Current displayed text
  const displayText = activeLang === 'en' ? englishText : (localTranslation || '');
  const displayLangCode = activeLang === 'en' ? 'EN' : (targetLang ? (LANG_CODES[targetLang] || targetLang.toUpperCase()) : 'EN');
  const displayLangName = activeLang === 'en' ? 'English' : (targetLang ? (LANG_NAMES[targetLang] || targetLang) : 'Unknown');

  const cardBase = isLight
    ? 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
    : 'bg-[#0e1828] border-white/[0.07] hover:border-white/15 hover:shadow-xl hover:shadow-black/20';

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${cardBase}`}>
      {/* ── Top row: priority + tier + confidence ── */}
      <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pc.dot}`} />
          <span className={`text-[9px] font-black uppercase tracking-widest ${pc.text}`}>{pc.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[9px] font-bold ${tierColor}`}>{tierLabel}</span>
          <span className={`text-[9px] font-bold ${confidence >= 80 ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : 'text-amber-400'}`}>{confidence}%</span>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="px-3.5 pb-2.5">
        {/* Language switcher pill — only show when there is a local language */}
        {hasLocalLang && (
          <button
            onClick={handleLangToggle}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider mb-2 border transition-all active:scale-95 ${activeLang === 'local'
              ? isLight ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
              : isLight ? 'bg-gray-100 border-gray-200 text-gray-500' : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            title={activeLang === 'en' ? `Switch to ${displayLangName}` : 'Switch to English'}
          >
            <Languages className="w-2.5 h-2.5" />
            {activeLang === 'en' ? displayLangCode : 'EN'}
            <span className="opacity-50">→</span>
            {activeLang === 'en' ? (LANG_CODES[targetLang!] || targetLang!.toUpperCase()) : 'EN'}
          </button>
        )}

        {/* Article text */}
        <p className={`text-[12px] font-semibold leading-snug ${isLight ? 'text-gray-900' : 'text-white'}`}>
          {activeLang === 'local' && translating ? (
            <span className={`italic text-[11px] ${isLight ? 'text-gray-400' : 'text-slate-500'}`}>
              Translating to {displayLangName}…
            </span>
          ) : activeLang === 'local' && translationError ? (
            <span className={`italic text-[11px] text-red-400`}>Translation unavailable</span>
          ) : (
            displayText
          )}
        </p>

        {/* Language tag below text */}
        {hasLocalLang && (
          <p className={`text-[8px] mt-1 ${isLight ? 'text-gray-400' : 'text-slate-600'}`}>
            {activeLang === 'en' ? 'English' : `${displayLangName} (${displayLangCode})`}
          </p>
        )}
      </div>

      {/* ── Epi stats (only if data exists) ── */}
      {(cases > 0 || deaths > 0) && (
        <div className={`mx-3 mb-2.5 grid grid-cols-2 gap-2 rounded-xl overflow-hidden border ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
          <div className={`px-2.5 py-1.5 ${isLight ? 'bg-red-50' : 'bg-red-500/8'}`}>
            <p className="text-[7px] font-black text-red-500 uppercase tracking-widest">Cases</p>
            <p className="text-[13px] font-black text-red-500">{cases > 0 ? cases.toLocaleString() : '—'}</p>
          </div>
          <div className={`px-2.5 py-1.5 ${isLight ? 'bg-gray-50' : 'bg-white/3'}`}>
            <p className={`text-[7px] font-black uppercase tracking-widest ${isLight ? 'text-gray-500' : 'text-slate-600'}`}>Deaths</p>
            <p className={`text-[13px] font-black ${isLight ? 'text-gray-800' : 'text-slate-300'}`}>{deaths > 0 ? deaths.toLocaleString() : '0'}</p>
          </div>
        </div>
      )}

      {/* ── AI Classification badge ── */}
      {origSignal?.ai_classification && (
        <div className={`mx-3 mb-2 flex items-center gap-2`}>
          <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
            origSignal.ai_classification === 'continent_alert' ? (isLight ? 'bg-red-50 text-red-600 border-red-200' : 'bg-red-500/10 text-red-400 border-red-500/20') :
            origSignal.ai_classification === 'area_alert' ? (isLight ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-orange-500/10 text-orange-400 border-orange-500/20') :
            origSignal.ai_classification === 'no_alert' ? (isLight ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') :
            (isLight ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-white/5 text-slate-500 border-white/10')
          }`}>
            {origSignal.ai_classification === 'continent_alert' ? '🌍 Continent' :
             origSignal.ai_classification === 'area_alert' ? '📍 Area' :
             origSignal.ai_classification === 'no_alert' ? '✓ Clear' : '? Uncertain'}
          </span>
          {origSignal.ai_severity && (
            <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
              origSignal.ai_severity === 'critical' ? (isLight ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse') :
              origSignal.ai_severity === 'high' ? (isLight ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-orange-500/10 text-orange-400 border-orange-500/20') :
              origSignal.ai_severity === 'moderate' ? (isLight ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20') :
              (isLight ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-white/5 text-slate-500 border-white/10')
            }`}>
              {origSignal.ai_severity}
            </span>
          )}
        </div>
      )}
      <div className={`px-3.5 py-2 border-t flex items-center justify-between gap-2 ${isLight ? 'border-gray-100' : 'border-white/[0.05]'}`}>
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="flex items-center gap-1">
            <MapPin className={`w-2.5 h-2.5 shrink-0 ${isLight ? 'text-gray-400' : 'text-slate-600'}`} />
            <span className={`text-[8px] font-bold truncate max-w-[70px] ${isLight ? 'text-gray-500' : 'text-slate-500'}`}>{item.country || 'Unknown'}</span>
          </div>
          <div className={`text-[7px] ${isLight ? 'text-gray-300' : 'text-slate-700'}`}>·</div>
          <span className={`text-[8px] font-bold truncate max-w-[60px] ${isLight ? 'text-gray-400' : 'text-slate-600'}`}>{item.source}</span>
          <div className={`text-[7px] ${isLight ? 'text-gray-300' : 'text-slate-700'}`}>·</div>
          <div className="flex items-center gap-1">
            <Clock className={`w-2.5 h-2.5 shrink-0 ${isLight ? 'text-gray-400' : 'text-slate-600'}`} />
            <span className={`text-[8px] font-bold ${isLight ? 'text-gray-400' : 'text-slate-600'}`}>{item.timeAgo}</span>
          </div>
        </div>

        {/* Analysis Hub ONLY on alerts page */}
        {isAlertsPage && origSignal && (
          <button
            onClick={(e) => { e.stopPropagation(); onSignalSelect?.(origSignal); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-blue-400 border border-blue-500/20 bg-blue-500/8 hover:bg-blue-500/15 active:scale-95 transition-all shrink-0"
          >
            Hub <ExternalLink className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}


// ── Main LiveFeedWatchlist ──
export default function LiveFeedWatchlist({
  className = "",
  overviewData,
  onSignalSelect,
  hideCollapse = false,
  feedOverride,
}: {
  className?: string;
  overviewData?: OverviewResponse['data'];
  onSignalSelect?: (signal: Signal) => void;
  hideCollapse?: boolean;
  /** When provided, replaces the sentinel context data with a custom feed (e.g. political news). */
  feedOverride?: LiveFeed[];
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { pathname } = useLocation();
  const { data, loading, error, refreshData, freshness, cacheAgeLabel } = useLiveFeedWatchlistContext();
  const [syncing, setSyncing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const pageContext = useMemo<PageContext>(() => PAGE_CONTEXT_MAP[pathname] || 'generic', [pathname]);
  const pageHeader = PAGE_HEADERS[pageContext];
  const isAlertsPage = pageContext === 'alerts';

  const items = useMemo(() => {
    // When a feedOverride is supplied (e.g. political news in HDIS) use it directly.
    if (feedOverride && feedOverride.length > 0)
      return feedOverride as (LiveFeed & { iso3?: string; country_iso?: string; original_signal?: any })[];
    if (!data?.liveFeed) return [];
    return data.liveFeed as (LiveFeed & { iso3?: string; country_iso?: string; original_signal?: any })[];
  }, [data, feedOverride]);

  const filteredItems = useMemo(() => {
    const keywords = CONTEXT_KEYWORDS[pageContext];

    if (pageContext === 'overview') {
      // Display the latest items chronologically (items are already pre-sorted by date in context)
      return [...items].slice(0, 15);
    }

    if (keywords.length === 0) return items;

    const scored = items.map(item => {
      const text = [item.headline, item.title, item.original_text, item.translated_text, item.summary].join(' ').toLowerCase();
      const score = keywords.filter(kw => text.includes(kw)).length;
      return { item, score };
    });

    // Only show genuinely matched signals — no random padding, keeping chronological order
    const matched = scored.filter(s => s.score > 0).map(s => s.item);
    return matched;
  }, [items, pageContext]);

  const programWatchlist = useMemo((): ProgramWatchItem[] => {
    if (!overviewData) return [];
    const list: ProgramWatchItem[] = [];
    if (overviewData.chw?.total_chw != null) {
      list.push({ label: 'CHW Total (AFRO)', value: overviewData.chw.total_chw.toLocaleString(), detail: `${overviewData.chw.countries?.length ?? 0} countries`, severity: 'green', sortOrder: 3 });
    }
    const below = Object.entries(overviewData.readiness?.country_completion ?? {}).filter(([, p]) => p > 0 && p < 40);
    if (below.length) list.push({ label: 'Readiness <40%', value: `${below.length} countries`, detail: below.slice(0, 3).map(([c]) => c).join(', ') + (below.length > 3 ? '…' : ''), severity: 'red', sortOrder: 1 });
    const s = overviewData.espar?.avg_score;
    if (s != null) {
      list.push({ label: 'IHR', value: s > 0 ? `${s.toFixed(1)}/5` : '—', detail: `${overviewData.espar?.countries?.length ?? 0} countries`, severity: s >= 3 ? 'green' : s >= 2 ? 'amber' : 'red', sortOrder: s >= 3 ? 3 : 1 });
    }
    if (overviewData.stardata) {
      list.push({ label: 'STAR Tracker', value: `${overviewData.stardata.countries ?? 0} countries`, detail: `${overviewData.stardata.active ?? 0} active`, severity: 'purple', sortOrder: 2 });
    }
    if (overviewData.pami) list.push({ label: 'PAMI Active', value: `${overviewData.pami.countries ?? 0}`, detail: (overviewData.pami.active_countries ?? []).slice(0, 3).join(', '), severity: 'red', sortOrder: 1 });
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [overviewData]);

  const severityStyles: Record<SeverityColor, { dot: string; text: string; bg: string; border: string }> = {
    red: { dot: 'bg-red-500', text: 'text-red-400', bg: isLight ? 'bg-red-50' : 'bg-red-500/8', border: isLight ? 'border-red-200' : 'border-red-500/20' },
    amber: { dot: 'bg-amber-500', text: 'text-amber-400', bg: isLight ? 'bg-amber-50' : 'bg-amber-500/8', border: isLight ? 'border-amber-200' : 'border-amber-500/20' },
    green: { dot: 'bg-green-500', text: isLight ? 'text-green-600' : 'text-green-400', bg: isLight ? 'bg-green-50' : 'bg-green-500/8', border: isLight ? 'border-green-200' : 'border-green-500/20' },
    purple: { dot: 'bg-purple-500', text: 'text-purple-400', bg: isLight ? 'bg-purple-50' : 'bg-purple-500/8', border: isLight ? 'border-purple-200' : 'border-purple-500/20' },
    blue: { dot: 'bg-blue-500', text: 'text-blue-400', bg: isLight ? 'bg-blue-50' : 'bg-blue-500/8', border: isLight ? 'border-blue-200' : 'border-blue-500/20' },
  };

  const handleSync = async () => { setSyncing(true); await refreshData(); setTimeout(() => setSyncing(false), 1000); };

  const colors: Record<string, string> = {
    "/chw": "bg-[#081D10]", "/ihr": "bg-[#091920]", "/readiness": "bg-[#1C1607]",
    "/star_tracker": "bg-[#1B0835]", "/alerts": "bg-[#0B1120]",
  };
  const layoutColor = isLight ? "bg-[#f2f4f8]" : (colors[pathname] || "bg-[#0B1120]");
  const p1Count = filteredItems.filter(i => i.priority === 'P1').length;

  if (collapsed && !hideCollapse) {
    return (
      <div className={`${layoutColor} w-10 flex-shrink-0 sticky top-4 ${className || 'h-[calc(100vh-2rem)]'} flex flex-col items-center rounded-2xl overflow-hidden shadow-lg border ${isLight ? 'border-gray-200' : 'border-white/5'}`}>
        <button onClick={() => setCollapsed(false)} className={`p-2 mt-2 rounded-lg ${isLight ? 'hover:bg-gray-100' : 'hover:bg-white/10'}`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="mt-4 -rotate-90 whitespace-nowrap">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Feed</span>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className={`${layoutColor} flex-shrink-0 h-[calc(100vh-1rem)] flex flex-col rounded-2xl border ${isLight ? 'border-gray-200' : 'border-white/5'} p-4 space-y-3`}>
        {[1, 2, 3].map(i => <div key={i} className="h-28 w-full bg-white/5 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (error) return (
    <div className="flex-shrink-0 h-[calc(100vh-1rem)] flex items-center justify-center border border-red-500/20 bg-red-500/5 rounded-2xl text-red-400 text-xs p-4 text-center">
      {error}
    </div>
  );

  return (
    <div className={`${layoutColor} ${isLight ? 'text-[#1a1a1a]' : 'text-white'} flex-shrink-0 sticky top-4 ${className || 'h-[calc(100vh-2rem)]'} flex flex-col rounded-[2rem] overflow-hidden shadow-2xl border ${isLight ? 'border-gray-200' : 'border-white/5'}`}>

      {/* ── Header ── */}
      <div className={`px-5 pt-5 pb-4 border-b shrink-0 ${isLight ? 'border-gray-200' : 'border-white/[0.05]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <p className="font-black text-[11px] uppercase tracking-[0.12em]">{feedOverride ? 'Diplomatic & Political Alerts' : 'Live Feed'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Circle size={5} className="text-emerald-500 fill-emerald-500 animate-pulse" />
                <span className={`text-[8px] font-bold uppercase tracking-widest ${isLight ? 'text-gray-400' : 'text-slate-500'}`}>
                  {feedOverride ? 'Diplomatic & political news' : pageHeader.subtitle}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={handleSync} disabled={syncing} className={`p-2 rounded-xl transition-all ${isLight ? 'hover:bg-gray-100 text-gray-400' : 'hover:bg-white/8 text-slate-600'}`}>
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            </button>
            {!hideCollapse && (
              <button onClick={() => setCollapsed(true)} className={`p-2 rounded-xl transition-all ${isLight ? 'hover:bg-gray-100 text-gray-400' : 'hover:bg-white/8 text-slate-600'}`}>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="overflow-y-auto flex-1 min-h-0 p-3 space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center px-4">
            <ShieldCheck className={`w-7 h-7 ${isLight ? 'text-gray-300' : 'text-slate-700'}`} />
            <p className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-gray-400' : 'text-slate-600'}`}>{PAGE_EMPTY_MESSAGES[pageContext]}</p>
            {items.length > 0 && (
              <p className={`text-[8px] font-medium ${isLight ? 'text-gray-400' : 'text-slate-600'}`}>
                {items.length} signals active across other categories
              </p>
            )}
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <SignalCard
              key={idx}
              item={item}
              isLight={isLight}
              isAlertsPage={isAlertsPage}
              onSignalSelect={onSignalSelect}
            />
          ))
        )}

        {/* Program watchlist */}
        {programWatchlist.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <AlertTriangle className={`w-3 h-3 ${isLight ? 'text-amber-500' : 'text-amber-400'}`} />
              <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-gray-500' : 'text-slate-500'}`}>Program Watchlist</span>
            </div>
            <div className="space-y-1.5">
              {programWatchlist.map((pw, i) => {
                const st = severityStyles[pw.severity];
                return (
                  <div key={i} className={`${st.bg} rounded-xl p-2.5 border ${st.border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
                        <div className="min-w-0">
                          <p className={`text-[9px] font-bold leading-tight truncate ${isLight ? 'text-gray-800' : 'text-gray-300'}`}>{pw.label}</p>
                          <p className="text-[8px] text-gray-500 truncate">{pw.detail}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black shrink-0 ${st.text}`}>{pw.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer with freshness indicator ── */}
      {filteredItems.length > 0 && (
        <div className={`px-4 py-2 border-t flex items-center justify-between shrink-0 ${isLight ? 'border-gray-200 bg-white/60' : 'border-white/[0.04] bg-black/20'}`}>
          <div className="flex items-center gap-2">
            {p1Count > 0 && <span className="text-[8px] font-black text-red-400">● {p1Count} Critical</span>}
            <span className={`text-[8px] font-bold ${isLight ? 'text-gray-400' : 'text-slate-600'}`}>{filteredItems.length} signals</span>
          </div>
          <div className="flex items-center gap-1">
            {freshness === 'live' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className={`text-[8px] font-black ${isLight ? 'text-emerald-600' : 'text-emerald-500'}`}>Live</span>
              </>
            ) : freshness === 'stale' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className={`text-[8px] font-black ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>Cached{cacheAgeLabel ? ` ${cacheAgeLabel}` : ''}</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className={`text-[8px] font-black ${isLight ? 'text-red-600' : 'text-red-400'}`}>Offline{cacheAgeLabel ? ` · ${cacheAgeLabel}` : ''}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}