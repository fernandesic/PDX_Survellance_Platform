import { useEffect, useState } from "react";
import type { NewsItem, NewsType } from "@/types";
import { useLocation } from "react-router-dom";
import { useNews } from "@/contexts/NewsProvider";
import { useTheme } from "@/contexts/ThemeContext";

export default function NewsTicker() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { pathname } = useLocation();
  const { newsData, loading, reloadNews } = useNews();

  const [news, setNews] = useState<NewsItem[]>([]);


  useEffect(() => {
    const fetchNews = () => {
      const data: NewsItem[] = [
        { country: "Madagascar", score: 8.5, value: 6372 },
        { country: "Tanzania", score: 8.5, value: 6372 },
        { country: "Kenya", score: 8.5, value: 6372 },
        { country: "Ghana", score: 8.5, value: 6372 },
        { country: "Senegal", score: 8.5, value: 6372 },
      ];
      setNews(data);
    };

    fetchNews();
  }, []);

  const colors: Record<string, string> = {
    "/chw": "bg-[#081D10]",
    "/ihr": "bg-[#091920]",
    "/readiness": "bg-[#1C1607]",
    "/star_tracker": "bg-[#1B0835]",
    "/alerts": "bg-[#202328]",
  };

  const defaultColor = "bg-[#090F1F]";

  const layoutColor = isLight ? "bg-white" : (colors[pathname] || defaultColor);

  return (
    <div className={`relative w-full h-10 overflow-hidden ${layoutColor} ${isLight ? 'text-[#1a1a1a] border border-gray-200' : 'text-white'} flex items-center rounded-md`}>
      <p className={`${layoutColor} z-40 p-3 text-sm ${isLight ? 'text-[#1a1a1a]' : ''}`}>News |</p>
      <div className="absolute left-20 -translate-y-1/2 w-fit whitespace-nowrap flex gap-10 animate-marquee py-1.5">
        {
          (newsData && Object.keys(newsData).length > 0) ? (
            Object.entries(newsData).map(([outerKey, list]: [string, NewsType[]]) => (
              <div className="flex items-center gap-2 text-sm" key={outerKey}>
                <div className={`${isLight ? 'bg-[#0093D5] text-white' : 'text-white bg-yellow-500'} p-3`}>{outerKey.toUpperCase()}</div>
                {list.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-light">{item.key}</span>
                    <span className="opacity-80">{item.value_1}</span>
                    <span className="text-yellow-400 text-xs">▲</span>
                    <span className="opacity-80">{item.value_2}</span>
                  </div>
                ))}
                <div className={`${isLight ? 'bg-[#0093D5] text-white' : 'text-white bg-yellow-500'} p-3`}>{outerKey.toUpperCase()}</div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-10">
              {news.map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-sm">
                  <span className={`${isLight ? 'text-blue-600' : 'text-yellow-500'} font-black`}>{item.country.toUpperCase()}</span>
                  <span className="opacity-80">Security: {item.score}</span>
                  <span className="text-emerald-500 text-xs font-black">LIVE</span>
                  <span className="opacity-80">Vol: {item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
