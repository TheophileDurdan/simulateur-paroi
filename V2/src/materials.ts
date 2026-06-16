import { defaultWallPreset } from "./presets/wallPresets";
import type { Layer, MaterialKind, MaterialPreset } from "./types";

export interface ResolvedLayer {
  kind: MaterialKind;
  rho: number;
  cp: number;
  lambda: number;
  color: string;
  epsilon: number;
  alphaSolar: number;
}

const SOLID_DEFAULT_EPS = 0.9;

export const MATERIALS: MaterialPreset[] = [
  { id: "beton-arme", name: "Béton armé", kind: "solid", rho: 2400, cp: 1000, lambda: 2.0, color: "#9E9E9E", epsilon: 0.9, alphaSolar: 0.65 },
  { id: "beton-leger", name: "Béton léger", kind: "solid", rho: 1800, cp: 1000, lambda: 0.8, color: "#BDBDBD", epsilon: 0.9, alphaSolar: 0.6 },
  { id: "brique", name: "Brique pleine", kind: "solid", rho: 1800, cp: 880, lambda: 0.8, color: "#C62828", epsilon: 0.91, alphaSolar: 0.7 },
  { id: "bloc-beton", name: "Bloc béton creux", kind: "solid", rho: 1400, cp: 1000, lambda: 0.5, color: "#E0E0E0", epsilon: 0.9, alphaSolar: 0.55 },
  { id: "mortier", name: "Mortier chaux", kind: "solid", rho: 1800, cp: 1000, lambda: 0.7, color: "#D7CCC8", epsilon: 0.9, alphaSolar: 0.6 },
  { id: "platre", name: "Plâtre", kind: "solid", rho: 900, cp: 1000, lambda: 0.4, color: "#FFF8E1", epsilon: 0.9, alphaSolar: 0.5 },
  { id: "bois", name: "OSB / bois massif", kind: "solid", rho: 650, cp: 1600, lambda: 0.13, color: "#8D6E63", epsilon: 0.9, alphaSolar: 0.55 },
  { id: "laine-verre", name: "Laine de verre", kind: "solid", rho: 20, cp: 840, lambda: 0.032, color: "#FFCC80", epsilon: 0.9, alphaSolar: 0.5 },
  { id: "laine-roche", name: "Laine de roche", kind: "solid", rho: 30, cp: 840, lambda: 0.035, color: "#90A4AE", epsilon: 0.9, alphaSolar: 0.5 },
  { id: "eps", name: "Polystyrène expansé (EPS)", kind: "solid", rho: 20, cp: 1460, lambda: 0.038, color: "#FFFFFF", epsilon: 0.9, alphaSolar: 0.45 },
  { id: "pur", name: "Polyuréthane (PUR)", kind: "solid", rho: 35, cp: 1400, lambda: 0.025, color: "#FFF59D", epsilon: 0.9, alphaSolar: 0.45 },
  { id: "liege", name: "Liège expansé", kind: "solid", rho: 120, cp: 1800, lambda: 0.04, color: "#A1887F", epsilon: 0.9, alphaSolar: 0.5 },
  { id: "laine-bois", name: "Laine de bois", kind: "solid", rho: 60, cp: 2100, lambda: 0.038, color: "#A5D6A7", epsilon: 0.9, alphaSolar: 0.5 },
  { id: "fibre-bois", name: "Fibre de bois (panneau)", kind: "solid", rho: 150, cp: 2100, lambda: 0.04, color: "#81C784", epsilon: 0.9, alphaSolar: 0.5 },
  { id: "ouate", name: "Ouate de cellulose", kind: "solid", rho: 55, cp: 2000, lambda: 0.039, color: "#BCAAA4", epsilon: 0.9, alphaSolar: 0.5 },
  { id: "pierre", name: "Pierre calcaire", kind: "solid", rho: 2400, cp: 900, lambda: 2.5, color: "#D5D5C5", epsilon: 0.9, alphaSolar: 0.55 },
  { id: "terre", name: "Terre crue", kind: "solid", rho: 1800, cp: 1000, lambda: 0.9, color: "#C4A574", epsilon: 0.9, alphaSolar: 0.6 },
  { id: "xps", name: "Polystyrène extrudé (XPS)", kind: "solid", rho: 35, cp: 1460, lambda: 0.034, color: "#E3F2FD", epsilon: 0.9, alphaSolar: 0.45 },
  { id: "beton-cell", name: "Béton cellulaire", kind: "solid", rho: 600, cp: 1000, lambda: 0.17, color: "#CFD8DC", epsilon: 0.9, alphaSolar: 0.55 },
  { id: "brique-rouge", name: "Brique rouge", kind: "solid", rho: 1700, cp: 880, lambda: 0.77, color: "#B71C1C", epsilon: 0.91, alphaSolar: 0.7 },
  { id: "tuile", name: "Tuile terre cuite", kind: "solid", rho: 1900, cp: 840, lambda: 1.0, color: "#BF360C", epsilon: 0.91, alphaSolar: 0.72 },
  { id: "crepi", name: "Crépi / enduit", kind: "solid", rho: 1800, cp: 1000, lambda: 0.7, color: "#D7CCC8", epsilon: 0.9, alphaSolar: 0.6 },
  { id: "placo", name: "Plaque de plâtre (BA13)", kind: "solid", rho: 700, cp: 1000, lambda: 0.25, color: "#FAFAFA", epsilon: 0.9, alphaSolar: 0.5 },
  {
    id: "lame-air",
    name: "Lame d'air (cavité fermée)",
    kind: "air_gap",
    rho: 0,
    cp: 0,
    lambda: 0,
    color: "#B3E5FC",
    epsilon: 0,
    alphaSolar: 0,
  },
  {
    id: "lame-air-ventilee",
    name: "Lame d'air ventilée",
    kind: "air_gap_ventilated",
    rho: 0,
    cp: 0,
    lambda: 0,
    color: "#81D4FA",
    epsilon: 0,
    alphaSolar: 0,
  },
  {
    id: "feuille-alu",
    name: "Feuille d'aluminium",
    kind: "thin_film",
    rho: 2700,
    cp: 900,
    lambda: 160,
    color: "#B0BEC5",
    epsilon: 0.04,
    alphaSolar: 0.15,
  },
];

export function getMaterial(id: string): MaterialPreset {
  const m = MATERIALS.find((p) => p.id === id);
  if (!m) throw new Error(`Matériau inconnu: ${id}`);
  return m;
}

export function resolveLayer(layer: Layer): ResolvedLayer {
  const preset = getMaterial(layer.materialId);
  return {
    kind: preset.kind,
    rho: layer.rho ?? preset.rho,
    cp: layer.cp ?? preset.cp,
    lambda: layer.lambda ?? preset.lambda,
    color: layer.color ?? preset.color,
    epsilon: layer.epsilon ?? preset.epsilon ?? SOLID_DEFAULT_EPS,
    alphaSolar: layer.alphaSolar ?? preset.alphaSolar,
  };
}

export function defaultLayers() {
  return defaultWallPreset().layers.map((l) => ({ ...l, id: crypto.randomUUID() }));
}
