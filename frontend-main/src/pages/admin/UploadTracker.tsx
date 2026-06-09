/**
 * /admin/upload-tracker — superadmin-only file upload for the manual
 * Ebola/DRC tracker workbook. Picks an outbreak, uploads the .xlsx, and
 * shows a small parse summary on success.
 *
 * The uploaded workbook is the source of truth for every case-count tile
 * on the outbreak workspace. No external surveillance feed is consulted.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthProvider';
import {
  fetchOutbreaks,
  uploadTracker,
  type Outbreak,
  type TrackerUploadSummary,
} from '@/pages/outbreak/services/outbreakApi';
import './UploadTracker.css';

export default function UploadTracker() {
  // Auth is owned by ProtectedRoute (route-level). This component only
  // gates *content* by is_super_admin. We never <Navigate /> from here —
  // doing so races with ProtectedRoute and the axios 401 interceptor and
  // turns into a redirect loop / "site jam".
  const { user, isAuthChecking } = useAuth();
  const isSuperAdmin = !!user?.is_super_admin;

  const [outbreaks, setOutbreaks] = useState<Outbreak[]>([]);
  const [outbreakId, setOutbreakId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrackerUploadSummary | null>(null);
  const [lastFilename, setLastFilename] = useState<string>('');

  // Only fetch when we know we're a super admin AND auth has finished
  // verifying. Calling fetchOutbreaks() during the auth-checking window
  // can trip the global 401 interceptor and bounce the whole window to
  // /login on a cookie hiccup.
  useEffect(() => {
    if (isAuthChecking || !isSuperAdmin) return;
    let cancelled = false;
    fetchOutbreaks()
      .then((list) => {
        if (cancelled) return;
        setOutbreaks(list);
        const firstActive = list.find(
          (o) => o.status === 'suspected' || o.status === 'confirmed',
        );
        if (firstActive) setOutbreakId(firstActive.id);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e?.message ?? e));
      });
    return () => { cancelled = true; };
  }, [isAuthChecking, isSuperAdmin]);

  if (isAuthChecking) return <div className="ut-loading">Checking access…</div>;
  if (!isSuperAdmin) {
    return (
      <div className="ut-denied">
        <h1>Restricted</h1>
        <p>This page is for superadmins only.</p>
        <p className="ut-denied-sub">
          You're signed in, but your account doesn't have superadmin
          permissions. Ask the platform admin to grant
          <code> is_super_admin </code> on your user.
        </p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || outbreakId == null) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const res = await uploadTracker(outbreakId, file);
      setSummary(res.summary);
      setLastFilename(res.filename);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || 'upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ut-page">
      <header className="ut-header">
        <h1>Upload outbreak tracker</h1>
        <p className="ut-subtitle">
          Upload the latest sitrep workbook (.xlsx). The workbook overrides
          every case-count tile on the selected outbreak's workspace.
          Re-uploading the same file is safe — duplicates are skipped.
        </p>
      </header>

      <form className="ut-form" onSubmit={onSubmit}>
        <label className="ut-field">
          <span>Outbreak</span>
          <select
            value={outbreakId ?? ''}
            onChange={(e) => setOutbreakId(Number(e.target.value) || null)}
            required
          >
            <option value="" disabled>Select…</option>
            {outbreaks.map((o) => (
              <option key={o.id} value={o.id}>
                #{o.id} — {o.pathogen.name} · {o.iso3} · {o.status}
              </option>
            ))}
          </select>
        </label>

        <label className="ut-field">
          <span>Workbook (.xlsx)</span>
          <input
            type="file"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </label>

        <button type="submit" className="ut-submit" disabled={busy || !file || outbreakId == null}>
          {busy ? 'Uploading…' : 'Upload and ingest'}
        </button>
      </form>

      {error && <div className="ut-error">{error}</div>}

      {summary && (
        <section className="ut-result">
          <h2>Ingested successfully</h2>
          <p className="ut-file">From <code>{lastFilename}</code></p>
          <p className="ut-asof">
            Latest reporting date: <strong>{summary.latest_as_of ?? '—'}</strong>
          </p>
          <table className="ut-summary-table">
            <thead>
              <tr>
                <th>Sheet</th>
                <th className="num">Total rows</th>
                <th className="num">New</th>
                <th className="num">Already had</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Daily cumulatives (headline)</td>
                <td className="num">{summary.daily_total}</td>
                <td className="num">{summary.daily_emitted}</td>
                <td className="num">{summary.daily_skipped}</td>
              </tr>
              <tr>
                <td>Per health zone</td>
                <td className="num">{summary.zone_total}</td>
                <td className="num">{summary.zone_emitted}</td>
                <td className="num">{summary.zone_skipped}</td>
              </tr>
              <tr>
                <td>Lab testing</td>
                <td className="num">{summary.lab_total}</td>
                <td className="num">{summary.lab_emitted}</td>
                <td className="num">{summary.lab_skipped}</td>
              </tr>
            </tbody>
          </table>
          {summary.warnings.length > 0 && (
            <ul className="ut-warnings">
              {summary.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <p className="ut-hint">
            Open the outbreak workspace to see the new numbers.
          </p>
        </section>
      )}
    </div>
  );
}
