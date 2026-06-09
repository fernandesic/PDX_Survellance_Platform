/**
 * TenantSwitcher — Super-admin dropdown to switch tenant context.
 *
 * Only visible when `isSuperAdmin` is true.
 * Allows viewing the platform "as" a specific country tenant, or
 * switching back to the continental (all-data) view.
 *
 * When the tenant is switched:
 *  1. activeTenantId is updated in AuthProvider (persisted to localStorage)
 *  2. React Query cache is cleared (handled by AuthProvider.setActiveTenantId)
 *  3. X-Tenant-ID header is injected on subsequent API calls (handled by api.ts interceptor)
 */

import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useTenant } from "@/hooks/useTenant";

/**
 * Hardcoded list of AFRO member states for the switcher.
 * Matches the 48 tenants seeded in the backend (47 countries + 1 AFR continental).
 * The `id` values MUST match the Tenant.id in the production database.
 *
 * NOTE: These are ordered alphabetically. The AFR continental tenant is listed first.
 */
const AFRO_TENANTS = [
  { id: 1, name: "WHO AFRO Continental", iso_code: "AFR" },
  { id: 2, name: "Algeria", iso_code: "DZA" },
  { id: 3, name: "Angola", iso_code: "AGO" },
  { id: 4, name: "Benin", iso_code: "BEN" },
  { id: 5, name: "Botswana", iso_code: "BWA" },
  { id: 6, name: "Burkina Faso", iso_code: "BFA" },
  { id: 7, name: "Burundi", iso_code: "BDI" },
  { id: 8, name: "Cabo Verde", iso_code: "CPV" },
  { id: 9, name: "Cameroon", iso_code: "CMR" },
  { id: 10, name: "Central African Republic", iso_code: "CAF" },
  { id: 11, name: "Chad", iso_code: "TCD" },
  { id: 12, name: "Comoros", iso_code: "COM" },
  { id: 13, name: "Congo", iso_code: "COG" },
  { id: 14, name: "Côte d'Ivoire", iso_code: "CIV" },
  { id: 15, name: "Democratic Republic of the Congo", iso_code: "COD" },
  { id: 16, name: "Equatorial Guinea", iso_code: "GNQ" },
  { id: 17, name: "Eritrea", iso_code: "ERI" },
  { id: 18, name: "Eswatini", iso_code: "SWZ" },
  { id: 19, name: "Ethiopia", iso_code: "ETH" },
  { id: 20, name: "Gabon", iso_code: "GAB" },
  { id: 21, name: "Gambia", iso_code: "GMB" },
  { id: 22, name: "Ghana", iso_code: "GHA" },
  { id: 23, name: "Guinea", iso_code: "GIN" },
  { id: 24, name: "Guinea-Bissau", iso_code: "GNB" },
  { id: 25, name: "Kenya", iso_code: "KEN" },
  { id: 26, name: "Lesotho", iso_code: "LSO" },
  { id: 27, name: "Liberia", iso_code: "LBR" },
  { id: 28, name: "Madagascar", iso_code: "MDG" },
  { id: 29, name: "Malawi", iso_code: "MWI" },
  { id: 30, name: "Mali", iso_code: "MLI" },
  { id: 31, name: "Mauritania", iso_code: "MRT" },
  { id: 32, name: "Mauritius", iso_code: "MUS" },
  { id: 33, name: "Mozambique", iso_code: "MOZ" },
  { id: 34, name: "Namibia", iso_code: "NAM" },
  { id: 35, name: "Niger", iso_code: "NER" },
  { id: 36, name: "Nigeria", iso_code: "NGA" },
  { id: 37, name: "Rwanda", iso_code: "RWA" },
  { id: 38, name: "Sao Tome and Principe", iso_code: "STP" },
  { id: 39, name: "Senegal", iso_code: "SEN" },
  { id: 40, name: "Seychelles", iso_code: "SYC" },
  { id: 41, name: "Sierra Leone", iso_code: "SLE" },
  { id: 42, name: "South Africa", iso_code: "ZAF" },
  { id: 43, name: "South Sudan", iso_code: "SSD" },
  { id: 44, name: "Togo", iso_code: "TGO" },
  { id: 45, name: "Uganda", iso_code: "UGA" },
  { id: 46, name: "United Republic of Tanzania", iso_code: "TZA" },
  { id: 47, name: "Zambia", iso_code: "ZMB" },
  { id: 48, name: "Zimbabwe", iso_code: "ZWE" },
];

export default function TenantSwitcher() {
  const { isSuperAdmin, activeTenantId, setActiveTenantId } = useTenant();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Only render for super admins
  if (!isSuperAdmin) return null;

  const activeTenant = activeTenantId
    ? AFRO_TENANTS.find((t) => t.id === activeTenantId)
    : null;

  const filtered = AFRO_TENANTS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.iso_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (id: number | null) => {
    setActiveTenantId(id);
    setIsOpen(false);
    setSearch("");
  };

  const displayLabel = activeTenant
    ? `${activeTenant.iso_code} · ${activeTenant.name}`
    : "All Countries";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        id="tenant-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 border
          ${activeTenant
            ? (isLight
                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20')
            : (isLight
                ? 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10')
          }`}
        title="Switch tenant context"
      >
        <Globe size={12} />
        <span className="max-w-[140px] truncate">{displayLabel}</span>
        <ChevronDown size={11} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 right-0 w-[280px] rounded-xl shadow-2xl border overflow-hidden z-[9999]
            ${isLight ? 'bg-white border-gray-200' : 'bg-[#111827] border-white/10'}`}
        >
          {/* Header */}
          <div className={`px-3 py-2.5 border-b flex items-center justify-between
            ${isLight ? 'border-gray-100' : 'border-white/5'}`}
          >
            <span className={`text-[11px] font-semibold uppercase tracking-wider
              ${isLight ? 'text-gray-500' : 'text-gray-400'}`}
            >
              View as Tenant
            </span>
            {activeTenant && (
              <button
                onClick={() => handleSelect(null)}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded
                  ${isLight ? 'text-gray-400 hover:bg-gray-100' : 'text-gray-500 hover:bg-white/5'}`}
                title="Reset to all countries"
              >
                <X size={10} />
                Reset
              </button>
            )}
          </div>

          {/* Search */}
          <div className={`px-3 py-2 border-b ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
            <input
              type="text"
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full text-xs px-2 py-1.5 rounded-md outline-none border
                ${isLight
                  ? 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-blue-300'
                  : 'bg-white/5 border-white/10 text-gray-200 placeholder:text-gray-500 focus:border-cyan-500/30'
                }`}
              autoFocus
            />
          </div>

          {/* "All Countries" option */}
          <div className="max-h-[280px] overflow-y-auto">
            <button
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors
                ${!activeTenant
                  ? (isLight ? 'bg-blue-50 text-blue-700' : 'bg-cyan-500/10 text-cyan-400')
                  : (isLight ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-400 hover:bg-white/[0.03]')
                }`}
            >
              <Globe size={12} />
              <span className="flex-1 text-left font-medium">All Countries (Continental)</span>
              {!activeTenant && <Check size={12} />}
            </button>

            <div className={`h-px ${isLight ? 'bg-gray-100' : 'bg-white/5'}`} />

            {/* Country list */}
            {filtered
              .filter((t) => t.iso_code !== "AFR")
              .map((t) => {
                const isActive = activeTenantId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors
                      ${isActive
                        ? (isLight ? 'bg-blue-50 text-blue-700' : 'bg-cyan-500/10 text-cyan-400')
                        : (isLight ? 'text-gray-600 hover:bg-gray-50' : 'text-gray-400 hover:bg-white/[0.03]')
                      }`}
                  >
                    <span className={`w-7 text-[10px] font-mono flex-shrink-0 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t.iso_code}
                    </span>
                    <span className="flex-1 text-left truncate">{t.name}</span>
                    {isActive && <Check size={12} />}
                  </button>
                );
              })}

            {filtered.filter((t) => t.iso_code !== "AFR").length === 0 && (
              <div className={`px-3 py-4 text-center text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                No matching countries
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
