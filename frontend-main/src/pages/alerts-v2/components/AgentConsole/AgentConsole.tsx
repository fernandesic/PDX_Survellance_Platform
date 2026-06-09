import { useState } from 'react';
import { Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { AgentConsoleLive } from './AgentConsole.live';
import { AgentConsoleStats } from './AgentConsole.stats';
import { AgentConsoleHistory } from './AgentConsole.history';

type Tab = 'live' | 'stats' | 'history';

interface AgentConsoleProps {
  onSelectAlert?: (id: string | null) => void;
  /** ISO3 of the country the user has filtered to via the map / feed badge. */
  activeCountry?: string | null;
  onClearCountry?: () => void;
}

export function AgentConsole({ onSelectAlert, activeCountry, onClearCountry }: AgentConsoleProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('live');

  return (
    <div
      className={`shrink-0 overflow-hidden bg-[#070B14] transition-all duration-200 ${
        collapsed ? 'h-9' : 'h-48'
      }`}
      data-testid="agent-console"
    >
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Agent Console
          </span>
          {!collapsed ? (
            <div className="flex gap-1 ml-2" role="tablist">
              {(['live', 'stats', 'history'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest transition-colors ${
                    activeTab === tab
                      ? 'bg-white/[0.08] text-slate-300'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                  data-testid={`agent-console-tab-${tab}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'expand agent console' : 'collapse agent console'}
          className="rounded p-0.5 text-slate-500 hover:text-slate-300"
          data-testid="agent-console-toggle"
        >
          {collapsed ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Content */}
      {!collapsed ? (
        <div
          className="h-[calc(100%-36px)] overflow-y-auto"
          role="tabpanel"
          data-testid="agent-console-panel"
        >
          {activeTab === 'live' ? (
            <AgentConsoleLive
              activeCountry={activeCountry ?? null}
              onClearCountry={onClearCountry}
            />
          ) : null}
          {activeTab === 'stats' ? <AgentConsoleStats /> : null}
          {activeTab === 'history' ? (
            <AgentConsoleHistory
              onSelectAlert={onSelectAlert}
              activeCountry={activeCountry ?? null}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
