import { useEffect, useRef, useState } from "react";
import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import GroupLayer from "@arcgis/core/layers/GroupLayer";
import type Layer from "@arcgis/core/layers/Layer";
import type Basemap from "@arcgis/core/Basemap";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import Polygon from "@arcgis/core/geometry/Polygon";
import esriConfig from "@arcgis/core/config";
import "@arcgis/core/assets/esri/themes/light/main.css";
import type { Feature, FeatureCollection } from "geojson";
import { logger } from "@/utils/logger";

interface CountryStyle {
    fillColor: string;
    fillOpacity?: number;
}

interface CountryAttributes {
    name?: string;
    [key: string]: unknown;
}

esriConfig.portalUrl = "https://www.arcgis.com";

interface UnifiedArcGISMapProps {
    mode: 'webmap' | 'geojson';
    webMapId?: string;
    geoData?: FeatureCollection;
    getCountryStyle?: (feature: Feature) => CountryStyle;
    onCountryClick?: (attributes: CountryAttributes) => void;
    selectedCountryName?: string | null;
    isLight?: boolean;
}

const webMapData: Record<string, string> = {
    "espar_1": "19a4e7d5ea724b248d8c1b95a2590e7a",
    "espar_2": "b4735f2969dd478bba6c3e2ef777d960",
    "espar_3": "d15cd72b73e74c50b1644d191282555d",
    "chw": "b475a009f2aa4dffb9bfd0c7cc06ea0c"
};

export function UnifiedArcGISMap({
    mode,
    webMapId,
    geoData,
    getCountryStyle,
    onCountryClick,
    selectedCountryName,
    isLight = false
}: UnifiedArcGISMapProps) {
    const mapDiv = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const mapRef = useRef<WebMap | null>(null);
    const layerCacheRef = useRef<Record<string, GroupLayer>>({});
    const geoLayerRef = useRef<GraphicsLayer | null>(null);
    const chwBasemapRef = useRef<Basemap | null>(null);
    const [mapReady, setMapReady] = useState(false);

    // 1. Initialize with the CHW WebMap directly — its basemap becomes
    //    the permanent basemap for all tabs (no placeholder needed).
    useEffect(() => {
        if (!mapDiv.current) return;

        if (import.meta.env.VITE_ARCGIS_API_KEY) {
            esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
        }

        const chwPortalId = webMapData["chw"];

        // Use CHW WebMap directly as the map so its basemap loads natively
        const initialMap = new WebMap({ portalItem: { id: chwPortalId } });

        mapRef.current = initialMap;

        const view = new MapView({
            container: mapDiv.current,
            map: initialMap,
            center: [18, 5],
            zoom: 3,
            constraints: {
                minZoom: 2,
                maxZoom: 10,
                rotationEnabled: false
            },
            ui: { components: ["zoom"] }
        });

        view.ui.move("zoom", "top-right");
        viewRef.current = view;

        // After the WebMap loads, move its operational layers into a cached
        // GroupLayer (hidden by default) and add the GeoJSON graphics layer.
        const mapWithLoadAll = initialMap as WebMap & { loadAll?: () => Promise<unknown> };
        const loadFn = typeof mapWithLoadAll.loadAll === 'function'
            ? mapWithLoadAll.loadAll()
            : initialMap.load();

        loadFn.then(() => {
            // Cache CHW operational layers into a GroupLayer
            const group = new GroupLayer({
                title: `WebMap_${chwPortalId}`,
                visible: false
            });

            const layersToMove: Layer[] = [];
            initialMap.layers.forEach((layer: Layer) => {
                layersToMove.push(layer);
            });
            layersToMove.forEach((layer: Layer) => {
                initialMap.layers.remove(layer);
                group.add(layer);
            });

            initialMap.add(group);
            layerCacheRef.current[chwPortalId] = group;

            // Store the CHW basemap so we can restore it on theme toggle
            if (initialMap.basemap) {
                chwBasemapRef.current = initialMap.basemap.clone();
            }

            // Add GeoJSON GraphicsLayer
            const gl = new GraphicsLayer({ visible: false, title: "GeoJSON_Layer" });
            geoLayerRef.current = gl;
            initialMap.add(gl);
        }).catch((err: unknown) => {
            logger.warn("Failed to load CHW WebMap:", err);
            // Fallback: still add GeoJSON layer
            const gl = new GraphicsLayer({ visible: false, title: "GeoJSON_Layer" });
            geoLayerRef.current = gl;
            initialMap.add(gl);
        });

        // Click handler
        interface GraphicHit {
            graphic: { attributes: Record<string, unknown> };
        }

        view.on("click", (event) => {
            view.hitTest(event).then((response) => {
                if (response.results.length > 0) {
                    const graphicHit = response.results.find(
                        (r): r is typeof r & GraphicHit =>
                            !!(r as unknown as GraphicHit).graphic,
                    );
                    if (graphicHit && onCountryClick) {
                        const attributes = graphicHit.graphic.attributes;
                        const countryName =
                            (attributes.ADM0_NAME as string | undefined) ||
                            (attributes.COUNTRY as string | undefined) ||
                            (attributes.name as string | undefined) ||
                            (attributes.Country as string | undefined);
                        onCountryClick({ name: countryName, ...attributes });
                    }
                }
            });
        });

        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Mark map as ready once the MapView finishes updating for the first time
    useEffect(() => {
        const view = viewRef.current;
        if (!view || mapReady) return;
        const handle = reactiveUtils.watch(
            () => view.updating,
            (updating) => {
                if (!updating) {
                    setMapReady(true);
                    handle.remove();
                }
            },
        );
        return () => handle.remove();
    }, [mapReady]);

    useEffect(() => {
        if (!mapRef.current) return;
        const currentBasemap = mapRef.current.basemap;
        if (isLight) {
            const basemap = esriConfig.apiKey ? "arcgis-topographic" : "topo";
            const currentId = (currentBasemap as Basemap & { id?: string } | null)?.id;
            if (!currentBasemap || currentId !== basemap) {
                // Basemap.fromId() accepts these literal IDs; the .basemap setter is typed strictly,
                // so cast through unknown to keep the call typed.
                mapRef.current.basemap = basemap as unknown as Basemap;
            }
        } else if (chwBasemapRef.current) {
            // Restore the CHW WebMap basemap instantly (no network call)
            mapRef.current.basemap = chwBasemapRef.current.clone();
        }
    }, [isLight]);

    // 3. Handle Data Switching (Persistent Layers)
    useEffect(() => {
        if (!viewRef.current || !mapRef.current) return;
        const map = mapRef.current;
        let isAborted = false;

        const updatelayers = async () => {
            const cache = layerCacheRef.current;
            Object.values(cache).forEach(layer => { layer.visible = false; });
            if (geoLayerRef.current) geoLayerRef.current.visible = false;

            if (mode === 'webmap' && webMapId) {
                const actualId = webMapData[webMapId] || webMapId;
                let group = cache[actualId];

                if (!group) {
                    const tempWebMap = new WebMap({ portalItem: { id: actualId } });
                    const tempWithLoadAll = tempWebMap as WebMap & { loadAll?: () => Promise<unknown> };
                    try {
                        if (typeof tempWithLoadAll.loadAll === 'function') {
                            await tempWithLoadAll.loadAll();
                        } else {
                            await tempWebMap.load();
                        }
                    } catch (err) {
                        // Portal item may be deleted, private, or unreachable. Log and
                        // bail out — the basemap still renders, just without this overlay.
                        logger.warn(`Failed to load WebMap "${actualId}":`, err);
                        return;
                    }

                    if (isAborted) return;

                    // Do NOT swap the basemap from the WebMap – keep the
                    // consistent 'oceans' basemap across all tabs so the map
                    // appearance stays the same; only add the data layers.

                    group = new GroupLayer({
                        title: `WebMap_${actualId}`,
                        visible: false
                    });

                    const layersToAdd: Layer[] = [];
                    tempWebMap.layers.forEach((layer: Layer) => {
                        layersToAdd.push(layer);
                    });
                    layersToAdd.forEach((layer: Layer) => {
                        // A layer whose load failed (e.g. dead sub-portal-item) has
                        // loadStatus === 'failed' and adding it triggers "Invalid URL"
                        // promise rejections inside ArcGIS. Skip those.
                        const loadable = layer as Layer & { loadStatus?: string };
                        if (loadable.loadStatus === 'failed') {
                            logger.warn(`Skipping failed layer in WebMap "${actualId}":`, layer.title);
                            return;
                        }
                        try {
                            const cloneable = layer as Layer & { clone?: () => Layer };
                            if (cloneable.clone) {
                                group!.add(cloneable.clone());
                            } else {
                                group!.add(layer);
                            }
                        } catch (err) {
                            logger.warn(`Failed to add layer "${layer.title}":`, err);
                        }
                    });

                    map.add(group);
                    cache[actualId] = group;
                }

                if (!isAborted && mode === 'webmap') {
                    group.visible = true;
                }

            } else if (mode === 'geojson' && geoData && geoLayerRef.current) {
                const gl = geoLayerRef.current;
                gl.visible = true;

                if (getCountryStyle) {
                    gl.removeAll();
                    const hexToRgb = (hex: string): [number, number, number] => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [100, 100, 100];
                    };

                    geoData.features.forEach((feature: Feature) => {
                        const style = getCountryStyle(feature);
                        if (style.fillColor === 'transparent') return;

                        const rgb = hexToRgb(style.fillColor);
                        let rings: number[][][] = [];
                        if (feature.geometry?.type === "Polygon") {
                            rings = feature.geometry.coordinates as number[][][];
                        } else if (feature.geometry?.type === "MultiPolygon") {
                            (feature.geometry.coordinates as number[][][][]).forEach((p) =>
                                p.forEach((r) => rings.push(r)),
                            );
                        }

                        if (rings.length === 0) return;

                        const countryName = feature.properties?.name || '';
                        const isSelected = selectedCountryName && countryName.toLowerCase().includes(selectedCountryName.toLowerCase());

                        const graphic = new Graphic({
                            geometry: new Polygon({ rings, spatialReference: { wkid: 4326 } }),
                            symbol: new SimpleFillSymbol({
                                color: [...rgb, style.fillOpacity || 0.7],
                                outline: {
                                    color: isSelected ? [6, 182, 212, 1] : [255, 255, 255, 0.4],
                                    width: isSelected ? 2 : 0.5
                                }
                            }),
                            attributes: feature.properties
                        });
                        gl.add(graphic);
                    });
                }
            }
        };

        updatelayers().catch((err) => {
            logger.warn("UnifiedArcGISMap.updatelayers failed:", err);
        });

        return () => {
            isAborted = true;
        };
    }, [mode, webMapId, geoData, getCountryStyle, selectedCountryName]);

    return <div ref={mapDiv} className="w-full h-full" style={{ opacity: mapReady ? 1 : 0, transition: 'opacity 0.4s ease-in' }} />;
}
