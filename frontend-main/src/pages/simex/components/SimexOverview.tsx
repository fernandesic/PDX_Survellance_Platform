import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import type { SimexType, Props } from "../types/simex";
import { ActivityCard } from "./ActivityCard";

export function SimexOverview({ data }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const tabs = ["SIMEX", "AAR", "IAR", "EAR"];
  const [activeTab, setActiveTab] = useState("SIMEX");

  const [tabData, setTabData] = useState<SimexType | undefined>(
    data.find((item) => item.abrv === "SIMEX")
  );

  useEffect(() => {
    setTabData(data.find((item) => item.abrv === activeTab));
  }, [activeTab, data]);

  return (
    <main className={`space-y-8 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
      <div className={isLight ? 'text-[#1a1a1a] mb-2' : 'text-white mb-2'}>
        <h1 className="text-2xl font-bold">
          Simulation Exercises and Action Reviews Conducted in 2025 In AFRO
        </h1>
        <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-neutral-300'}`}>
          Simulation Exercises, After-Action Reviews, Intra-Action Reviews & Early Action Reviews
        </p>
      </div>

      <div className={`flex flex-wrap mb-6 ${isLight ? 'bg-gray-100' : 'bg-black/30'}`}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium ${activeTab === t
              ? "bg-yellow-500 text-black"
              : isLight
                ? "hover:bg-yellow-100 text-gray-700"
                : "hover:bg-yellow-900/40 text-gray-300"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="">
        <ActivityCard item={tabData} />
      </section>
    </main>
  );
}
