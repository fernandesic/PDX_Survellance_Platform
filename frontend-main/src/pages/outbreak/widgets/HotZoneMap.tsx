/**
 * HotZoneMap (T-026) — lightweight choropleth-by-count of countries
 * mentioned in the event stream, integrated with an interactive ArcGIS GIS map
 * to plot precise GPS pins where coordinates exist in sentinel signals.
 */

import { useEffect, useRef, useMemo } from 'react';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import esriConfig from '@arcgis/core/config';
import '@arcgis/core/assets/esri/themes/light/main.css';
import type { OutbreakEvent, Outbreak } from '../services/outbreakApi';

interface Props {
  events: OutbreakEvent[];
  outbreak: Outbreak;
  onSelectGeo?: (iso: string) => void;
}

export default function HotZoneMap({ events, outbreak, onSelectGeo }: Props) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);

  // Group countries by mention count
  const counts = useMemo(() => {
    const map: Record<string, { count: number; latest: string }> = {};
    for (const e of events) {
      const iso = ((e.payload_json?.country_iso as string) || '').toUpperCase();
      if (!iso) continue;
      if (!map[iso]) map[iso] = { count: 0, latest: e.ts };
      map[iso].count += 1;
      if (e.ts > map[iso].latest) map[iso].latest = e.ts;
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [events]);

  // Extract geocoded signals
  const geoSignals = useMemo(() => {
    const pins: Array<{
      id: number;
      lat: number;
      lng: number;
      headline: string;
      source: string;
      disease: string;
      tier: number;
      priority: string;
    }> = [];

    for (const e of events) {
      const payload = e.payload_json || {};
      const lat = payload.latitude != null ? Number(payload.latitude) : null;
      const lng = payload.longitude != null ? Number(payload.longitude) : null;

      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        pins.push({
          id: e.id,
          lat,
          lng,
          headline: (payload.headline as string || 'CHW Ground Signal').substring(0, 150),
          source: e.source || 'kobo_chw',
          disease: payload.disease_name as string || '',
          tier: payload.source_tier != null ? Number(payload.source_tier) : 3,
          priority: payload.priority as string || 'P3',
        });
      }
    }
    return pins;
  }, [events]);

  const max = counts.length ? counts[0][1].count : 1;

  // Initialize ArcGIS Map if coordinates exist
  useEffect(() => {
    if (!mapDiv.current || geoSignals.length === 0) return;

    if (import.meta.env.VITE_ARCGIS_API_KEY) {
      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
    }

    const graphicsLayer = new GraphicsLayer({ title: "Geocoded_Signals" });
    graphicsLayerRef.current = graphicsLayer;

    const map = new Map({
      basemap: esriConfig.apiKey ? "arcgis-dark-gray" : "dark-gray-vector",
      layers: [graphicsLayer],
    });

    // Find dynamic center based on signals or default to Africa center
    let centerLat = 2.0;
    let centerLng = 20.0;
    if (geoSignals.length > 0) {
      const sumLat = geoSignals.reduce((acc, p) => acc + p.lat, 0);
      const sumLng = geoSignals.reduce((acc, p) => acc + p.lng, 0);
      centerLat = sumLat / geoSignals.length;
      centerLng = sumLng / geoSignals.length;
    }

    const view = new MapView({
      container: mapDiv.current,
      map,
      center: [centerLng, centerLat],
      zoom: geoSignals.length === 1 ? 6 : 4,
      constraints: {
        minZoom: 2,
        maxZoom: 14,
        rotationEnabled: false,
      },
      ui: { components: ["zoom"] },
    });

    view.ui.move("zoom", "top-right");
    viewRef.current = view;

    // Plot pins once map view is ready
    view.when(() => {
      geoSignals.forEach((p) => {
        const point = new Point({ latitude: p.lat, longitude: p.lng });

        // Tier 0 gets a glowing emerald marker, others get red/orange warning markers
        const isTier0 = p.tier === 0 || p.source === 'kobo_chw';
        const color = isTier0 ? [16, 185, 129, 0.9] : [239, 68, 68, 0.85]; // Emerald vs Red
        const style = isTier0 ? "diamond" : "circle";
        const size = isTier0 ? 14 : 10;

        const symbol = new SimpleMarkerSymbol({
          style,
          color,
          size,
          outline: { color: [255, 255, 255, 0.8], width: 1.5 },
        });

        const graphic = new Graphic({
          geometry: point,
          symbol,
          attributes: p,
          popupTemplate: {
            title: `🏥 ${isTier0 ? 'Field Intelligence' : 'Sentinel Alert'} — Tier ${p.tier}`,
            content: `
              <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; color: #fff;">
                <p><strong>Disease:</strong> ${p.disease}</p>
                <p><strong>Signal:</strong> ${p.headline}</p>
                <p><strong>Priority:</strong> ${p.priority} | <strong>Source:</strong> ${p.source}</p>
                <p style="font-size: 11px; color: #a1a1aa; margin-top: 6px;">ID: evt:${p.id} | Coordinates: ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</p>
              </div>
            `,
          },
        });

        graphicsLayer.add(graphic);
      });
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [geoSignals]);

  if (counts.length === 0) {
    return (
      <div className="ob-card">
        <h3 className="ob-card-title">Hot Zone Map</h3>
        <p className="ob-no-data">
          No geocoded events yet. Once signals carry a country code, this
          map ranks countries by current event volume.
        </p>
      </div>
    );
  }

  return (
    <div className="ob-card ob-hotzone-card">
      <h3 className="ob-card-title">Hot Zone Map</h3>
      <p className="ob-card-desc">
        Visual geographic telemetry and country volume rankings. Emerald diamonds (🏥) plot Tier 0 Ground Truth reports.
      </p>

      {geoSignals.length > 0 && (
        <div 
          className="ob-gis-map-container"
          style={{ 
            height: '350px', 
            borderRadius: '6px', 
            overflow: 'hidden', 
            marginBottom: '16px',
            border: '1px solid var(--ob-border)'
          }}
        >
          <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      <div className="ob-hotzone-rows">
        {counts.slice(0, 12).map(([iso, { count, latest }]) => {
          const pct = (count / max) * 100;
          const isEpicenter = iso === outbreak.iso3.toUpperCase();
          const isNeighbor = outbreak.neighbor_iso3s?.map((s) => s.toUpperCase()).includes(iso);
          const cls = isEpicenter ? 'ob-hotzone-row--epicenter'
            : isNeighbor ? 'ob-hotzone-row--neighbor'
            : 'ob-hotzone-row--other';
          return (
            <button
              key={iso}
              type="button"
              className={`ob-hotzone-row ${cls}`}
              onClick={() => onSelectGeo?.(iso)}
            >
              <span className="ob-hotzone-iso">{iso}</span>
              <span className="ob-hotzone-bar-wrap">
                <span className="ob-hotzone-bar" style={{ width: `${pct}%` }} />
              </span>
              <span className="ob-hotzone-count">{count}</span>
              <span className="ob-hotzone-latest">
                {new Date(latest).toLocaleDateString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
