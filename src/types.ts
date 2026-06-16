export interface MaterialPreset {
  id: string;
  name: string;
  rho: number;
  cp: number;
  lambda: number;
  color: string;
}

export interface Layer {
  id: string;
  materialId: string;
  thicknessMm: number;
  /** Overrides preset when set */
  rho?: number;
  cp?: number;
  lambda?: number;
  color?: string;
}

export interface NodeProps {
  rho: number;
  cp: number;
  lambda: number;
  color: string;
  layerId: string;
}

export interface SimulationState {
  tExt: number;
  tAirInt: number;
  wallTemps: number[];
}

export type SimSpeed = 1 | 10 | 100;

export const R_SI = 0.13;
export const R_SE = 0.04;
export const DX = 0.001;
export const AIR_RHO = 1.2;
export const AIR_CP = 1005;
export const AIR_DEPTH = 5.0;
/** Nuit tropicale — scénario canicule Paris (cf. presets/parisHeatwave). */
export const INITIAL_TEMP = 26;
export const PX_PER_DEG = 10;
/** Marge sous les thermomètres (px) */
export const MARGIN_BOTTOM = 20;
/** Largeur visuelle des zones d'air (px) — convention graphique, pas 1 px/mm */
export const AIR_ZONE_WIDTH = 100;
/** Largeur des barres thermomètre dans les zones d'air (px), centrées */
export const AIR_BAR_WIDTH = 30;
/** Température max affichable sur les barres de la paroi */
export const MAX_DISPLAY_TEMP = 70;
/** Hauteur min. zone paroi : barres 0–70 °C + marge basse */
export const MIN_WALL_ZONE_HEIGHT = MAX_DISPLAY_TEMP * PX_PER_DEG + MARGIN_BOTTOM;
export const MIN_CANVAS_HEIGHT = MIN_WALL_ZONE_HEIGHT;
export const MIN_DT = 1.0;

/** Irradiance lorsque le soleil est perpendiculaire à la façade (ciel clair d'été), W/m² */
export const G_MAX = 950;
/** Absorptivité solaire — brique rouge / enduit foncé typique Paris */
export const SOLAR_ABSORPTIVITY = 0.65;
