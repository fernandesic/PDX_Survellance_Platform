// @ts-nocheck
import { Incident } from '../types';
import { logger } from "@/utils/logger";

const API_BASE = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:8000';
const INCIDENT_API = `${API_BASE}/api/v1/ihmref/country/incident`;

export async function fetchIncidents(country?: string): Promise<Incident[]> {
    try {
        const url = country ? `${INCIDENT_API}?country=${encodeURIComponent(country)}` : INCIDENT_API;
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        // Handle paginated response if applicable, otherwise assume array
        return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
        logger.error('Incident API Error:', error);
        return [];
    }
}
