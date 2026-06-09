/**
 * HDIS-PRO: Threat Trend Chart
 * Uses source_timestamp (publication date) for accurate 30-day trends.
 * Falls back to created_at for signals without source_timestamp.
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useIntelRecords } from "@/pages/hdis/hooks/useIntelligence";
import { useMemo } from "react";
import { format, subDays, isAfter } from "date-fns";

const RISK_COLORS: Record<string, string> = {
  critical: "hsl(0, 72%, 51%)",
  high: "hsl(25, 95%, 53%)",
  medium: "hsl(38, 92%, 50%)",
  low: "hsl(160, 70%, 42%)",
};

export function ProThreatTrendChart() {
  const { data: records } = useIntelRecords();

  const { chartData, totals } = useMemo(() => {
    const days = 30; // 30-day window for better data spread
    const cutoff = subDays(new Date(), days);
    const buckets: Record<string, { critical: number; high: number; medium: number; low: number }> = {};

    // Create buckets for each day
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      buckets[d] = { critical: 0, high: 0, medium: 0, low: 0 };
    }

    // Use source_timestamp (publication date), fallback to created_at
    records?.forEach((r: any) => {
      const dateStr = r.source_timestamp || r.created_at;
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (!isAfter(date, cutoff)) return;

      const day = format(date, "MMM dd");
      if (buckets[day] && r.risk_level) {
        const level = r.risk_level as keyof (typeof buckets)[string];
        if (level in buckets[day]) buckets[day][level]++;
      }
    });

    const data = Object.entries(buckets).map(([date, counts]) => ({ date, ...counts }));

    // Only show last 14 entries to fit nicely
    const trimmed = data.slice(-14);

    const t = { critical: 0, high: 0, medium: 0, low: 0 };
    trimmed.forEach((d) => {
      t.critical += d.critical;
      t.high += d.high;
      t.medium += d.medium;
      t.low += d.low;
    });
    return { chartData: trimmed, totals: t };
  }, [records]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <h3 className="font-mono text-sm font-bold text-foreground tracking-wide">SIGNAL ACTIVITY</h3>
        </div>
        <div className="flex items-center gap-3">
          {(["critical", "high", "medium", "low"] as const).map((l) => (
            <div key={l} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: RISK_COLORS[l] }} />
              <span className="font-mono text-xs text-muted-foreground capitalize">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 border-b border-border/50">
        {(Object.entries(totals) as [string, number][]).map(([level, count]) => (
          <div key={level} className="flex flex-col items-center py-2 border-r last:border-r-0 border-border/30">
            <span className="font-mono text-lg font-bold" style={{ color: RISK_COLORS[level] }}>{count}</span>
            <span className="font-mono text-xs uppercase text-muted-foreground tracking-wider">{level}</span>
          </div>
        ))}
      </div>

      {/* Bar Chart — stacked bars show volume per day */}
      <div className="p-4 pt-2">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--grid-line))" strokeOpacity={0.3} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "hsl(var(--text-dim))", fontFamily: "JetBrains Mono" }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "hsl(var(--text-dim))", fontFamily: "JetBrains Mono" }}
              axisLine={false} tickLine={false} allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono",
              }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
            />
            <Bar dataKey="critical" stackId="a" fill={RISK_COLORS.critical} radius={[0, 0, 0, 0]} />
            <Bar dataKey="high" stackId="a" fill={RISK_COLORS.high} />
            <Bar dataKey="medium" stackId="a" fill={RISK_COLORS.medium} />
            <Bar dataKey="low" stackId="a" fill={RISK_COLORS.low} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
