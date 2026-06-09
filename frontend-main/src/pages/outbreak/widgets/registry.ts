/**
 * Widget registry (T-111).
 *
 * Maps a widget key (as it appears in `pathogen.monitor_widgets`) to a
 * React component. The Now pane iterates the pathogen's declared list
 * and renders matching widgets in the declared order. Anything not in
 * this map is silently ignored — admins get a clean "remove from list"
 * UX without having to touch code.
 */

import type { ComponentType } from 'react';
import {
  UnsafeBurialList, HcwInfectionAlarm, SilenceAnomalyList,
} from './EventListWidgets';
import {
  MobilityCard, DeforestationCard, AnimalSurveillanceCard,
  ClimateCard, SpilloverRiskListCard,
} from './TransmissionDriverCards';
import FieldIntelligenceCard from './FieldIntelligenceCard';

export interface WidgetProps {
  events: import('../services/outbreakApi').OutbreakEvent[];
  outbreak: import('../services/outbreakApi').Outbreak;
  onSelectEvent?: (id: number) => void;
}

export const WIDGET_REGISTRY: Record<string, ComponentType<WidgetProps>> = {
  field_intel: FieldIntelligenceCard,
  burial: UnsafeBurialList,
  hcw: HcwInfectionAlarm,
  silence: SilenceAnomalyList,
  mobility: MobilityCard,
  deforestation: DeforestationCard,
  animal: AnimalSurveillanceCard,
  climate: ClimateCard,
  spillover: SpilloverRiskListCard,
  // "capacity" is rendered separately (CanWeRespondCard + supporting cards).
  // CrossBorderSummaryCard is rendered directly in AheadPane (not via registry).
};

export function widgetsFor(outbreak: WidgetProps['outbreak']): string[] {
  const declared = outbreak.pathogen?.monitor_widgets;
  if (declared && declared.length) return declared;
  // Sensible default if a pathogen hasn't been curated yet.
  return ['capacity', 'spillover', 'field_intel', 'burial', 'hcw', 'silence'];
}
