// @ts-nocheck
import { useEffect, useRef, useState, memo, useCallback } from 'react';
import WebScene from '@arcgis/core/WebScene';
import SceneView from '@arcgis/core/views/SceneView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import { Play, Pause, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import esriConfig from '@arcgis/core/config';
import IdentityManager from '@arcgis/core/identity/IdentityManager';
import type { Region, RegionClimateProfile, LayerType } from '@/pages/climate/types/climate';
import { Loader2, Wind, Thermometer, CloudRain, Flame, Leaf, Satellite, Eye, EyeOff, Waves } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/utils/logger';

// NASA GIBS layers that support time scrubbing
const TIME_ENABLED_LAYERS = [
    { id: 'precipitation', baseUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/{date}T00:30:00Z/GoogleMapsCompatible_Level6/{level}/{row}/{col}.png' },
    { id: 'temperature', baseUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/{date}/GoogleMapsCompatible_Level7/{level}/{row}/{col}.png' },
    { id: 'vegetation', baseUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_EVI_8Day/default/{date}/GoogleMapsCompatible_Level9/{level}/{row}/{col}.png' },
    { id: 'dust', baseUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol_Optical_Depth_3km/default/{date}/GoogleMapsCompatible_Level6/{level}/{row}/{col}.png' },
];

const WHO_WEBSCENE_ID = 'b3938ec5ea5d44c18af20ea0c8bbb051';
const ARCGIS_API_KEY = import.meta.env.VITE_ARCGIS_API_KEY;

// WHO WebScene layer IDs (from the /data JSON)
// These match the layer titles in the WHO WebScene
const SCENE_LAYER_CONFIG = [
    { id: 'wind', title: 'Global Average Wind Speeds by Month and Altitude', icon: <Wind size={15} />, label: 'Wind Flow', description: 'Animated wind speed & direction' },
    { id: 'precipitation', title: 'Precipitation Rate, 30-minute avg. (IMERG)', icon: <CloudRain size={15} />, label: 'Precipitation', description: 'NASA IMERG 30-min rainfall' },
    { id: 'fire_viirs', title: 'Satellite (VIIRS) Thermal Hotspots and Fire Activity', icon: <Flame size={15} />, label: 'Fire Hotspots', description: 'VIIRS satellite thermal' },
    { id: 'fire_modis', title: 'Satellite (MODIS) Thermal Hotspots and Fire Activity', icon: <Flame size={15} />, label: 'MODIS Fire', description: 'MODIS thermal detection' },
    { id: 'temperature', title: 'Land Surface Temperature (Day, MODIS, Terra)', icon: <Thermometer size={15} />, label: 'Surface Temp', description: 'NASA MODIS land temp' },
    { id: 'vegetation', title: 'Vegetation / drought monitoring', icon: <Leaf size={15} />, label: 'Vegetation', description: 'NDVI drought monitoring' },
    { id: 'dust', title: 'Dust/Aerosols', icon: <Waves size={15} />, label: 'Dust/Aerosols', description: 'MODIS aerosol depth' },
    { id: 'satellite_color', title: 'NOAA Colorized Satellite Imagery', icon: <Satellite size={15} />, label: 'NOAA Satellite', description: 'GOES colorized imagery' },
    { id: 'satellite_ir', title: 'NOAA Infrared Satellite Imagery', icon: <Satellite size={15} />, label: 'Infrared', description: 'GOES infrared imagery' },
    { id: 'stations', title: 'Current Weather and Wind Station Data', icon: <Wind size={15} />, label: 'Stations', description: 'NOAA METAR weather data' },
];

type WeatherLayerType = string;

interface ClimateMapProps {
    regions: Region[];
    selectedRegion: Region | null;
    onRegionClick: (region: Region) => void;
    activeLayers: LayerType[];
    regionProfiles: Map<string, RegionClimateProfile>;
    activeWeatherLayer: WeatherLayerType | null;
    onWeatherLayerChange: (layer: WeatherLayerType | null) => void;
}

const getSeverityColor = (severity: string): [number, number, number] => {
    switch (severity) {
        case 'HIGH': return [239, 68, 68];
        case 'MEDIUM': return [245, 158, 11];
        default: return [34, 197, 94];
    }
};

const getHazardFromProfile = (profile: RegionClimateProfile): { type: string; severity: string } => {
    if (profile.activeHazards.length > 0) return profile.activeHazards[0];
    const risks = profile.diseaseRisks.filter(r => r.riskLevel !== 'LOW');
    if (risks.length > 0) return { type: risks[0].disease, severity: risks[0].riskLevel };
    return { type: 'stable', severity: 'LOW' };
};

export const ArcGISClimateMap = memo(({
    regions,
    selectedRegion,
    onRegionClick,
    activeLayers,
    regionProfiles,
    activeWeatherLayer,
    onWeatherLayerChange
}: ClimateMapProps) => {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<SceneView | null>(null);
    const sceneRef = useRef<WebScene | null>(null);
    const markersLayerRef = useRef<GraphicsLayer | null>(null);
    const glowLayerRef = useRef<GraphicsLayer | null>(null);
    // Direct layer references — no title matching needed
    const layerMapRef = useRef<Map<string, any>>(new Map());
    const [activeLIds, setActiveLIds] = useState<Set<string>>(new Set(['wind', 'fire_viirs']));
    const [isLoading, setIsLoading] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(3);
    const [whoSceneLoaded, setWhoSceneLoaded] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isPlaying, setIsPlaying] = useState(false);
    const playIntervalRef = useRef<any>(null);

    // Date range: last 30 days
    const dateRangeStart = useRef(new Date(Date.now() - 30 * 86400000));
    const dateRangeEnd = useRef(new Date());
    const totalDays = 30;

    const formatDate = (d: Date) =>
        `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}, ${d.getFullYear()}`;

    const applyDateToLayers = useCallback((d: Date) => {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        TIME_ENABLED_LAYERS.forEach(tl => {
            const layer = layerMapRef.current.get(tl.id);
            if (layer && layer.urlTemplate) {
                layer.urlTemplate = tl.baseUrl.replace('{date}', dateStr);
                layer.refresh?.();
            }
        });
    }, []);

    const stepDate = useCallback((delta: number) => {
        setSelectedDate(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() + delta);
            if (next < dateRangeStart.current) return dateRangeStart.current;
            if (next > dateRangeEnd.current) return dateRangeEnd.current;
            applyDateToLayers(next);
            return next;
        });
    }, [applyDateToLayers]);

    useEffect(() => {
        if (isPlaying) {
            playIntervalRef.current = setInterval(() => stepDate(1), 800);
        } else {
            clearInterval(playIntervalRef.current);
        }
        return () => clearInterval(playIntervalRef.current);
    }, [isPlaying, stepDate]);

    // Initialize ArcGIS SceneView
    useEffect(() => {
        if (!containerRef.current || viewRef.current) return;
        let destroyed = false;

        async function init() {
            IdentityManager.destroyCredentials();
            (IdentityManager as any).dialog = null;

            if (ARCGIS_API_KEY) {
                esriConfig.apiKey = ARCGIS_API_KEY;
            }

            let scene: WebScene;

            // Load WHO scene with 15s timeout
            try {
                scene = await Promise.race([
                    (async () => {
                        const s = new WebScene({ portalItem: { id: WHO_WEBSCENE_ID } });
                        await s.load();
                        return s;
                    })(),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 15000)
                    )
                ]);

                // Build layer lookup map from all layers
                const allLayers = scene.allLayers.toArray();
                console.log('[ArcGIS] ✅ WHO WebScene loaded. All layers:', allLayers.length);
                allLayers.forEach((layer: any, i: number) => {
                    console.log(`  [${i}] "${layer.title}" type=${layer.type} visible=${layer.visible}`);
                });

                // Map our config IDs to actual layer references
                SCENE_LAYER_CONFIG.forEach(cfg => {
                    const match = allLayers.find((l: any) => l.title && l.title.trim() === cfg.title.trim());
                    if (match) {
                        layerMapRef.current.set(cfg.id, match);
                        console.log(`  ✅ Mapped "${cfg.id}" → "${match.title}"`);
                    } else {
                        console.warn(`  ❌ No match for "${cfg.id}": "${cfg.title}"`);
                    }
                });

                setWhoSceneLoaded(true);
            } catch (err) {
                console.warn('[ArcGIS] WHO WebScene failed/timeout:', err);
                scene = new WebScene({ basemap: 'satellite', ground: 'world-elevation' });
                await scene.load();
            }

            if (destroyed) return;

            // Override the WHO scene's "Terrain with Labels" basemap → dark satellite
            scene.basemap = 'satellite' as any;
            sceneRef.current = scene;

            // Fix broken WMTS layers — replace with working WebTileLayer using correct template URLs
            if (layerMapRef.current.size > 0) {
                const wmtsFixes: { title: string; templateUrl: string }[] = [
                    { title: 'Precipitation Rate, 30-minute avg. (IMERG)', templateUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/2026-05-11T00:30:00Z/GoogleMapsCompatible_Level6/{level}/{row}/{col}.png' },
                    { title: 'Land Surface Temperature (Day, MODIS, Terra)', templateUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2026-05-11/GoogleMapsCompatible_Level7/{level}/{row}/{col}.png' },
                    { title: 'Vegetation / drought monitoring', templateUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_EVI_8Day/default/2026-05-09/GoogleMapsCompatible_Level9/{level}/{row}/{col}.png' },
                    { title: 'Dust/Aerosols', templateUrl: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol_Optical_Depth_3km/default/2026-05-11/GoogleMapsCompatible_Level6/{level}/{row}/{col}.png' },
                ];

                wmtsFixes.forEach(fix => {
                    // Find and remove the broken WMTS layer
                    const broken = scene.allLayers.find((l: any) => l.title && l.title.trim() === fix.title);
                    if (broken) {
                        const wasVisible = broken.visible;
                        scene.remove(broken);

                        // Add working WebTileLayer replacement
                        const replacement = new WebTileLayer({
                            urlTemplate: fix.templateUrl,
                            title: fix.title,
                            visible: wasVisible,
                            opacity: 0.85
                        });
                        scene.add(replacement);

                        // Update our layer map ref
                        const cfgId = SCENE_LAYER_CONFIG.find(c => c.title.trim() === fix.title)?.id;
                        if (cfgId) {
                            layerMapRef.current.set(cfgId, replacement);
                            console.log(`  🔧 Replaced broken WMTS: "${fix.title}" → WebTileLayer`);
                        }
                    }
                });
            }

            const glowLayer = new GraphicsLayer({ title: 'Hazard Glows' });
            const markersLayer = new GraphicsLayer({ title: 'Country Markers' });
            scene.addMany([glowLayer, markersLayer]);
            glowLayerRef.current = glowLayer;
            markersLayerRef.current = markersLayer;

            const view = new SceneView({
                container: containerRef.current!,
                map: scene,
                camera: {
                    position: { longitude: 20, latitude: 0, z: 8000000 },
                    tilt: 0,
                    heading: 0
                },
                environment: {
                    // Override the WHO scene's foggy weather — clean atmosphere
                    atmosphere: { quality: 'high' },
                    lighting: { type: 'sun', date: new Date(), directShadowsEnabled: false },
                    starsEnabled: true,
                    weather: { type: 'sunny', cloudCover: 0 }
                },
                qualityProfile: 'high',
                ui: { components: ['zoom', 'navigation-toggle', 'compass'] },
                popup: { defaultPopupTemplateEnabled: false }
            });

            viewRef.current = view;

            view.when().then(() => {
                if (destroyed) return;
                console.log('[ArcGIS] SceneView ready');
                applyVisibility(new Set(['wind', 'fire_viirs']));
            }).catch(err => {
                console.warn('[ArcGIS] SceneView.when() error:', err);
            });

            setIsLoading(false);

            // Click handler
            view.on('click', (event) => {
                if (!regions.length || !event.mapPoint) return;
                const { longitude, latitude } = event.mapPoint;
                let nearest: Region | null = null;
                let minDist = Infinity;
                for (const r of regions) {
                    const d = Math.sqrt(
                        Math.pow(r.centroid.lat - latitude, 2) +
                        Math.pow(r.centroid.lng - longitude, 2)
                    );
                    if (d < minDist && d < 5) { minDist = d; nearest = r; }
                }
                if (nearest) onRegionClick(nearest);
            });

            view.watch('zoom', (z) => setZoomLevel(z || 3));
        }

        init();
        return () => { destroyed = true; viewRef.current?.destroy(); viewRef.current = null; };
    }, []);

    // Apply visibility using stored layer refs — simple and direct
    const applyVisibility = useCallback((activeIds: Set<string>) => {
        layerMapRef.current.forEach((layer, id) => {
            const shouldBeVisible = activeIds.has(id);
            layer.visible = shouldBeVisible;
            console.log(`  Toggle "${id}" → visible=${shouldBeVisible}`);
        });
    }, []);

    // Toggle a layer on/off
    const toggleLayer = useCallback((layerId: string) => {
        setActiveLIds(prev => {
            const next = new Set(prev);
            if (next.has(layerId)) {
                next.delete(layerId);
            } else {
                next.add(layerId);
            }
            // Apply after state update
            setTimeout(() => applyVisibility(next), 0);
            return next;
        });
    }, [applyVisibility]);

    // Show markers immediately from regions, update colors when profiles arrive
    useEffect(() => {
        const markersLayer = markersLayerRef.current;
        const glowLayer = glowLayerRef.current;
        if (!markersLayer || !glowLayer) return;
        if (!regions.length) return;

        markersLayer.removeAll();
        glowLayer.removeAll();

        regions.forEach(region => {
            if (!region.centroid || isNaN(region.centroid.lat) || isNaN(region.centroid.lng)) return;

            const profile = regionProfiles.get(region.id);
            let color: [number, number, number] = [100, 116, 139];
            let hazardLabel = '';

            if (profile) {
                const hazardInfo = getHazardFromProfile(profile);
                if (hazardInfo.type !== 'stable') {
                    color = getSeverityColor(hazardInfo.severity);
                    hazardLabel = hazardInfo.severity;
                } else {
                    color = [34, 197, 94];
                }
            }

            const point = new Point({ longitude: region.centroid.lng, latitude: region.centroid.lat });

            glowLayer.add(new Graphic({
                geometry: point,
                symbol: new SimpleMarkerSymbol({
                    style: 'circle',
                    color: [...color, 0.25],
                    size: '34px',
                    outline: { color: [...color, 0.05], width: 0 }
                }),
                attributes: { regionId: region.id, name: region.name }
            }));

            markersLayer.add(new Graphic({
                geometry: point,
                symbol: new SimpleMarkerSymbol({
                    style: 'circle',
                    color: color,
                    size: '12px',
                    outline: { color: [255, 255, 255, 0.9], width: 1.5 }
                }),
                attributes: { regionId: region.id, name: region.name },
                popupTemplate: {
                    title: '{name}',
                    content: hazardLabel ? `${hazardLabel} risk` : 'Monitoring'
                }
            }));

            // Subtle country label
            markersLayer.add(new Graphic({
                geometry: point,
                symbol: new TextSymbol({
                    text: region.name,
                    color: [255, 255, 255, 0.85],
                    haloColor: [0, 0, 0, 0.5],
                    haloSize: 1,
                    font: {
                        size: 8,
                        family: 'Arial',
                        weight: 'normal'
                    },
                    yoffset: -14
                }),
                attributes: { regionId: region.id, name: region.name }
            }));
        });

        logger.log('[ArcGIS] Markers updated:', markersLayer.graphics.length, 'for', regions.length, 'regions');
    }, [regions, regionProfiles]);

    // Handle selected region fly-to
    useEffect(() => {
        if (!viewRef.current || !selectedRegion) return;
        viewRef.current.goTo(
            { center: [selectedRegion.centroid.lng, selectedRegion.centroid.lat], zoom: 5, tilt: 30 },
            { duration: 1500 }
        );
    }, [selectedRegion]);

    // Listen for 3D/2D view triggers
    useEffect(() => {
        const handle3D = (e: any) => {
            if (!viewRef.current) return;
            const { lng, lat, zoom = 12, pitch = 60, bearing = 0 } = e.detail;
            viewRef.current.goTo(
                { center: [lng, lat], zoom, tilt: pitch, heading: bearing },
                { duration: 2000 }
            );
        };
        const handle2D = (e: any) => {
            if (!viewRef.current) return;
            const { lng, lat, zoom = 3.5 } = e.detail;
            viewRef.current.goTo(
                { center: [lng, lat], zoom, tilt: 0, heading: 0 },
                { duration: 2000 }
            );
        };

        window.addEventListener('trigger3DView', handle3D);
        window.addEventListener('trigger2DView', handle2D);
        return () => {
            window.removeEventListener('trigger3DView', handle3D);
            window.removeEventListener('trigger2DView', handle2D);
        };
    }, []);

    // Legend data per layer
    const LEGEND_DATA = [
        { id: 'precipitation', label: 'Precipitation', unit: 'mm/hr', gradient: 'linear-gradient(to right, #006994, #00bfff, #00ff88, #ffff00, #ff6600, #ff0000)', stops: ['0.1','0.5','1','2','5'] },
        { id: 'temperature', label: 'Land Temp', unit: '°C', gradient: 'linear-gradient(to right, #2c0a4a, #6a0dad, #0000ff, #00bfff, #00ff00, #ffff00, #ff6600, #ff0000, #ffffff)', stops: ['-20','0','20','40','60'] },
        { id: 'vegetation', label: 'Vegetation', unit: 'NDVI', gradient: 'linear-gradient(to right, #5c3d11, #d4a96a, #ffffcc, #78c800, #006400)', stops: ['0','0.25','0.5','0.75','1'] },
        { id: 'dust', label: 'Aerosol Depth', unit: 'AOD', gradient: 'linear-gradient(to right, #fff7e6, #ffd966, #ff8c00, #8b0000)', stops: ['0','0.3','0.6','1'] },
        { id: 'fire_viirs', label: 'Fire Intensity', unit: 'VIIRS', gradient: 'linear-gradient(to right, #ffff00, #ff8c00, #ff0000, #8b0000)', stops: ['Low','Med','High'] },
    ];
    const activeLegends = LEGEND_DATA.filter(l => activeLIds.has(l.id));

    // Slider value (0–totalDays)
    const sliderVal = Math.round((selectedDate.getTime() - dateRangeStart.current.getTime()) / 86400000);

    return (
        <div className="relative w-full h-full">
            <style>{`
                .esri-ui-corner { z-index: 10 !important; }
                .esri-widget--button { background: transparent !important; color: white !important; }
                .esri-attribution { display: none !important; }
            `}</style>

            <div ref={containerRef} className="w-full h-full" />

            {/* Loading */}
            {isLoading && (
                <div className="absolute inset-0 bg-[#050810]/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
                    <Loader2 size={48} className="text-cyan-500 animate-spin" />
                    <div className="mt-4 text-white/80 text-sm font-medium tracking-wide">Loading WHO Climate Scene...</div>
                </div>
            )}

            {/* Layer Toggle Panel */}
            {whoSceneLoaded && (
                <div style={{
                    position: 'absolute', top: 16, left: 16, zIndex: 50,
                    display: 'flex', flexDirection: 'column', gap: 2,
                    background: 'rgba(7,11,22,0.92)',
                    backdropFilter: 'blur(20px)', padding: '10px 8px', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                    maxHeight: 'calc(100% - 32px)', overflowY: 'auto'
                }}>
                    <div style={{ fontSize: 8, fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 6, paddingLeft: 8 }}>
                        WHO Layers
                    </div>
                    {SCENE_LAYER_CONFIG.map(cfg => {
                        const isActive = activeLIds.has(cfg.id);
                        return (
                            <button key={cfg.id} onClick={() => toggleLayer(cfg.id)} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '6px 10px', borderRadius: 8, border: 'none',
                                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                transition: 'all 0.15s ease',
                                background: isActive ? 'rgba(56,189,248,0.12)' : 'transparent',
                                color: isActive ? '#7dd3fc' : 'rgba(100,116,139,0.8)',
                                textAlign: 'left', whiteSpace: 'nowrap'
                            }}>
                                <span style={{ opacity: isActive ? 1 : 0.35, display: 'flex' }}>{cfg.icon}</span>
                                <span style={{ flex: 1 }}>{cfg.label}</span>
                                {isActive
                                    ? <Eye size={11} style={{ opacity: 0.5 }} />
                                    : <EyeOff size={11} style={{ opacity: 0.2 }} />}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Custom TimeSlider — bottom LEFT, under the layers panel ── */}
            {whoSceneLoaded && (
                <div style={{
                    position: 'absolute', bottom: 16, left: 16,
                    zIndex: 50, width: 220,
                    background: 'rgba(7,11,22,0.92)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16,
                    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                    padding: '10px 14px 12px',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 8, fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: 2 }}>Date</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#7dd3fc' }}>{formatDate(selectedDate)}</span>
                    </div>
                    {/* Track */}
                    <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ position: 'absolute', left: 0, width: `${(sliderVal / totalDays) * 100}%`, height: 3, borderRadius: 99, background: 'linear-gradient(to right, #0ea5e9, #38bdf8)' }} />
                        <input type="range" min={0} max={totalDays} value={sliderVal}
                            onChange={e => {
                                const next = new Date(dateRangeStart.current.getTime() + Number(e.target.value) * 86400000);
                                setSelectedDate(next);
                                applyDateToLayers(next);
                            }}
                            style={{ position: 'absolute', width: '100%', opacity: 0, height: 20, cursor: 'pointer', zIndex: 2 }}
                        />
                        <div style={{
                            position: 'absolute', left: `calc(${(sliderVal / totalDays) * 100}% - 6px)`,
                            width: 12, height: 12, borderRadius: '50%',
                            background: '#38bdf8', border: '2px solid rgba(255,255,255,0.9)',
                            boxShadow: '0 0 6px rgba(56,189,248,0.7)', pointerEvents: 'none', zIndex: 1
                        }} />
                    </div>
                    {/* Start / End labels */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 8, color: 'rgba(100,116,139,0.6)', fontWeight: 600 }}>
                            {dateRangeStart.current.toLocaleString('default', { month: 'short' })} {dateRangeStart.current.getDate()}
                        </span>
                        <span style={{ fontSize: 8, color: 'rgba(100,116,139,0.6)', fontWeight: 600 }}>Today</span>
                    </div>
                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button onClick={() => stepDate(-1)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: '4px 7px', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
                            <ChevronLeft size={13} />
                        </button>
                        <button onClick={() => setIsPlaying(p => !p)} style={{
                            background: isPlaying ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isPlaying ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.07)'}`,
                            borderRadius: 7, padding: '4px 12px', cursor: 'pointer',
                            color: isPlaying ? '#38bdf8' : '#64748b',
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800, letterSpacing: 0.5
                        }}>
                            {isPlaying ? <><Pause size={11} /> PAUSE</> : <><Play size={11} /> PLAY</>}
                        </button>
                        <button onClick={() => stepDate(1)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: '4px 7px', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
                            <ChevronRight size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Custom Legend ── */}
            {whoSceneLoaded && (
                <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 50 }}>
                    <button
                        onClick={() => setShowLegend(p => !p)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: showLegend ? 'rgba(56,189,248,0.15)' : 'rgba(7,11,22,0.92)',
                            border: `1px solid ${showLegend ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.07)'}`,
                            borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
                            color: showLegend ? '#38bdf8' : '#64748b', fontSize: 10, fontWeight: 700,
                            backdropFilter: 'blur(20px)', letterSpacing: 1, textTransform: 'uppercase',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                        }}
                    >
                        <BookOpen size={12} />
                        Legend
                    </button>

                    {showLegend && activeLegends.length > 0 && (
                        <div style={{
                            position: 'absolute', bottom: '100%', right: 0, marginBottom: 8,
                            background: 'rgba(7,11,22,0.95)', backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
                            boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
                            padding: '12px 14px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 14
                        }}>
                            <div style={{ fontSize: 8, fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: 2.5 }}>Active Layer Legend</div>
                            {activeLegends.map(l => (
                                <div key={l.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{l.label}</span>
                                        <span style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>{l.unit}</span>
                                    </div>
                                    <div style={{ height: 8, borderRadius: 99, background: l.gradient, marginBottom: 4 }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        {l.stops.map(s => <span key={s} style={{ fontSize: 8, color: '#475569', fontWeight: 600 }}>{s}</span>)}
                                    </div>
                                </div>
                            ))}
                            {activeLegends.length === 0 && (
                                <div style={{ fontSize: 10, color: '#475569' }}>Enable a layer to see its legend</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
