import { format } from "date-fns";
// Briefing lives in hdis/types — useIntelligence re-imports it but doesn't
// re-export, so go to the source directly.
import type { Briefing } from "@/pages/hdis/types";

function riskEmoji(level: string) {
  switch (level) {
    case "critical": return "🔴";
    case "high": return "🟠";
    case "medium": return "🟡";
    case "low": return "🟢";
    default: return "⚪";
  }
}

export function briefingToMarkdown(b: Briefing): string {
  const content = b.content as any;
  const lines: string[] = [];

  lines.push(`# ${(b.briefing_type ?? "daily").toUpperCase()} BRIEFING`);
  lines.push("");
  lines.push(`**Generated:** ${format(new Date(b.generated_at), "MMMM d, yyyy HH:mm 'UTC'")}`);
  if (b.period_start && b.period_end) {
    lines.push(`**Coverage:** ${format(new Date(b.period_start), "MMM d, yyyy")} — ${format(new Date(b.period_end), "MMM d, yyyy")}`);
  }
  if (b.country_filter?.length) {
    lines.push(`**Countries:** ${b.country_filter.join(", ")}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  if (content?.executive_summary) {
    lines.push("## Executive Summary");
    lines.push("");
    lines.push(content.executive_summary);
    lines.push("");
  }

  if (content?.risk_assessment) {
    lines.push("## Risk Assessment");
    lines.push("");
    const ra = content.risk_assessment;
    lines.push(`**Level:** ${riskEmoji(ra.level)} ${(ra.level ?? "unknown").toUpperCase()} | **Direction:** ${ra.direction ?? "stable"}`);
    if (ra.comparison) lines.push(`**Comparison:** ${ra.comparison}`);
    if (ra.reasoning) {
      lines.push("");
      lines.push(ra.reasoning);
    }
    lines.push("");
  }

  if (content?.cross_pillar_correlation) {
    lines.push("## Cross-Pillar Correlation");
    lines.push("");
    lines.push(content.cross_pillar_correlation);
    lines.push("");
  }

  if (content?.recommended_actions?.length) {
    lines.push("## Recommended Actions");
    lines.push("");
    for (let i = 0; i < content.recommended_actions.length; i++) {
      const a = content.recommended_actions[i];
      if (typeof a === "string") {
        lines.push(`${i + 1}. ${a}`);
      } else {
        lines.push(`### ${i + 1}. ${a.action}`);
        lines.push("");
        if (a.urgency) lines.push(`**Urgency:** ${a.urgency.toUpperCase()}`);
        if (a.pillar) lines.push(`**Pillar:** ${a.pillar}`);
        if (a.rationale) lines.push(`**Rationale:** ${a.rationale}`);
        lines.push("");
      }
    }
  }

  if (content?.information_gaps?.length) {
    lines.push("## Information Gaps");
    lines.push("");
    for (const gap of content.information_gaps) {
      lines.push(`- **${gap.area}**${gap.criticality ? ` (${gap.criticality})` : ""}`);
      if (gap.suggested_investigation) lines.push(`  - ${gap.suggested_investigation}`);
    }
    lines.push("");
  }

  if (content?.sources_summary) {
    lines.push("## Sources");
    lines.push("");
    lines.push(`- **Total Signals:** ${content.sources_summary.total_signals ?? 0}`);
    lines.push(`- **Total Sources:** ${content.sources_summary.total_sources ?? 0}`);
    lines.push("");
  }

  lines.push("---");
  lines.push(`*WHO AFRO Health Diplomacy Intelligence System — Generated ${format(new Date(b.generated_at), "yyyy-MM-dd")}*`);

  return lines.join("\n");
}

export function downloadBriefingMarkdown(b: Briefing) {
  const md = briefingToMarkdown(b);
  const dateStr = format(new Date(b.generated_at), "yyyy-MM-dd");
  const filename = `HDIS-Briefing-${b.briefing_type}-${dateStr}.md`;
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadBriefingPDF(b: Briefing) {
  const content = b.content as any;
  const dateStr = format(new Date(b.generated_at), "MMMM d, yyyy HH:mm");

  const riskColor = (level: string) => {
    switch (level) {
      case "critical": return "#dc2626";
      case "high": return "#ea580c";
      case "medium": return "#ca8a04";
      case "low": return "#16a34a";
      default: return "#6b7280";
    }
  };

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>HDIS Briefing — ${b.briefing_type} — ${dateStr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: #1a1a2e; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
  .header { border-bottom: 3px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-family: 'JetBrains Mono', monospace; font-size: 22px; text-transform: uppercase; letter-spacing: 2px; }
  .header .meta { font-size: 12px; color: #64748b; margin-top: 6px; }
  .section-title { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; margin: 28px 0 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .summary { font-size: 14px; line-height: 1.7; margin-bottom: 8px; }
  .event { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .event-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .event-title { font-weight: 700; font-size: 14px; }
  .risk-badge { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; color: white; text-transform: uppercase; }
  .event-desc { font-size: 13px; color: #334155; margin-bottom: 8px; }
  .who-impact { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 8px 12px; font-size: 12px; border-radius: 0 4px 4px 0; }
  .countries { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #64748b; }
  .risk-matrix { display: flex; gap: 24px; margin: 12px 0; }
  .risk-item { text-align: center; }
  .risk-count { font-size: 28px; font-weight: 700; }
  .risk-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; }
  .action { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
  .action-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
  .action-meta { font-size: 11px; color: #64748b; }
  .timeline-badge { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; font-style: italic; }
  @media print { body { padding: 20px; } .event, .action { break-inside: avoid; } }
</style></head><body>`;

  html += `<div class="header">
    <h1>🛡️ ${b.briefing_type?.toUpperCase()} BRIEFING</h1>
    <div class="meta">Generated: ${dateStr} UTC${b.period_start && b.period_end ? ` • Coverage: ${format(new Date(b.period_start), "MMM d")} — ${format(new Date(b.period_end), "MMM d, yyyy")}` : ""}${b.country_filter?.length ? ` • Countries: ${b.country_filter.join(", ")}` : ""}</div>
  </div>`;

  if (content?.executive_summary) {
    html += `<div class="section-title">Executive Summary</div><p class="summary">${content.executive_summary}</p>`;
  }

  if (content?.risk_assessment) {
    const ra = content.risk_assessment;
    html += `<div class="section-title">Risk Assessment</div>`;
    html += `<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px">`;
    html += `<span class="risk-badge" style="background:${riskColor(ra.level)}">${(ra.level ?? "").toUpperCase()}</span>`;
    html += `<span style="font-size:13px;color:#64748b">${ra.direction === "worsening" ? "↑ Worsening" : ra.direction === "improving" ? "↓ Improving" : "→ Stable"}</span>`;
    if (ra.comparison) html += `<span style="font-size:12px;color:#94a3b8">• ${ra.comparison}</span>`;
    html += `</div>`;
    if (ra.reasoning) html += `<p class="summary">${ra.reasoning}</p>`;
  }

  if (content?.cross_pillar_correlation) {
    html += `<div class="section-title">Cross-Pillar Correlation</div>`;
    html += `<p class="summary">${content.cross_pillar_correlation}</p>`;
  }

  if (content?.recommended_actions?.length) {
    html += `<div class="section-title">Recommended Actions</div>`;
    for (const a of content.recommended_actions) {
      if (typeof a === "string") {
        html += `<div class="action"><p class="summary">${a}</p></div>`;
      } else {
        const urgencyColor = a.urgency === "immediate" ? "#dc2626" : a.urgency === "48h" ? "#ea580c" : a.urgency === "this_week" ? "#3b82f6" : "#64748b";
        html += `<div class="action">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <span class="action-title">${a.action}</span>
            ${a.urgency ? `<span class="timeline-badge" style="color:${urgencyColor};border:1px solid ${urgencyColor}">${a.urgency.toUpperCase()}</span>` : ""}
          </div>
          ${a.rationale ? `<p class="event-desc">${a.rationale}</p>` : ""}
          <div class="action-meta">${a.pillar ? `📋 ${a.pillar}` : ""}</div>
        </div>`;
      }
    }
  }

  if (content?.information_gaps?.length) {
    html += `<div class="section-title">Information Gaps</div>`;
    for (const gap of content.information_gaps) {
      html += `<div class="action">
        <span class="action-title">❓ ${gap.area}</span>
        ${gap.criticality ? `<span style="font-size:10px;color:#64748b;margin-left:8px">(${gap.criticality})</span>` : ""}
        ${gap.suggested_investigation ? `<p class="event-desc" style="margin-top:4px">${gap.suggested_investigation}</p>` : ""}
      </div>`;
    }
  }

  if (content?.sources_summary) {
    html += `<div class="section-title">Sources</div>`;
    html += `<p class="summary" style="font-size:12px;color:#64748b">Based on ${content.sources_summary.total_signals ?? 0} signals from ${content.sources_summary.total_sources ?? 0} sources</p>`;
  }

  html += `<div class="footer">WHO AFRO Health Diplomacy Intelligence System — Confidential — ${format(new Date(b.generated_at), "yyyy-MM-dd")}</div>`;
  html += `</body></html>`;

  // Open in new window for print-to-PDF
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}
