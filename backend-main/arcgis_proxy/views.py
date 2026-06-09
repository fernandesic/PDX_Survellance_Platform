import hashlib
import requests
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

# ── Security: only allow these ArcGIS base URLs ─────────────────────
ALLOWED_BASES = [
    "https://services.arcgis.com/5T5nSi527N4F7luB/",
    "https://services8.arcgis.com/oTalEaSXAuyNT7xf/",
    "https://services.arcgis.com/P3ePLMYs2RVChkJx/",
    "https://services.arcgis.com/Vr4pJuhEJB9F4bUA/",
]

WHO_WEBMAP_URL = (
    "https://who.maps.arcgis.com/sharing/rest/content/items/"
    "c63cab4e6fc643269e67e70121e27dbf/data?f=json"
)

CHW_WEBMAP_ID = "b475a009f2aa4dffb9bfd0c7cc06ea0c"
POE_WEBMAP_ID = "c43b68ef49624a269422af37b45ac639"
IHR_POE_WEBMAP_ID = "d7eae467485841b69c8f38f2c45217d2"
ESPAR_WEBMAP_IDS = {
    "espar_1": "19a4e7d5ea724b248d8c1b95a2590e7a",
    "espar_2": "b4735f2969dd478bba6c3e2ef777d960",
    "espar_3": "d15cd72b73e74c50b1644d191282555d",
}

CACHE_TTL = 600  # 10 minutes


def _cache_key(prefix: str, *args: str) -> str:
    raw = "|".join(args)
    return f"arcgis_{prefix}_{hashlib.md5(raw.encode()).hexdigest()}"


class ArcGISQueryProxyView(APIView):
    """
    Cached proxy for ArcGIS FeatureServer /query endpoint.

    GET /api/v1/arcgis/query?layer_url=<url>&where=<expr>&out_fields=<fields>&result_offset=<n>&result_count=<n>
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        layer_url = request.query_params.get("layer_url", "").strip()
        if not layer_url:
            return Response(
                {"error": "layer_url is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Security check
        if not any(layer_url.startswith(base) for base in ALLOWED_BASES):
            return Response(
                {"error": "URL not in allowed list"},
                status=status.HTTP_403_FORBIDDEN,
            )

        where = request.query_params.get("where", "1=1")
        out_fields = request.query_params.get("out_fields", "*")
        result_offset = request.query_params.get("result_offset", "0")
        result_count = request.query_params.get("result_count", "2000")
        return_geometry = request.query_params.get("return_geometry", "true")

        key = _cache_key("query", layer_url, where, out_fields, result_offset, result_count, return_geometry)
        data = cache.get(key)

        if data is None:
            try:
                resp = requests.get(
                    f"{layer_url}/query",
                    params={
                        "f": "json",
                        "where": where,
                        "outFields": out_fields,
                        "returnGeometry": return_geometry,
                        "outSR": "4326",
                        "resultRecordCount": result_count,
                        "resultOffset": result_offset,
                    },
                    timeout=60,
                )
                resp.raise_for_status()
                data = resp.json()
                cache.set(key, data, CACHE_TTL)
            except requests.RequestException as e:
                return Response(
                    {"error": f"ArcGIS request failed: {str(e)}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        return Response(data)


class ArcGISWebMapView(APIView):
    """
    Returns the operational layers from the WHO WebMap config.

    GET /api/v1/arcgis/webmap
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        map_id = request.query_params.get("map_id", "").strip()
        
        # Determine URL
        if map_id == "chw":
            url = f"https://www.arcgis.com/sharing/rest/content/items/{CHW_WEBMAP_ID}/data?f=json"
            key = f"arcgis_webmap_layers_{CHW_WEBMAP_ID}"
        elif map_id == "poe":
            url = f"https://who.maps.arcgis.com/sharing/rest/content/items/{POE_WEBMAP_ID}/data?f=json"
            key = f"arcgis_webmap_layers_{POE_WEBMAP_ID}"
        elif map_id == "poe_ihr":
            url = f"https://who.maps.arcgis.com/sharing/rest/content/items/{IHR_POE_WEBMAP_ID}/data?f=json"
            key = f"arcgis_webmap_layers_{IHR_POE_WEBMAP_ID}"
        elif map_id in ESPAR_WEBMAP_IDS:
            actual_id = ESPAR_WEBMAP_IDS[map_id]
            url = f"https://www.arcgis.com/sharing/rest/content/items/{actual_id}/data?f=json"
            key = f"arcgis_webmap_layers_{actual_id}"
        elif map_id:
            url = f"https://www.arcgis.com/sharing/rest/content/items/{map_id}/data?f=json"
            key = f"arcgis_webmap_layers_{map_id}"
        else:
            url = WHO_WEBMAP_URL
            key = "arcgis_webmap_layers"

        data = cache.get(key)

        if data is None:
            try:
                resp = requests.get(url, timeout=30)
                resp.raise_for_status()
                webmap = resp.json()
                def flatten_layers(layers):
                    result = []
                    for layer in layers:
                        if layer.get("layerType") == "GroupLayer":
                            result.extend(flatten_layers(layer.get("layers", [])))
                        else:
                            # Return more metadata as recommended by Handoff Pack
                            result.append({
                                "id": layer.get("id"),
                                "title": layer.get("title"),
                                "url": layer.get("url"),
                                "layerType": layer.get("layerType"),
                                "itemId": layer.get("itemId"),
                                "visibility": layer.get("visibility"),
                                "opacity": layer.get("opacity", 1),
                                "layerDefinition": layer.get("layerDefinition", {}),
                                "popupInfo": layer.get("popupInfo", {}),
                            })
                    return result

                data = flatten_layers(webmap.get("operationalLayers", []))
                cache.set(key, data, CACHE_TTL * 9)  # 90 min — rarely changes
            except requests.RequestException as e:
                return Response(
                    {"error": f"WebMap request failed: {str(e)}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        return Response(data)
