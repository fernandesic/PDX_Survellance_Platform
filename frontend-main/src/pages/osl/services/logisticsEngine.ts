// @ts-nocheck

import type { FormData, ForwarderKPI, RankedForwarder, ShipmentData } from './types';


function normalize(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
}


export function calculateForwarderKPIs(
    data: ShipmentData[],
    forwarders: string[],
    formData: FormData
): Record<string, ForwarderKPI> {
    const results: Record<string, ForwarderKPI> = {};

    forwarders.forEach(f => {

        const match = Object.keys(formData).find(key =>
            key.endsWith('_price') &&

            key.replace('_price', '').replace(/_/g, ' ').toLowerCase().includes(f.toLowerCase().split(' ')[0])
        );

        let userPrice: number | undefined;
        let userDays: number | undefined;

        if (match) {
            const baseKey = match.replace('_price', '');
            userPrice = formData[`${baseKey}_price`];
            userDays = formData[`${baseKey}_days`];
        } else {

            const forwarderKey = f.toLowerCase().replace(/[^a-z]/g, '_');
            userPrice = formData[`${forwarderKey}_price`];
            userDays = formData[`${forwarderKey}_days`];
        }

        const forwarderData = data.filter(d => d.forwarder === f);
        const totalShipments = forwarderData.length;


        const avgTransitDays = userDays || (totalShipments > 0 ?
            forwarderData.reduce((sum, d) => sum + d.transit_days, 0) / totalShipments : 7);

        const avgCost = userPrice || (totalShipments > 0 ?
            forwarderData.reduce((sum, d) => sum + d.cost_usd, 0) / totalShipments : 30000);

        const onTimeRate = totalShipments > 0 ?
            forwarderData.filter(d => d.on_time).length / totalShipments : 0.85;

        const costPerKg = avgCost / (formData.weight || 1);

        results[f] = {
            totalShipments,
            avgTransitDays,
            avgCost,
            onTimeRate,
            costPerKg,
            isUserInput: !!userPrice || !!userDays
        };
    });

    return results;
}


export function rankForwarders(kpis: Record<string, ForwarderKPI>): RankedForwarder[] {
    const entries = Object.entries(kpis);
    if (entries.length === 0) return [];

    const weights = [0.68, 0.45, 0.22]; // time, cost, reliability
    const criteria: Array<keyof ForwarderKPI> = ['avgTransitDays', 'costPerKg', 'onTimeRate'];
    const isBenefit = [false, false, true]; // lower time/cost is better; higher reliability is better


    const matrix = entries.map(([, data]) => criteria.map(c => {
        const val = data[c];
        return typeof val === 'number' ? val : (val ? 1 : 0);
    }));

    const denom = criteria.map((_, j) =>
        Math.sqrt(matrix.reduce((sum, row) => sum + Math.pow(row[j], 2), 0)) || 1
    );
    const normalized = matrix.map(row => row.map((v, j) => v / denom[j]));


    const weighted = normalized.map(row => row.map((v, j) => v * weights[j]));


    const ideal = criteria.map((_, j) =>
        isBenefit[j] ? Math.max(...weighted.map(r => r[j])) : Math.min(...weighted.map(r => r[j]))
    );
    const nadir = criteria.map((_, j) =>
        isBenefit[j] ? Math.min(...weighted.map(r => r[j])) : Math.max(...weighted.map(r => r[j]))
    );


    const scored = weighted.map((row, i) => {
        const dPlus = Math.hypot(...row.map((v, j) => v - ideal[j]));
        const dMinus = Math.hypot(...row.map((v, j) => v - nadir[j]));
        const closeness = dMinus / ((dPlus + dMinus) || 1);
        return { name: entries[i][0], data: entries[i][1], score: closeness };
    });


    return scored
        .map(({ name, data, score }) => ({
            name,
            ...data,
            score,
        }))
        .sort((a, b) => b.score - a.score);
}


