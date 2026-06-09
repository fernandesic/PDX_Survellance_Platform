// @ts-nocheck
import type { BackendSignal, AutoDetection } from '../types';
import { fetchLiveSignals } from './azureService';
import { logger } from "@/utils/logger";

export const fetchBackendSignals = async (count: number = 5): Promise<BackendSignal[]> => {
  await new Promise(r => setTimeout(r, 300));

  return Array.from({ length: count }).map((_, i) => ({
    id: `NET-${Date.now()}-${i}`,
    timestamp: new Date().toISOString(),
    type: Math.random() > 0.8 ? 'data_packet' : 'heartbeat',
    status: 'ok'
  }));
};

export const fetchAutoDetections = async (): Promise<AutoDetection[]> => {
  try {
    const signals = await fetchLiveSignals("Global");

    // Handle both old format (level/hazard) and new format (priority/signal_type)
    const criticalSignals = signals.filter(s => {
      // New sentinel API format
      if (s.priority) {
        return s.priority === 'P1' || s.priority === 'P2';
      }
      // Old format fallback
      if (s.level) {
        return s.level === 'P1' || (s.hazard?.type === 'natural_disaster');
      }
      return false;
    })
      .sort((a, b) => {
        const getTs = (s: any) => new Date(s.source_timestamp || s.publishedAt || s.created_at || 0).getTime();
        return getTs(b) - getTs(a);
      })
      // Only show alerts from the last 7 days — no stale popups
      .filter(s => {
        const ts = new Date(s.source_timestamp || s.publishedAt || s.created_at || 0).getTime();
        return (Date.now() - ts) < 7 * 24 * 60 * 60 * 1000;
      });

    if (criticalSignals.length > 0) {
      const topSignal = criticalSignals[0];

      // Get values with fallbacks for both formats
      const signalType = topSignal.signal_type || topSignal.hazard?.type || 'disease';
      const headline = topSignal.disease_name || topSignal.headline || 'Unknown Event';
      const summary = topSignal.lingua_data?.original_text || topSignal.summary || '';
      const country = topSignal.location?.country || topSignal.location_country || 'Unknown';

      return [{
        id: `DET-${topSignal.id}`,
        type: signalType === 'hazard' ? 'ANOMALY_DETECTED' : 'VIRAL_SURGE',
        severity: 'CRITICAL',
        title: headline,
        description: (summary === headline) ? "" : summary.substring(0, 200),
        location: country,
        metric: 'Verified Live Event'
      }];
    }
  } catch (e) {
    logger.error("Anomaly Detection Error:", e);
  }
  return [];
};
