/**
 * HDIS-PRO — Country Intelligence View
 * Two modes: Country list overview, and deep-dive into a specific country.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCountries, useCountryDetail } from "@/pages/hdis/hooks/useIntelligence";
import { TrustBadge } from "@/pages/hdis/components/TrustBadge";
import { RiskBadge } from "@/pages/hdis/components/shared/RiskBadge";
import { BackButton } from "@/pages/hdis/components/shared/BackButton";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Shield,
  Activity,
  AlertTriangle,
  Heart,
  Syringe,
  Flame,
  CloudRain,
  Handshake,
  Users,
  Cross,
  Search,
} from "lucide-react";
import type { CountryIntelligence, RiskLevel } from "@/pages/hdis/types";

// Pillar metadata
const PILLAR_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string }
> = {
  outbreak: {
    label: "Outbreak",
    icon: Activity,
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/30",
  },
  conflict: {
    label: "Conflict",
    icon: Flame,
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/30",
  },
  vaccine: {
    label: "Vaccine",
    icon: Syringe,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/30",
  },
  policy: {
    label: "Policy",
    icon: Shield,
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/30",
  },
  funding: {
    label: "Funding",
    icon: Heart,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/30",
  },
  workforce: {
    label: "Workforce",
    icon: Users,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/30",
  },
  climate: {
    label: "Climate",
    icon: CloudRain,
    color: "text-teal-400",
    bg: "bg-teal-400/10 border-teal-400/30",
  },
  agreement: {
    label: "Agreements",
    icon: Handshake,
    color: "text-indigo-400",
    bg: "bg-indigo-400/10 border-indigo-400/30",
  },
  uhc: {
    label: "UHC",
    icon: Cross,
    color: "text-pink-400",
    bg: "bg-pink-400/10 border-pink-400/30",
  },
};

const RISK_COLORS: Record<string, string> = {
  critical: "border-l-red-500 bg-red-500/5",
  high: "border-l-orange-500 bg-orange-500/5",
  medium: "border-l-yellow-500 bg-yellow-500/5",
  low: "border-l-green-500 bg-green-500/5",
};

// ─── Pillar Mini Bar ─────────────────────────────────────────────────

function PillarMiniBar({ pillars }: { pillars: Record<string, number> }) {
  const total = Object.values(pillars).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
      {Object.entries(pillars).map(([key, count]) => {
        const cfg = PILLAR_CONFIG[key];
        if (!cfg || count === 0) return null;
        return (
          <div
            key={key}
            className={`h-full ${cfg.color.replace("text-", "bg-")} transition-all`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${cfg.label}: ${count}`}
          />
        );
      })}
    </div>
  );
}

// ─── Country Card ────────────────────────────────────────────────────

function CountryCard({
  country,
  onClick,
}: {
  country: CountryIntelligence;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-lg border border-border border-l-4
        ${RISK_COLORS[country.risk_level] || RISK_COLORS.low}
        p-4 transition-all duration-200
        hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-mono text-sm font-bold text-foreground">
            {country.country_name || country.country_iso}
          </h3>
          <span className="font-mono text-sm text-muted-foreground">
            {country.country_iso}
          </span>
        </div>
        <RiskBadge level={country.risk_level as RiskLevel} />
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground font-medium">
            {country.signal_count}
          </span>
          <span className="font-mono text-sm text-muted-foreground">
            signals
          </span>
        </div>
        {country.critical_count > 0 && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-400" />
            <span className="font-mono text-xs text-red-400 font-medium">
              {country.critical_count}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm text-muted-foreground">
            {country.active_pillars} pillars
          </span>
        </div>
      </div>

      <div className="mt-3">
        <PillarMiniBar pillars={country.pillars} />
      </div>

      {/* Pillar tags */}
      <div className="mt-2 flex flex-wrap gap-1">
        {Object.entries(country.pillars)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4)
          .map(([key, count]) => {
            const cfg = PILLAR_CONFIG[key];
            if (!cfg) return null;
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${cfg.bg}`}
              >
                <cfg.icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                <span className={`font-mono text-xs ${cfg.color}`}>
                  {count}
                </span>
              </span>
            );
          })}
      </div>
    </div>
  );
}

// ─── Country Detail View ─────────────────────────────────────────────

function CountryDetailView({
  countryIso,
  onBack,
}: {
  countryIso: string;
  onBack: () => void;
}) {
  const { data: detail, isLoading } = useCountryDetail(countryIso);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-16 text-center">
        <p className="font-mono text-sm text-muted-foreground">
          No intelligence data for this country
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-md border border-border p-2 hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="font-mono text-xl font-bold text-foreground tracking-tight">
            {detail.country_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {detail.signal_count} signals • {detail.active_pillars} active
            pillars
          </p>
        </div>
        <RiskBadge level={detail.risk_level as RiskLevel} />
      </div>

      {/* Risk Distribution */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(detail.by_priority).map(([level, count]) => (
          <div
            key={level}
            className={`rounded-lg border border-border p-3 ${count > 0 ? RISK_COLORS[level] : ""
              }`}
          >
            <div className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
              {level}
            </div>
            <div className="font-mono text-2xl font-bold text-foreground mt-1">
              {count}
            </div>
          </div>
        ))}
      </div>

      {/* Pillar Breakdown */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-mono text-sm font-semibold text-foreground">
            PILLAR BREAKDOWN
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(detail.pillars).map(([key, pillar]) => {
            const cfg = PILLAR_CONFIG[key];
            if (!cfg) return null;
            return (
              <div key={key} className="bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded-md border p-1.5 ${cfg.bg}`}
                    >
                      <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>
                    <span className="font-mono text-xs font-medium text-foreground">
                      {pillar.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-foreground">
                      {pillar.count}
                    </span>
                    {pillar.critical > 0 && (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-xs text-red-400 font-bold">
                        {pillar.critical} CRIT
                      </span>
                    )}
                  </div>
                </div>
                {pillar.latest_headline && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {pillar.latest_headline}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Signal Timeline */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-mono text-sm font-semibold text-foreground">
            SIGNAL TIMELINE
          </h3>
        </div>
        <div className="divide-y divide-border/50">
          {detail.timeline.map((r: any) => (
            <div
              key={r.id}
              onClick={() => navigate(`/hdis/record/${r.id}`)}
              className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Pillar icon */}
                {PILLAR_CONFIG[r.pillar] && (
                  <div
                    className={`rounded-md border p-1 ${PILLAR_CONFIG[r.pillar].bg}`}
                  >
                    {(() => {
                      const Icon = PILLAR_CONFIG[r.pillar].icon;
                      return (
                        <Icon
                          className={`h-3 w-3 ${PILLAR_CONFIG[r.pillar].color}`}
                        />
                      );
                    })()}
                  </div>
                )}
                <span className="text-sm text-foreground truncate">
                  {r.headline}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {r.pillar_label && (
                  <span className="font-mono text-sm text-muted-foreground">
                    {r.pillar_label}
                  </span>
                )}
                <TrustBadge level={r.trust?.trust_level ?? "unconfirmed"} />
                <RiskBadge level={r.risk_level ?? "low"} />
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

const ProCountries = () => {
  const { data: countries, isLoading } = useCountries();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("");

  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    let result = [...countries];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.country_name?.toLowerCase().includes(q) ||
          c.country_iso.toLowerCase().includes(q)
      );
    }

    if (riskFilter) {
      result = result.filter((c) => c.risk_level === riskFilter);
    }

    return result;
  }, [countries, searchQuery, riskFilter]);

  // Country deep-dive mode
  if (selectedCountry) {
    return (
      <CountryDetailView
        countryIso={selectedCountry}
        onBack={() => setSelectedCountry(null)}
      />
    );
  }

  // Summary stats
  const riskCounts = {
    critical: countries?.filter((c) => c.risk_level === "critical").length ?? 0,
    high: countries?.filter((c) => c.risk_level === "high").length ?? 0,
    medium: countries?.filter((c) => c.risk_level === "medium").length ?? 0,
    low: countries?.filter((c) => c.risk_level === "low").length ?? 0,
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-start gap-2 -ml-2">
        <BackButton />
        <div className="pt-1.5">
          <h2 className="font-mono text-xl font-bold text-foreground tracking-tight">
            COUNTRY INTELLIGENCE
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {countries?.length ?? 0} countries monitored • Health diplomacy pillar
            coverage
          </p>
        </div>
      </div>

      {/* Risk overview pills */}
      <div className="flex flex-wrap gap-3">
        {(["critical", "high", "medium", "low"] as const).map((level) => (
          <button
            key={level}
            onClick={() =>
              setRiskFilter(riskFilter === level ? "" : level)
            }
            className={`
              flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-xs transition-all
              ${riskFilter === level
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }
            `}
          >
            <span
              className={`h-2 w-2 rounded-full ${level === "critical"
                ? "bg-red-500"
                : level === "high"
                  ? "bg-orange-500"
                  : level === "medium"
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
            />
            <span className="uppercase">{level}</span>
            <span className="font-bold">{riskCounts[level]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search countries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Country grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredCountries.length === 0 ? (
        <div className="flex items-center justify-center p-16">
          <p className="font-mono text-sm text-muted-foreground">
            No countries match your filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCountries.map((country) => (
            <CountryCard
              key={country.country_iso}
              country={country}
              onClick={() => setSelectedCountry(country.country_iso)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProCountries;
