/**
 * HDIS-PRO: Pillar Intelligence Distribution — horizontal bar with icons.
 * Shows breakdown across all 9 health diplomacy pillars.
 */
import { useDashboardStats } from "@/pages/hdis/hooks/useIntelligence";
import { useNavigate } from "react-router-dom";
import {
  Activity, Shield, Heart, Syringe, Flame,
  CloudRain, Handshake, Users, Cross,
} from "lucide-react";

const PILLAR_CONFIG: Record<string, { label: string; icon: any; color: string; bar: string }> = {
  outbreak:  { label: "Disease Outbreak",  icon: Activity,  color: "text-red-400",     bar: "bg-red-400" },
  conflict:  { label: "Conflict & Health", icon: Flame,     color: "text-orange-400",  bar: "bg-orange-400" },
  vaccine:   { label: "Vaccine Access",    icon: Syringe,   color: "text-blue-400",    bar: "bg-blue-400" },
  policy:    { label: "Health Policy",     icon: Shield,    color: "text-purple-400",  bar: "bg-purple-400" },
  funding:   { label: "Health Funding",    icon: Heart,     color: "text-emerald-400", bar: "bg-emerald-400" },
  workforce: { label: "Health Workforce",  icon: Users,     color: "text-cyan-400",    bar: "bg-cyan-400" },
  climate:   { label: "Climate & Health",  icon: CloudRain, color: "text-teal-400",    bar: "bg-teal-400" },
  agreement: { label: "Agreements",        icon: Handshake, color: "text-indigo-400",  bar: "bg-indigo-400" },
  uhc:       { label: "UHC",               icon: Cross,     color: "text-pink-400",    bar: "bg-pink-400" },
};

export function PillarDistribution() {
  const { data: stats } = useDashboardStats();
  const navigate = useNavigate();

  const pillars = stats?.by_pillar ?? {};
  const maxVal = Math.max(...Object.values(pillars), 1);
  const sorted = Object.entries(pillars)
    .sort(([, a], [, b]) => b - a)
    .filter(([, v]) => v > 0);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="font-mono text-sm font-semibold text-foreground tracking-wide">
          PILLAR DISTRIBUTION
        </h3>
        <span className="font-mono text-sm text-muted-foreground">
          {sorted.length} active pillars
        </span>
      </div>
      <div className="p-4 space-y-2.5">
        {sorted.map(([key, count]) => {
          const cfg = PILLAR_CONFIG[key];
          if (!cfg) return null;
          const Icon = cfg.icon;
          const pct = (count / maxVal) * 100;
          return (
            <button
              key={key}
              onClick={() => navigate(`/hdis-pro/feed?pillar=${key}`)}
              className="group w-full flex items-center gap-3 hover:bg-secondary/30 rounded-md px-2 py-1.5 transition-colors text-left"
            >
              <div className={`shrink-0 rounded-md p-1.5 bg-secondary/50 group-hover:bg-secondary ${cfg.color}`}>
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm text-foreground">{cfg.label}</span>
                  <span className={`font-mono text-xs font-bold ${cfg.color}`}>{count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cfg.bar} transition-all duration-700`}
                    style={{ width: `${pct}%`, opacity: 0.8 }}
                  />
                </div>
              </div>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <div className="py-8 text-center">
            <p className="font-mono text-xs text-muted-foreground">No pillar data yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
