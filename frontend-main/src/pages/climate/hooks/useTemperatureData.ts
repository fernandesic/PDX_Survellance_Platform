import { useState, useCallback, useRef } from 'react';
import type MapView from '@arcgis/core/views/MapView';
import { webMercatorToGeographic } from "@arcgis/core/geometry/support/webMercatorUtils";
import { fetchRealTemperatureGrid } from '@/pages/climate/services/realTemperatureService';
import { logger } from "@/utils/logger";

export function useTemperatureData(mapView: MapView | null) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const lastFetch = useRef(0);
    const activeFetch = useRef(false);
    const lastExtent = useRef<string>("");

    const fetchData = useCallback(async (view: MapView) => {
        if (activeFetch.current || !view.extent) return;

        // movement detection: only fetch if extent changed significantly
        const currentExtent = `${view.extent.xmin.toFixed(1)},${view.extent.ymin.toFixed(1)},${view.zoom}`;
        if (currentExtent === lastExtent.current && data.length > 0) return;

        // throttle: minimum 5 seconds between successful fetches
        if (Date.now() - lastFetch.current < 5000 && data.length > 0) return;

        let minLat, maxLat, minLng, maxLng;
        const ext = view.extent;

        if (ext.spatialReference.isGeographic) {
            minLat = ext.ymin; maxLat = ext.ymax; minLng = ext.xmin; maxLng = ext.xmax;
        } else {
            const geoExtent = webMercatorToGeographic(ext) as any;
            if (geoExtent) {
                minLat = geoExtent.ymin; maxLat = geoExtent.ymax; minLng = geoExtent.xmin; maxLng = geoExtent.xmax;
            } else {
                minLat = ext.ymin; maxLat = ext.ymax; minLng = ext.xmin; maxLng = ext.xmax;
            }
        }

        activeFetch.current = true;
        setLoading(true);
        lastFetch.current = Date.now();
        lastExtent.current = currentExtent;

        try {
            logger.log('[Heatmap] Fetching grid data for extent...', currentExtent);
            const grid = await fetchRealTemperatureGrid(minLat, maxLat, minLng, maxLng, 6);
            if (grid.length > 0) {
                setData(grid);
            }
        } catch (err) {
            logger.error('Heatmap fetch failed:', err);
        } finally {
            activeFetch.current = false;
            setLoading(false);
        }
    }, [data.length]);

    return { data, loading, fetchData };
}
