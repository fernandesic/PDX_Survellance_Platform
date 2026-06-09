import React, { useMemo } from 'react';
import type { Incident, Signal } from '../types';
import { Sparkles, Target, AlertTriangle, Activity } from 'lucide-react';

interface AlertsKPIProps {
  alerts: Signal[];
  incidents: Incident[];
  autoDetectionsCount: number;
}

export function AlertsKPI({ alerts, incidents, autoDetectionsCount }: AlertsKPIProps) {
  // Compute actionable threats (Critical + High priority alerts)
  const actionableCount = useMemo(() => {
    return alerts.filter(a => {
      const priority = a.priority ?? a.level;
      return priority === 'P1' || priority === 'P2';
    }).length;
  }, [alerts]);

  // Mocking total signals processed based on alerts length to simulate the funnel
  // In a real scenario, this would come from the backend.
  const signalsProcessed = alerts.length * 127 + 342;

  return (
    <div className="flex w-full items-center justify-between gap-4 px-4 py-2" aria-label="Key Performance Indicators">
      <KpiBlock 
        label="Signals Ingested (24h)" 
        value={signalsProcessed.toLocaleString()} 
        icon={<Activity className="h-4 w-4 text-slate-500" />} 
      />
      
      <div className="h-8 w-px bg-white/5" aria-hidden="true" />
      
      <KpiBlock 
        label="AI Auto-Detections" 
        value={autoDetectionsCount.toString()} 
        icon={<Sparkles className="h-4 w-4 text-indigo-400" />} 
      />
      
      <div className="h-8 w-px bg-white/5" aria-hidden="true" />
      
      <KpiBlock 
        label="Actionable Threats" 
        value={actionableCount.toString()} 
        icon={<AlertTriangle className="h-4 w-4 text-amber-400" />} 
      />
      
      <div className="h-8 w-px bg-white/5" aria-hidden="true" />
      
      <KpiBlock 
        label="Active Official Incidents" 
        value={incidents.length.toString()} 
        icon={<Target className="h-4 w-4 text-emerald-400" />} 
      />
    </div>
  );
}

interface KpiBlockProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function KpiBlock({ label, value, icon }: KpiBlockProps) {
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.03]">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <span className="text-lg font-light tracking-tight text-slate-200">
          {value}
        </span>
      </div>
    </div>
  );
}
