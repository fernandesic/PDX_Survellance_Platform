// @ts-nocheck

import React, { useEffect, useRef } from 'react';
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import esriConfig from "@arcgis/core/config";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import { type Signal, AlertLevel } from '../types';
import "@arcgis/core/assets/esri/themes/light/main.css";

interface ArcGISMapProps {
    signals: Signal[];
    onSignalClick: (signal: Signal) => void;
    selectedCountry: string;
}

// Disease color mapping helper
const getDiseaseColor = (hazardName: string) => {
    const name = (hazardName || '').toLowerCase();
    if (name.includes('ebola')) return [239, 68, 68];       // Red-500
    if (name.includes('cholera')) return [37, 99, 235];    // Blue-600
    if (name.includes('measles')) return [249, 115, 22];   // Orange-500
    if (name.includes('yellow fever')) return [234, 179, 8]; // Yellow-500
    if (name.includes('mpox')) return [139, 92, 246];      // Purple-500
    return null;
};

// Helper function to get coordinates from signal (handles both old and new format)
function getSignalCoordinates(signal: Signal): [number, number] | null {
    const coords = signal.location?.coordinates;
    if (!coords) return null;

    // Check if it's an object format {lat, lng}
    if (typeof coords === 'object' && !Array.isArray(coords) && 'lat' in coords && 'lng' in coords) {
        return [coords.lng, coords.lat];
    }
    // Check if it's array format [lon, lat]
    if (Array.isArray(coords) && coords.length >= 2) {
        return [coords[0], coords[1]];
    }
    return null;
}

// Helper function to get alert level (handles priority string or AlertLevel enum)
function getAlertLevel(signal: Signal): string {
    // New format uses priority string (P1, P2, P3, P4)
    if (signal.priority) {
        return signal.priority;
    }
    // Old format uses level property
    if (signal.level) {
        return signal.level;
    }
    return 'P4';
}

export const ArcGISMap: React.FC<ArcGISMapProps> = ({ signals, onSignalClick, selectedCountry }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const graphicsLayerRef = useRef<GraphicsLayer | null>(null);
    const heatmapLayerRef = useRef<FeatureLayer | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;
        if (import.meta.env.VITE_ARCGIS_API_KEY) {
            esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
        }

        const map = new Map({
            basemap: "streets-relief-vector"
        });

        const view = new MapView({
            container: mapRef.current,
            map: map,
            center: [20, 5],
            zoom: 4,
            constraints: {
                minZoom: 3,
                maxZoom: 12,
                snapToZoom: false,
                rotationEnabled: false
            },
            ui: {
                components: []
            },
            highlightOptions: {
                haloOpacity: 0,
                fillOpacity: 0
            }
        });

        // Add Heatmap Feature Layer (World Countries)
        const heatmapLayer = new FeatureLayer({
            url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0",
            title: "Country Intensity",
            opacity: 0.4,
            effect: "drop-shadow(2px, 2px, 3px)",
            definitionExpression: "ISO_CC IN ('DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'SZ', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW')",
            renderer: {
                type: "simple",
                symbol: {
                    type: "simple-fill",
                    color: [255, 255, 255, 0],
                    outline: { color: [200, 200, 200, 0.4], width: 1 }
                }
            } as any
        });
        map.add(heatmapLayer);
        heatmapLayerRef.current = heatmapLayer;

        const graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);

        viewRef.current = view;
        graphicsLayerRef.current = graphicsLayer;

        // Ensure map layout is correct after containers are rendered
        view.when(() => {
            // view.resize() is not a function in @arcgis/core
            // MapView automatically resizes to its container
        });

        // Removed custom click hitTest to prevent auto-scrolling to SignalDetailPanel
        // The popup automatically handles clicks now via popupTemplate

        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
            }
        };
    }, []);

    useEffect(() => {
        if (!graphicsLayerRef.current || !signals) return;

        graphicsLayerRef.current.removeAll();

        // Calculate counts per country for heatmap
        const countryCounts: Record<string, number> = {};
        signals.forEach(s => {
            const iso = (s.location?.country_iso || s.location?.iso3 || '').slice(0, 2).toUpperCase();
            if (iso) countryCounts[iso] = (countryCounts[iso] || 0) + 1;
        });

        // Update heatmap renderer
        if (heatmapLayerRef.current) {
            const uniqueValues = Object.entries(countryCounts).map(([iso, count]) => {
                let color = [255, 255, 255, 0];
                if (count > 5) color = [239, 68, 68, 0.6];      // High Intensity (Red)
                else if (count > 2) color = [251, 146, 60, 0.6]; // Medium Intensity (Orange)
                else if (count > 0) color = [250, 204, 21, 0.6]; // Low Intensity (Yellow)

                return {
                    value: iso,
                    symbol: new SimpleFillSymbol({
                        color: color,
                        outline: { color: [255, 255, 255, 0.5], width: 1 }
                    })
                };
            });

            heatmapLayerRef.current.renderer = new UniqueValueRenderer({
                field: "ISO_CC",
                defaultSymbol: new SimpleFillSymbol({
                    color: [255, 255, 255, 0],
                    outline: { color: [226, 232, 240, 0.4], width: 1 }
                }),
                uniqueValueInfos: uniqueValues
            });
        }

        signals.forEach(signal => {
            const coords = getSignalCoordinates(signal);
            if (!coords) return;

            const [lon, lat] = coords;

            const point = new Point({
                longitude: lon,
                latitude: lat
            });

            // Get alert level and determine color
            const level = getAlertLevel(signal);
            const diseaseColor = getDiseaseColor(signal.hazard?.name || '');

            const color = diseaseColor || (
                level === 'P1' || level === AlertLevel.CRITICAL
                    ? [239, 68, 68]
                    : level === 'P2' || level === AlertLevel.HIGH
                        ? [251, 146, 60]
                        : level === 'P3' || level === AlertLevel.MEDIUM
                            ? [250, 204, 21]
                            : [34, 197, 94]
            );

            const symbol = new SimpleMarkerSymbol({
                color: [...color, 0.9],
                outline: {
                    color: [255, 255, 255, 1],
                    width: 2
                },
                size: (level === 'P1' || level === AlertLevel.CRITICAL || diseaseColor) ? "18px" : "12px",
                style: diseaseColor ? "diamond" : "circle"
            });

            const template = new PopupTemplate({
                title: "{popupTitle}",
                content: `
                    <div style="font-family: sans-serif; font-size: 13px; color: #333;">
                        <p style="margin: 0 0 5px 0;"><b>Location:</b> {location_name}</p>
                        <p style="margin: 0 0 5px 0;"><b>Disease:</b> {disease_name}</p>
                        <p style="margin: 0 0 5px 0;"><b>Priority:</b> {priority}</p>
                        <p style="margin: 0 0 10px 0;"><b>Source:</b> {source_name}</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;" />
                        <div style="display: flex; gap: 10px;">
                            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 6px; color: #ef4444; flex: 1; text-align: center;">
                                <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Cases</div>
                                <div style="font-size: 16px; font-weight: 900;">{cases}</div>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; color: #475569; flex: 1; text-align: center;">
                                <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;">Deaths</div>
                                <div style="font-size: 16px; font-weight: 900;">{deaths}</div>
                            </div>
                        </div>
                    </div>
                `
            });

            const graphic = new Graphic({
                geometry: point,
                symbol: symbol,
                attributes: {
                    signal: signal,
                    popupTitle: signal.headline || signal.title || signal.summary || 'Signal Alert',
                    location_name: signal.location?.country || signal.location?.name || 'Unknown',
                    disease_name: signal.disease_name || signal.hazard?.name || 'Unknown Event',
                    priority: level,
                    source_name: (typeof signal.source === 'object' ? signal.source?.name : signal.source) || signal.source_name || signal.ingestion_source || 'Unknown',
                    cases: signal.reported_cases || signal.epi?.cases_suspected || 0,
                    deaths: signal.reported_deaths || signal.epi?.deaths || 0
                },
                popupTemplate: template
            });

            graphicsLayerRef.current?.add(graphic);
        });
    }, [signals]);

    return (
        <div className="absolute inset-0 w-full h-full bg-slate-50">
            <div
                ref={mapRef}
                tabIndex={-1}
                className="focus:outline-none focus:ring-0"
                style={{ width: '100%', height: '100%', padding: 0, margin: 0, outline: 'none', border: 'none' }}
            />
        </div>
    );
};

