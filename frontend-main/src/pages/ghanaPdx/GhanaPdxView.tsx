/**
 * GhanaPdxView — Shell view: Header → Tabs → Active tab content.
 *
 * Features:
 * - Lazy-loaded tab components (code splitting)
 * - Keep-alive: previously visited tabs stay mounted but hidden
 * - CSS transition on tab content for smooth switching
 * - Per-tab skeleton loaders
 */

import { lazy, Suspense, type CSSProperties } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import type { GhanaTabId } from './constants';
import { GHANA_TABS } from './constants';
import GhanaHeader from './components/GhanaHeader';
import GhanaTabNav from './components/GhanaTabNav';

// Lazy-load tab components so inactive tabs don't inflate the bundle
const GhanaOverviewTab = lazy(() => import('./components/tabs/GhanaOverviewTab'));
const GhanaIHRTab = lazy(() => import('./components/tabs/GhanaIHRTab'));
const GhanaCHWTab = lazy(() => import('./components/tabs/GhanaCHWTab'));
const GhanaReadinessTab = lazy(() => import('./components/tabs/GhanaReadinessTab'));
const GhanaStarTab = lazy(() => import('./components/tabs/GhanaStarTab'));
const GhanaAlertsTab = lazy(() => import('./components/tabs/GhanaAlertsTab'));
const GhanaPredictionsTab = lazy(() => import('./components/tabs/GhanaPredictionsTab'));
const GhanaIHMREFTab = lazy(() => import('./components/tabs/GhanaIHMREFTab'));

const TAB_COMPONENTS: Record<GhanaTabId, React.LazyExoticComponent<() => React.ReactElement>> = {
  overview: GhanaOverviewTab,
  ihr: GhanaIHRTab,
  chw: GhanaCHWTab,
  readiness: GhanaReadinessTab,
  star: GhanaStarTab,
  alerts: GhanaAlertsTab,
  predictions: GhanaPredictionsTab,
  ihmref: GhanaIHMREFTab,
};

interface GhanaPdxViewProps {
  activeTab: GhanaTabId;
  setActiveTab: (tab: GhanaTabId) => void;
  visitedTabs: Set<GhanaTabId>;
  stats?: {
    population?: string;
    totalCHWs?: number;
    ihrScore?: number;
    alertCount?: number;
    readinessScore?: number;
  };
}

/* ── Skeleton loaders per tab type ── */
function TabSkeleton({ tabId, isLight }: { tabId: GhanaTabId; isLight: boolean }) {
  const pulse = isLight ? 'bg-gray-200' : 'bg-white/[0.06]';
  const breath = { animation: 'pulse 2s ease-in-out infinite' };

  // Overview / default: grid of cards
  if (tabId === 'overview' || tabId === 'chw' || tabId === 'predictions') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-24 rounded-xl ${pulse}`} style={breath} />
          ))}
        </div>
        <div className={`h-64 rounded-xl ${pulse}`} style={{ ...breath, animationDelay: '0.3s' }} />
      </div>
    );
  }

  // IHR: score card + chart
  if (tabId === 'ihr') {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className={`flex-1 h-40 rounded-xl ${pulse}`} style={breath} />
          <div className={`flex-1 h-40 rounded-xl ${pulse}`} style={{ ...breath, animationDelay: '0.2s' }} />
        </div>
        <div className={`h-72 rounded-xl ${pulse}`} style={{ ...breath, animationDelay: '0.4s' }} />
      </div>
    );
  }

  // Table-based tabs
  if (tabId === 'readiness' || tabId === 'ihmref') {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-8 w-20 rounded-full ${pulse}`} style={breath} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`h-12 rounded-lg ${pulse}`} style={{ ...breath, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    );
  }

  // Star / Alerts: pills + list
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`h-8 w-14 rounded-full shrink-0 ${pulse}`} style={breath} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-20 rounded-xl ${pulse}`} style={{ ...breath, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div className={`h-80 rounded-xl ${pulse}`} style={{ ...breath, animationDelay: '0.5s' }} />
    </div>
  );
}

export default function GhanaPdxView({ activeTab, setActiveTab, visitedTabs, stats }: GhanaPdxViewProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-[1600px] mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* ── Header with KPI ribbon ── */}
      <div className="shrink-0">
        <GhanaHeader stats={stats} />
      </div>

      {/* ── Tab Navigation ── */}
      <div className="shrink-0">
        <GhanaTabNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* ── Tab Content — keep-alive rendering ── */}
      <div
        className={`rounded-xl p-3 md:p-4 flex-1 overflow-hidden ${
          isLight
            ? 'bg-white border border-gray-100 shadow-sm'
            : 'bg-white/[0.02] border border-white/5'
        }`}
      >
        {GHANA_TABS.map((tab) => {
          const tabId = tab.id as GhanaTabId;
          const isActive = tabId === activeTab;
          const wasVisited = visitedTabs.has(tabId);

          // Only render tabs that have been visited (lazy mount on first visit)
          if (!wasVisited) return null;

          const TabComponent = TAB_COMPONENTS[tabId];

          // Hide inactive tabs but keep them mounted
          const style: CSSProperties = {
            display: isActive ? 'block' : 'none',
            height: '100%',
          };

          return (
            <div key={tabId} style={style}>
              <Suspense fallback={<TabSkeleton tabId={tabId} isLight={isLight} />}>
                <TabComponent />
              </Suspense>
            </div>
          );
        })}
      </div>
    </div>
  );
}
