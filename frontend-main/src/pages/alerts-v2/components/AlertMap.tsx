import { useEffect, useMemo, useRef } from 'react';
import EsriMap from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import esriConfig from '@arcgis/core/config';
import '@arcgis/core/assets/esri/themes/light/main.css';

import { AFRO_COUNTRIES, PRIORITY_COLORS, PRIORITY_LABELS } from '../constants';
import type { AlertLevel, Signal } from '../types';
import { useOutbreakDetection } from '@/hooks/useOutbreakDetection';
import { adaptSignalsForOutbreakDetection } from './signalAdapter';
import {
  countByIso,
  countPlottable,
  getAlertLevel,
  getSignalCoords,
  heatFillRgba,
  isPulsingPriority,
  markerSizePx,
  priorityRgb,
  shouldPlotSignal,
} from './alertMapUtils';
import {
  CLUSTER_RING_MIN_COUNT,
  clusterCentroid,
  clusterRadiusPx,
  clusterRingColor,
  isRealCountryCluster,
} from './clusterUtils';

// ISO2 → ISO3 lookup built from AFRO_COUNTRIES
const ISO2_TO_ISO3: Record<string, string> = {};
// Build from the canonical AFRO_ISO2_EXPR order (same country order as AFRO_COUNTRIES)
const _AFRO_ISO2 = ['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','SZ','TZ','TG','TN','UG','ZM','ZW'];
const _AFRO_ISO3 = AFRO_COUNTRIES.map(c => c.iso3);
// The ISO2 list above is in the same order as AFRO_COUNTRIES
for (let i = 0; i < _AFRO_ISO2.length && i < _AFRO_ISO3.length; i++) {
  ISO2_TO_ISO3[_AFRO_ISO2[i]] = _AFRO_ISO3[i];
}

// Only the 47 AFRO states — matches v1 and AFRO_COUNTRIES in constants.ts.
const AFRO_ISO2_EXPR =
  "ISO_CC IN ('DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'SZ', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW')";

const SIGNAL_ATTR = 'alertsV2SignalId';
const STYLE_R_ATTR = 'alertsV2StyleR';
const STYLE_G_ATTR = 'alertsV2StyleG';
const STYLE_B_ATTR = 'alertsV2StyleB';
const STYLE_SIZE_ATTR = 'alertsV2StyleSize';

function makeMarkerSymbol(
  r: number,
  g: number,
  b: number,
  sizePx: number,
  selected: boolean,
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

interface AlertMapProps {
  signals: Signal[];
  selectedAlertId: string | null;
  onSelectAlert: (id: string | null) => void;
  onCountryClick?: (iso3: string) => void;
}

export function AlertMap({ signals, selectedAlertId, onSelectAlert, onCountryClick }: AlertMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const markersLayerRef = useRef<GraphicsLayer | null>(null);
  const clustersLayerRef = useRef<GraphicsLayer | null>(null);
  const heatLayerRef = useRef<FeatureLayer | null>(null);
  const selectHandlerRef = useRef<(id: string | null) => void>(onSelectAlert);
  const countryClickRef = useRef<((iso3: string) => void) | undefined>(onCountryClick);
  // Map of signal id → its core marker Graphic, so the selection effect can
  // mutate just two markers (old + new) instead of rebuilding all 200.
  const graphicsByIdRef = useRef<Map<string, Graphic>>(new Map());
  // The id whose symbol currently carries the "selected" outline. Tracked
  // separately from the prop so we don't have to read stale state.
  const lastSelectedRef = useRef<string | null>(null);

  // Same hook SituationReport uses — groups last-7d signals by country+disease
  // into ≥3-signal clusters. The adapter narrows v2 Signals to only the fields
  // the hook reads, so divergence becomes a compile-time error.
  const adaptedSignals = useMemo(() => adaptSignalsForOutbreakDetection(signals), [signals]);
  const rawClusters = useOutbreakDetection(adaptedSignals);

  // Drop placeholder clusters (AFR/"Africa Region", unknown disease) that
  // aren't actionable outbreaks — they clutter the map and the chip.
  const clusters = useMemo(() => rawClusters.filter(isRealCountryCluster), [rawClusters]);

  // Only larger clusters get a ring on the map to keep dense regions readable;
  // the smaller ones still show up in the chip.
  const ringClusters = useMemo(
    () => clusters.filter((c) => c.count >= CLUSTER_RING_MIN_COUNT),
    [clusters],
  );

  // Keep click handler fresh without re-initialising the ArcGIS view.
  useEffect(() => {
    selectHandlerRef.current = onSelectAlert;
  }, [onSelectAlert]);

  useEffect(() => {
    countryClickRef.current = onCountryClick;
  }, [onCountryClick]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (import.meta.env.VITE_ARCGIS_API_KEY) {
      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
    }

    const map = new EsriMap({ basemap: 'streets-relief-vector' });

    const view = new MapView({
      container: containerRef.current,
      map,
      center: [20, 5],
      zoom: 4,
      constraints: { minZoom: 3, maxZoom: 12, snapToZoom: false, rotationEnabled: false },
      ui: { components: [] },
      popup: { autoOpenEnabled: false } as unknown as MapView['popup'],
      highlightOptions: { haloOpacity: 0, fillOpacity: 0 } as unknown as MapView['highlightOptions'],
    } as unknown as __esri.MapViewProperties);

    const heatLayer = new FeatureLayer({
      url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0',
      title: 'AFRO signal intensity',
      opacity: 0.45,
      definitionExpression: AFRO_ISO2_EXPR,
      renderer: {
        type: 'simple',
        symbol: {
          type: 'simple-fill',
          color: [255, 255, 255, 0],
          outline: { color: [200, 200, 200, 0.4], width: 1 },
        },
      } as unknown as FeatureLayer['renderer'],
    });
    map.add(heatLayer);

    // Clusters sit underneath markers so the ring doesn't eat clicks on the
    // individual signal dots inside it.
    const clustersLayer = new GraphicsLayer();
    map.add(clustersLayer);

    const markersLayer = new GraphicsLayer();
    map.add(markersLayer);

    const clickHandle = view.on('click', (event) => {
      view
        .hitTest(event, { include: [markersLayer] })
        .then((result) => {
          const hit = result.results.find((r) => {
            const g = (r as { graphic?: Graphic }).graphic;
            return Boolean(g?.attributes?.[SIGNAL_ATTR]);
          }) as { graphic?: Graphic } | undefined;
          // ArcGIS coerces numeric-looking string attributes ("123") to
          // numbers internally, so accept both string and number here.
          const rawId = hit?.graphic?.attributes?.[SIGNAL_ATTR];
          if (rawId != null) {
            selectHandlerRef.current(String(rawId));
          } else if (countryClickRef.current) {
            // No signal marker hit — check if a country polygon was clicked
            view
              .hitTest(event, { include: [heatLayer] })
              .then((heatResult) => {
                const countryHit = heatResult.results[0] as { graphic?: Graphic } | undefined;
                const iso2 = countryHit?.graphic?.attributes?.['ISO_CC'];
                if (iso2 && typeof iso2 === 'string') {
                  const iso3 = ISO2_TO_ISO3[iso2];
                  if (iso3 && countryClickRef.current) {
                    countryClickRef.current(iso3);
                  }
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          /* view destroyed mid-flight — safe to ignore */
        });
    });

    // Cursor stays as the default. The previous pointer-move + hitTest hover
    // detection ran ~10 hitTests/sec against the markers layer + heat layer,
    // which pegged the GPU at 100% just from mouse motion. Markers are still
    // clearly clickable from the visual cue (colored dots vs. flat basemap).

    viewRef.current = view;
    heatLayerRef.current = heatLayer;
    markersLayerRef.current = markersLayer;
    clustersLayerRef.current = clustersLayer;

    return () => {
      clickHandle.remove();
      view.destroy();
      viewRef.current = null;
      heatLayerRef.current = null;
      markersLayerRef.current = null;
      clustersLayerRef.current = null;
    };
  }, []);

  // ── Rebuild markers + heat colors when the signal DATA changes. ──────────
  // This is the expensive path (removes all graphics, creates new ones).
  // It does NOT depend on `selectedAlertId` — selection highlight is handled
  // by the lightweight effect below.
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const heatLayer = heatLayerRef.current;
    if (!markersLayer) return;

    markersLayer.removeAll();
    const nextGraphics = new Map<string, Graphic>();

    for (const signal of signals) {
      if (!shouldPlotSignal(signal)) continue;
      const coords = getSignalCoords(signal);
      if (!coords) continue;
      const [lng, lat] = coords;

      const level = getAlertLevel(signal);
      const [r, g, b] = priorityRgb(level);
      const size = markerSizePx(level);

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
            // Halo graphic is decorative; no signal attr so clicks fall through to core.
          }),
        );
      }

      // Build the core marker as *unselected*. The selection effect below
      // overlays the selected outline on whichever id is currently active —
      // separating the two means a click costs O(1) symbol swaps rather
      // than O(n) marker rebuilds.
      const marker = new Graphic({
        geometry: new Point({ longitude: lng, latitude: lat }),
        symbol: makeMarkerSymbol(r, g, b, size, false),
        attributes: {
          [SIGNAL_ATTR]: signal.id,
          [STYLE_R_ATTR]: r,
          [STYLE_G_ATTR]: g,
          [STYLE_B_ATTR]: b,
          [STYLE_SIZE_ATTR]: size,
        },
      });
      markersLayer.add(marker);
      nextGraphics.set(signal.id, marker);
    }

    graphicsByIdRef.current = nextGraphics;

    // Re-apply the current selection — the rebuild dropped it. We don't
    // depend on `selectedAlertId` here (that would defeat the purpose);
    // the next effect handles prop-driven selection changes.
    const sel = lastSelectedRef.current;
    if (sel) {
      const g = nextGraphics.get(sel);
      if (g) {
        const r = g.attributes[STYLE_R_ATTR] as number;
        const gg = g.attributes[STYLE_G_ATTR] as number;
        const b = g.attributes[STYLE_B_ATTR] as number;
        const size = g.attributes[STYLE_SIZE_ATTR] as number;
        g.symbol = makeMarkerSymbol(r, gg, b, size, true);
      } else {
        // Selected signal is no longer in the dataset.
        lastSelectedRef.current = null;
      }
    }

    if (heatLayer) {
      const counts = countByIso(signals);
      const entries = Object.entries(counts);
      const uniqueValueInfos = entries.map(([iso2, count]) => ({
        value: iso2,
        symbol: new SimpleFillSymbol({
          color: heatFillRgba(count),
          outline: { color: [255, 255, 255, 0.5], width: 1 },
        }) as unknown as SimpleFillSymbol,
      }));

      heatLayer.renderer = new UniqueValueRenderer({
        field: 'ISO_CC',
        defaultSymbol: new SimpleFillSymbol({
          color: [255, 255, 255, 0],
          outline: { color: [226, 232, 240, 0.4], width: 1 },
        }) as unknown as SimpleFillSymbol,
        uniqueValueInfos,
      }) as unknown as FeatureLayer['renderer'];
    }
  }, [signals]);

  // Selection-only updates: swap symbols on at most two graphics (the old
  // selection and the new one) instead of rebuilding the whole marker layer.
  // (Lookup is by Map.get(signal.id), so no ArcGIS string/number coercion
  // gotcha applies here — IDs round-trip as the original strings.)
  useEffect(() => {
    const map = graphicsByIdRef.current;
    const prev = lastSelectedRef.current;
    if (prev === selectedAlertId) return;

    if (prev) {
      const g = map.get(prev);
      if (g) {
        const r = g.attributes[STYLE_R_ATTR] as number;
        const gg = g.attributes[STYLE_G_ATTR] as number;
        const b = g.attributes[STYLE_B_ATTR] as number;
        const size = g.attributes[STYLE_SIZE_ATTR] as number;
        g.symbol = makeMarkerSymbol(r, gg, b, size, false);
      }
    }
    if (selectedAlertId) {
      const g = map.get(selectedAlertId);
      if (g) {
        const r = g.attributes[STYLE_R_ATTR] as number;
        const gg = g.attributes[STYLE_G_ATTR] as number;
        const b = g.attributes[STYLE_B_ATTR] as number;
        const size = g.attributes[STYLE_SIZE_ATTR] as number;
        g.symbol = makeMarkerSymbol(r, gg, b, size, true);
      }
    }
    lastSelectedRef.current = selectedAlertId;
  }, [selectedAlertId]);

  // Draw cluster rings + count labels on their own layer whenever the
  // cluster set changes.
  useEffect(() => {
    const clustersLayer = clustersLayerRef.current;
    if (!clustersLayer) return;

    clustersLayer.removeAll();

    for (const cluster of ringClusters) {
      const centroid = clusterCentroid(cluster);
      if (!centroid) continue;
      const [lng, lat] = centroid;
      const [r, g, b] = clusterRingColor(cluster.urgency);
      const radius = clusterRadiusPx(cluster.count);

      clustersLayer.add(
        new Graphic({
          geometry: new Point({ longitude: lng, latitude: lat }),
          symbol: new SimpleMarkerSymbol({
            color: [r, g, b, 0.12],
            outline: { color: [r, g, b, 0.7], width: 2 },
            size: `${radius * 2}px`,
            style: 'circle',
          }) as unknown as SimpleMarkerSymbol,
        }),
      );

      clustersLayer.add(
        new Graphic({
          geometry: new Point({ longitude: lng, latitude: lat }),
          symbol: new TextSymbol({
            text: `${cluster.count}`,
            color: [255, 255, 255, 1],
            haloColor: [r, g, b, 0.9],
            haloSize: 2,
            font: { size: 11, weight: 'bold', family: 'sans-serif' },
            yoffset: radius - 6,
          }) as unknown as TextSymbol,
        }),
      );
    }
  }, [ringClusters]);

  const totalActive = useMemo(() => countPlottable(signals), [signals]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-slate-900">
      <div
        ref={containerRef}
        data-testid="alert-map-canvas"
        className="absolute inset-0"
        tabIndex={-1}
        style={{ outline: 'none' }}
      />

      <div
        data-testid="alert-map-total"
        className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur"
      >
        {totalActive} active {totalActive === 1 ? 'signal' : 'signals'}
      </div>

      {clusters.length > 0 ? (
        <div
          data-testid="alert-map-clusters"
          className="pointer-events-none absolute right-3 top-3 max-w-[260px] rounded-lg border border-amber-400/40 bg-slate-950/95 px-3 py-2 text-[11px] text-white shadow-xl ring-1 ring-black/20"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            {clusters.length} outbreak {clusters.length === 1 ? 'cluster' : 'clusters'}
          </div>
          <ul className="space-y-1">
            {clusters.slice(0, 4).map((c) => (
              <li
                key={`${c.iso3}|${c.disease}`}
                data-testid="alert-map-cluster-row"
                className="flex items-center justify-between gap-2 text-white"
              >
                <span className="truncate font-medium">
                  {c.disease.toLowerCase()} · {c.country}
                </span>
                <span className="shrink-0 rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">
                  {c.count}
                </span>
              </li>
            ))}
            {clusters.length > 4 ? (
              <li className="pt-0.5 text-[10px] text-slate-300">
                +{clusters.length - 4} more
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <ul
        data-testid="alert-map-legend"
        className="pointer-events-none absolute bottom-3 left-3 space-y-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-[11px] text-white shadow-lg backdrop-blur"
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
            <span className="text-slate-200">{PRIORITY_LABELS[p]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
