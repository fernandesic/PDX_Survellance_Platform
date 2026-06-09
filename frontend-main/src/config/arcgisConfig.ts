import esriConfig from "@arcgis/core/config.js";

export const initializeArcGIS = (apiKey?: string) => {
    if (apiKey) {
        esriConfig.apiKey = apiKey;
    }



    esriConfig.request.useIdentity = false;
};

export const DEFAULT_MAP_CONFIG = {
    center: {
        longitude: 20,
        latitude: -3,
        zoom: 3.5
    },

    africaBounds: {
        xmin: -20,
        ymin: -35,
        xmax: 55,
        ymax: 25
    },

    basemap: "gray-vector",

    minZoom: 2.5,
    maxZoom: 8
};
