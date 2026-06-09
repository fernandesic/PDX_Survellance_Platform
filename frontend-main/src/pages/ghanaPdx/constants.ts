import {
  LayoutGrid, Shield, Users, AlertTriangle, MapPin,
  Bell, Brain, FileText,
} from 'lucide-react';

/* ─── Ghana Identity ─── */
export const GHANA_COUNTRY_NAME = "Ghana";
export const GHANA_ISO  = "GHA";
export const GHANA_ISO2 = "GH";

/** Ghana map bounding box (lat 4.5°–11.2°N, lon 3.3°W–1.2°E) */
export const GHANA_BOUNDS = {
  center: { lat: 7.9465, lng: -1.0232 },
  north: 11.2,
  south: 4.5,
  west: -3.3,
  east: 1.2,
} as const;

/* ─── Tab Definitions ─── */
export const GHANA_TABS = [
  { id: "overview",    label: "Overview",      icon: LayoutGrid },
  { id: "ihr",         label: "IHR",           icon: Shield },
  { id: "chw",         label: "CHW",           icon: Users },
  { id: "readiness",   label: "Readiness",     icon: AlertTriangle },
  { id: "star",        label: "STAR Tracker",  icon: MapPin },
  { id: "alerts",      label: "Alerts",        icon: Bell },
  { id: "predictions", label: "Predictions",   icon: Brain },
  { id: "ihmref",      label: "IHMREF",        icon: FileText },
] as const;

export type GhanaTabId = typeof GHANA_TABS[number]['id'];
