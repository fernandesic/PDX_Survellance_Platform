import { capitalize } from "@/utils";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface DropdownProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: string[];
  flat?: boolean;
  bgColor?: string;
  showLabel?: boolean;
  allowEmptyDefault?: boolean;
}

export default function Dropdown({ label, showLabel = true, value, onChange, items, flat = true, bgColor = '#0c7be910', allowEmptyDefault = true }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isLightTheme = theme === 'light';


  const isLightBg = bgColor ? (
    bgColor.startsWith('#eff') ||
    bgColor.startsWith('#f') ||
    bgColor.includes('255') ||
    bgColor.toLowerCase().includes('white') ||
    bgColor.toLowerCase() === '#eff6ff' ||
    parseInt(bgColor.replace('#', '').substring(0, 2), 16) > 200
  ) : false;

  const textColor = isLightBg ? 'text-gray-900' : 'text-white';
  const labelColor = isLightTheme ? 'text-gray-700' : 'text-gray-400';
  const dropdownBgColor = isLightBg ? 'bg-white' : 'bg-[#0d1424]';
  const dropdownBorderColor = isLightBg ? 'border-gray-200' : 'border-white/10';
  const hoverBgColor = isLightBg ? 'hover:bg-gray-100' : 'hover:bg-white/10';
  const selectedBgColor = isLightBg ? 'bg-blue-50' : 'bg-white/5';
  const selectedTextColor = isLightBg ? 'text-blue-600' : 'text-cyan-400';
  const itemTextColor = isLightBg ? 'text-gray-700' : 'text-white';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
  };

  const displayValue = value ? capitalize(value.trim()) : `All ${label}`;

  return (
    <div className={`w-full ${flat ? 'flex gap-2 items-center' : ''}`} ref={dropdownRef}>
      {showLabel && <p className={`text-sm mb-1 ${labelColor}`}>{label}</p>}

      <div className="relative w-full">
        <div
          className={`w-full px-4 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer text-sm ${textColor}`}
          style={{ backgroundColor: bgColor }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div
            className={`absolute z-50 top-full left-0 right-0 mt-1 ${dropdownBgColor} border ${dropdownBorderColor} rounded-lg shadow-xl overflow-hidden`}
          >
            <div className="max-h-96 overflow-y-auto">
              {allowEmptyDefault && (
                <div
                  className={`px-4 py-2 text-sm cursor-pointer ${hoverBgColor} transition-colors ${!value ? `${selectedBgColor} ${selectedTextColor}` : itemTextColor}`}
                  onClick={() => handleSelect("")}
                >
                  {!value && '✓ '}All {label}
                </div>
              )}
              {items.map((item) => (
                <div
                  key={item.trim()}
                  className={`px-4 py-2 text-sm cursor-pointer ${hoverBgColor} transition-colors ${value === item.trim() ? `${selectedBgColor} ${selectedTextColor}` : itemTextColor}`}
                  onClick={() => handleSelect(item.trim())}
                >
                  {value === item.trim() && '✓ '}{capitalize(item.trim())}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}