import { parisHeatwaveLayers } from "./presets/parisHeatwave";
import type { MaterialPreset } from "./types";

export const MATERIALS: MaterialPreset[] = [
  { id: "beton-arme", name: "Béton armé", rho: 2400, cp: 1000, lambda: 2.0, color: "#9E9E9E" },
  { id: "beton-leger", name: "Béton léger", rho: 1800, cp: 1000, lambda: 0.8, color: "#BDBDBD" },
  { id: "brique", name: "Brique pleine", rho: 1800, cp: 880, lambda: 0.8, color: "#C62828" },
  { id: "bloc-beton", name: "Bloc béton creux", rho: 1400, cp: 1000, lambda: 0.5, color: "#E0E0E0" },
  { id: "mortier", name: "Mortier chaux", rho: 1800, cp: 1000, lambda: 0.7, color: "#D7CCC8" },
  { id: "platre", name: "Plâtre", rho: 900, cp: 1000, lambda: 0.4, color: "#FFF8E1" },
  { id: "bois", name: "OSB / bois massif", rho: 650, cp: 1600, lambda: 0.13, color: "#8D6E63" },
  { id: "laine-verre", name: "Laine de verre", rho: 20, cp: 840, lambda: 0.032, color: "#FFCC80" },
  { id: "laine-roche", name: "Laine de roche", rho: 30, cp: 840, lambda: 0.035, color: "#90A4AE" },
  { id: "eps", name: "Polystyrène expansé (EPS)", rho: 20, cp: 1460, lambda: 0.038, color: "#FFFFFF" },
  { id: "pur", name: "Polyuréthane (PUR)", rho: 35, cp: 1400, lambda: 0.025, color: "#FFF59D" },
  { id: "liege", name: "Liège expansé", rho: 120, cp: 1800, lambda: 0.04, color: "#A1887F" },
  { id: "laine-bois", name: "Laine de bois", rho: 60, cp: 2100, lambda: 0.038, color: "#A5D6A7" },
  { id: "fibre-bois", name: "Fibre de bois (panneau)", rho: 150, cp: 2100, lambda: 0.04, color: "#81C784" },
  { id: "ouate", name: "Ouate de cellulose", rho: 55, cp: 2000, lambda: 0.039, color: "#BCAAA4" },
  { id: "pierre", name: "Pierre calcaire", rho: 2400, cp: 900, lambda: 2.5, color: "#D5D5C5" },
  { id: "terre", name: "Terre crue", rho: 1800, cp: 1000, lambda: 0.9, color: "#C4A574" },
  { id: "xps", name: "Polystyrène extrudé (XPS)", rho: 35, cp: 1460, lambda: 0.034, color: "#E3F2FD" },
  { id: "beton-cell", name: "Béton cellulaire", rho: 600, cp: 1000, lambda: 0.17, color: "#CFD8DC" },
  { id: "brique-rouge", name: "Brique rouge", rho: 1700, cp: 880, lambda: 0.77, color: "#B71C1C" },
];

export function getMaterial(id: string): MaterialPreset {
  const m = MATERIALS.find((p) => p.id === id);
  if (!m) throw new Error(`Matériau inconnu: ${id}`);
  return m;
}

export function defaultLayers() {
  return parisHeatwaveLayers();
}
