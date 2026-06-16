import { defaultWallPreset } from "./presets/wallPresets";
import type { Layer, MaterialCategory, MaterialKind, MaterialPreset } from "./types";

export interface ResolvedLayer {
  kind: MaterialKind;
  rho: number;
  cp: number;
  lambda: number;
  color: string;
  epsilon: number;
  alphaSolar: number;
}

export interface MaterialCategoryDef {
  id: MaterialCategory;
  label: string;
}

export const MATERIAL_CATEGORIES: MaterialCategoryDef[] = [
  { id: "murs", label: "Murs" },
  { id: "isolants", label: "Isolants" },
  { id: "finition", label: "Finition" },
  { id: "autre", label: "Autre" },
];

const SOLID_DEFAULT_EPS = 0.9;

/** Anciens identifiants → nouveaux (compatibilité couches sauvegardées). */
const LEGACY_ID_MAP: Record<string, string> = {
  "beton-arme": "beton",
  "beton-leger": "beton",
  "brique": "brique-pleine",
  "brique-rouge": "brique-pleine",
  "bloc-beton": "bloc-beton-creux",
  eps: "polystyrene-expanse",
  ouate: "ouate-cellulose",
  bois: "osb",
  crepi: "crepi-sable",
  placo: "plaque-platre",
  mortier: "enduit-chaux",
  tuile: "brique-creuse",
  "laine-verre": "laine-roche",
  pur: "polystyrene-expanse",
  liege: "laine-bois",
  "fibre-bois": "laine-bois",
  terre: "pise",
  xps: "polystyrene-expanse",
  "beton-cell": "beton",
  "lame-air": "lame-air",
  "lame-air-ventilee": "lame-air-ventilee",
  "feuille-alu": "feuille-alu",
};

export const MATERIALS: MaterialPreset[] = [
  // — Murs —
  {
    id: "beton",
    name: "Béton",
    category: "murs",
    kind: "solid",
    rho: 2400,
    cp: 1000,
    lambda: 2.0,
    color: "#6B7C8A",
    epsilon: 0.9,
    alphaSolar: 0.65,
  },
  {
    id: "bloc-beton-creux",
    name: "Blocs de béton creux",
    category: "murs",
    kind: "solid",
    rho: 1400,
    cp: 1000,
    lambda: 0.5,
    color: "#4A5D6B",
    epsilon: 0.9,
    alphaSolar: 0.55,
  },
  {
    id: "pierre",
    name: "Pierre",
    category: "murs",
    kind: "solid",
    rho: 2400,
    cp: 900,
    lambda: 2.5,
    color: "#8D7B68",
    epsilon: 0.9,
    alphaSolar: 0.55,
  },
  {
    id: "pise",
    name: "Pisé",
    category: "murs",
    kind: "solid",
    rho: 1800,
    cp: 1000,
    lambda: 0.9,
    color: "#B8956A",
    epsilon: 0.9,
    alphaSolar: 0.6,
  },
  {
    id: "brique-pleine",
    name: "Brique pleine",
    category: "murs",
    kind: "solid",
    rho: 1800,
    cp: 880,
    lambda: 0.8,
    color: "#C4523D",
    epsilon: 0.91,
    alphaSolar: 0.7,
  },
  {
    id: "brique-creuse",
    name: "Brique creuse",
    category: "murs",
    kind: "solid",
    rho: 1200,
    cp: 880,
    lambda: 0.45,
    color: "#E07B54",
    epsilon: 0.91,
    alphaSolar: 0.65,
  },

  // — Isolants —
  {
    id: "polystyrene-expanse",
    name: "Polystyrène expansé",
    category: "isolants",
    kind: "solid",
    rho: 20,
    cp: 1460,
    lambda: 0.038,
    color: "#FFE566",
    epsilon: 0.9,
    alphaSolar: 0.45,
  },
  {
    id: "laine-roche",
    name: "Laine de roche",
    category: "isolants",
    kind: "solid",
    rho: 30,
    cp: 840,
    lambda: 0.035,
    color: "#5C8DAE",
    epsilon: 0.9,
    alphaSolar: 0.5,
  },
  {
    id: "laine-bois",
    name: "Laine de bois",
    category: "isolants",
    kind: "solid",
    rho: 60,
    cp: 2100,
    lambda: 0.038,
    color: "#6B9E78",
    epsilon: 0.9,
    alphaSolar: 0.5,
  },
  {
    id: "ouate-cellulose",
    name: "Ouate de cellulose",
    category: "isolants",
    kind: "solid",
    rho: 55,
    cp: 2000,
    lambda: 0.039,
    color: "#C9A87C",
    epsilon: 0.9,
    alphaSolar: 0.5,
  },

  // — Finitions —
  {
    id: "crepi-acrylique",
    name: "Crépi acrylique",
    category: "finition",
    kind: "solid",
    rho: 1800,
    cp: 1000,
    lambda: 0.7,
    color: "#F2EDE4",
    epsilon: 0.9,
    alphaSolar: 0.55,
  },
  {
    id: "crepi-sable",
    name: "Crépi au sable",
    category: "finition",
    kind: "solid",
    rho: 1800,
    cp: 1000,
    lambda: 0.7,
    color: "#C9B08A",
    epsilon: 0.9,
    alphaSolar: 0.6,
  },
  {
    id: "platre",
    name: "Plâtre",
    category: "finition",
    kind: "solid",
    rho: 900,
    cp: 1000,
    lambda: 0.4,
    color: "#D4C4B0",
    epsilon: 0.9,
    alphaSolar: 0.5,
  },
  {
    id: "plaque-platre",
    name: "Plaque de plâtre",
    category: "finition",
    kind: "solid",
    rho: 700,
    cp: 1000,
    lambda: 0.25,
    color: "#B8B5D6",
    epsilon: 0.9,
    alphaSolar: 0.5,
  },
  {
    id: "enduit-chaux",
    name: "Enduit à la chaux",
    category: "finition",
    kind: "solid",
    rho: 1800,
    cp: 1000,
    lambda: 0.7,
    color: "#DFE8D0",
    epsilon: 0.9,
    alphaSolar: 0.6,
  },
  {
    id: "bardage-bois",
    name: "Bardage bois",
    category: "finition",
    kind: "solid",
    rho: 550,
    cp: 1600,
    lambda: 0.13,
    color: "#8B5E3C",
    epsilon: 0.9,
    alphaSolar: 0.55,
  },
  {
    id: "osb",
    name: "OSB",
    category: "finition",
    kind: "solid",
    rho: 650,
    cp: 1600,
    lambda: 0.13,
    color: "#C9A227",
    epsilon: 0.9,
    alphaSolar: 0.55,
  },

  // — Autre —
  {
    id: "lame-air",
    name: "Lame d'air (non ventilée)",
    category: "autre",
    kind: "air_gap",
    rho: 0,
    cp: 0,
    lambda: 0,
    color: "#E8EAF6",
    epsilon: 0,
    alphaSolar: 0,
  },
  {
    id: "lame-air-ventilee",
    name: "Lame d'air ventilée",
    category: "autre",
    kind: "air_gap_ventilated",
    rho: 0,
    cp: 0,
    lambda: 0,
    color: "#85C1E9",
    epsilon: 0,
    alphaSolar: 0,
  },
  {
    id: "lame-air-ouverte",
    name: "Lame d'air ouverte",
    category: "autre",
    kind: "air_gap_open",
    rho: 0,
    cp: 0,
    lambda: 0,
    color: "#3498DB",
    epsilon: 0,
    alphaSolar: 0,
  },
  {
    id: "feuille-alu",
    name: "Feuille d'aluminium",
    category: "autre",
    kind: "thin_film",
    rho: 2700,
    cp: 900,
    lambda: 160,
    color: "#AAB7B8",
    epsilon: 0.04,
    alphaSolar: 0.15,
  },
];

export function getMaterial(id: string): MaterialPreset {
  const resolved = LEGACY_ID_MAP[id] ?? id;
  const m = MATERIALS.find((p) => p.id === resolved);
  if (!m) throw new Error(`Matériau inconnu: ${id}`);
  return m;
}

export function materialsByCategory(category: MaterialCategory): MaterialPreset[] {
  return MATERIALS.filter((m) => m.category === category);
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

export function defaultSolidMaterial(): MaterialPreset {
  return MATERIALS.find((m) => m.category === "murs")!;
}
