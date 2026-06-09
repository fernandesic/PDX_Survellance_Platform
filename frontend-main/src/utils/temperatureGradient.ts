/**
 * Temperature Gradient Utilities
 * Converts temperature values to color gradients for heatmap visualization
 */

export interface ColorStop {
    temp: number;
    color: [number, number, number];
}

// Temperature to color mapping (Celsius)
export const TEMPERATURE_GRADIENT: ColorStop[] = [
    { temp: -30, color: [138, 43, 226] },   // Purple (extreme cold)
    { temp: -20, color: [75, 0, 130] },     // Indigo
    { temp: -10, color: [0, 0, 255] },      // Blue
    { temp: 0, color: [0, 191, 255] },      // Deep Sky Blue
    { temp: 5, color: [0, 255, 255] },      // Cyan
    { temp: 10, color: [0, 255, 127] },     // Spring Green
    { temp: 15, color: [50, 205, 50] },     // Lime Green
    { temp: 20, color: [173, 255, 47] },    // Green Yellow
    { temp: 25, color: [255, 255, 0] },     // Yellow
    { temp: 30, color: [255, 215, 0] },     // Gold
    { temp: 35, color: [255, 165, 0] },     // Orange
    { temp: 40, color: [255, 69, 0] },      // Orange Red
    { temp: 45, color: [255, 0, 0] },       // Red
    { temp: 50, color: [139, 0, 0] },       // Dark Red
];

/**
 * Interpolate between two colors
 */
function interpolateColor(
    color1: [number, number, number],
    color2: [number, number, number],
    factor: number
): [number, number, number] {
    return [
        Math.round(color1[0] + (color2[0] - color1[0]) * factor),
        Math.round(color1[1] + (color2[1] - color1[1]) * factor),
        Math.round(color1[2] + (color2[2] - color1[2]) * factor),
    ];
}

/**
 * Get color for a given temperature value
 */
export function getTemperatureColor(tempCelsius: number): [number, number, number] {
    // Find the two color stops to interpolate between
    let lowerStop = TEMPERATURE_GRADIENT[0];
    let upperStop = TEMPERATURE_GRADIENT[TEMPERATURE_GRADIENT.length - 1];

    for (let i = 0; i < TEMPERATURE_GRADIENT.length - 1; i++) {
        if (tempCelsius >= TEMPERATURE_GRADIENT[i].temp &&
            tempCelsius <= TEMPERATURE_GRADIENT[i + 1].temp) {
            lowerStop = TEMPERATURE_GRADIENT[i];
            upperStop = TEMPERATURE_GRADIENT[i + 1];
            break;
        }
    }

    // Handle extreme values
    if (tempCelsius < TEMPERATURE_GRADIENT[0].temp) {
        return TEMPERATURE_GRADIENT[0].color;
    }
    if (tempCelsius > TEMPERATURE_GRADIENT[TEMPERATURE_GRADIENT.length - 1].temp) {
        return TEMPERATURE_GRADIENT[TEMPERATURE_GRADIENT.length - 1].color;
    }

    // Interpolate
    const range = upperStop.temp - lowerStop.temp;
    const factor = (tempCelsius - lowerStop.temp) / range;

    return interpolateColor(lowerStop.color, upperStop.color, factor);
}

/**
 * Get RGBA color string for a temperature
 */
export function getTemperatureColorRGBA(tempCelsius: number, alpha: number = 0.6): string {
    const [r, g, b] = getTemperatureColor(tempCelsius);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get hex color for a temperature
 */
export function getTemperatureColorHex(tempCelsius: number): string {
    const [r, g, b] = getTemperatureColor(tempCelsius);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Create a gradient legend for the temperature scale
 */
export function createGradientLegend(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return canvas;

    const gradient = ctx.createLinearGradient(0, 0, width, 0);

    for (let i = 0; i < TEMPERATURE_GRADIENT.length; i++) {
        const stop = TEMPERATURE_GRADIENT[i];
        const position = i / (TEMPERATURE_GRADIENT.length - 1);
        const [r, g, b] = stop.color;
        gradient.addColorStop(position, `rgb(${r}, ${g}, ${b})`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    return canvas;
}
