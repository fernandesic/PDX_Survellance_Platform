import { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import Extent from "@arcgis/core/geometry/Extent";
import esriConfig from "@arcgis/core/config";
import { COUNTRIES, EPI_LINKS, riskColorRgba, tierBorderRgba, type StaticCountry } from "./ohData";

esriConfig.portalUrl = "https://www.arcgis.com";

interface Props {
  layers: Record<string, boolean>;
  onCountryHover?: (country: StaticCountry | null, x: number, y: number) => void;
  onCountryClick?: (country: StaticCountry) => void;
  countries?: StaticCountry[];
}

export default function OneHealthMap({ layers, onCountryHover, onCountryClick, countries: countriesProp }: Props) {
  const data = countriesProp && countriesProp.length > 0 ? countriesProp : COUNTRIES;
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const riskLayerRef = useRef<GraphicsLayer | null>(null);
  const alertLayerRef = useRef<GraphicsLayer | null>(null);
  const epiLinkLayerRef = useRef<GraphicsLayer | null>(null);

  useEffect(() => {
    if (!mapDiv.current) return;

    if (import.meta.env.VITE_ARCGIS_API_KEY) {
      esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
    }

    const basemapId = esriConfig.apiKey ? "arcgis-topographic" : "topo";
    const map = new Map({ basemap: basemapId });

    const africaExtent = new Extent({
      xmin: -30, ymin: -40, xmax: 65, ymax: 40,
      spatialReference: { wkid: 4326 },
    });

    const view = new MapView({
      container: mapDiv.current,
      map,
      center: [20, 0],
      zoom: 3.5,
      background: { color: [8, 17, 28, 1] },
      constraints: { minZoom: 2, maxZoom: 10, rotationEnabled: false, geometry: africaExtent },
      ui: { components: ["zoom"] },
    });
    view.ui.move("zoom", "bottom-right");

    const riskLayer = new GraphicsLayer();
    const alertLayer = new GraphicsLayer();
    const epiLinkLayer = new GraphicsLayer();

    map.addMany([riskLayer, epiLinkLayer, alertLayer]);

    viewRef.current = view;
    riskLayerRef.current = riskLayer;
    alertLayerRef.current = alertLayer;
    epiLinkLayerRef.current = epiLinkLayer;

    // Draw risk circles
    data.forEach((c) => {
      const rgba = riskColorRgba(c.risk);
      const borderRgba = tierBorderRgba(c.tier);
      const size = 12 + c.risk * 3;

      const graphic = new Graphic({
        geometry: new Point({ longitude: c.lon, latitude: c.lat }),
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          color: [rgba[0], rgba[1], rgba[2], rgba[3] * 255],
          size: `${size}px`,
          outline: {
            color: [borderRgba[0], borderRgba[1], borderRgba[2], (borderRgba[3] ?? 1) * 255],
            width: c.tier > 0 ? 1.5 : 0.3,
          },
        }),
        attributes: { ...c },
      });
      riskLayer.add(graphic);
    });

    // Draw alert pulsing markers (larger rings for high-tier)
    data.filter((c) => c.tier >= 2 && c.alert).forEach((c) => {
      const borderRgba = tierBorderRgba(c.tier);
      const size = c.tier === 4 ? 24 : c.tier === 3 ? 18 : 14;

      const markerGraphic = new Graphic({
        geometry: new Point({ longitude: c.lon, latitude: c.lat }),
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          color: [borderRgba[0], borderRgba[1], borderRgba[2], 200],
          size: `${size}px`,
          outline: { color: [borderRgba[0], borderRgba[1], borderRgba[2], 150], width: 2 },
        }),
        attributes: { ...c, isAlert: true },
      });
      alertLayer.add(markerGraphic);
    });

    // Draw epi-link lines
    EPI_LINKS.forEach((link) => {
      const from = data.find((c) => c.iso3 === link.from);
      const to = data.find((c) => c.iso3 === link.to);
      if (!from || !to) return;

      const color: [number, number, number, number] =
        link.type === "zoonotic" ? [0, 229, 200, 100] : [79, 142, 247, 100];

      const lineGraphic = new Graphic({
        geometry: new Polyline({
          paths: [[[from.lon, from.lat], [to.lon, to.lat]]],
        }),
        symbol: new SimpleLineSymbol({ color, width: 1.2, style: "dash" }),
      });
      epiLinkLayer.add(lineGraphic);
    });

    // Click handler
    view.on("click", (event) => {
      view.hitTest(event).then((response) => {
        const hit = response.results.find((r) => r.type === "graphic");
        if (hit && hit.type === "graphic" && onCountryClick) {
          const attrs = hit.graphic.attributes;
          if (attrs?.iso3) {
            const country = data.find((c) => c.iso3 === attrs.iso3);
            if (country) onCountryClick(country);
          }
        }
      });
    });

    // Hover handler
    view.on("pointer-move", (event) => {
      view.hitTest(event).then((response) => {
        const hit = response.results.find((r) => r.type === "graphic");
        if (hit && hit.type === "graphic" && hit.graphic.attributes?.iso3) {
          const country = data.find((c) => c.iso3 === hit.graphic.attributes.iso3);
          if (country && onCountryHover) {
            onCountryHover(country, event.x, event.y);
          }
          if (mapDiv.current) mapDiv.current.style.cursor = "pointer";
        } else {
          if (onCountryHover) onCountryHover(null, 0, 0);
          if (mapDiv.current) mapDiv.current.style.cursor = "default";
        }
      });
    });

    return () => {
      view.destroy();
      map.destroy();
    };
  }, []);

  // Toggle layer visibility based on props
  useEffect(() => {
    if (riskLayerRef.current) riskLayerRef.current.visible = layers.spillover !== false;
    if (alertLayerRef.current) alertLayerRef.current.visible = layers.alerts !== false;
    if (epiLinkLayerRef.current) epiLinkLayerRef.current.visible = layers.epilinks === true;
  }, [layers]);

  return (
    <div
      ref={mapDiv}
      className="w-full h-full"
      style={{ background: "#08111c" }}
    />
  );
}
