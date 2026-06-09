import { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TileLayer from "@arcgis/core/layers/TileLayer";
import Basemap from "@arcgis/core/Basemap";
import Point from "@arcgis/core/geometry/Point";
import VectorTileLayer from "@arcgis/core/layers/VectorTileLayer";
import esriConfig from "@arcgis/core/config";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import "@arcgis/core/assets/esri/themes/light/main.css";
import type { PAMILocation } from "@/pages/pami/types/pami";
import { arcgisService } from "@/services/arcgisService";
import {
    COUNTRY_SHAPEFILES_BASE,
    COUNTRY_LAYERS,
    PAMI_CONFIGS,
    PAMI_COLOR,
    NO_PAMI,
    OUTLINE_WHITE,
    OUTLINE_THIN,
    buildRegionMap,
    type CountryLayerConfig,
    type PAMILayerConfig,
} from "./pamiMapConfig";
import { logger } from "@/utils/logger";

interface PAMIMapProps {
    locations: PAMILocation[];
}

export function PAMIMap({ locations }: PAMIMapProps) {
    const mapDiv = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Map | null>(null);
    const viewRef = useRef<MapView | null>(null);
    const graphicsLayerRef = useRef<GraphicsLayer | null>(null);


    // 1. Initial Map Creation (Runs once)
    useEffect(() => {
        if (!mapDiv.current || mapRef.current) return;

        if (import.meta.env.VITE_ARCGIS_API_KEY) {
            esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
        }

        const map = new Map({
            basemap: new Basemap({
                baseLayers: [
                    new TileLayer({
                        url: "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer",
                        opacity: 0.4
                    }),
                    new VectorTileLayer({
                        url: "https://cdn.arcgis.com/sharing/rest/content/items/7dc6cea0b1764a1f9af2e679f642f0f5/resources/styles/root.json"
                    })
                ],
            }),
        });

        const view = new MapView({
            container: mapDiv.current,
            map,
            center: [18, 5],
            zoom: 3.5,
            constraints: { minZoom: 3, maxZoom: 12, rotationEnabled: false },
            ui: { components: ["zoom"] },
        });
        view.ui.move("zoom", "top-right");

        // ── Overlay layers ──────────────────────────────────────────
        const waterbodyLayer = new FeatureLayer({
            url: "https://services.arcgis.com/Vr4pJuhEJB9F4bUA/arcgis/rest/services/African_Rivers/FeatureServer/0",
            renderer: new SimpleRenderer({
                symbol: new SimpleFillSymbol({
                    color: [14, 135, 204, 0.7],
                    outline: new SimpleLineSymbol({ color: [10, 100, 160, 0.4], width: 0.5 }),
                }),
            }),
        });

        const bordersLayer = new FeatureLayer({
            url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries/FeatureServer/0",
            definitionExpression: "CONTINENT = 'Africa'",
            renderer: new SimpleRenderer({
                symbol: new SimpleFillSymbol({
                    color: [0, 0, 0, 0],
                    outline: new SimpleLineSymbol({ color: [93, 64, 55, 0.7], width: 1.2, style: "dash" }),
                }),
            }),
        });

        const graphicsLayer = new GraphicsLayer();
        map.addMany([waterbodyLayer, bordersLayer, graphicsLayer]);

        mapRef.current = map;
        viewRef.current = view;
        graphicsLayerRef.current = graphicsLayer;

        // ── Helper: Map REST field types to JS API types ───────────
        const mapArcGISFieldType = (esriType: string): any => {
            const mapping: Record<string, string> = {
                "esriFieldTypeString": "string",
                "esriFieldTypeOID": "oid",
                "esriFieldTypeInteger": "integer",
                "esriFieldTypeSmallInteger": "small-integer",
                "esriFieldTypeDouble": "double",
                "esriFieldTypeSingle": "single",
                "esriFieldTypeDate": "date",
                "esriFieldTypeGeometry": "geometry",
                "esriFieldTypeGlobalID": "global-id",
                "esriFieldTypeGUID": "guid",
            };
            return mapping[esriType] || "string";
        };

        // ── Load country layer via Backend Proxy (best approach) ─────
        const loadCountryLayer = async (config: CountryLayerConfig) => {
            const regionSet = buildRegionMap(locations, config.country);
            const layerUrl = `${COUNTRY_SHAPEFILES_BASE}/${config.index}`;

            try {
                // Fetch cached data via Backend Proxy
                const data = await arcgisService.queryLayer(layerUrl);

                // Process features for PAMI priority
                const features = data.features.map((f: any) => {
                    let name = "";
                    for (const field of config.attributeFields) {
                        if (f.attributes[field]) {
                            name = f.attributes[field].toString().toLowerCase().trim();
                            if (regionSet.has(name)) break;
                        }
                    }
                    f.attributes.PAMI_PRIORITY = regionSet.has(name) ? 1 : 0;

                    // Create ArcGIS Graphic object from source feature
                    return Graphic.fromJSON(f);
                });

                map.add(
                    new FeatureLayer({
                        source: features,
                        fields: [
                            ...data.fields.map((f: any) => ({
                                ...f,
                                type: mapArcGISFieldType(f.type)
                            })),
                            { name: "PAMI_PRIORITY", alias: "PAMI Priority", type: "integer" }
                        ],
                        objectIdField: data.objectIdField || "FID",
                        renderer: new UniqueValueRenderer({
                            field: "PAMI_PRIORITY",
                            defaultSymbol: new SimpleFillSymbol({ color: NO_PAMI, outline: OUTLINE_THIN }),
                            uniqueValueInfos: [{
                                value: 1,
                                symbol: new SimpleFillSymbol({ color: PAMI_COLOR, outline: OUTLINE_WHITE }),
                            }],
                        }),
                        title: config.country,
                        opacity: 0.7,
                        popupTemplate: {
                            title: "{ADM2_NAME}, {ADM1_NAME}",
                            content: [{
                                type: "fields",
                                fieldInfos: [
                                    { fieldName: "ADM0_NAME", label: "Country" },
                                    { fieldName: "ADM1_NAME", label: "Province" },
                                    { fieldName: "ADM2_NAME", label: "District" },
                                    { fieldName: "PAMI_PRIORITY", label: "Priority" },
                                ],
                            }],
                        },
                    }),
                    0
                );
            } catch (err) {
                // Ignore loading errors for individual country layers
            }
        };

        // ── Load PAMI layer via Backend Proxy ───────────────────────
        const loadPAMILayer = async (config: PAMILayerConfig) => {
            try {
                // Fetch cached data via Backend Proxy
                const data = await arcgisService.queryLayer(config.url);
                const features = data.features.map(f => Graphic.fromJSON(f));

                map.add(
                    new FeatureLayer({
                        source: features,
                        fields: data.fields.map((f: any) => ({
                            ...f,
                            type: mapArcGISFieldType(f.type)
                        })),
                        objectIdField: data.objectIdField || "FID",
                        opacity: 0.7,
                        title: `${config.country} PAMIs`,
                        renderer: new SimpleRenderer({
                            symbol: new SimpleFillSymbol({ color: PAMI_COLOR, outline: OUTLINE_WHITE }),
                        }),
                        popupTemplate: {
                            title: `${config.country} PAMI`,
                            content: [{ type: "fields", fieldInfos: config.popupFields }],
                        },
                    }),
                    0
                );
            } catch (err) {
                // Ignore loading errors for individual PAMI layers
            }
        };


        // ── Dynamic Operational Layers ──────────────────────────────
        (async () => {
            try {
                const operationalLayers = await arcgisService.getWebMapLayers();
                logger.log(`[PAMI-Dynamic] Found ${operationalLayers.length} operational layers`);

                for (const layer of operationalLayers) {
                    const { title, url } = layer;

                    // 2. Specific PAMI FeatureLayers (Zambia, Sudan, Ghana)
                    const pamiConfig = PAMI_CONFIGS.find(p => p.url === url);
                    if (pamiConfig) {
                        await loadPAMILayer(pamiConfig);
                        continue;
                    }

                    // 3. Country Shapefiles
                    if (url.includes("Country_Shapefiles")) {
                        const indexMatch = url.match(/\/(\d+)$/);
                        if (indexMatch) {
                            const index = parseInt(indexMatch[1]);
                            const countryConfig = COUNTRY_LAYERS.find(c => c.index === index);
                            if (countryConfig) {
                                await loadCountryLayer(countryConfig);
                                continue;
                            }
                        }
                    }

                    // 4. Default: Just add as a generic FeatureLayer
                    if (url && url.includes("FeatureServer")) {
                        try {
                            const data = await arcgisService.queryLayer(url);
                            const features = data.features.map(f => Graphic.fromJSON(f));
                            map.add(new FeatureLayer({
                                source: features,
                                fields: data.fields.map((f: any) => ({ ...f, type: mapArcGISFieldType(f.type) })),
                                objectIdField: data.objectIdField || "FID",
                                title: title,
                                opacity: 0.5
                            }));
                        } catch (e) {
                            logger.error(`Failed to load generic layer: ${title}`, e);
                        }
                    }
                }
            } catch (err) {
                logger.error("Error fetching dynamic webmap layers:", err);
            }
        })();



        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
            if (mapRef.current) {
                mapRef.current.destroy();
                mapRef.current = null;
            }
        };
    }, []);

    // 2. Data Update Effect (Runs on locations change)
    useEffect(() => {
        if (!graphicsLayerRef.current || !locations) return;

        logger.log(`[PAMI-Map] Updating ${locations.length} point markers`);
        graphicsLayerRef.current.removeAll();

        locations.forEach((loc) => {
            if (!loc.latitude || !loc.longitude) return;
            graphicsLayerRef.current?.add(
                new Graphic({
                    geometry: new Point({ longitude: loc.longitude, latitude: loc.latitude }),
                    symbol: new SimpleMarkerSymbol({
                        color: [220, 38, 38, 0.9],
                        size: "10px",
                        outline: { color: [255, 255, 255, 1], width: 2 },
                    }),
                    attributes: { ...loc, title: loc.district || loc.province || "PAMI" },
                })
            );
        });
    }, [locations]);

    return (
        <div className="relative w-full h-full">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-white border border-slate-400 px-8 py-2 rounded-sm shadow-md">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight whitespace-nowrap">
                        PAMI LOCATIONS IN AFRICA (WHO LIVE)
                    </h2>
                </div>
            </div>

            <div ref={mapDiv} style={{ width: "100%", height: "100%", backgroundColor: "white" }} />

            <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm border border-slate-300 rounded-sm p-4 text-slate-900 text-sm shadow-lg min-w-[200px]">
                <h4 className="font-bold mb-3 text-base border-b border-slate-200 pb-1">Legend</h4>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-4 bg-red-600 border border-red-700" />
                        <span className="text-xs font-medium">PAMI Location</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-4 bg-[#0E87CC] border border-[#7BBBD8]" />
                        <span className="text-xs font-medium">Waterbody</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-4 bg-white border border-slate-300" />
                        <span className="text-xs font-medium">Provinces (No PAMI data)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-1 border-b-2 border-dashed border-slate-500" />
                        <span className="text-xs font-medium">Country Borders</span>
                    </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 text-[9px] text-slate-400">
                    <p className="font-semibold text-slate-500 mb-1">Data Sources via Backend</p>
                    <p>WHO Country_Shapefiles • WHO PAMIs • MOH in WHO AFRO • EPR</p>
                </div>
            </div>


        </div>
    );
}
