import { useRef } from 'react';
import type { StarTickerAlert } from '@/types';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface StarTickerProps {
    alerts: StarTickerAlert[];
}

export default function StarTicker({ alerts }: StarTickerProps) {
    const tickerRef = useRef<HTMLDivElement>(null);


    const getRiskStyle = (level: string) => {
        const lowerLevel = level?.toLowerCase() || '';
        if (lowerLevel.includes('very high')) {
            return { color: 'text-red-500', bg: 'bg-red-500/20', icon: TrendingUp, arrow: '▲▲' };
        }
        if (lowerLevel.includes('high')) {
            return { color: 'text-orange-500', bg: 'bg-orange-500/20', icon: TrendingUp, arrow: '▲' };
        }
        if (lowerLevel.includes('moderate')) {
            return { color: 'text-yellow-500', bg: 'bg-yellow-500/20', icon: null, arrow: '–' };
        }
        if (lowerLevel.includes('very low')) {
            return { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: TrendingDown, arrow: '▼▼' };
        }
        if (lowerLevel.includes('low')) {
            return { color: 'text-green-500', bg: 'bg-green-500/20', icon: TrendingDown, arrow: '▼' };
        }
        return { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: null, arrow: '' };
    };

    if (!alerts || alerts.length === 0) return null;


    const displayAlerts = [...alerts, ...alerts];

    return (
        <div className="bg-[#0a0f1a] rounded-lg border border-white/5 overflow-hidden mb-4">

            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-red-900/30 to-orange-900/20 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-semibold text-white">STAR RISK ALERTS</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1 text-red-400">
                        <span>▲▲</span> Very High
                    </span>
                    <span className="flex items-center gap-1 text-orange-400">
                        <span>▲</span> High
                    </span>
                    <span className="flex items-center gap-1 text-yellow-400">
                        <span>–</span> Moderate
                    </span>
                    <span className="flex items-center gap-1 text-green-400">
                        <span>▼</span> Low
                    </span>
                </div>
            </div>


            <div className="relative overflow-hidden py-3">
                <div
                    ref={tickerRef}
                    className="flex animate-scroll-left whitespace-nowrap"
                    style={{
                        animation: 'scrollLeft 30s linear infinite',
                    }}
                >
                    {displayAlerts.map((alert, idx) => {
                        const style = getRiskStyle(alert.risk_level);
                        return (
                            <div
                                key={idx}
                                className={`inline-flex items-center gap-2 mx-4 px-3 py-1.5 rounded-md ${style.bg} border border-white/5`}
                            >

                                <span className={`font-mono font-bold text-sm ${style.color}`}>
                                    {alert.code}
                                </span>


                                <span className="text-gray-600">|</span>


                                <span className="text-white text-xs font-medium max-w-[120px] truncate">
                                    {alert.hazard}
                                </span>


                                <span className={`text-xs font-bold ${style.color}`}>
                                    {style.arrow}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>


            <style>{`
        @keyframes scrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-left {
          animation: scrollLeft 30s linear infinite;
        }
        .animate-scroll-left:hover {
          animation-play-state: paused;
        }
      `}</style>
        </div>
    );
}
