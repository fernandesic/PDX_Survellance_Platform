/**
 * PIPMap — placeholder stub.
 *
 * The real map component referenced by PIPView was never committed to
 * this branch (presumably still in another author's local). This stub
 * keeps the build green and renders a clean empty state so the page
 * doesn't crash. Replace with the actual map implementation when it
 * lands; the prop shape matches what PIPView already passes.
 */

import type { CountrySummary } from '../utils/api';

interface Props {
  layers: Record<string, boolean>;
  countries: CountrySummary[];
  onCountryHover: (country: CountrySummary | null, x: number, y: number) => void;
  onCountryClick: (country: CountrySummary) => void;
}

export default function PIPMap(_props: Props) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.9rem',
      }}
    >
      PIP map component not yet wired (placeholder).
    </div>
  );
}
