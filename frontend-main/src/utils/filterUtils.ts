import type {
    RegionClimateProfile,
    ClimateFilters,
    HazardTypeFilter,
    DiseaseTypeFilter,
    PriorityLevel
} from '@/pages/climate/types/climate';

export function calculatePriority(profile: RegionClimateProfile): PriorityLevel {
    const hasHighHazard = profile.activeHazards.some(h => h.severity === 'HIGH');
    const hasHighDiseaseRisk = profile.diseaseRisks.some(r => r.riskLevel === 'HIGH');

    if (hasHighHazard && hasHighDiseaseRisk) return 'P1';
    if (hasHighHazard || hasHighDiseaseRisk) return 'P2';

    const hasMediumRisk = profile.activeHazards.some(h => h.severity === 'MEDIUM') ||
        profile.diseaseRisks.some(r => r.riskLevel === 'MEDIUM');
    if (hasMediumRisk) return 'P3';

    return 'P4';
}
export function filterByCountries(
    profiles: Map<string, RegionClimateProfile>,
    countries: string[]
): Map<string, RegionClimateProfile> {
    if (countries.length === 0) return profiles;

    const filtered = new Map<string, RegionClimateProfile>();
    profiles.forEach((profile, key) => {
        if (countries.includes(profile.region.name)) {
            filtered.set(key, profile);
        }
    });
    return filtered;
}
export function filterByHazardTypes(
    profiles: Map<string, RegionClimateProfile>,
    hazardTypes: HazardTypeFilter[]
): Map<string, RegionClimateProfile> {
    if (hazardTypes.length === 0) return profiles;

    const filtered = new Map<string, RegionClimateProfile>();
    profiles.forEach((profile, key) => {
        const hasMatchingHazard = profile.activeHazards.some(h =>
            hazardTypes.includes(h.type as HazardTypeFilter)
        );
        if (hasMatchingHazard) {
            filtered.set(key, profile);
        }
    });
    return filtered;
}
export function filterByDiseaseTypes(
    profiles: Map<string, RegionClimateProfile>,
    diseaseTypes: DiseaseTypeFilter[]
): Map<string, RegionClimateProfile> {
    if (diseaseTypes.length === 0) return profiles;

    const filtered = new Map<string, RegionClimateProfile>();
    profiles.forEach((profile, key) => {
        const hasMatchingDisease = profile.diseaseRisks.some(r =>
            diseaseTypes.includes(r.disease as DiseaseTypeFilter)
        );
        if (hasMatchingDisease) {
            filtered.set(key, profile);
        }
    });
    return filtered;
}
export function filterByPriorities(
    profiles: Map<string, RegionClimateProfile>,
    priorities: PriorityLevel[]
): Map<string, RegionClimateProfile> {
    if (priorities.length === 0) return profiles;

    const filtered = new Map<string, RegionClimateProfile>();
    profiles.forEach((profile, key) => {
        const priority = calculatePriority(profile);
        if (priorities.includes(priority)) {
            filtered.set(key, profile);
        }
    });
    return filtered;
}
export function filterByConfidence(
    profiles: Map<string, RegionClimateProfile>,
    threshold: number
): Map<string, RegionClimateProfile> {
    if (threshold === 0) return profiles;

    const thresholdDecimal = threshold / 100;
    const filtered = new Map<string, RegionClimateProfile>();

    profiles.forEach((profile, key) => {
        const meetsThreshold =
            profile.activeHazards.some(h => h.confidence >= thresholdDecimal) ||
            profile.diseaseRisks.some(r => r.confidence >= thresholdDecimal);

        if (meetsThreshold) {
            filtered.set(key, profile);
        }
    });
    return filtered;
}

export function applyAllFilters(
    profiles: Map<string, RegionClimateProfile>,
    filters: ClimateFilters
): Map<string, RegionClimateProfile> {
    let filtered = profiles;

    filtered = filterByCountries(filtered, filters.countries);
    filtered = filterByHazardTypes(filtered, filters.hazardTypes);
    filtered = filterByDiseaseTypes(filtered, filters.diseaseTypes);
    filtered = filterByPriorities(filtered, filters.priorities);
    filtered = filterByConfidence(filtered, filters.confidenceThreshold);

    return filtered;
}

export function countActiveFilters(filters: ClimateFilters): number {
    let count = 0;
    if (filters.countries.length > 0) count++;
    if (filters.admin1.length > 0) count++;
    if (filters.hazardTypes.length > 0) count++;
    if (filters.diseaseTypes.length > 0) count++;
    if (filters.priorities.length > 0) count++;
    if (filters.confidenceThreshold > 0) count++;
    return count;
}
