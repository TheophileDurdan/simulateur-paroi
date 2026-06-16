import type { FacadeOrientation } from "../facadeGeometry";
import type { Layer } from "../types";

export type WallPresetId = "roof-tile-south" | "wall-concrete-south" | "wall-timber";

export interface WallPreset {
  id: WallPresetId;
  name: string;
  facade: FacadeOrientation;
  layers: Layer[];
}

function layer(materialId: string, thicknessMm: number): Layer {
  return { id: crypto.randomUUID(), materialId, thicknessMm };
}

/** Toit 35° sud : tuiles + lame ventilée + Al + laine de roche + placo. */
export function roofTileSouthPreset(): WallPreset {
  return {
    id: "roof-tile-south",
    name: "Toit 35° sud — tuiles",
    facade: { tiltFromHorizontal: 35, azimuthFacing: 180 },
    layers: [
      layer("tuile", 20),
      layer("lame-air-ventilee", 40),
      layer("feuille-alu", 1),
      layer("laine-roche", 200),
      layer("placo", 13),
    ],
  };
}

/** Mur sud : béton armé + EPS + plâtre. */
export function wallConcreteSouthPreset(): WallPreset {
  return {
    id: "wall-concrete-south",
    name: "Mur sud — béton + EPS",
    facade: { tiltFromHorizontal: 90, azimuthFacing: 180 },
    layers: [
      layer("beton-arme", 200),
      layer("eps", 100),
      layer("platre", 13),
    ],
  };
}

/** Mur ossature bois : crépi + OSB + laine de bois + OSB + plâtre. */
export function wallTimberFramePreset(): WallPreset {
  return {
    id: "wall-timber",
    name: "Mur ossature bois",
    facade: { tiltFromHorizontal: 90, azimuthFacing: 180 },
    layers: [
      layer("crepi", 10),
      layer("bois", 18),
      layer("laine-bois", 200),
      layer("bois", 18),
      layer("platre", 13),
    ],
  };
}

export const WALL_PRESETS: WallPreset[] = [
  roofTileSouthPreset(),
  wallConcreteSouthPreset(),
  wallTimberFramePreset(),
];

export function getWallPreset(id: WallPresetId): WallPreset {
  const p = WALL_PRESETS.find((w) => w.id === id);
  if (!p) throw new Error(`Preset paroi inconnu: ${id}`);
  return p;
}

export function defaultWallPreset(): WallPreset {
  return wallConcreteSouthPreset();
}
