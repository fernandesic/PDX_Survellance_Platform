/**
 * GhanaPredictionsTab — Outbreak predictions for Ghana
 *
 * Enhanced with:
 *  - Visual risk score gauge per disease
 *  - Component score breakdown bars (STAR, Climate, Sentinel, ESPAR, Readiness)
 *  - Predicted cases horizon display
 *  - Confidence interval visualization
 */
import { useTheme } from '@/contexts/ThemeContext';
import { useGhanaPredictions, useGhanaCountryForecast } from '../../hooks/useGhanaData';
import { Loader2, Brain, AlertTriangle, Info, ShieldAlert, Thermometer, Radio, ClipboardCheck, Bug } from 'lucide-react';

export default function GhanaPredictionsTab() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { data: predictions, isLoading: predLoading } = useGhanaPredictions();
  const { data: forecast, isError: forecastErrored } = useGhanaCountryForecast();

  const preds = (predictions ?? []) as any[];
  const forecastData = forecast as any;

  if (predLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const riskColor = (level: string) => {
    const l = level?.toLowerCase();
    if (l === 'critical') return { text: 'text-red-400', bg: 'bg-red-500', badge: 'bg-red-500/10 text-red-400 border-red-500/20', bar: '#ef4444' };
    if (l === 'high') return { text: 'text-orange-400', bg: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', bar: '#f97316' };
    if (l === 'medium') return { text: 'text-yellow-400', bg: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', bar: '#eab308' };
    return { text: 'text-green-400', bg: 'bg-green-500', badge: 'bg-green-500/10 text-green-400 border-green-500/20', bar: '#22c55e' };
  };

  // Group by risk level for summary
  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const avgRisk = preds.length ? preds.reduce((s, p) => s + (p.composite_risk_score ?? 0), 0) / preds.length : 0;
  preds.forEach(p => {
    const l = (p.risk_level || 'low').toLowerCase() as keyof typeof riskCounts;
    if (l in riskCounts) riskCounts[l]++;
  });

  const componentMeta = [
    { key: 'star_score', label: 'STAR', icon: AlertTriangle, color: '#f97316' },
    { key: 'climate_score', label: 'Climate', icon: Thermometer, color: '#06b6d4' },
    { key: 'sentinel_score', label: 'Sentinel', icon: Radio, color: '#8b5cf6' },
    { key: 'espar_score', label: 'ESPAR', icon: ShieldAlert, color: '#22c55e' },
    { key: 'readiness_score', label: 'Readiness', icon: ClipboardCheck, color: '#eab308' },
  ];

  return (
    <div className="flex flex-col h-full gap-4 pb-2">
      {/* Top: Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        <div className={`rounded-xl border p-3 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Diseases Tracked</p>
          <p className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{preds.length}</p>
        </div>
        <div className={`rounded-xl border p-3 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Avg Risk Score</p>
          <p className={`text-2xl font-bold ${avgRisk >= 60 ? 'text-red-400' : avgRisk >= 40 ? 'text-yellow-400' : 'text-green-400'}`}>
            {avgRisk.toFixed(1)}
          </p>
        </div>
        {(['critical', 'high', 'medium', 'low'] as const).map(level => (
          <div key={level} className={`rounded-xl border p-3 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{level}</p>
            <p className={`text-2xl font-bold ${riskColor(level).text}`}>{riskCounts[level]}</p>
          </div>
        ))}
      </div>

      {/* Forecast info bar */}
      {forecastErrored && (
        <div className={`rounded-lg border p-3 flex items-start gap-2 shrink-0 ${isLight ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/5 border-amber-500/20 text-amber-300'}`}>
          <Info size={14} className="mt-0.5 shrink-0" />
          <p className="text-[11px] leading-relaxed">
            National-level ML forecast data for Ghana is not yet available. The risk predictions below use the composite scoring engine (STAR + Climate + Sentinel + ESPAR + Readiness).
          </p>
        </div>
      )}

      {preds.length === 0 ? (
        <div className={`text-center py-12 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
          <Brain size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No prediction data available for Ghana</p>
        </div>
      ) : (
        /* Disease cards grid */
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {preds
              .sort((a: any, b: any) => (b.composite_risk_score ?? 0) - (a.composite_risk_score ?? 0))
              .map((pred: any, idx: number) => {
                const rc = riskColor(pred.risk_level);
                const score = pred.composite_risk_score ?? 0;
                return (
                  <div
                    key={pred.id ?? idx}
                    className={`rounded-xl border p-4 transition-all hover:shadow-lg ${
                      isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Header: Disease name + risk badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Bug size={16} className={rc.text} />
                        <span className={`text-sm font-bold capitalize ${isLight ? 'text-gray-800' : 'text-white'}`}>
                          {pred.disease_name || 'Unknown'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${rc.badge}`}>
                        {pred.risk_level || 'MEDIUM'}
                      </span>
                    </div>

                    {/* Risk score gauge */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`relative w-14 h-14 rounded-full flex items-center justify-center ${isLight ? 'bg-gray-50' : 'bg-white/5'}`}>
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke={isLight ? '#e5e7eb' : '#1e293b'} strokeWidth="4" />
                          <circle
                            cx="28" cy="28" r="24" fill="none"
                            stroke={rc.bar}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${(score / 100) * 150.8} 150.8`}
                          />
                        </svg>
                        <span className={`text-xs font-bold ${rc.text}`}>{score.toFixed(0)}</span>
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className={`text-[10px] uppercase tracking-wider font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                          Confidence: {pred.confidence != null ? `${Math.round(pred.confidence)}%` : '—'}
                        </p>
                        {pred.confidence_lower != null && pred.confidence_upper != null && (
                          <div className="flex items-center gap-1.5">
                            <div className={`flex-1 h-1.5 rounded-full relative overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-white/10'}`}>
                              <div
                                className="absolute h-full rounded-full opacity-40"
                                style={{
                                  left: `${pred.confidence_lower}%`,
                                  width: `${pred.confidence_upper - pred.confidence_lower}%`,
                                  backgroundColor: rc.bar,
                                }}
                              />
                              <div
                                className="absolute h-full w-0.5 rounded"
                                style={{ left: `${pred.confidence}%`, backgroundColor: rc.bar }}
                              />
                            </div>
                            <span className={`text-[9px] font-mono shrink-0 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                              {pred.confidence_lower.toFixed(0)}–{pred.confidence_upper.toFixed(0)}%
                            </span>
                          </div>
                        )}
                        {pred.prediction_date && (
                          <p className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                            Predicted: {new Date(pred.prediction_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Component score breakdown */}
                    <div className="space-y-1.5">
                      <p className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Component Scores</p>
                      {componentMeta.map(cm => {
                        const val = pred[cm.key] ?? 0;
                        return (
                          <div key={cm.key} className="flex items-center gap-2 text-[11px]">
                            <cm.icon size={10} style={{ color: cm.color }} className="shrink-0" />
                            <span className={`w-16 truncate ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{cm.label}</span>
                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-white/10'}`}>
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(val, 100)}%`, backgroundColor: cm.color }}
                              />
                            </div>
                            <span className={`w-8 text-right font-bold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{val}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Predicted cases horizon */}
                    {(pred.predicted_cases_30d > 0 || pred.predicted_cases_60d > 0 || pred.predicted_cases_90d > 0) && (
                      <div className={`mt-3 pt-3 grid grid-cols-3 gap-2 border-t ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                        {[
                          { label: '30d', val: pred.predicted_cases_30d },
                          { label: '60d', val: pred.predicted_cases_60d },
                          { label: '90d', val: pred.predicted_cases_90d },
                        ].map(h => (
                          <div key={h.label} className="text-center">
                            <p className={`text-[9px] uppercase ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>Cases {h.label}</p>
                            <p className={`text-sm font-bold ${isLight ? 'text-gray-800' : 'text-white'}`}>{(h.val ?? 0).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Data sources */}
                    {pred.data_sources_used?.length > 0 && (
                      <div className={`mt-2 flex flex-wrap gap-1`}>
                        {pred.data_sources_used.map((src: string, i: number) => (
                          <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${isLight ? 'bg-gray-100 text-gray-500' : 'bg-white/5 text-gray-500'}`}>
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
