import { useAlerts } from "@/pages/hdis/hooks/useIntelligence";
import { RiskBadge } from "@/pages/hdis/components/shared/RiskBadge";
import { BackButton } from "@/pages/hdis/components/shared/BackButton";
import { ApiConsumer } from "@/lib/api";
import { Shield, Check, AlertTriangle, ChevronDown, ChevronRight, Globe, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WHO_AFRO_COUNTRIES } from "@/pages/hdis/lib/constants";
import { logger } from "@/utils/logger";

const Alerts = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAcked, setShowAcked] = useState(false);
  const { data: alerts, isLoading } = useAlerts({ acknowledged: showAcked ? undefined : false });

  const [acking, setAcking] = useState<number | null>(null);
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});

  const acknowledge = async (alertId: number) => {
    setAcking(alertId);
    try {
      await ApiConsumer.post(`/hdis/alerts/${alertId}/acknowledge/`);
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-stats"] });
    } catch (e) {
      logger.error("Failed to acknowledge alert", e);
    }
    setAcking(null);
  };

  const toggleCountry = (iso: string) => {
    setExpandedCountries(prev => ({ ...prev, [iso]: !prev[iso] }));
  };

  // Group alerts by country and calculate stats
  const groupedAlerts = useMemo(() => {
    if (!alerts) return [];

    const groups: Record<string, {
      iso: string;
      name: string;
      alerts: any[];
      stats: { critical: number; high: number; medium: number; low: number };
      latestDate: Date;
    }> = {};

    alerts.forEach((a: any) => {
      const iso = a.country_iso || "UNKNOWN";
      if (!groups[iso]) {
        groups[iso] = {
          iso,
          name: WHO_AFRO_COUNTRIES[iso as keyof typeof WHO_AFRO_COUNTRIES] || a.country || iso,
          alerts: [],
          stats: { critical: 0, high: 0, medium: 0, low: 0 },
          latestDate: new Date(a.created_at),
        };
      }

      groups[iso].alerts.push(a);
      const risk = (a.risk_level || "low") as keyof typeof groups[string]["stats"];
      groups[iso].stats[risk]++;

      const alertDate = new Date(a.created_at);
      if (alertDate > groups[iso].latestDate) {
        groups[iso].latestDate = alertDate;
      }
    });

    return Object.values(groups).sort((a, b) => {
      // Sort by critical count first, then by date
      if (b.stats.critical !== a.stats.critical) return b.stats.critical - a.stats.critical;
      return b.latestDate.getTime() - a.latestDate.getTime();
    });
  }, [alerts]);

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2 -ml-2">
          <BackButton />
          <div className="pt-1.5">
            <h2 className="font-mono text-xl font-bold text-foreground tracking-tight">ALERT CENTER</h2>
            <p className="mt-0.5 text-sm text-muted-foreground uppercase font-mono tracking-wider opacity-70">
              {alerts?.length ?? 0} active triggers across {groupedAlerts.length} countries
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer bg-secondary/30 px-3 py-1.5 rounded-lg border border-border group hover:bg-secondary/50 transition-colors">
          <input
            type="checkbox"
            checked={showAcked}
            onChange={(e) => setShowAcked(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <span className="font-mono text-sm font-bold text-muted-foreground uppercase group-hover:text-foreground transition-colors">Show acknowledged</span>
        </label>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-32 space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="font-mono text-sm text-muted-foreground animate-pulse">MONITORING DATASTREAMS...</span>
          </div>
        ) : groupedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-32 space-y-4 rounded-xl border border-dashed border-border/50">
            <div className="h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center">
              <Shield className="h-6 w-6 text-muted-foreground opacity-20" />
            </div>
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest italic">All systems clear. No pending alerts found.</p>
          </div>
        ) : (
          groupedAlerts.map((group) => {
            const isExpanded = expandedCountries[group.iso] === true;
            return (
              <div key={group.iso} className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
                <div
                  onClick={() => toggleCountry(group.iso)}
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-secondary/20 transition-colors border-b border-border/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50 border border-border/50">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground leading-tight flex items-center gap-2">
                        {group.name}
                        <span className="text-sm uppercase font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{group.iso}</span>
                      </h3>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="font-mono text-sm text-muted-foreground uppercase font-bold">{group.alerts.length} ALERTS TOTAL</span>
                        <div className="flex gap-1.5">
                          {group.stats.critical > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="Critical" />}
                          {group.stats.high > 0 && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" title="High" />}
                          {group.stats.medium > 0 && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" title="Medium" />}
                        </div>
                        <span className="font-mono text-xs text-muted-foreground italic uppercase">Latest: {formatDistanceToNow(group.latestDate, { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-4">
                      {group.stats.critical > 0 && (
                        <div className="flex flex-col items-center px-3 py-1 rounded bg-red-500/10 border border-red-500/20">
                          <span className="text-xs font-bold text-red-500">{group.stats.critical}</span>
                          <span className="text-xs font-mono text-red-400 font-bold uppercase">Critical</span>
                        </div>
                      )}
                      {group.stats.high > 0 && (
                        <div className="flex flex-col items-center px-3 py-1 rounded bg-orange-500/10 border border-orange-500/20">
                          <span className="text-xs font-bold text-orange-500">{group.stats.high}</span>
                          <span className="text-xs font-mono text-orange-400 font-bold uppercase">High</span>
                        </div>
                      )}
                    </div>
                    {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </div>

                {/* Alerts List for Country */}
                {isExpanded && (
                  <div className="divide-y divide-border/30 bg-secondary/5">
                    {group.alerts.map((a: any) => (
                      <div
                        key={a.id}
                        className="group flex flex-col md:flex-row md:items-center justify-between px-6 py-4 hover:bg-secondary/20 transition-colors"
                      >
                        <div
                          className="flex-1 cursor-pointer min-w-0"
                          onClick={() => navigate(`/hdis/record/${a.record_id}`)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              <AlertTriangle className={`h-4 w-4 shrink-0 ${a.risk_level === "critical" ? "text-red-500" : a.risk_level === "high" ? "text-orange-500" : "text-yellow-500"}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                                {a.trigger_reason}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                <RiskBadge level={a.risk_level ?? "low"} />
                                {a.multi_source_validated && (
                                  <span className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-400 border border-blue-500/20 uppercase">
                                    <Shield className="h-2.5 w-2.5" /> Multi-Source Corroborated
                                  </span>
                                )}
                                <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground uppercase px-2 py-0.5 bg-secondary/50 rounded">
                                  <Info className="h-2.5 w-2.5" />
                                  Indexed {format(new Date(a.created_at), "MMM d, HH:mm")}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 md:mt-0 md:ml-6 flex items-center justify-between md:justify-end gap-4 border-t border-border/20 pt-4 md:pt-0 md:border-t-0">
                          <span className="font-mono text-sm text-muted-foreground italic uppercase md:hidden">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                          </span>
                          <div className="flex items-center gap-3">
                            {a.acknowledged_at ? (
                              <div className="flex flex-col items-end">
                                <span className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-1 font-mono text-sm font-bold text-green-400 border border-green-500/20 uppercase tracking-tight">
                                  <Check className="h-3 w-3" /> Acknowledged
                                </span>
                                <span className="text-xs font-mono text-muted-foreground mt-0.5 italic">
                                  {formatDistanceToNow(new Date(a.acknowledged_at), { addSuffix: true })}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); acknowledge(a.id); }}
                                disabled={acking === a.id}
                                className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 font-mono text-sm font-bold text-primary hover:bg-primary/20 hover:border-primary transition-all disabled:opacity-50 active:scale-95 uppercase tracking-wider"
                              >
                                {acking === a.id ? "Processing..." : "Mark as Actioned"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div >
  );
};

export default Alerts;
