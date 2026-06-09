import { useTheme } from "@/contexts/ThemeContext";
import type { SimexType } from "../types/simex";

export function ActivityCard({ item }: { item: SimexType | undefined }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Parse countries for pill layout
  const countries = item?.african_countries_involved
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <div className={`border rounded-xl p-5 flex flex-col justify-between ${isLight ? 'bg-yellow-50 border-yellow-400' : 'bg-[#412207] border-yellow-500/70'}`}>
      <div className="space-y-3 flex flex-row items-center justify-between">
        <h2 className={`text-xl font-semibold ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{item?.category}</h2>
        <div className="flex flex-row gap-2 items-center">
          <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-white'}`}>Conducted AFRO</p>
          <p className="text-4xl font-bold text-yellow-500">
            {item?.conducted_afro}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 ">
        {countries?.map((c, idx) => (
          <span
            key={idx}
            className={`text-xs px-2 py-2 ${isLight ? 'bg-yellow-200 text-gray-800' : 'bg-yellow-700/30 text-gray-200'}`}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
