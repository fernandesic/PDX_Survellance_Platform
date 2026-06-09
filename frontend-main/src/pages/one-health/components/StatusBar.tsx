import { useEffect, useState } from "react";
import { oneHealthApi, type OHIngestionSource } from "../services/oneHealth";

interface StatusBarProps {
  dataSource?: "loading" | "api" | "fallback";
}

const STATUS_COLOR: Record<string, string> = {
  fresh: "var(--oh-sage)",
  stale: "var(--oh-amber)",
  disconnected: "var(--oh-crimson)",
  not_configured: "var(--oh-text3)",
};

export default function StatusBar({ dataSource }: StatusBarProps) {
  const [sources, setSources] = useState<OHIngestionSource[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await oneHealthApi.getIngestionStatus();
        if (!cancelled && Array.isArray(data)) setSources(data);
      } catch {
        // Leave sources empty on error — UI shows nothing rather than fake green dots.
      }
    }
    load();
    const id = setInterval(load, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-6 z-[800] flex items-center px-4 gap-4 backdrop-blur-lg"
      style={{
        background: "var(--oh-glass2)",
        borderTop: "1px solid var(--oh-border)",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "9px",
        color: "var(--oh-text3)",
      }}
    >
      {sources.length === 0 && (
        <span style={{ opacity: 0.6 }}>Loading ingestion status…</span>
      )}
      {sources.map((src) => {
        const color = STATUS_COLOR[src.status] || STATUS_COLOR.not_configured;
        const label = src.status === "not_configured"
          ? `${src.name}: not configured`
          : `${src.name}: ${src.label}`;
        return (
          <div
            key={src.name}
            className="flex items-center gap-1.5"
            title={src.last_seen ? `Last seen: ${src.last_seen}` : src.status}
          >
            <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: color }} />
            {label}
          </div>
        );
      })}
      <div className="ml-auto flex gap-4">
        <span>47 Member States · WHO AFRO</span>
        <span style={{ color: dataSource === "api" ? "var(--oh-sage)" : "var(--oh-aqua)" }}>
          {dataSource === "api" ? "LIVE DB · All systems operational" : "TRIAD v1.0 — Fallback mode"}
        </span>
      </div>
    </div>
  );
}
