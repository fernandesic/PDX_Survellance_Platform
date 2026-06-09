/**
 * ChwDeploymentCard — T-095
 *
 * Country-level CHW density at the top, then the affected districts
 * (joined from `outbreak.regions` server-side) with coverage flags.
 * Any district under 20% active CHWs is rendered in red.
 */

import type { OutbreakCapacity } from '../services/outbreakApi';

interface Props {
  capacity?: OutbreakCapacity;
  iso3: string;
}

export default function ChwDeploymentCard({ capacity, iso3 }: Props) {
  const chw = capacity?.chw;

  if (!chw?.data_available) {
    return (
      <div className="ob-card">
        <h3 className="ob-card-title">CHW Deployment — {iso3}</h3>
        <p className="ob-no-data">
          No CHW data on file for {iso3}. Seed the <code>chwfolder</code> tables
          for this country to populate this card.
        </p>
      </div>
    );
  }

  const districts = chw.districts ?? [];
  const overallGap = (chw.active_pct ?? 0) < 20;
  const densityCls = (chw.density ?? 0) >= 5 ? 'ob-good' : (chw.density ?? 0) >= 2 ? 'ob-warn' : 'ob-bad';

  return (
    <div className="ob-card ob-chw-card">
      <div className="ob-chw-header">
        <h3 className="ob-card-title" style={{ border: 'none', padding: 0, margin: 0 }}>
          CHW Deployment — {iso3}
        </h3>
        <div className="ob-chw-summary">
          <div className="ob-chw-stat">
            <span className="ob-chw-stat-label">CHWs / 10k</span>
            <span className={`ob-chw-stat-value ${densityCls}`}>
              {chw.density != null ? chw.density.toFixed(1) : '—'}
            </span>
          </div>
          <div className="ob-chw-stat">
            <span className="ob-chw-stat-label">Active</span>
            <span className={`ob-chw-stat-value ${overallGap ? 'ob-bad' : 'ob-good'}`}>
              {chw.active_pct != null ? `${chw.active_pct.toFixed(0)}%` : '—'}
            </span>
          </div>
          <div className="ob-chw-stat">
            <span className="ob-chw-stat-label">Total CHWs</span>
            <span className="ob-chw-stat-value">
              {chw.total_chws != null ? chw.total_chws.toLocaleString() : '—'}
            </span>
          </div>
          <div className="ob-chw-stat">
            <span className="ob-chw-stat-label">Population</span>
            <span className="ob-chw-stat-value">
              {chw.population != null ? chw.population.toLocaleString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {districts.length === 0 ? (
        <p className="ob-no-data">No matching districts found for the outbreak's affected regions.</p>
      ) : (
        <div className="ob-chw-table-wrap">
          <table className="ob-chw-table">
            <thead>
              <tr>
                <th>District</th>
                <th>Region</th>
                <th>CHWs / 10k</th>
                <th>Active %</th>
                <th>Total</th>
                <th>Population</th>
              </tr>
            </thead>
            <tbody>
              {districts.map((d) => (
                <tr key={`${d.district}-${d.region}`} className={d.gap_flag ? 'ob-chw-row--gap' : ''}>
                  <td>{d.district}</td>
                  <td>{d.region || '—'}</td>
                  <td>{d.chws_per_10k != null ? d.chws_per_10k.toFixed(1) : '—'}</td>
                  <td>{d.active_pct != null ? `${d.active_pct.toFixed(0)}%` : '—'}</td>
                  <td>{d.total_chws?.toLocaleString() ?? '—'}</td>
                  <td>{d.population?.toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ob-chw-legend">
        Districts in red have less than 20% active CHWs — coverage gap.
      </div>
    </div>
  );
}
