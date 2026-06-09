import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, TrendingUp, X, Pause, Play } from 'lucide-react';
import type { AutoDetection } from '../types';

export interface AutoDetectionPopupProps {
  detections: AutoDetection[];
  onClose?: (id: string) => void;
  hidden?: boolean;
}

const AUTO_DISMISS_MS = 5000;

const TYPE_CONFIG = {
  ANOMALY_DETECTED: { label: 'AI Anomaly', Icon: Zap,        color: '#f59e0b' },
  VIRAL_SURGE:      { label: 'Viral Surge', Icon: TrendingUp, color: '#f87171' },
} as const;

// ─── Icon button ──────────────────────────────────────────────────────────────

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button" onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 5, border: 'none', padding: 0,
        background: h ? 'rgba(255,255,255,0.07)' : 'transparent',
        color: h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
        cursor: 'pointer', transition: 'all 150ms',
      }}
    >{children}</button>
  );
}

// ─── Toast card ───────────────────────────────────────────────────────────────

function ToastCard({ detection, onDismiss }: { detection: AutoDetection; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const elapsed = useRef(0);
  const lastTick = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const cfg = TYPE_CONFIG[detection.type];
  const { Icon } = cfg;

  const dismiss = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (paused || hovering) { lastTick.current = null; return; }
    function tick(now: number) {
      if (lastTick.current !== null) elapsed.current += now - lastTick.current;
      lastTick.current = now;
      const pct = Math.max(0, 100 - (elapsed.current / AUTO_DISMISS_MS) * 100);
      setProgress(pct);
      if (pct <= 0) { dismiss(); return; }
      rafId.current = requestAnimationFrame(tick);
    }
    rafId.current = requestAnimationFrame(tick);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); lastTick.current = null; };
  }, [paused, hovering, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.6 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      data-testid="auto-detection-card"
      data-detection-id={detection.id}
      style={{
        width: 340, background: '#0c0d10',
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: `2.5px solid ${cfg.color}`,
        borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div style={{ padding: '11px 12px 10px 14px' }}>
        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon style={{ width: 11, height: 11, color: cfg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: cfg.color }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              · {detection.severity}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <IconBtn onClick={() => setPaused(p => !p)} title={paused ? 'Resume' : 'Pause'}>
              {paused ? <Play style={{ width: 10, height: 10 }} /> : <Pause style={{ width: 10, height: 10 }} />}
            </IconBtn>
            <IconBtn onClick={onDismiss} title="Dismiss">
              <X style={{ width: 10, height: 10 }} />
            </IconBtn>
          </div>
        </div>

        {/* Title */}
        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.88)', lineHeight: 1.45, margin: '0 0 5px 0', letterSpacing: '-0.01em' }}>
          {detection.title}
        </p>

        {/* Description */}
        {detection.description && (
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.55, margin: '0 0 8px 0' }}>
            {detection.description}
          </p>
        )}

        {/* Location · metric */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
            {detection.location}
          </span>
          {detection.metric && (
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', borderRadius: 20, padding: '2px 8px' }}>
              {detection.metric}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: cfg.color, opacity: paused || hovering ? 0.4 : 0.75, transition: 'opacity 200ms' }} />
      </div>
    </motion.div>
  );
}

export function AutoDetectionPopup({
  detections,
  onClose,
  hidden = false,
}: AutoDetectionPopupProps) {
  return (
    <div
      data-testid="auto-detection-popup"
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
        pointerEvents: 'none',
      }}
    >
      {/* Cards */}
      <AnimatePresence mode="popLayout">
        {!hidden && detections.map((det) => (
          <div key={det.id} style={{ pointerEvents: 'auto' }}>
            <ToastCard detection={det} onDismiss={() => onClose?.(det.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
