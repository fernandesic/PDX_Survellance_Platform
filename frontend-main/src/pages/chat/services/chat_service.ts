import { apiPost, apiGet } from "@/lib/api";
import type { RegionClimateProfile } from "@/pages/climate/types/climate";

export interface ChatResponse {
    status: string;
    message: string;
    data: {
        short_answer: string;
        structured_insight: string;
        recommendation: string | null;
        confidence: "Low" | "Medium" | "High";
        table_data: any[] | null;
        sources_cited: string[] | null;
        raw_response: string;
        rag_used: boolean;
        data_sources: string[];
    };
}

export interface ChatHealthResponse {
    status: string;
    ollama_available: boolean;
    model: string;
    available_models: string[];
}

export interface WarmupResponse {
    status: string;
    message: string;
    time_seconds?: number;
}

export type ContextType = 'star' | 'espar' | 'readiness' | 'chw' | 'climate' | 'general';

// Supported languages for AI responses
export type Language = 'en' | 'fr' | 'pt' | 'ar' | 'es' | 'hi';

export const SUPPORTED_LANGUAGES: Record<Language, string> = {
    'en': 'English',
    'fr': 'Français',
    'pt': 'Português',
    'ar': 'العربية',
    'es': 'Español',
    'hi': 'हिन्दी'
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

export const chatService = {
    query: async (
        message: string,
        contextType: ContextType = 'general',
        country?: string,
        history: { role: string; content: string }[] = [],
        language: Language = 'en'
    ): Promise<ChatResponse> => {
        return await apiPost<ChatResponse>('/chat/query', {
            message,
            context_type: contextType,
            country,
            conversation_history: history,
            language
        });
    },

    queryStream: async (
        message: string,
        contextType: ContextType = 'general',
        onChunk: (chunk: string) => void,
        onComplete: (metadata?: { rag_used: boolean; data_sources: string[] }) => void,
        onError: (error: Error) => void,
        history: { role: string; content: string }[] = [],
        language: Language = 'en'
    ): Promise<void> => {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            // Mirror the Axios interceptor: inject X-Tenant-ID for super admin tenant switching
            const activeTenantId = localStorage.getItem('who_active_tenant_id');
            if (activeTenantId) {
                headers['X-Tenant-ID'] = activeTenantId;
            }

            const response = await fetch(`${API_BASE_URL}/chat/stream`, {
                method: 'POST',
                credentials: 'include',    // Send httpOnly cookies
                headers,
                body: JSON.stringify({
                    message,
                    context_type: contextType,
                    conversation_history: history,
                    language
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let metadata = { rag_used: false, data_sources: [] as string[] };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const messages = buffer.split('\n\n');
                buffer = messages.pop() || '';

                for (const message of messages) {
                    const lines = message.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const content = line.slice(6);
                            if (content === '[DONE]') {
                                onComplete(metadata);
                                return;
                            }
                            try {
                                const decoded = JSON.parse(content);

                                if (decoded && typeof decoded === 'object' && decoded.type === 'metadata') {
                                    metadata = {
                                        rag_used: decoded.rag_used || false,
                                        data_sources: decoded.data_sources || []
                                    };
                                    continue;
                                }

                                onChunk(decoded);
                            } catch {
                                onChunk(content);
                            }
                        }
                    }
                }
            }
            onComplete(metadata);
        } catch (error) {
            onError(error instanceof Error ? error : new Error(String(error)));
        }
    },

    warmup: async (): Promise<WarmupResponse> => {
        return await apiPost<WarmupResponse>('/chat/warmup', {});
    },

    checkHealth: async (): Promise<ChatHealthResponse> => {
        return await apiGet<ChatHealthResponse>('/chat/health');
    },

    detectContextType: (message: string): ContextType => {
        const lowercaseMsg = message.toLowerCase();

        if (lowercaseMsg.includes('climate') ||
            lowercaseMsg.includes('weather') ||
            lowercaseMsg.includes('flood') ||
            lowercaseMsg.includes('drought') ||
            lowercaseMsg.includes('heatwave') ||
            lowercaseMsg.includes('temperature') ||
            lowercaseMsg.includes('precipitation') ||
            lowercaseMsg.includes('malaria') ||
            lowercaseMsg.includes('cholera') ||
            lowercaseMsg.includes('meningitis') ||
            lowercaseMsg.includes('disease risk')) {
            return 'climate';
        }

        if (lowercaseMsg.includes('hazard') ||
            lowercaseMsg.includes('risk') ||
            lowercaseMsg.includes('star') ||
            lowercaseMsg.includes('severity')) {
            return 'star';
        }

        if (lowercaseMsg.includes('capacity') ||
            lowercaseMsg.includes('ihr') ||
            lowercaseMsg.includes('espar') ||
            lowercaseMsg.includes('preparedness')) {
            return 'espar';
        }

        if (lowercaseMsg.includes('readiness') ||
            lowercaseMsg.includes('ready') ||
            lowercaseMsg.includes('priority action')) {
            return 'readiness';
        }

        if (lowercaseMsg.includes('chw') ||
            lowercaseMsg.includes('community health') ||
            lowercaseMsg.includes('worker')) {
            return 'chw';
        }

        return 'general';
    }
};

export function buildClimateContext(profile: RegionClimateProfile): string {
    const parts: string[] = [];
    const { region, timeWindow, anomalies, activeHazards, diseaseRisks } = profile;

    // Header
    parts.push(`CLIMATE INTELLIGENCE REPORT: ${region.name}`);
    parts.push(`Time Period: ${timeWindow.start} to ${timeWindow.end}`);
    if (region.population) {
        parts.push(`Population: ${region.population.toLocaleString()}`);
    }
    parts.push('');

    // Active Hazards
    if (activeHazards.length > 0) {
        parts.push('ACTIVE HAZARDS:');
        activeHazards.forEach(h => {
            parts.push(`- ${h.type.toUpperCase()} (Severity: ${h.severity}, Confidence: ${(h.confidence * 100).toFixed(0)}%)`);
            parts.push(`  ${h.description}`);
            parts.push(`  Period: ${h.startDate} to ${h.endDate}`);
        });
        parts.push('');
    } else {
        parts.push('ACTIVE HAZARDS: None detected');
        parts.push('');
    }

    // Climate Anomalies
    if (anomalies.length > 0) {
        parts.push('CLIMATE INDICATORS:');
        anomalies.forEach(a => {
            const direction = a.zScore > 0 ? 'above' : 'below';
            parts.push(`- ${a.variable}: ${a.value.toFixed(1)} (${Math.abs(a.zScore).toFixed(1)}σ ${direction} normal)`);
        });
        parts.push('');
    }

    // Historical Context
    if (profile.historicalAnnualData && profile.historicalAnnualData.length > 0) {
        parts.push('HISTORICAL REFERENCE DATA (PREVIOUS YEARS):');
        profile.historicalAnnualData.slice(0, 5).forEach(year => {
            parts.push(`- Year ${year.year}: Avg Temp (T2M): ${year.T2M.toFixed(1)}°C, Total Precip: ${year.PRECTOT.toFixed(1)}mm`);
        });
        parts.push('');
    }

    // Disease Risks
    if (diseaseRisks.length > 0) {
        parts.push('DISEASE RISK ASSESSMENT:');
        diseaseRisks.forEach(r => {
            parts.push(`- ${r.disease.toUpperCase()}: ${r.riskLevel} risk (${(r.confidence * 100).toFixed(0)}% confidence)`);
            parts.push(`  Explanation: ${r.explanation}`);
            parts.push(`  Climate drivers: ${r.climateDrivers.join(', ')}`);
        });
        parts.push('');
    } else {
        parts.push('DISEASE RISK ASSESSMENT: No elevated risks detected');
        parts.push('');
    }

    return parts.join('\n');
}
