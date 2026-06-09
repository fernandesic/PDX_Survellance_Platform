import { formatDistanceToNow } from "date-fns";
import { ExternalLink, MessageSquare, Globe, AlertCircle } from "lucide-react";
import { PILLAR_CFG } from "@/pages/hdis/constants";
import { TrustBadge } from "@/pages/hdis/components/TrustBadge";
import { RiskBadge } from "@/pages/hdis/components/shared/RiskBadge";
import type { IntelRecord } from "@/pages/hdis/types";

interface IntelRecordCardProps {
    record: IntelRecord;
    onClick: (id: number) => void;
}

export function IntelRecordCard({ record, onClick }: IntelRecordCardProps) {
    const pillar = PILLAR_CFG[record.pillar] || PILLAR_CFG.outbreak;
    const PillarIcon = pillar.icon;

    const timeAgo = formatDistanceToNow(new Date(record.created_at), { addSuffix: true });

    return (
        <div
            onClick={() => onClick(record.id)}
            className="group relative flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-primary/30 hover:bg-secondary/20 cursor-pointer shadow-sm hover:shadow-md"
        >
            {/* Top Row: Meta & Verification */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-[#0c1220]"
                        style={{ color: pillar.color, backgroundColor: `${pillar.color}10` }}
                    >
                        <PillarIcon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground/70">
                            {pillar.label}
                        </span>
                        <span className="font-mono text-[13px] text-muted-foreground">
                            {timeAgo}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <TrustBadge
                        level={record.trust?.trust_level ?? "unconfirmed"}
                        showScore={record.trust?.score}
                    />
                    <RiskBadge level={record.risk_level ?? "low"} />
                </div>
            </div>

            {/* Headline */}
            <div>
                <h3 className="text-base font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                    {record.headline}
                </h3>
            </div>

            {/* Bottom Row: Location & Actions */}
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" />
                        <span className="font-mono text-sm uppercase">{record.location_country_iso}</span>
                    </div>
                    {record.disease_name && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="font-mono text-sm uppercase">{record.disease_name}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {record.source_display?.url && (
                        <a
                            href={record.source_display.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-primary transition-all"
                            title="Official Link"
                        >
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    )}
                    <div
                        className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
                        title="Add Notes"
                    >
                        <MessageSquare className="h-4 w-4" />
                    </div>
                </div>
            </div>

            {/* Vertical Status Line (High/Critical only) */}
            {(record.risk_level === 'critical' || record.risk_level === 'high') && (
                <div
                    className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full"
                    style={{ backgroundColor: record.risk_level === 'critical' ? '#ef4444' : '#f97316' }}
                />
            )}
        </div>
    );
}
