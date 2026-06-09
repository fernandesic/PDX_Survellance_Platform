/**
 * GhanaMap — ArcGIS map focused exclusively on Ghana.
 *
 * Shows Ghana country boundary highlighted, with alert signal markers
 * plotted on top.  Follows the same ArcGIS pattern used in AlertMap (alerts-v2).
 *
 * Features:
 * - Ghana boundary highlight via FeatureLayer + definitionExpression
 * - Signal markers coloured by priority (P1–P4)
 * - Pulsing halo on P1/P2 markers
 * - Click-to-select signal
 * - Priority legend overlay
 * - Active signal count badge
 * - Theme-aware (dark/light)
 */

import { useEffect, useMemo, useRef } from 'react';
import EsriMap from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Extent from '@arcgis/core/geometry/Extent';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import esriConfig from '@arcgis/core/config';
import '@arcgis/core/assets/esri/themes/light/main.css';

import { GHANA_BOUNDS } from '../constants';

/* ── Priority config ── */

type AlertLevel = 'P1' | 'P2' | 'P3' | 'P4';

const PRIORITY_RGB: Record<AlertLevel, [number, number, number]> = {
  P1: [239, 68, 68],
  P2: [251, 146, 60],
  P3: [245, 158, 11],
  P4: [148, 163, 184],
};

const PRIORITY_COLORS: Record<AlertLevel, string> = {
  P1: '#ef4444',
  P2: '#fb923c',
  P3: '#f59e0b',
  P4: '#94a3b8',
};

const PRIORITY_LABELS: Record<AlertLevel, string> = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
};

const SIGNAL_ATTR = 'ghanaMapSignalId';

function getAlertLevel(signal: any): AlertLevel {
  const raw = signal.priority ?? signal.level;
  if (raw === 'P1' || raw === 'P2' || raw === 'P3' || raw === 'P4') return raw;
  return 'P4';
}

function priorityRgb(priority: AlertLevel): [number, number, number] {
  return PRIORITY_RGB[priority] ?? PRIORITY_RGB.P4;
}

function isPulsingPriority(priority: AlertLevel): boolean {
  return priority === 'P1' || priority === 'P2';
}

function markerSizePx(priority: AlertLevel): number {
  if (priority === 'P1') return 18;
  if (priority === 'P2') return 14;
  if (priority === 'P3') return 11;
  return 9;
}

function getSignalCoords(signal: any): [number, number] | null {
  // Ghana centroid fallback
  const GHANA_CENTROID = { lat: GHANA_BOUNDS.center.lat, lng: GHANA_BOUNDS.center.lng };

  const coords = signal.location?.coordinates;

  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    if (typeof lng === 'number' && typeof lat === 'number' && !(lng === 0 && lat === 0)) {
      return [lng, lat];
    }
  }

  if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
    const { lat, lng } = coords as { lat: number; lng: number };
    if (typeof lng === 'number' && typeof lat === 'number' && !(lng === 0 && lat === 0)) {
      return [lng, lat];
    }
  }

  // Fallback to Ghana centroid with jitter so markers don't stack
  const jitter = () => (Math.random() - 0.5) * 1.5;
  return [GHANA_CENTROID.lng + jitter(), GHANA_CENTROID.lat + jitter()];
}

function makeMarkerSymbol(
  r: number, g: number, b: number,
  sizePx: number, selected: boolean,
): SimpleMarkerSymbol {
  return new SimpleMarkerSymbol({
    color: [r, g, b, 0.95],
    outline: {
      color: selected ? [255, 255, 255, 1] : [255, 255, 255, 0.9],
      width: selected ? 3 : 1.5,
    },
    size: `${sizePx}px`,
    style: 'circle',
  }) as unknown as SimpleMarkerSymbol;
}

/* ── Component ── */

interface GhanaMapProps {
  /** Alert signals — already filtered for Ghana by the hook */
  signals: any[];
  /** Currently selected alert id */
  selectedAlertId?: string | null;
  /** Callback when an alert marker is clicked */
  onSelectAlert?: (id: string | null) => void;
  /** Light/dark theme */
  isLight?: boolean;
}

export default function GhanaMap({
  signals,
  selectedAlertId = null,
  onSelectAlert,
  isLight = false,
}: GhanaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const markersLayerRef = useRef<GraphicsLayer | null>(null);
  const selectHandlerRef = useRef<((id: string | null) => void) | undefined>(onSelectAlert);
  const graphicsByIdRef = useRef<Map<string, Graphic>>(new Map());
  const lastSelectedRef = useRef<string | null>(null);

  // Keep handler ref fresh
  useEffect(() => {
    selectHandlerRef.current = onSelectAlert;
  }, [onSelectAlert]);

  // ── Initialize map — only on mount or theme change ──
  useEffect(() => {
    if (!containerRef.current) return;

    if (import.meta.env.VITE_ARCGIS_API_KEY) {
      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
    }
    esriConfig.portalUrl = 'https://www.arcgis.com';

    // Using 'streets-relief-vector' to match the AlertMap light theme.
    const basemapId = 'streets-relief-vector';

    const map = new EsriMap({ basemap: basemapId });

    // Ghana bounding box
    const ghanaExtent = new Extent({
      xmin: GHANA_BOUNDS.west,
      ymin: GHANA_BOUNDS.south,
      xmax: GHANA_BOUNDS.east,
      ymax: GHANA_BOUNDS.north,
      spatialReference: { wkid: 4326 },
    });

    const view = new MapView({
      container: containerRef.current,
      map,
      extent: ghanaExtent,
      constraints: {
        minZoom: 5,
        maxZoom: 12,
        rotationEnabled: false,
        geometry: ghanaExtent,
      },
      ui: { components: ['zoom'] },
      popup: { autoOpenEnabled: false } as unknown as MapView['popup'],
      highlightOptions: { haloOpacity: 0, fillOpacity: 0 } as unknown as MapView['highlightOptions'],
    } as unknown as __esri.MapViewProperties);

    view.ui.move('zoom', 'top-right');

    // Ghana country boundary highlight
    const ghanaLayer = new FeatureLayer({
      url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0',
      title: 'Ghana boundary',
      opacity: 0.6,
      definitionExpression: "ISO_CC = 'GH'",
      renderer: {
        type: 'simple',
        symbol: new SimpleFillSymbol({
          color: isLight ? [0, 107, 63, 0.12] : [0, 107, 63, 0.25],
          outline: {
            color: isLight ? [0, 107, 63, 0.8] : [255, 215, 0, 0.7],
            width: 2,
          },
        }),
      } as unknown as FeatureLayer['renderer'],
    });
    map.add(ghanaLayer);

    // Markers layer on top
    const markersLayer = new GraphicsLayer();
    map.add(markersLayer);

    // Click handler
    const clickHandle = view.on('click', (event) => {
      view
        .hitTest(event, { include: [markersLayer] })
        .then((result) => {
          const hit = result.results.find((r) => {
            const g = (r as { graphic?: Graphic }).graphic;
            return Boolean(g?.attributes?.[SIGNAL_ATTR]);
          }) as { graphic?: Graphic } | undefined;
          const rawId = hit?.graphic?.attributes?.[SIGNAL_ATTR];
          if (rawId != null && selectHandlerRef.current) {
            selectHandlerRef.current(String(rawId));
          }
        })
        .catch(() => {});
    });

    viewRef.current = view;
    markersLayerRef.current = markersLayer;

    return () => {
      clickHandle.remove();
      view.destroy();
      viewRef.current = null;
      markersLayerRef.current = null;
    };
  }, [isLight]);

  // ── Rebuild markers when signal data changes ──
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;

    markersLayer.removeAll();
    const nextGraphics = new Map<string, Graphic>();

    for (const signal of signals) {
      const coords = getSignalCoords(signal);
      if (!coords) continue;
      const [lng, lat] = coords;

      const level = getAlertLevel(signal);
      const [r, g, b] = priorityRgb(level);
      const size = markerSizePx(level);

      // Pulsing halo for P1/P2
      if (isPulsingPriority(level)) {
        markersLayer.add(
          new Graphic({
            geometry: new Point({ longitude: lng, latitude: lat }),
            symbol: new SimpleMarkerSymbol({
              color: [r, g, b, 0.25],
              outline: { color: [r, g, b, 0.55], width: 1 },
              size: `${size * 2}px`,
              style: 'circle',
            }) as unknown as SimpleMarkerSymbol,
          }),
        );
      }

      // Core marker
      const isSelected = signal.id === selectedAlertId;
      const marker = new Graphic({
        geometry: new Point({ longitude: lng, latitude: lat }),
        symbol: makeMarkerSymbol(r, g, b, size, isSelected),
        attributes: {
          [SIGNAL_ATTR]: signal.id,
          _r: r, _g: g, _b: b, _size: size,
        },
      });
      markersLayer.add(marker);
      nextGraphics.set(String(signal.id), marker);
    }

    graphicsByIdRef.current = nextGraphics;
    lastSelectedRef.current = selectedAlertId ?? null;
  }, [signals]);

  // ── Lightweight selection highlight ──
  useEffect(() => {
    const map = graphicsByIdRef.current;
    const prev = lastSelectedRef.current;
    if (prev === selectedAlertId) return;

    if (prev) {
      const g = map.get(prev);
      if (g) {
        g.symbol = makeMarkerSymbol(
          g.attributes._r, g.attributes._g, g.attributes._b,
          g.attributes._size, false,
        );
      }
    }
    if (selectedAlertId) {
      const g = map.get(selectedAlertId);
      if (g) {
        g.symbol = makeMarkerSymbol(
          g.attributes._r, g.attributes._g, g.attributes._b,
          g.attributes._size, true,
        );
      }
    }
    lastSelectedRef.current = selectedAlertId ?? null;
  }, [selectedAlertId]);

  // Count plottable
  const totalActive = useMemo(() => signals.filter((s) => getSignalCoords(s) !== null).length, [signals]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border"
      style={{
        borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)',
        background: isLight ? '#f8fafc' : 'rgb(15 23 42)',
      }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        tabIndex={-1}
        style={{ outline: 'none' }}
      />

      {/* Signal count badge */}
      <div
        className="pointer-events-none absolute left-3 top-3 rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur"
        style={{
          background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.85)',
          color: isLight ? '#1e293b' : '#fff',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`,
        }}
      >
        🇬🇭 {totalActive} active {totalActive === 1 ? 'signal' : 'signals'}
      </div>

      {/* Priority legend */}
      <ul
        className="pointer-events-none absolute bottom-3 left-3 space-y-1 rounded-lg px-3 py-2 text-[11px] shadow-lg backdrop-blur"
        style={{
          background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.85)',
          color: isLight ? '#374151' : '#fff',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`,
        }}
      >
        {(['P1', 'P2', 'P3', 'P4'] as AlertLevel[]).map((p) => (
          <li key={p} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isPulsingPriority(p) ? 'ring-2 ring-white/20' : ''
              }`}
              style={{ backgroundColor: PRIORITY_COLORS[p] }}
            />
            <span>{PRIORITY_LABELS[p]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
