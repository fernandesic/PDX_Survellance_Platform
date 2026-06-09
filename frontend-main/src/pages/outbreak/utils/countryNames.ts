/**
 * Shared ISO3 → country-name lookup for the outbreak workspace.
 *
 * Centralised so every geo-bearing component (banner, country grid,
 * signal cards, transmission-driver widgets) renders human-readable
 * names while keeping the iso code accessible as a tooltip / a11y label.
 *
 * Scope: AFRO + a couple of frequently-cited non-AFRO countries that
 * appear in signal payloads (kept short on purpose — extend when a
 * new country shows up).
 */

const ISO3_NAMES: Record<string, string> = {
  AGO: 'Angola', BEN: 'Benin', BWA: 'Botswana', BFA: 'Burkina Faso',
  BDI: 'Burundi', CPV: 'Cabo Verde', CMR: 'Cameroon',
  CAF: 'Central African Republic', TCD: 'Chad', COM: 'Comoros',
  COG: 'Congo', CIV: "Côte d'Ivoire", COD: 'DR Congo',
  GNQ: 'Equatorial Guinea', ERI: 'Eritrea', SWZ: 'Eswatini',
  ETH: 'Ethiopia', GAB: 'Gabon', GMB: 'Gambia', GHA: 'Ghana',
  GIN: 'Guinea', GNB: 'Guinea-Bissau', KEN: 'Kenya', LSO: 'Lesotho',
  LBR: 'Liberia', MDG: 'Madagascar', MWI: 'Malawi', MLI: 'Mali',
  MRT: 'Mauritania', MUS: 'Mauritius', MOZ: 'Mozambique', NAM: 'Namibia',
  NER: 'Niger', NGA: 'Nigeria', RWA: 'Rwanda', SEN: 'Senegal',
  SYC: 'Seychelles', SLE: 'Sierra Leone', ZAF: 'South Africa',
  SSD: 'South Sudan', TZA: 'Tanzania', TGO: 'Togo', UGA: 'Uganda',
  ZMB: 'Zambia', ZWE: 'Zimbabwe', DZA: 'Algeria',
  // Common non-AFRO mentions in disease signals (Marburg, Mpox spillovers).
  AFR: 'Africa Region',
  USA: 'United States', GBR: 'United Kingdom', FRA: 'France',
  CHN: 'China', IND: 'India', BRA: 'Brazil',
};

/**
 * Return the full country name for an ISO3 code, falling back to the
 * code itself when unknown so we never render blank space.
 */
export function countryName(iso?: string | null): string {
  if (!iso) return '—';
  const key = iso.toUpperCase();
  return ISO3_NAMES[key] ?? key;
}

/**
 * Format `iso3 — Country Name` for places that benefit from showing
 * both (e.g. tooltips on bare-iso displays).
 */
export function isoWithName(iso?: string | null): string {
  if (!iso) return '—';
  const key = iso.toUpperCase();
  const name = ISO3_NAMES[key];
  return name ? `${key} — ${name}` : key;
}

export { ISO3_NAMES };
