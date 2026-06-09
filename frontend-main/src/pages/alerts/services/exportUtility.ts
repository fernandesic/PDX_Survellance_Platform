import type { Signal } from '../types';

export const exportToExcel = (signals: Signal[], country: string = 'Regional') => {
    // Generate CSV content
    const headers = ['ID', 'Date', 'Headline', 'Country', 'Priority', 'Cases', 'Deaths', 'Source'];
    const rows = signals.map(s => [
        s.id,
        new Date(s.publishedAt || s.created_at || '').toLocaleDateString(),
        s.headline || s.disease_name,
        s.location?.country || 'Unknown',
        s.priority || s.level,
        s.reported_cases || 0,
        s.reported_deaths || 0,
        s.source?.name || s.source_name || 'Sentinel'
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AFRO_Sentinel_Briefing_${country}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const printSituationReport = () => {
    window.print();
};
