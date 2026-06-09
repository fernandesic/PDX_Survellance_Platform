/**
 * GhanaTabNav — Horizontal tab strip for the Ghana PDX dashboard.
 *
 * Features:
 * - Icon + label per tab
 * - Active tab with accent underline indicator
 * - Horizontal scroll on mobile with gradient fade edges
 * - Smooth transitions
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { GHANA_TABS } from '../constants';
import type { GhanaTabId } from '../constants';

interface GhanaTabNavProps {
  activeTab: GhanaTabId;
  onTabChange: (tab: GhanaTabId) => void;
}

export default function GhanaTabNav({ activeTab, onTabChange }: GhanaTabNavProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  /* ── Scroll fade logic ── */
  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 8);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades);
    return () => {
      el.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
    };
  }, [updateFades]);

  /* ── Scroll active tab into view ── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  return (
    <div className="relative">
      {/* Left gradient fade */}
      {showLeftFade && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none ${
            isLight
              ? 'bg-gradient-to-r from-white to-transparent'
              : 'bg-gradient-to-r from-[#0a1128] to-transparent'
          }`}
        />
      )}

      {/* Right gradient fade */}
      {showRightFade && (
        <div
          className={`absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none ${
            isLight
              ? 'bg-gradient-to-l from-white to-transparent'
              : 'bg-gradient-to-l from-[#0a1128] to-transparent'
          }`}
        />
      )}

      {/* Scrollable tabs */}
      <div
        ref={scrollRef}
        className={`flex gap-1 overflow-x-auto scrollbar-hide pb-px border-b ${
          isLight ? 'border-gray-200' : 'border-white/10'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {GHANA_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative flex items-center gap-2 px-4 py-3 text-sm font-medium
                whitespace-nowrap transition-all duration-200 rounded-t-lg
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
                ${isActive
                  ? isLight
                    ? 'text-[#006B3F] bg-[#006B3F]/5 focus-visible:ring-[#006B3F]/40'
                    : 'text-[#FFD700] bg-[#FFD700]/5 focus-visible:ring-[#FFD700]/40'
                  : isLight
                    ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 focus-visible:ring-white/20'
                }
              `}
            >
              <Icon size={16} className={isActive ? '' : 'opacity-70'} />
              <span>{tab.label}</span>

              {/* Active indicator line */}
              {isActive && (
                <span
                  className={`absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full transition-all duration-300 ${
                    isLight ? 'bg-[#006B3F]' : 'bg-[#FFD700]'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
