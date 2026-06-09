import type { RegionClimateProfile, PriorityLevel } from '@/pages/climate/types/climate';
import { calculatePriority } from './filterUtils';

export interface KPIMetrics {
    countriesFlagged: number;
    admin1Flagged: number;
    topRiskLocations: TopRiskLocation[];
    newEvents24h: number;
    escalations24h: number;
    convergenceEvents: number;
}

export interface TopRiskLocation {
    regionId: string;
    regionName: string;
    priority: PriorityLevel;
    hazardTypes: string[];
    diseaseRisks: string[];
    convergence: boolean;
}

export function calculateKPIs(
    profiles: Map<string, RegionClimateProfile>
): KPIMetrics {
    const countriesFlagged = countFlaggedCountries(profiles);
    const admin1Flagged = countFlaggedAdmin1(profiles);
    const topRiskLocations = getTopRiskLocations(profiles, 5);
    const { newEvents, escalations } = count24hEvents(profiles);
    const convergenceEvents = countConvergenceEvents(profiles);

    return {
        countriesFlagged,
        admin1Flagged,
        topRiskLocations,
        newEvents24h: newEvents,
        escalations24h: escalations,
        convergenceEvents
    };
}

function countFlaggedCountries(profiles: Map<string, RegionClimateProfile>): number {
    const flaggedCountries = new Set<string>();

    profiles.forEach((profile) => {
        if (profile.region.adminLevel === 'country') {
            const hasHazard = profile.activeHazards.some(h => h.severity === 'MEDIUM' || h.severity === 'HIGH');
            const hasDisease = profile.diseaseRisks.some(r => r.riskLevel === 'MEDIUM' || r.riskLevel === 'HIGH');

            if (hasHazard || hasDisease) {
                flaggedCountries.add(profile.region.name);
            }
        }
    });

    return flaggedCountries.size;
}

function countFlaggedAdmin1(profiles: Map<string, RegionClimateProfile>): number {
    let count = 0;

    profiles.forEach((profile) => {
        if (profile.region.adminLevel === 'admin1' && profile.activeHazards.length > 0) {
            count++;
        }
    });

    return count;
}

function getTopRiskLocations(
    profiles: Map<string, RegionClimateProfile>,
    limit: number
): TopRiskLocation[] {
    const locations: TopRiskLocation[] = [];

    profiles.forEach((profile) => {
        const priority = calculatePriority(profile);
        const convergence = detectConvergence(profile);

        locations.push({
            regionId: profile.region.id,
            regionName: profile.region.name,
            priority,
            hazardTypes: profile.activeHazards.map(h => h.type),
            diseaseRisks: profile.diseaseRisks.map(r => r.disease),
            convergence
        });
    });
    locations.sort((a, b) => {
        const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return locations.slice(0, limit);
}

function count24hEvents(profiles: Map<string, RegionClimateProfile>): {
    newEvents: number;
    escalations: number;
} {
    let activeAlerts = 0;
    let extremeRisks = 0;

    profiles.forEach((profile) => {
        activeAlerts += profile.activeHazards.filter(h => h.severity === 'MEDIUM' || h.severity === 'HIGH').length;

        extremeRisks += profile.activeHazards.filter(h => h.severity === 'HIGH').length;
    });

    return { newEvents: activeAlerts, escalations: extremeRisks };
}

function countConvergenceEvents(profiles: Map<string, RegionClimateProfile>): number {
    let count = 0;

    profiles.forEach((profile) => {
        if (detectConvergence(profile)) {
            count++;
        }
    });

    return count;
}

export function detectConvergence(profile: RegionClimateProfile): boolean {
    const hasHighHazard = profile.activeHazards.some(h => h.severity === 'HIGH');
    const hasHighDisease = profile.diseaseRisks.some(d => d.riskLevel === 'HIGH');
    return hasHighHazard && hasHighDisease;
}

export function getHazardIcon(hazardType: string): string {
    const icons: Record<string, string> = {
        flood: '💧',
        drought: '🌵',
        heatwave: '🌡️',
        fire: '🔥',
        wind: '💨',
        storm: '⛈️'
    };
    return icons[hazardType] || '⚠️';
}
export function getDiseaseIcon(diseaseType: string): string {
    const icons: Record<string, string> = {
        cholera: '🦠',
        malaria: '🦟',
        meningitis: '🧠',
        malnutrition: '🍽️'
    };
    return icons[diseaseType] || '💊';
}
