// @ts-nocheck
import {
    AlertTriangle,
    Droplets,
    Thermometer,
    Flame,
    Skull,
    Bug,
    Brain,
    Utensils,
    AlertCircle
} from 'lucide-react';
import { HazardType, DiseaseType, SeverityLevel } from '@/pages/climate/types/climate';


export const HAZARD_METADATA: Record<HazardType, { label: string; icon: any; color: string }> = {
    flood: { label: 'Flood', icon: Droplets, color: 'text-blue-400' },
    drought: { label: 'Drought', icon: AlertTriangle, color: 'text-amber-500' },
    heatwave: { label: 'Heatwave', icon: Thermometer, color: 'text-orange-500' },
    fire: { label: 'Fire', icon: Flame, color: 'text-red-500' },
};

export const DISEASE_METADATA: Record<DiseaseType, { label: string; icon: any; color: string }> = {
    cholera: { label: 'Cholera', icon: Skull, color: 'text-cyan-400' },
    malaria: { label: 'Malaria', icon: Bug, color: 'text-emerald-400' },
    meningitis: { label: 'Meningitis', icon: Brain, color: 'text-purple-400' },
    malnutrition: { label: 'Malnutrition', icon: Utensils, color: 'text-yellow-400' },
};

export const SEVERITY_STYLES: Record<SeverityLevel, { bg: string; text: string; border: string }> = {
    HIGH: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/50'
    },
    MEDIUM: {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/50'
    },
    LOW: {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/50'
    },
};

export const getHazardIcon = (type: string) => HAZARD_METADATA[type as HazardType]?.icon || AlertCircle;
export const getDiseaseIcon = (type: string) => DISEASE_METADATA[type as DiseaseType]?.icon || AlertCircle;

