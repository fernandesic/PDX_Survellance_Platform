/**
 * ScenariosSection — container for the SEIRDV counterfactual simulator.
 *
 * Layout: Form on the left, Results on the right.
 * Includes a disclaimer banner and run history toggle.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, X } from 'lucide-react';
import ScenarioForm from './ScenarioForm';
import ScenarioResults from './ScenarioResults';
import { useScenarioRun } from './useScenarioRun';

export default function ScenariosSection() {
    const { run, loading, error, submit, reset, polling } = useScenarioRun();
    const [showHistory, setShowHistory] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
        >
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <Beaker size={20} className="text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            Scenario & Response
                        </h2>
                        <p className="text-xs text-gray-400">
                            SEIRDV Counterfactual Simulator · What-if analysis for intervention planning
                        </p>
                    </div>
                </div>
                {run && (
                    <button
                        onClick={reset}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/10 transition-colors"
                    >
                        <X size={12} />
                        New Scenario
                    </button>
                )}
            </div>

            {/* Disclaimer Banner */}
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <p className="text-xs text-amber-200/80 leading-relaxed">
                    <strong className="text-amber-300">Counterfactual scenario</strong> — this projects what would
                    happen under each candidate response. It is <strong>not</strong> a forecast. Results depend on
                    the parameters you set and the stochastic model assumptions.
                </p>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Form Panel */}
                <div className="lg:col-span-4">
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sticky top-4">
                        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                            <Beaker size={14} className="text-emerald-400" />
                            Configure Scenario
                        </h3>
                        <ScenarioForm
                            onSubmit={submit}
                            loading={loading}
                            disabled={polling}
                        />
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-8">
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 min-h-[400px] h-full flex flex-col">
                        <AnimatePresence mode="wait">
                            {run ? (
                                <motion.div
                                    key="results"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex-1"
                                >
                                    <ScenarioResults run={run} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex-1 flex items-center justify-center min-h-[400px]"
                                >
                                    <div className="text-center space-y-3 max-w-sm">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                                            <Beaker size={28} className="text-emerald-400/60" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-300 font-medium">
                                                No scenario running
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                Configure parameters on the left and click
                                                <span className="text-blue-400"> Run Scenario</span> to
                                                simulate outbreak trajectories under different
                                                intervention strategies.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Error display */}
                        {error && !run?.error_message && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300"
                            >
                                {error}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
