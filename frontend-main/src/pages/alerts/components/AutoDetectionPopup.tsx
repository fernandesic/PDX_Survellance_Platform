// @ts-nocheck
import React, { useState } from 'react';
import type { AutoDetection } from '../types';
import { Zap, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface AutoDetectionPopupProps {
  detections: AutoDetection[];
  onClose?: (id: string) => void;
}

export const AutoDetectionPopup: React.FC<AutoDetectionPopupProps> = ({ detections, onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Track minimized state locally so it persists across API polling
  const [isMinimized, setIsMinimized] = useState(false);

  if (detections.length === 0) return null;

  // Minimized logo/button state
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-6 right-20 z-[100] flex items-center justify-center w-14 h-14 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.2)] border transition-all hover:scale-110 group ${isLight ? 'bg-amber-100 border-amber-300 text-amber-600' : 'bg-[#1a150a] border-amber-500/30 text-amber-500'}`}
        title="View AI Anomalies"
      >
        <Zap className="w-6 h-6 fill-current group-hover:animate-pulse" />

        {/* Notification Badge */}
        <span className="absolute -top-1 -right-1 flex h-5 w-5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-[10px] font-bold text-white items-center justify-center border-2 border-[#1a150a]">
            {detections.length}
          </span>
        </span>
      </button>
    );
  }

  // Expanded State
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {/* If there are multiple detections, we can optionally wrap them. For now, matching the original layout */}
      {detections.map(det => (
        <div key={det.id} className={`relative p-6 rounded-2xl shadow-2xl border w-[380px] pointer-events-auto animate-slide-up ${isLight ? 'bg-white border-gray-200 text-[#1a1a1a]' : 'bg-[#0a1128] text-white border-white/10'}`}>
          <button
            onClick={() => setIsMinimized(true)}
            className={`absolute top-4 right-4 transition-colors z-20 p-1.5 rounded-full ${isLight ? 'text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200' : 'text-gray-500 hover:text-white bg-white/5 hover:bg-white/10'}`}
          >
            <X className="w-4 h-4" />
          </button>

          <div className={`flex items-center gap-2 mb-3 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
            <Zap className="w-4 h-4 fill-current" />
            <span className="text-[10px] font-black uppercase tracking-widest">AI Anomaly Detected</span>
          </div>
          <h4 className={`font-black text-base mb-2 tracking-tight ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{det.title}</h4>
          <p className={`text-[13px] font-bold leading-relaxed mb-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{det.description}</p>
          <div className={`flex justify-between items-center pt-3 border-t ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>{det.location}</span>
            <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${isLight ? 'text-red-600 bg-red-50 border-red-200' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>{det.metric}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
