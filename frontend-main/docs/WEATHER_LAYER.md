# Climate Weather Layer - Developer Notes

## Overview
The climate dashboard now uses **Windy.com embeds** for weather visualization instead of custom canvas or ArcGIS FlowRenderer.

## Files Modified

| File | Changes |
|------|---------|
| `src/components/climate/ClimateMap.tsx` | Added Windy.com iframe overlay |
| `src/components/climate/HeatmapLayer.tsx` | Enhanced particle rendering (backup) |
| `src/services/realTemperatureService.ts` | Fixed wind direction calc |

---

## How It Works

### Current Architecture
```
┌─────────────────────────────────┐
│     Weather Layer Active?       │
├──────────YES─────────┬────NO────┤
│                      │          │
│  Windy.com iframe    │  ArcGIS  │
│  (overlays map)      │  Map     │
│                      │          │
└──────────────────────┴──────────┘
```

### Layer Mapping
| Toolbar Button | Windy Overlay |
|----------------|---------------|
| Temperature 🌡️ | `overlay=temp` |
| Wind 💨 | `overlay=wind` |
| Flood 💧 | `overlay=rain` |

---

## Key Code (ClimateMap.tsx)

```tsx
// Dynamic Windy overlay based on active layer
{(isWindActive || isTempActive || isFloodActive) && (
    <iframe
        src={`https://embed.windy.com/embed2.html?lat=5&lon=20&zoom=3&overlay=${
            isWindActive ? 'wind' : isTempActive ? 'temp' : 'rain'
        }&product=ecmwf`}
        style={{ position: 'absolute', zIndex: 20, ... }}
    />
)}
```

---

## Future Improvements

### To Remove Windy Branding (requires API key)
1. Get free API key from https://api.windy.com
2. Replace iframe with Windy JavaScript API
3. This gives full control over UI elements

### To Use ArcGIS FlowRenderer Instead
1. Get ArcGIS API key from https://developers.arcgis.com
2. Add to `.env` as `VITE_ARCGIS_API_KEY`
3. Uncomment ImageryTileLayer code in ClimateMap.tsx

---

## Dependencies
- Windy.com (free embed, no API key needed)
- ArcGIS JS SDK (for base map)
- Open-Meteo API (for climate data)

---

*Last updated: 2026-02-07*
