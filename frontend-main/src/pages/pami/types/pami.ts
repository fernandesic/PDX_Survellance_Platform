export interface PAMILocation {
    id: string;
    country: string;
    province?: string;
    district?: string;
    localMunicipality?: string;
    region?: string;
    wardNumber?: string;
    priorityIndex: number | string;
    risk?: string;
    latitude?: number;
    longitude?: number;
    shape?: string;
}

export interface PAMIData {
    locations: PAMILocation[];
    totalLocations: number;
    countries: string[];
}
