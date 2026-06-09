

interface CountrySummaryChartsProps {
    overviewData: any;
    isLight: boolean;
}

export function CountrySummaryCharts({ overviewData, isLight }: CountrySummaryChartsProps) {
    return (
        <>
            <div className={`w-full h-full min-h-0 ${isLight ? 'bg-white/80 backdrop-blur-md border-gray-100' : 'bg-[#0d1424] border-white/5'} rounded-lg border p-3 pt-6 flex flex-col shadow-lg`}>
                <h4 className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-lg font-semibold mb-3`}>Country Summary</h4>
                <div className="space-y-2 mt-2 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                    {overviewData.chart.total_chw_and_population_2024.map((item: any, idx: number) => {
                        const chw = Number(item.chw);
                        const population = Number(item.population);
                        const rate = population > 0 ? Number(((chw / population) * 10000).toFixed(1)) : 0;
                        const countryCode = item.country.substring(0, 2).toUpperCase();

                        return (
                            <div
                                key={idx}
                                className={`flex items-center justify-between py-2 px-1.5 border-b ${isLight ? 'border-gray-200' : 'border-white/5'} last:border-0`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold text-[9px]">
                                        {countryCode}
                                    </div>
                                    <div>
                                        <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-[12px] font-medium`}>{item.country}</div>
                                        <div className={`${isLight ? 'text-gray-600' : 'text-gray-500'} text-[10px]`}>{item.year}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-sm font-semibold`}>{chw.toLocaleString()}</div>
                                    <div className={`${isLight ? 'text-[#0093D5]' : 'text-cyan-400'} text-[8px]`}>{rate}/10k</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={`w-full h-full min-h-0 ${isLight ? 'bg-white/80 backdrop-blur-md border-gray-100' : 'bg-[#0d1424] border-white/5'} rounded-lg border p-3 pt-6 flex flex-col shadow-lg`}>
                <h4 className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-lg font-semibold mb-3`}>Country Rates</h4>
                <div className="space-y-2 mt-2 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                    {overviewData.chart.total_chw_and_population_2024.map((item: any, idx: number) => {
                        const chw = Number(item.chw);
                        const population = Number(item.population);
                        const rate = population > 0 ? Number(((chw / population) * 10000).toFixed(2)) : 0;
                        const isHigh = rate > 10;
                        return (
                            <div
                                key={idx}
                                className={`flex items-center justify-between py-2 px-1.5 border-b ${isLight ? 'border-gray-200' : 'border-white/5'} last:border-0`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold ${isHigh
                                        ? 'bg-blue-500/25'
                                        : 'bg-orange-500/25'
                                        }`}>
                                        {item.country.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-[12px] font-medium`}>{item.country}</div>
                                        <div className={`${isLight ? 'text-gray-600' : 'text-gray-500'} text-[10px]`}>{item.year}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-sm font-semibold`}>{rate.toFixed(2)}</div>
                                    <div className={`text-[8px] ${isHigh ? (isLight ? 'text-[#0093D5]' : 'text-blue-400') : 'text-orange-400'}`}>
                                        per 10k
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
