/**
 * CrossBorderSummaryCard — DRC cross-border daily mobility summary.
 *
 * Static reference table compiled by WHO AFRO Health Emergency
 * Preparedness from IOM DTM, UNHCR, WHO, and World Bank sources
 * (May 2026 vintage). Rendered for DRC outbreaks only.
 *
 * This is curated reference data, not a live signal feed — values
 * change at most yearly when AFRO refreshes the consolidated table.
 * Keep the source citation visible; update the const below when
 * a new version of the xlsx lands.
 */

import type { WidgetProps } from './registry';

interface Row {
  country: string;
  daily: string;
  annual: string;
  risk: string;
  crossing: string;
}

const SUMMARY_ROWS: Row[] = [
  { country: 'Uganda',                       daily: '8,000–12,000',  annual: '~2.9M–4.4M',   risk: 'CONFIRMED EVD', crossing: 'Vurra/Goli/Mpondwe/Bunagana' },
  { country: 'Rwanda',                       daily: '30,000–90,000', annual: '~11M–18M',     risk: 'HIGH',          crossing: 'Rubavu–Goma (Petite Barrière)' },
  { country: 'Republic of Congo (Brazzaville)', daily: '3,000–5,000', annual: '~1.1M–1.8M',  risk: 'MEDIUM',        crossing: 'Beach Ngobila–Beach Corniche' },
  { country: 'Burundi',                      daily: '8,000–15,000',  annual: '~2.9M–5.5M',   risk: 'HIGH',          crossing: 'Kavimvira/Gatumba–Uvira' },
  { country: 'Tanzania',                     daily: '2,000–4,000',   annual: '~730K–1.5M',   risk: 'LOW-MEDIUM',    crossing: 'Kigoma Port (Lake Tanganyika)' },
  { country: 'Zambia',                       daily: '4,000–6,000',   annual: '~1.5M–2.2M',   risk: 'LOW',           crossing: 'Kasumbalesa OSBP' },
  { country: 'Angola',                       daily: '3,000–6,000',   annual: '~1.1M–2.2M',   risk: 'LOW',           crossing: 'Luvo / Dilolo' },
  { country: 'South Sudan',                  daily: '1,500–4,000',   annual: '~550K–1.5M',   risk: 'HIGH',          crossing: 'Aba–Yei / Faradje–Juba' },
  { country: 'CAR',                          daily: '500–1,500',     annual: '~180K–550K',   risk: 'MEDIUM',        crossing: 'Bangassou–Ndu' },
];

const CONTEXT_NOTES = [
  'Uganda importation confirmed: 15 May 2026 (Week 6 from 1 April 2026 DRC index case).',
  'PDX 80% importation probability envelope: empirically validated.',
  'Rwanda closed Rubavu–Goma border 17 May 2026 due to BDBV risk.',
  'IHR Article 12 assessment mandatory; South Sudan now second-order risk via Uganda.',
];

const SOURCE = 'IOM DTM, UNHCR, WHO, World Bank · WHO AFRO PDX Team · May 2026';

function riskTone(risk: string): { color: string; bg: string; border: string } {
  const r = risk.toUpperCase();
  if (r.includes('CONFIRMED')) return { color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.14)', border: '#ef4444' };
  if (r === 'HIGH')            return { color: '#fdba74', bg: 'rgba(249, 115, 22, 0.12)', border: '#f97316' };
  if (r.startsWith('MEDIUM'))  return { color: '#fde047', bg: 'rgba(234, 179, 8, 0.10)',  border: '#eab308' };
  if (r.startsWith('LOW-MED')) return { color: '#fde047', bg: 'rgba(234, 179, 8, 0.06)',  border: '#a3a3a3' };
  return { color: '#86efac', bg: 'rgba(34, 197, 94, 0.08)', border: '#22c55e' };
}

export default function CrossBorderSummaryCard({ outbreak }: WidgetProps) {
  // The compiled table is DRC-specific. For any other epicentre the
  // widget renders nothing (registry will simply skip it).
  if ((outbreak.iso3 || '').toUpperCase() !== 'COD') return null;

  return (
    <div className="ob-card" style={{ gridColumn: '1 / -1' }}>
      <h3 className="ob-card-title">DRC cross-border mobility — summary</h3>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            color: 'var(--ob-text, #e2e8f0)',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.25)' }}>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Country</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Daily total</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Annual</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Risk</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Key crossing</th>
            </tr>
          </thead>
          <tbody>
            {SUMMARY_ROWS.map((r) => {
              const tone = riskTone(r.risk);
              return (
                <tr
                  key={r.country}
                  style={{ borderBottom: '1px solid rgba(148,163,184,0.10)' }}
                >
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{r.country}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{r.daily}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--ob-text-muted, #94a3b8)' }}>{r.annual}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: tone.bg,
                        color: tone.color,
                        borderLeft: `2px solid ${tone.border}`,
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.risk}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--ob-text-muted, #94a3b8)' }}>{r.crossing}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: '8px 10px',
          background: 'rgba(148,163,184,0.06)',
          borderLeft: '2px solid rgba(148,163,184,0.4)',
          fontSize: 11,
          color: 'var(--ob-text-muted, #94a3b8)',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--ob-text, #e2e8f0)' }}>Ebola context (May 2026)</strong>
        <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
          {CONTEXT_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: 'var(--ob-text-muted, #94a3b8)',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--ob-text, #e2e8f0)' }}>Sources:</strong>{' '}
        {SOURCE}
      </div>
    </div>
  );
}
