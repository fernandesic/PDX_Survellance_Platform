import { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import Polygon from "@arcgis/core/geometry/Polygon";
import Point from "@arcgis/core/geometry/Point";
import Extent from "@arcgis/core/geometry/Extent";
import esriConfig from "@arcgis/core/config";
import "@arcgis/core/assets/esri/themes/light/main.css";

// Set the portal URL to the public portal by default to prevent organizational login prompts
esriConfig.portalUrl = "https://www.arcgis.com";

export function SimpleArcGISMap({
    geoData,
    getCountryStyle,
    onCountryClick,
    mapKey,
    onMapReady,
    selectedCountryName,
    isLight,
    getMarkerStyle
}: any) {
    const mapDiv = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const graphicsLayerRef = useRef<GraphicsLayer | null>(null);

    useEffect(() => {
        if (!mapDiv.current) return;
        if (import.meta.env.VITE_ARCGIS_API_KEY) {
            esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
        }
        let basemapId = isLight ? "topo" : "dark-gray-vector";
        if (esriConfig.apiKey) {
            basemapId = isLight ? "topographic" : "arcgis-dark-gray";
        }

        const map = new Map({ basemap: basemapId });
        const africaExtent = new Extent({
            xmin: -25, ymin: -35, xmax: 65, ymax: 38,
            spatialReference: { wkid: 4326 }
        });

        const view = new MapView({
            container: mapDiv.current,
            map,
            center: [20, 5],
            zoom: 3.5,
            background: { color: isLight ? [217, 237, 255, 1] : [10, 22, 40, 1] },
            constraints: { minZoom: 2, maxZoom: 9, rotationEnabled: false, geometry: africaExtent },
            ui: { components: ["zoom"] }
        });
        view.ui.move("zoom", "top-right");

        const graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);
        viewRef.current = view;
        graphicsLayerRef.current = graphicsLayer;

        if (onCountryClick) {
            view.on("click", (event) => {
                view.hitTest(event).then((response) => {
                    if (response.results.length > 0) {
                        const result = response.results[0];
                        if (result.type === "graphic") {
                            onCountryClick(result.graphic.attributes);
                        }
                    }
                });
            });
        }

        let hoveredGraphic: any = null;
        let hoveredOriginalSymbol: any = null;
        view.on("pointer-move", (event) => {
            view.hitTest(event).then((response) => {
                if (hoveredGraphic && hoveredOriginalSymbol) {
                    hoveredGraphic.symbol = hoveredOriginalSymbol;
                    hoveredGraphic = null;
                    hoveredOriginalSymbol = null;
                }
                if (response.results.length > 0) {
                    const result = response.results[0];
                    if (result.type === "graphic" && result.graphic.geometry) {
                        (mapDiv.current as any).style.cursor = "pointer";
                        hoveredGraphic = result.graphic;
                        hoveredOriginalSymbol = result.graphic.symbol ? (result.graphic.symbol as any).clone() : null;
                        if (result.graphic.symbol) {
                            const hoverSymbol = (result.graphic.symbol as any).clone();
                            hoverSymbol.outline = { color: [6, 182, 212, 1], width: 2.5 };
                            result.graphic.symbol = hoverSymbol;
                        }
                    } else {
                        (mapDiv.current as any).style.cursor = "default";
                    }
                } else {
                    (mapDiv.current as any).style.cursor = "default";
                }
            });
        });

        view.when(() => { if (onMapReady) onMapReady(view); });

        return () => {
            view.destroy();
            map.destroy();
            viewRef.current = null;
            graphicsLayerRef.current = null;
        };
    }, [mapKey, isLight]);

    // Redraw graphics when data or selection changes
    useEffect(() => {
        if (!graphicsLayerRef.current || !geoData) return;
        graphicsLayerRef.current.removeAll();

        const hexToRgb = (hex: string): [number, number, number] => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [200, 200, 200];
        };

        geoData.features.forEach((feature: any) => {
            const style = getCountryStyle(feature);
            const showFill = style.fillOpacity !== 0 && style.fillColor !== 'transparent';
            
            const countryName = feature.properties?.name || '';
            const isSelected = selectedCountryName && countryName.toLowerCase().includes(selectedCountryName.toLowerCase());

            let rings: number[][][] = [];
            let pointCoords: number[] | null = null;
            if (feature.geometry.type === "Polygon") rings = feature.geometry.coordinates;
            else if (feature.geometry.type === "MultiPolygon") {
                feature.geometry.coordinates.forEach((p: any) => p.forEach((r: any) => rings.push(r)));
            } else if (feature.geometry.type === "Point") pointCoords = feature.geometry.coordinates;

            if (rings.length === 0 && !pointCoords) return;

            const geometry = rings.length > 0 ? new Polygon({ rings, spatialReference: { wkid: 4326 } }) :
                new Point({ longitude: pointCoords![0], latitude: pointCoords![1], spatialReference: { wkid: 4326 } });

            // 1. Draw the actual country polygon (if visible)
            if (showFill) {
                const rgb = hexToRgb(style.fillColor);
                const symbol = new SimpleFillSymbol({
                    color: [...rgb, style.fillOpacity || 0.7],
                    outline: {
                        color: isSelected ? [6, 182, 212, 1] : [255, 255, 255, 0.9],
                        width: isSelected ? 3 : 1
                    }
                });

                const graphic = new Graphic({
                    geometry: geometry,
                    symbol: rings.length > 0 ? symbol : new SimpleMarkerSymbol({
                        color: [...rgb, 0.9], size: "12px", outline: { color: [255, 255, 255], width: 1 }
                    }),
                    attributes: feature.properties
                });
                graphicsLayerRef.current!.add(graphic);
            }

            // 2. Draw the marker (centroid bubble) if provided
            if (getMarkerStyle && geometry.type === "polygon") {
                const markerStyle = getMarkerStyle(feature);
                if (markerStyle && markerStyle.color !== "transparent") {
                    const centroid = (geometry as Polygon).centroid;
                    const markerGraphic = new Graphic({
                        geometry: centroid,
                        symbol: new SimpleMarkerSymbol({
                            color: markerStyle.color,
                            size: markerStyle.size || "12px",
                            outline: { color: [255, 255, 255, 1], width: 1.5 }
                        }),
                        attributes: feature.properties
                    });
                    graphicsLayerRef.current!.add(markerGraphic);
                }
            }
        });
    }, [geoData, getCountryStyle, selectedCountryName, getMarkerStyle]);

    return (
        <div
            ref={mapDiv}
            style={{
                width: "100%",
                height: "100%",
                background: "transparent"
            }}
        />
    );
}
