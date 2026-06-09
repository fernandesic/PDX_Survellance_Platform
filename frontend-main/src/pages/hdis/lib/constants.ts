// Intelligence taxonomy constants
export const EVENT_TYPES = [
  "funding",
  "mobility_restriction",
  "security_conflict",
  "trade",
  "climate_governance",
  "digital_regulation",
  "outbreak",
  "policy_change",
] as const;

export const TOPICS = [
  "workforce",
  "vaccines",
  "surveillance",
  "supply_chain",
  "RCCE",
  "border_health",
  "diplomatic_relations",
] as const;

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const STANCES = ["supportive", "neutral", "oppositional", "unclear"] as const;
export const SCS_TIERS = [1, 2, 3, 4] as const;

export const WHO_AFRO_COUNTRIES: Record<string, string> = {
  DZA: "Algeria", AGO: "Angola", BEN: "Benin", BWA: "Botswana", BFA: "Burkina Faso",
  BDI: "Burundi", CPV: "Cabo Verde", CMR: "Cameroon", CAF: "Central African Republic",
  TCD: "Chad", COM: "Comoros", COG: "Congo", COD: "DR Congo", CIV: "Côte d'Ivoire",
  GNQ: "Equatorial Guinea", ERI: "Eritrea", SWZ: "Eswatini", ETH: "Ethiopia",
  GAB: "Gabon", GMB: "Gambia", GHA: "Ghana", GIN: "Guinea", GNB: "Guinea-Bissau",
  KEN: "Kenya", LSO: "Lesotho", LBR: "Liberia", MDG: "Madagascar", MWI: "Malawi",
  MLI: "Mali", MRT: "Mauritania", MUS: "Mauritius", MOZ: "Mozambique", NAM: "Namibia",
  NER: "Niger", NGA: "Nigeria", RWA: "Rwanda", STP: "São Tomé and Príncipe",
  SEN: "Senegal", SYC: "Seychelles", SLE: "Sierra Leone", ZAF: "South Africa",
  SSD: "South Sudan", TZA: "Tanzania", TGO: "Togo", UGA: "Uganda", ZMB: "Zambia",
  ZWE: "Zimbabwe",
};

export function computeSignalStrength(tierWeight: number, ageHours: number, sourcesCount: number): number {
  const recencyDecay = Math.max(0, 1 - ageHours / 168); // 7-day decay
  const multiSourceBonus = Math.min(sourcesCount * 0.2, 1);
  const raw = tierWeight * recencyDecay + multiSourceBonus;
  return Math.max(1, Math.min(5, Math.round(raw * 5)));
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  funding: "Funding",
  mobility_restriction: "Mobility Restriction",
  security_conflict: "Security Conflict",
  trade: "Trade",
  climate_governance: "Climate Governance",
  digital_regulation: "Digital Regulation",
  outbreak: "Outbreak",
  policy_change: "Policy Change",
};

export const RISK_COLORS: Record<string, string> = {
  critical: "threat-critical",
  high: "threat-high",
  medium: "threat-medium",
  low: "threat-low",
};
