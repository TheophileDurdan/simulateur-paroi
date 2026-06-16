import type { Layer } from "../types";
import {
  DEFAULT_CLIMATE_PRESET_ID,
  getClimatePreset,
  presetDateISO,
  scheduleFromPreset,
} from "./climatePresets";

/** Paris (Parc Montsouris / station de référence Météo-France). */
export const PARIS_LAT_DEG = 48.86;

export function parisHeatwaveDateISO(): string {
  return presetDateISO(getClimatePreset(DEFAULT_CLIMATE_PRESET_ID));
}

export const PARIS_HEATWAVE_SCHEDULE = getClimatePreset(DEFAULT_CLIMATE_PRESET_ID).schedule;

export const PARIS_HEATWAVE_INITIAL_TEMP = getClimatePreset(DEFAULT_CLIMATE_PRESET_ID).initialTemp;

export function parisHeatwaveLayers(): Layer[] {
  return [
    { id: crypto.randomUUID(), materialId: "brique-rouge", thicknessMm: 200 },
    { id: crypto.randomUUID(), materialId: "laine-verre", thicknessMm: 100 },
    { id: crypto.randomUUID(), materialId: "platre", thicknessMm: 13 },
  ];
}

/** Paroi démo : brique + lame d'air + laine + feuille Al (effet rayonnement). */
export function cavityRadiationDemoLayers(): Layer[] {
  return [
    { id: crypto.randomUUID(), materialId: "brique-rouge", thicknessMm: 200 },
    { id: crypto.randomUUID(), materialId: "lame-air", thicknessMm: 20 },
    { id: crypto.randomUUID(), materialId: "feuille-alu", thicknessMm: 1 },
    { id: crypto.randomUUID(), materialId: "laine-verre", thicknessMm: 100 },
    { id: crypto.randomUUID(), materialId: "platre", thicknessMm: 13 },
  ];
}

export { scheduleFromPreset };
