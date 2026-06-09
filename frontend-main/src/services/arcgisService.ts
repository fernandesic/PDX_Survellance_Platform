import { logger } from "@/utils/logger";
import { apiGet } from "@/lib/api";

export type ArcGISAttributeValue = unknown;

export interface ArcGISSymbol {
    type?: string;
    color: number[];
    outline?: { color?: number[]; width?: number };
    size?: number;
    style?: string;
}

export interface ArcGISGeometry {
    x?: number;
    y?: number;
    rings?: number[][][];
    paths?: number[][][];
    spatialReference?: ArcGISSpatialReference;
}

export interface ArcGISSpatialReference {
    wkid?: number;
    latestWkid?: number;
}

export interface ArcGISField {
    name: string;
    type?: string;
    alias?: string;
    length?: number;
}

export interface ArcGISFeature {
    attributes: Record<string, ArcGISAttributeValue>;
    geometry: ArcGISGeometry;
}

export interface ArcGISQueryResponse {
    features: ArcGISFeature[];
    fields: ArcGISField[];
    spatialReference: ArcGISSpatialReference;
    objectIdField?: string;
}

export interface ArcGISUniqueValueInfo {
    value: string | number;
    label: string;
    symbol: ArcGISSymbol;
}

export interface ArcGISPopupInfo {
    title?: string;
    description?: string;
    fieldInfos?: Array<{ fieldName: string; label?: string; visible?: boolean }>;
}

export interface ArcGISWebMapLayer {
    id: string;
    title: string;
    url: string;
    layerType: string;
    itemId?: string;
    visibility?: boolean;
    opacity?: number;
    layerDefinition?: {
        drawingInfo?: {
            renderer?: {
                type: string;
                field: string;
                classBreakInfos?: Array<{
                    symbol: ArcGISSymbol;
                    classMaxValue: number;
                    label: string;
                }>;
                uniqueValueInfos?: ArcGISUniqueValueInfo[];
            };
        };
    };
    popupInfo?: ArcGISPopupInfo;
}

export const arcgisService = {
    /**
     * Fetch layers from the WHO WebMap config through the backend proxy.
     */
    async getWebMapLayers(mapId?: string): Promise<ArcGISWebMapLayer[]> {
        try {
            return await apiGet("/arcgis/webmap/", {
                params: { map_id: mapId }
            });
        } catch (error) {
            logger.error("Error fetching WebMap layers:", error);
            throw error;
        }
    },

    /**
     * Query features from an ArcGIS FeatureLayer through the backend proxy.
     * Use this for PAMI data layers to benefit from backend caching.
     */
    async queryLayer(
        layerUrl: string,
        params: {
            where?: string;
            outFields?: string;
            returnGeometry?: boolean;
            resultRecordCount?: number;
            resultOffset?: number;
        } = {}
    ): Promise<ArcGISQueryResponse> {
        try {
            return await apiGet("/arcgis/query/", {
                params: {
                    layer_url: layerUrl,
                    where: params.where || "1=1",
                    out_fields: params.outFields || "*",
                    return_geometry: params.returnGeometry !== false ? "true" : "false",
                    result_count: params.resultRecordCount || 2000,
                    result_offset: params.resultOffset || 0,
                },
            });
        } catch (error) {
            logger.error(`Error querying ArcGIS layer (${layerUrl}):`, error);
            throw error;
        }
    }
};
