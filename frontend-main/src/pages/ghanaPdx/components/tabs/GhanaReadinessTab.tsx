/**
 * GhanaReadinessTab — Readiness scores for Ghana
 */
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useGhanaReadiness } from '../../hooks/useGhanaData';
import { Loader2, CheckCircle2 } from 'lucide-react';

const READINESS_CATEGORIES = ['Arbo Virus', 'Cholera', 'Ebola', 'Meningitis', 'Mpox', 'Pandemic Influenza'];

export default function GhanaReadinessTab() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [selectedCategory, setSelectedCategory] = useState(READINESS_CATEGORIES[0]);
  const { data, isLoading } = useGhanaReadiness(selectedCategory);
  const readinessData = data as any;

  return (
    <div className="space-y-5">
      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {READINESS_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              selectedCategory === cat
                ? isLight ? 'bg-[#006B3F] text-white' : 'bg-[#FFD700] text-gray-900'
                : isLight ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : !readinessData?.results?.length ? (
        <div className={`text-center py-16 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
          <CheckCircle2 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No readiness data for {selectedCategory}</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isLight ? 'bg-gray-50 text-gray-600' : 'bg-white/[0.03] text-gray-400'}>
                  <th className="text-left px-4 py-2.5 font-medium">Question</th>
                  <th className="text-center px-4 py-2.5 font-medium w-24">Score</th>
                  <th className="text-center px-4 py-2.5 font-medium w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {readinessData.results.map((item: any, idx: number) => {
                  // BaseReadiness exposes question_score (per-question, often 0/1)
                  // and category_score (rolled-up category %). Prefer question_score
                  // and scale 0–1 booleans to a 0–100 progress bar.
                  const rawScore = item.question_score ?? item.category_score ?? 0;
                  const score = rawScore <= 1 ? rawScore * 100 : rawScore;
                  return (
                    <tr
                      key={idx}
                      className={`border-t transition-colors ${
                        isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-white/5 hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className={`px-4 py-3 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                        {item.question || item.category || `Item ${idx + 1}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className={`w-12 h-2 rounded-full overflow-hidden ${isLight ? 'bg-gray-200' : 'bg-white/10'}`}>
                            <div
                              className={`h-full rounded-full ${
                                score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(score, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                            {typeof score === 'number' ? `${Math.round(score)}%` : score}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          score >= 80 ? 'bg-green-500/10 text-green-500'
                          : score >= 50 ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-red-500/10 text-red-500'
                        }`}>
                          {score >= 80 ? 'Ready' : score >= 50 ? 'Partial' : 'Gap'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
