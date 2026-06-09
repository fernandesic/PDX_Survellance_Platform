/**
 * NotificationConsole (T-043 / T-044).
 *
 * Lists pending / pending_confirm / sent / dismissed / failed
 * notifications. High-severity rows have a 60s hold window with
 * Send / Cancel buttons that drive the backend rule engine.
 *
 * Telegram dispatch (T-042) is not wired yet — channels other than
 * `email` simply log on the backend until a real handler is added.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmNotification, fetchNotifications, type OutbreakNotification,
} from '../services/outbreakApi';

interface Props {
  outbreakId: number;
}

const STATES = ['pending_confirm', 'pending', 'sent', 'failed', 'dismissed'] as const;

export default function NotificationConsole({ outbreakId }: Props) {
  const qc = useQueryClient();
  const [stateFilter, setStateFilter] = useState<string>('');

  const { data: items = [], isLoading } = useQuery<OutbreakNotification[]>({
    queryKey: ['outbreak-notifications', outbreakId, stateFilter],
    queryFn: () => fetchNotifications(outbreakId, stateFilter || undefined),
    refetchInterval: 10_000,
  });

  const confirm = useMutation({
    mutationFn: (vars: { id: number; send: boolean }) =>
      confirmNotification(outbreakId, vars.id, vars.send),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outbreak-notifications', outbreakId] }),
  });

  const grouped = useMemo(() => {
    const out: Record<string, OutbreakNotification[]> = {};
    for (const s of STATES) out[s] = [];
    for (const n of items) {
      if (!out[n.state]) out[n.state] = [];
      out[n.state].push(n);
    }
    return out;
  }, [items]);

  return (
    <div className="ob-card ob-notif-card">
      <div className="ob-notif-header">
        <h3 className="ob-card-title" style={{ border: 'none', padding: 0, margin: 0 }}>
          Notification Console
        </h3>
        <select
          className="ob-feed-filter"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="">All states</option>
          {STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="ob-no-data">loading...</div>}
      {!isLoading && items.length === 0 && (
        <p className="ob-no-data">
          No notifications queued. Once a NotificationRule matches an event,
          notifications show up here in the right state.
        </p>
      )}

      {STATES.map((state) => {
        const rows = grouped[state] || [];
        if (rows.length === 0) return null;
        return (
          <div key={state} className={`ob-notif-group ob-notif-group--${state}`}>
            <div className="ob-notif-group-title">{state} ({rows.length})</div>
            <ul className="ob-notif-list">
              {rows.map((n) => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  busy={confirm.isPending}
                  onConfirm={(send) => confirm.mutate({ id: n.id, send })}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function NotifRow({
  notif, onConfirm, busy,
}: {
  notif: OutbreakNotification;
  onConfirm: (send: boolean) => void;
  busy: boolean;
}) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!notif.hold_until || notif.state !== 'pending_confirm') {
      setSecsLeft(null);
      return;
    }
    const update = () => {
      const left = Math.max(0, Math.floor(
        (new Date(notif.hold_until as string).getTime() - Date.now()) / 1000
      ));
      setSecsLeft(left);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [notif.hold_until, notif.state]);

  const canConfirm = notif.state === 'pending_confirm';
  return (
    <li className={`ob-notif-row ob-notif-row--${notif.state}`}>
      <div className="ob-notif-meta">
        <span className="ob-notif-channel">{notif.channel}</span>
        <span className="ob-notif-rule">{notif.rule_name}</span>
        <span className="ob-notif-time">
          {new Date(notif.created_at).toLocaleString()}
        </span>
      </div>
      <div className="ob-notif-msg">{notif.rendered_message}</div>
      {notif.error && <div className="ob-notif-error">err: {notif.error}</div>}
      {canConfirm && (
        <div className="ob-notif-actions">
          {secsLeft !== null && (
            <span className="ob-notif-countdown">{secsLeft}s remaining</span>
          )}
          <button
            type="button"
            className="ob-ingest-btn"
            disabled={busy}
            onClick={() => onConfirm(true)}
          >
            Send
          </button>
          <button
            type="button"
            className="ob-readiness-toggle"
            disabled={busy}
            onClick={() => onConfirm(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}
