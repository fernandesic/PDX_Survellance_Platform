import { useState, useEffect, useCallback } from "react";
import { COUNTRIES, type StaticCountry } from "./components/ohData";
import { oneHealthApi, type OHCountry, type OHKPIs, type OHAgent, type OHHITLAction } from "./services/oneHealth";
import { useLiveStream } from "./hooks/useLiveStream";
import { OneHealthView } from "./OneHealthView";
import type { Alert } from "./components/AlertFeed";

function mapApiAlert(a: any): Alert {
  return {
    alert_id: a.alert_id,
    tier: a.alert_tier,
    disease: a.disease_name,
    country: a.country_iso3,
    district: a.district,
    note: `${a.status || ""} · ${a.district || ""}`.trim(),
    ihr: a.ihr_notifiable,
    woah: a.woah_listed,
    status: a.status,
  };
}

/** Merge API data into the static country shape the components expect */
function apiToStatic(c: OHCountry): StaticCountry {
  return {
    iso3: c.iso3,
    name: c.name,
    lat: c.lat,
    lon: c.lon,
    risk: c.risk ?? 5,
    spar: c.spar ?? 51,
    tier: 0, // alerts come from a separate source; default 0
    sub: c.sub ?? "",
    alert: undefined,
  };
}

const OneHealthPage = () => {
  const [layers, setLayers] = useState<Record<string, boolean>>({
    spillover: true,
    alerts: true,
    animals: false,
    environment: false,
    epilinks: false,
    spar: false,
  });

  const [tooltip, setTooltip] = useState<{
    country: StaticCountry | null;
    x: number;
    y: number;
  }>({ country: null, x: 0, y: 0 });

  // Real data state
  const [countries, setCountries] = useState<StaticCountry[]>(COUNTRIES);
  const [kpis, setKpis] = useState<OHKPIs | null>(null);
  const [dataSource, setDataSource] = useState<"loading" | "api" | "fallback">("loading");
  const [selectedCountryIso3, setSelectedCountryIso3] = useState<string | undefined>();

  // Right panel mode: "ew" = Early Warning, "ops" = Alerts/Agents/HITL
  const [rightPanel, setRightPanel] = useState<"ew" | "ops">("ew");

  // TRIAD Additions: search, alert detail, live stream
  const [search, setSearch] = useState("");
  const [openAlertId, setOpenAlertId] = useState<string | null>(null);
  const live = useLiveStream();

  // Alerts are fetched once and persisted across panel toggles to avoid
  // the static→DB flicker every time the user opens the Operations panel.
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsSource, setAlertsSource] = useState<"db" | "static" | "loading">("loading");

  // Agents — same lift-to-parent pattern as alerts.
  const [agents, setAgents] = useState<OHAgent[]>([]);
  const [agentsSource, setAgentsSource] = useState<"db" | "loading" | "fallback">("loading");

  // Human-in-the-Loop pending queue.
  const [hitl, setHitl] = useState<OHHITLAction[]>([]);
  const [hitlSource, setHitlSource] = useState<"db" | "loading" | "fallback">("loading");

  const refreshHITL = useCallback(async () => {
    try {
      const data = await oneHealthApi.getHITLPending(10);
      if (Array.isArray(data)) {
        setHitl(data);
        setHitlSource("db");
      }
    } catch {
      setHitlSource("fallback");
    }
  }, []);

  const handleHITLApprove = useCallback(async (actionId: string) => {
    setHitl((prev) => prev.filter((a) => a.action_id !== actionId)); // optimistic
    try { await oneHealthApi.approveHITL(actionId); } catch { /* ignore */ }
    refreshHITL();
  }, [refreshHITL]);

  const handleHITLDismiss = useCallback(async (actionId: string) => {
    setHitl((prev) => prev.filter((a) => a.action_id !== actionId));
    try { await oneHealthApi.dismissHITL(actionId); } catch { /* ignore */ }
    refreshHITL();
  }, [refreshHITL]);

  const handleHITLAcknowledge = useCallback(async (actionId: string) => {
    setHitl((prev) => prev.filter((a) => a.action_id !== actionId));
    try { await oneHealthApi.acknowledgeHITL(actionId); } catch { /* ignore */ }
    refreshHITL();
  }, [refreshHITL]);

  // One-shot bootstrap of slow-changing data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [apiCountries, apiKpis, apiAlerts, apiAgents, apiHITL] = await Promise.all([
        oneHealthApi.getCountries(),
        oneHealthApi.getKPIs(),
        oneHealthApi.getAlerts(2, 30),
        oneHealthApi.getAgents().catch(() => null),
        oneHealthApi.getHITLPending(10).catch(() => null),
      ]);

      if (cancelled) return;

      if (apiCountries && apiCountries.length > 0) {
        setCountries(apiCountries.map(apiToStatic));
        setDataSource("api");
      } else {
        setDataSource("fallback");
      }

      if (apiKpis) setKpis(apiKpis);

      if (apiAlerts && apiAlerts.length > 0) {
        setAlerts(apiAlerts.map(mapApiAlert));
        setAlertsSource("db");
      } else {
        // API returned nothing — fall back to static so the panel isn't empty
        const fallback: Alert[] = COUNTRIES
          .filter((c) => c.alert)
          .sort((a, b) => (b.alert?.tier || 0) - (a.alert?.tier || 0))
          .map((c) => ({
            tier: c.alert!.tier,
            disease: c.alert!.disease,
            country: c.name,
            note: c.alert!.note,
          }));
        setAlerts(fallback);
        setAlertsSource("static");
      }

      if (apiAgents && Array.isArray(apiAgents) && apiAgents.length > 0) {
        setAgents(apiAgents);
        setAgentsSource("db");
      } else {
        setAgents([]);
        setAgentsSource("fallback");
      }

      if (apiHITL && Array.isArray(apiHITL)) {
        setHitl(apiHITL);
        setHitlSource("db");
      } else {
        setHitl([]);
        setHitlSource("fallback");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Merge live SSE frames as they arrive (5-second cadence)
  useEffect(() => {
    if (!live.ts) return;
    if (live.kpis) setKpis((prev) => prev ? { ...prev, ...live.kpis } : prev);
    if (live.alerts && live.alerts.length > 0) {
      setAlerts(live.alerts.map(mapApiAlert));
      setAlertsSource("db");
    }
    if (live.agents && live.agents.length > 0) {
      setAgents(live.agents as OHAgent[]);
      setAgentsSource("db");
    }
    if (live.hitl && Array.isArray(live.hitl)) {
      setHitl(live.hitl as OHHITLAction[]);
      setHitlSource("db");
    }
    setDataSource("api");
  }, [live.ts, live.kpis, live.alerts, live.agents, live.hitl]);

  const toggleLayer = useCallback((key: string) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleCountryHover = useCallback(
    (country: StaticCountry | null, x: number, y: number) => {
      setTooltip({ country, x, y });
    },
    []
  );

  // Prevent parent layout from scrolling on the OneHealth page
  useEffect(() => {
    // Find the parent scroll container (MainLayout's grow div)
    const parent = document.querySelector(".grow.overflow-y-auto") as HTMLElement | null;
    if (parent) {
      parent.style.overflow = "hidden";
    }
    return () => {
      if (parent) {
        parent.style.overflow = "";
      }
    };
  }, []);

  return (
    <OneHealthView
        layers={layers}
        toggleLayer={toggleLayer}
        tooltip={tooltip}
        handleCountryHover={handleCountryHover}
        countries={countries}
        kpis={kpis}
        dataSource={dataSource}
        rightPanel={rightPanel}
        setRightPanel={setRightPanel}
        setSelectedCountryIso3={setSelectedCountryIso3}
        search={search}
        setSearch={setSearch}
        openAlertId={openAlertId}
        setOpenAlertId={setOpenAlertId}
        alerts={alerts}
        alertsSource={alertsSource}
        agents={agents}
        agentsSource={agentsSource}
        hitl={hitl}
        hitlSource={hitlSource}
        onHITLApprove={handleHITLApprove}
        onHITLDismiss={handleHITLDismiss}
        onHITLAcknowledge={handleHITLAcknowledge}
    />
  );
};

export default OneHealthPage;

