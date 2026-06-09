import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIntelRecords } from "@/pages/hdis/hooks/useIntelligence";
import { BackButton } from "@/pages/hdis/components/shared/BackButton";
import { IntelRecordCard } from "@/pages/hdis/components/IntelRecordCard";
import { RISK_LEVELS, WHO_AFRO_COUNTRIES } from "@/pages/hdis/lib/constants";
import { isToday, isYesterday, format, startOfDay, subDays, isAfter } from "date-fns";
import { Globe } from "lucide-react";
import type { TrustLevel } from "@/pages/hdis/types";

const TRUST_LEVELS: TrustLevel[] = ["verified", "corroborated", "unverified", "unconfirmed"];

const Feed = () => {
  const navigate = useNavigate();
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [trustFilter, setTrustFilter] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || undefined;

  const { data: records, isLoading } = useIntelRecords({
    risk_level: riskFilter || undefined,
    country_tag: countryFilter || undefined,
    trust_level: trustFilter || undefined,
    q: searchQuery,
  });

  // Filter and Group records by date
  const groupedRecords = useMemo(() => {
    if (!records) return [];

    const now = new Date();
    const groups: { [key: string]: any[] } = {};

    const filteredRecords = records.filter(record => {
      if (timeFilter === "all") return true;
      const date = new Date(record.created_at);

      if (timeFilter === "today") return isToday(date);
      if (timeFilter === "yesterday") return isYesterday(date);
      if (timeFilter === "week") return isAfter(date, subDays(now, 7));
      if (timeFilter === "month") return isAfter(date, subDays(now, 30));

      return true;
    });

    filteredRecords.forEach((record) => {
      const date = new Date(record.created_at);
      let groupKey = "";

      if (isToday(date)) {
        groupKey = "Today";
      } else if (isYesterday(date)) {
        groupKey = "Yesterday";
      } else {
        groupKey = format(date, "MMMM d, yyyy");
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(record);
    });

    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
      timestamp: startOfDay(new Date(items[0].created_at)).getTime(),
    })).sort((a, b) => b.timestamp - a.timestamp);
  }, [records, timeFilter]);

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      <div className="flex items-start gap-2 -ml-2">
        <BackButton />
        <div className="pt-1.5">
          <h2 className="font-mono text-xl font-bold text-foreground tracking-tight uppercase">Intelligence Feed</h2>
          <p className="mt-0.5 text-sm text-muted-foreground italic font-mono uppercase opacity-70">
            Real-time multi-source health diplomacy signals
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="font-mono text-sm uppercase tracking-wider text-muted-foreground font-bold">Risk</label>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-secondary px-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer hover:bg-secondary/70 transition-colors"
          >
            <option value="">All Risks</option>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>{r.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-mono text-sm uppercase tracking-wider text-muted-foreground font-bold">Trust</label>
          <select
            value={trustFilter}
            onChange={(e) => setTrustFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-secondary px-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer hover:bg-secondary/70 transition-colors"
          >
            <option value="">All Trust Levels</option>
            {TRUST_LEVELS.map((t) => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-mono text-sm uppercase tracking-wider text-muted-foreground font-bold">Region</label>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-secondary px-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer hover:bg-secondary/70 transition-colors"
          >
            <option value="">All Countries</option>
            {Object.entries(WHO_AFRO_COUNTRIES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-mono text-sm uppercase tracking-wider text-muted-foreground font-bold">Period</label>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-secondary px-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer hover:bg-secondary/70 transition-colors"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>

        {(riskFilter || trustFilter || countryFilter || timeFilter !== "all") && (
          <button
            onClick={() => { setRiskFilter(""); setTrustFilter(""); setCountryFilter(""); setTimeFilter("all"); }}
            className="font-mono text-sm uppercase tracking-widest text-primary hover:text-primary/80 transition-all font-bold"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Grouped Records View */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-32 space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="font-mono text-xs text-muted-foreground animate-pulse">SYNCHRONIZING FEED...</span>
          </div>
        ) : groupedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-32 space-y-4 rounded-xl border border-dashed border-border/50">
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
              <Globe className="h-6 w-6 text-muted-foreground opacity-20" />
            </div>
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">No matching signals indexed</p>
          </div>
        ) : (
          groupedRecords.map((group) => (
            <div key={group.date} className="space-y-4">
              <div className="flex items-center gap-4 px-1">
                <h4 className="font-mono text-sm font-bold text-muted-foreground uppercase tracking-[0.2em]">
                  {group.date}
                </h4>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-border/50 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.items.map((r: any) => (
                  <IntelRecordCard
                    key={r.id}
                    record={r}
                    onClick={(id) => navigate(`/hdis/record/${id}`)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;
