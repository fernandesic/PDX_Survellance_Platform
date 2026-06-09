/**
 * ScenarioForm — input controls for the SEIRDV counterfactual simulator.
 *
 * Groups parameters into collapsible sections:
 * - Population & Initial State
 * - Epidemiological Rates
 * - Vaccination & Intervention
 * - Simulation Settings
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, ChevronDown, ChevronRight, Users,
    Activity, Shield, Settings, RotateCcw, Info, Wand2
} from 'lucide-react';
import { useToast } from '@/contexts/ToastProvider';
import { scenariosApi, type ScenarioConfig } from './scenariosApi';

interface ScenarioFormProps {
    onSubmit: (config: ScenarioConfig) => void;
    loading: boolean;
    disabled?: boolean;
}

/* ── Defaults matching toy_data.xlsx ──────────────────────────── */
const DEFAULTS: ScenarioConfig = {
    n_populations: 1,
    ini_S: [10000],
    ini_I: [10],
    beta: 0.3,
    sigma: 0.143,   // 1/7
    gamma: 0.071,    // 1/14
    mu: 0.01,
    time: 180,
    n_sims: 50,
    diffusion: 0.0,
    vacc_coverage: 0.0,
    vacc_efficacy: 0.0,
    interv_delay: 14,
    interv_efficacy: 0.25,
    interv_vacc_type: 2,
    target_size: 200,
    interv_release: 28,
};

/* ── Section toggle ───────────────────────────────────────────── */
function Section({ title, icon: Icon, children, defaultOpen = true }: {
    title: string;
    icon: typeof Activity;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
            >
                <Icon size={15} className="text-blue-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-200 flex-1">{title}</span>
                {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 py-3 space-y-3 border-t border-white/5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Input field ──────────────────────────────────────────────── */
function Field({ label, hint, children }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                {label}
                {hint && (
                    <span className="group relative">
                        <Info size={11} className="text-gray-600 cursor-help" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] text-gray-300 bg-gray-800 rounded border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {hint}
                        </span>
                    </span>
                )}
            </label>
            {children}
        </div>
    );
}

function NumInput({ value, onChange, min, max, step, className }: {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
}) {
    return (
        <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step ?? 'any'}
            className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors ${className ?? ''}`}
        />
    );
}

/* ── Main Form ────────────────────────────────────────────────── */
export default function ScenarioForm({ onSubmit, loading, disabled }: ScenarioFormProps) {
    const { showToast } = useToast();
    const [cfg, setCfg] = useState<ScenarioConfig>({ ...DEFAULTS });
    const [fitting, setFitting] = useState(false);
    const [fitDataStr, setFitDataStr] = useState("0, 5\n7, 20\n14, 50\n21, 120"); // Day, Cases
    const [showFitParams, setShowFitParams] = useState(false);

    const set = <K extends keyof ScenarioConfig>(key: K, val: ScenarioConfig[K]) =>
        setCfg(prev => ({ ...prev, [key]: val }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(cfg);
    };

    const handleReset = () => setCfg({ ...DEFAULTS });

    const handleAutoFit = async () => {
        try {
            setFitting(true);
            const lines = fitDataStr.trim().split('\n');
            const time_grid: number[] = [];
            const observed_cumulative_cases: number[] = [];
            
            for (const line of lines) {
                const parts = line.split(',').map(s => parseFloat(s.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    time_grid.push(parts[0]);
                    observed_cumulative_cases.push(parts[1]);
                }
            }
            
            if (time_grid.length < 4) {
                showToast("Need at least 4 data points (Day, Cases)", 'error');
                return;
            }

            const res = await scenariosApi.fitParameters({
                pathogen_id: 'cholera', // defaults to cholera for now
                observed_cumulative_cases,
                time_grid,
                initial_S: cfg.ini_S[0] || 10000,
                initial_I: cfg.ini_I[0] || 1,
                n_bootstrap: 50, // Keep it fast for UI interaction
            });

            if (res.converged) {
                set('beta', Number(res.point_estimate.beta.toFixed(4)));
                set('sigma', Number(res.point_estimate.sigma.toFixed(4)));
                set('gamma', Number(res.point_estimate.gamma.toFixed(4)));
                set('mu', Number(res.point_estimate.mu.toFixed(4)));
                setShowFitParams(false);
                showToast(`Fitted successfully!\nRMSE: ${res.rmse.toFixed(2)}`, 'success');
            } else {
                showToast("Model failed to converge. Try adjusting the data or initial population.", 'error');
            }
        } catch (e: any) {
            showToast(`Fitting error: ${e.message}`, 'error');
        } finally {
            setFitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3" id="scenario-form">
            {/* Population & Initial State */}
            <Section title="Population & Initial State" icon={Users}>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Susceptible (S₀)" hint="Initial susceptible population">
                        <NumInput value={cfg.ini_S[0]} onChange={(v) => set('ini_S', [v])} min={0} />
                    </Field>
                    <Field label="Infected (I₀)" hint="Initial infectious individuals">
                        <NumInput value={cfg.ini_I[0]} onChange={(v) => set('ini_I', [v])} min={0} />
                    </Field>
                </div>
            </Section>

            {/* Epidemiological Rates */}
            <Section title="Epidemiological Rates" icon={Activity}>
                <div className="flex justify-end mb-2">
                    <button
                        type="button"
                        onClick={() => setShowFitParams(!showFitParams)}
                        className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <Wand2 size={12} />
                        Auto-Fit from Data
                    </button>
                </div>
                
                <AnimatePresence>
                    {showFitParams && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-4 bg-white/5 p-3 rounded-lg border border-white/10"
                        >
                            <label className="block text-xs text-gray-300 mb-1">Paste Observed Data (Day, Cumulative Cases)</label>
                            <textarea 
                                value={fitDataStr}
                                onChange={e => setFitDataStr(e.target.value)}
                                className="w-full h-24 bg-black/30 border border-white/10 rounded-md p-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50 mb-2 font-mono"
                                placeholder="0, 5&#10;7, 20&#10;14, 50"
                            />
                            <button
                                type="button"
                                onClick={handleAutoFit}
                                disabled={fitting}
                                className="w-full py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded border border-blue-500/30 transition-colors flex justify-center items-center gap-2"
                            >
                                {fitting ? 'Fitting...' : 'Run Parameter Fit'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-3 gap-3">
                    <Field label="β (Transmission)" hint="Contact rate × probability of transmission">
                        <NumInput value={cfg.beta} onChange={(v) => set('beta', v)} min={0} step={0.01} />
                    </Field>
                    <Field label="σ (Incubation⁻¹)" hint="1 / average incubation period in days">
                        <NumInput value={cfg.sigma} onChange={(v) => set('sigma', v)} min={0} step={0.001} />
                    </Field>
                    <Field label="γ (Recovery⁻¹)" hint="1 / average infectious period in days">
                        <NumInput value={cfg.gamma} onChange={(v) => set('gamma', v)} min={0} step={0.001} />
                    </Field>
                </div>
                <Field label="μ (Case Fatality Rate)" hint="Probability of death per infectious individual">
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={cfg.mu ?? 0}
                            onChange={(e) => set('mu', Number(e.target.value))}
                            className="flex-1 accent-blue-500"
                        />
                        <span className="text-xs text-gray-300 w-12 text-right font-mono">
                            {((cfg.mu ?? 0) * 100).toFixed(0)}%
                        </span>
                    </div>
                </Field>
            </Section>

            {/* Intervention */}
            <Section title="Vaccination & Intervention" icon={Shield} defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Intervention Delay (days)" hint="Days after outbreak before response starts">
                        <NumInput value={cfg.interv_delay ?? 14} onChange={(v) => set('interv_delay', v)} min={0} />
                    </Field>
                    <Field label="Intervention Efficacy" hint="Reduction in transmission (0–1)">
                        <NumInput value={cfg.interv_efficacy ?? 0} onChange={(v) => set('interv_efficacy', v)} min={0} max={1} step={0.05} />
                    </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Vaccine Type" hint="1 = preventive, 2 = reactive">
                        <select
                            value={cfg.interv_vacc_type ?? 2}
                            onChange={(e) => set('interv_vacc_type', Number(e.target.value) as 1 | 2)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                        >
                            <option value={1}>Type 1 — Preventive (global)</option>
                            <option value={2}>Type 2 — Reactive (ring)</option>
                        </select>
                    </Field>
                    <Field label="Ring Target Size" hint="Number of contacts to vaccinate per case">
                        <NumInput value={cfg.target_size ?? 200} onChange={(v) => set('target_size', v)} min={0} />
                    </Field>
                </div>
            </Section>

            {/* Simulation */}
            <Section title="Simulation Settings" icon={Settings} defaultOpen={false}>
                <div className="grid grid-cols-3 gap-3">
                    <Field label="Time Horizon (days)" hint="Total simulation duration">
                        <NumInput value={cfg.time} onChange={(v) => set('time', v)} min={1} max={365} />
                    </Field>
                    <Field label="Simulations" hint="Number of stochastic runs (more = smoother)">
                        <NumInput value={cfg.n_sims ?? 50} onChange={(v) => set('n_sims', v)} min={1} max={1000} />
                    </Field>
                    <Field label="Diffusion" hint="Spatial mixing rate between populations">
                        <NumInput value={cfg.diffusion ?? 0} onChange={(v) => set('diffusion', v)} min={0} max={1} step={0.01} />
                    </Field>
                </div>
            </Section>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
                <button
                    type="submit"
                    disabled={loading || disabled}
                    id="scenario-submit-btn"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                >
                    <Play size={14} />
                    {loading ? 'Submitting…' : 'Run Scenario'}
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10 transition-colors"
                    title="Reset to defaults"
                >
                    <RotateCcw size={14} />
                </button>
            </div>
        </form>
    );
}
