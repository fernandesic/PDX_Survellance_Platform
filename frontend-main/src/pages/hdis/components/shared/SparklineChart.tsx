interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    fillOpacity?: number;
    className?: string;
}

export function SparklineChart({
    data,
    width = 100,
    height = 28,
    color = "#ef4444",
    fillOpacity = 0.15,
    className = "",
}: SparklineProps) {
    if (!data.length) return null;

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const step = width / Math.max(data.length - 1, 1);

    const points = data.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    });

    const linePath = `M${points.join(" L")}`;
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`shrink-0 ${className}`}>
            <defs>
                <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#spark-${color.replace("#", "")})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
