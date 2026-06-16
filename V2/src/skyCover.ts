/** Couverture nuageuse du ciel. */
export type SkyCover = "clear" | "hazy" | "overcast";

export const DEFAULT_SKY_COVER: SkyCover = "clear";

export const SKY_COVER_LABELS: Record<SkyCover, string> = {
  clear: "Dégagé",
  hazy: "Voilé",
  overcast: "Couvert",
};

export function parseSkyCover(value: string): SkyCover {
  if (value === "hazy" || value === "overcast") return value;
  return "clear";
}

export const SKY_COVER_TIPS: Record<SkyCover, string> = {
  clear: "Ciel dégagé — soleil maximal, ciel froid la nuit (fort refroidissement radiatif)",
  hazy: "Ciel voilé — soleil atténué, ciel intermédiaire",
  overcast: "Ciel couvert — peu de direct, ciel proche de T air (faible refroidissement radiatif)",
};

function skyCoverOptionsHtml(selected: SkyCover): string {
  return (Object.keys(SKY_COVER_LABELS) as SkyCover[])
    .map(
      (id) =>
        `<option value="${id}"${id === selected ? " selected" : ""} title="${SKY_COVER_LABELS[id]} — ${SKY_COVER_TIPS[id]}">${SKY_COVER_LABELS[id]}</option>`,
    )
    .join("");
}

export { skyCoverOptionsHtml };

interface SkyCoverSolarModel {
  /** Transmission du rayonnement direct (0–1). */
  directTrans: number;
  /** Composante diffuse maximale (fraction de G_max en plein jour). */
  diffuseMax: number;
}

const SKY_COVER_SOLAR: Record<SkyCover, SkyCoverSolarModel> = {
  clear: { directTrans: 1.0, diffuseMax: 0.07 },
  hazy: { directTrans: 0.55, diffuseMax: 0.2 },
  overcast: { directTrans: 0.1, diffuseMax: 0.35 },
};

/**
 * Facteur d'irradiance solaire (0–1) tenant compte de la couverture du ciel.
 * beamFactor : facteur géométrique direct (0–1), sunUp : soleil au-dessus de l'horizon.
 */
export function skyCoverSolarFactor(
  beamFactor: number,
  sunUp: boolean,
  cover: SkyCover = DEFAULT_SKY_COVER,
): number {
  if (!sunUp) return 0;
  const { directTrans, diffuseMax } = SKY_COVER_SOLAR[cover];
  const direct = beamFactor * directTrans;
  let diffuse: number;
  if (cover === "overcast") {
    diffuse = diffuseMax;
  } else if (cover === "hazy") {
    diffuse = diffuseMax * (0.4 + 0.6 * beamFactor);
  } else {
    diffuse = diffuseMax * (0.1 + 0.9 * beamFactor);
  }
  return Math.min(1, direct + diffuse);
}
