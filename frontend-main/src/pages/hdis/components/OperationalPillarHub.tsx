import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";
import { useMemo } from "react";
import { format, subDays, isAfter } from "date-fns";

export function OperationalPillarHub() {
    const { records } = useDashboardContext();

    const chartData = useMemo(() => {
        const days = 14;
        const cutoff = subDays(new Date(), days);
        const buckets: Record<string, number> = {};

        for (let i = days - 1; i >= 0; i--) {
            const d = format(subDays(new Date(), i), "MMM dd");
            buckets[d] = 0;
        }

        records?.forEach((r: any) => {
            const dateStr = r.source_timestamp || r.created_at;
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (!isAfter(date, cutoff)) return;
            const day = format(date, "MMM dd");
            if (buckets[day] !== undefined) {
                buckets[day]++;
            }
        });

        return Object.entries(buckets).map(([date, count]) => ({
            date,
            signals: count,
        }));
    }, [records]);

    return (
        <div className="rounded-xl border border-border/40 bg-card p-4 h-full flex flex-col">
            <h3 className="font-mono text-sm font-bold text-foreground tracking-wide mb-3" style={{ fontStyle: "italic" }}>
                Operational Pillar Hub
            </h3>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "JetBrains Mono" }}
                            axisLine={false} tickLine={false}
                            interval="preserveStartEnd"
                            angle={-30}
                            textAnchor="end"
                            height={30}
                        />
                        <YAxis
                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "JetBrains Mono" }}
                            axisLine={false} tickLine={false} allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 8, fontSize: 10, fontFamily: "JetBrains Mono",
                                color: "hsl(var(--card-foreground))",
                            }}
                        />
                        <Bar
                            dataKey="signals"
                            fill="#f59e0b"
                            fillOpacity={0.85}
                            radius={[2, 2, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
