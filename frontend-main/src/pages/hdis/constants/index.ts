import {
    Activity, Flame, Syringe, Shield, Heart,
    Users, CloudRain, Handshake, Cross,
    Truck, Search, Beaker
} from "lucide-react";

export const RISK_COLORS: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
    monitoring: "#64748b",
};

export const RISK_ORDER: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    monitoring: 0,
};

export const PILLAR_CFG: Record<string, {
    label: string;
    icon: any;
    color: string;
    bg: string;
}> = {
    outbreak: { label: "Outbreak", icon: Activity, color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
    conflict: { label: "Conflict", icon: Flame, color: "#f97316", bg: "rgba(249,115,22,0.08)" },
    vaccine: { label: "Vaccine", icon: Syringe, color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
    policy: { label: "Policy", icon: Shield, color: "#a855f7", bg: "rgba(168,85,247,0.08)" },
    funding: { label: "Funding", icon: Heart, color: "#10b981", bg: "rgba(16,185,129,0.08)" },
    workforce: { label: "Workforce", icon: Users, color: "#06b6d4", bg: "rgba(6,182,212,0.08)" },
    climate: { label: "Climate", icon: CloudRain, color: "#14b8a6", bg: "rgba(20,184,166,0.08)" },
    agreement: { label: "Agreement", icon: Handshake, color: "#6366f1", bg: "rgba(99,102,241,0.08)" },
    uhc: { label: "UHC", icon: Cross, color: "#ec4899", bg: "rgba(236,72,153,0.08)" },
    osl: { label: "OSL", icon: Truck, color: "#9ca3af", bg: "rgba(156,163,175,0.08)" },
    surveillance: { label: "Surveillance", icon: Search, color: "#facc15", bg: "rgba(250,204,21,0.08)" },
    laboratory: { label: "Laboratory", icon: Beaker, color: "#2dd4bf", bg: "rgba(45,212,191,0.08)" },
};

export const REGIONS: Record<string, string[]> = {
    "East": ["KEN", "UGA", "TZA", "RWA", "BDI", "ETH", "ERI", "SSD", "SOM", "DJI"],
    "West Africa": ["NGA", "GHA", "SEN", "CIV", "MLI", "BFA", "NER", "BEN", "TGO", "SLE", "LBR", "GIN", "GNB", "GMB", "CPV"],
    "Southern": ["ZAF", "ZMB", "ZWE", "MOZ", "MWI", "BWA", "NAM", "LSO", "SWZ", "MDG", "AGO"],
    "Central": ["COD", "COG", "CMR", "CAF", "TCD", "GAB", "GNQ"],
    "North": ["DZA", "EGY", "LBY", "MAR", "TUN", "MRT", "SDN"],
};

export const REGIONAL_BLOCS: Record<string, { label: string; members: string[]; color: string }> = {
    EAC: { label: "East African Community", members: ["KEN", "UGA", "TZA", "RWA", "BDI", "SSD", "COD", "SOM", "ETH"], color: "#3b82f6" },
    ECOWAS: { label: "ECOWAS", members: ["NGA", "GHA", "SEN", "CIV", "MLI", "BFA", "NER", "BEN", "TGO", "SLE", "LBR", "GIN", "GNB", "GMB", "CPV"], color: "#10b981" },
    SADC: { label: "SADC", members: ["ZAF", "ZMB", "ZWE", "MOZ", "MWI", "BWA", "NAM", "LSO", "SWZ", "MDG", "AGO", "TZA", "COD"], color: "#f59e0b" },
    ECCAS: { label: "ECCAS", members: ["COD", "COG", "CMR", "CAF", "TCD", "GAB", "GNQ", "BDI", "RWA", "AGO"], color: "#a855f7" },
    AMU: { label: "Arab Maghreb Union", members: ["DZA", "LBY", "MAR", "TUN", "MRT"], color: "#06b6d4" },
};

export const DIPLOMATIC_PILLARS = {
    vaccine_diplomacy: ["vaccine"],
    resource_allocation: ["funding"],
    partnership: ["agreement", "policy"],
    instability: ["conflict", "outbreak"],
} as const;

