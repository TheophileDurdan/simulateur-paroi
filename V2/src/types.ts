export type MaterialKind = "solid" | "air_gap" | "air_gap_ventilated" | "thin_film";

export interface MaterialPreset {
  id: string;
  name: string;
  kind: MaterialKind;
  rho: number;
  cp: number;
  lambda: number;
  color: string;
  /** Émissivité infrarouge (0–1) */
  epsilon: number;
  /** Absorptivité solaire surface (0–1) */
  alphaSolar: number;
}

export interface Layer {
  id: string;
  materialId: string;
  thicknessMm: number;
  rho?: number;
  cp?: number;
  lambda?: number;
  epsilon?: number;
  alphaSolar?: number;
  color?: string;
}

export interface NodeProps {
  rho: number;
  cp: number;
  lambda: number;
  color: string;
  epsilon: number;
  alphaSolar: number;
  layerId: string;
}

export interface SimulationState {
  tExt: number;
  tAirInt: number;
  wallTemps: number[];
}

export type SimSpeed = 10 | 100 | 1000;

export const DX = 0.001;
export const AIR_RHO = 1.2;
export const AIR_CP = 1005;
export const AIR_DEPTH = 5.0;
export const INITIAL_TEMP = 26;
export const PX_PER_DEG = 10;
export const MARGIN_BOTTOM = 20;
export const AIR_ZONE_WIDTH = 100;
export const AIR_BAR_WIDTH = 30;
export const MAX_DISPLAY_TEMP = 70;
export const MIN_WALL_ZONE_HEIGHT = MAX_DISPLAY_TEMP * PX_PER_DEG + MARGIN_BOTTOM;
export const MIN_CANVAS_HEIGHT = MIN_WALL_ZONE_HEIGHT;
export const MIN_DT = 1.0;
export const G_MAX = 950;
export const STEFAN_BOLTZMANN = 5.670374419e-8;
/** Renouvellements d'air int./ext. par défaut (vol/h). */
export const DEFAULT_VENTILATION_ACH = 0.5;
/** Puissance chauffage/refroidissement air int. (W/m² de paroi), ±. */
export const MAX_INTERIOR_HEATING_W = 100;
