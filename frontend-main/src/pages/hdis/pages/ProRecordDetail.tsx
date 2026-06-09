import { useParams, useNavigate } from "react-router-dom";
import { useIntelRecord } from "@/pages/hdis/hooks/useIntelligence";
import { TrustBadge } from "@/pages/hdis/components/TrustBadge";
import { RiskBadge } from "@/pages/hdis/components/shared/RiskBadge";
import { ArrowLeft, ExternalLink, Clock, MapPin, Shield } from "lucide-react";
import { format } from "date-fns";

const RecordDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: record, isLoading } = useIntelRecord(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center p-16">
        <p className="font-mono text-sm text-muted-foreground">Record not found</p>
      </div>
    );
  }

  const trustData = record.trust;

  return (
    <div className="mx-auto space-y-6 animate-fade-in-up">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> BACK
      </button>

      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground leading-tight">{record.headline}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RiskBadge level={record.risk_level ?? "low"} />
              <TrustBadge level={trustData?.trust_level ?? "unconfirmed"} showScore={trustData?.score} />
              {record.country_tags.map((c) => (
                <span key={c} className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-sm">
                  <MapPin className="h-3 w-3" /> {c}
                </span>
              ))}
              <span className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
                <Clock className="h-3 w-3" /> {format(new Date(record.created_at), "PPp")}
              </span>
            </div>
          </div>
          {record.source_url && (
            <a
              href={record.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded border border-border px-3 py-1.5 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Source
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Impact Assessment */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">IMPACT ASSESSMENT</h3>
            <p className="text-sm text-foreground leading-relaxed">{record.impact_assessment || "No impact data available."}</p>
          </div>

          {/* Recommended Posture */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">RECOMMENDED POSTURE</h3>
            <p className="text-sm text-foreground leading-relaxed">{record.recommended_posture || "Routine monitoring."}</p>
          </div>

          {/* Translated text */}
          {record.translated_text && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">TRANSLATED TEXT</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{record.translated_text}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Trust Details */}
          {trustData && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">
                <Shield className="h-3.5 w-3.5 inline mr-1" /> TRUST ANALYSIS
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Composite Score</span>
                  <span className="font-mono font-bold text-foreground">{trustData.score}/100</span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${trustData.score >= 80 ? "bg-green-500" :
                        trustData.score >= 60 ? "bg-yellow-500" :
                          trustData.score >= 40 ? "bg-orange-500" : "bg-red-500"
                      }`}
                    style={{ width: `${trustData.score}%` }}
                  />
                </div>
                <div className="space-y-2 mt-3 pt-3 border-t border-border/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Source Tier</span>
                    <span className="font-mono text-foreground">Tier {record.scs_tier} ({(trustData.source_tier_weight * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Corroboration</span>
                    <span className="font-mono text-foreground">{trustData.corroboration_count} source{trustData.corroboration_count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Disease Confidence</span>
                    <span className="font-mono text-foreground">{trustData.disease_match_confidence}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recency Factor</span>
                    <span className="font-mono text-foreground">{(trustData.recency_factor * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Classification */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">CLASSIFICATION</h3>
            <div className="space-y-2">
              {record.disease_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Disease</span>
                  <span className="font-mono text-foreground">{record.disease_name}</span>
                </div>
              )}
              {record.disease_category && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-mono text-foreground">{record.disease_category}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className="font-mono text-foreground uppercase">{record.status}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Source</span>
                <span className="font-mono text-foreground">{record.source_display?.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Ingested from</span>
                <span className="font-mono text-foreground">{record.ingestion_source || "—"}</span>
              </div>
              {record.reported_cases != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cases</span>
                  <span className="font-mono text-foreground">{record.reported_cases}</span>
                </div>
              )}
              {record.reported_deaths != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deaths</span>
                  <span className="font-mono text-foreground">{record.reported_deaths}</span>
                </div>
              )}
            </div>
          </div>

          {/* Topics */}
          {record.topics?.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">TOPICS</h3>
              <div className="flex flex-wrap gap-1.5">
                {record.topics.map((t) => (
                  <span key={t} className="rounded bg-secondary px-2 py-0.5 font-mono text-sm text-secondary-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordDetail;
