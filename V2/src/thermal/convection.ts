/**
 * Coefficients de convection simplifiés (EN ISO 6946 / pratique bâtiment).
 * tiltFromHorizontal : 90° = mur vertical, 0° = toit horizontal.
 */

/** Convection extérieure nominale (vent faible), W/m²·K */
export function hExterior(tiltFromHorizontalDeg: number): number {
  const t = Math.min(90, Math.max(0, tiltFromHorizontalDeg));
  if (t >= 75) return 8;
  if (t <= 15) return 4;
  return 4 + ((8 - 4) * (t - 15)) / 60;
}

/** Convection intérieure — paroi verticale, W/m²·K */
export function hInterior(): number {
  return 2.5;
}

/**
 * Coefficient d'échange thermique air int./ext. (W/m²·K) pour un volume d'air
 * de profondeur effective depthM, en fonction du renouvellement d'air (vol/h).
 */
export function ventilationHeatCoeff(
  achPerHour: number,
  depthM = 5,
  rho = 1.2,
  cp = 1005,
): number {
  return (rho * cp * depthM * Math.max(0, achPerHour)) / 3600;
}

/** Convection dans une lame d'air ventilée à grille (échange partiel avec l'ext.), W/m²·K */
export function hCavityGrilleVentilation(thicknessMm: number): number {
  const e = Math.max(20, thicknessMm);
  if (e <= 40) return 5;
  if (e <= 80) return 4;
  return 3;
}

/** Lame ouverte : échange fort avec l'ext. → T air lame ≈ T ext., W/m²·K */
export function hCavityOpenVentilation(_thicknessMm: number): number {
  return 45;
}

export function hCavityToExterior(thicknessMm: number, open: boolean): number {
  return open ? hCavityOpenVentilation(thicknessMm) : hCavityGrilleVentilation(thicknessMm);
}

/** Capacité thermique volumique de l'air de cavité (J/(m²·K) par m² de paroi). */
export function cavityAirCapacitance(thicknessMm: number, rho = 1.2, cp = 1005): number {
  const depthM = Math.max(0.005, thicknessMm / 1000);
  return rho * cp * depthM;
}

/** Convection face paroi ↔ air de cavité (un côté), W/m²·K */
export function hCavitySurface(tiltFromHorizontalDeg: number, thicknessMm: number): number {
  return hCavityConvection(tiltFromHorizontalDeg, thicknessMm) * 0.5;
}

/** @deprecated Ancien couplage direct paroi–ext. ; conservé pour référence. */
export function hVentilatedCavity(thicknessMm: number): number {
  const e = Math.max(20, thicknessMm);
  if (e <= 40) return 18;
  if (e <= 80) return 15;
  return 12;
}

/** @deprecated Utiliser hCavityOpenVentilation */
export function hOpenCavity(thicknessMm: number): number {
  return hVentilatedCavity(thicknessMm) * 1.35;
}

/**
 * Convection dans une cavité d'air fermée non ventilée.
 * Dépend de l'épaisseur et de l'inclinaison de la paroi porteuse.
 */
export function hCavityConvection(tiltFromHorizontalDeg: number, thicknessMm: number): number {
  const e = Math.max(5, thicknessMm);
  let hBase: number;
  if (e <= 15) hBase = 4.5;
  else if (e <= 40) hBase = 3.8;
  else if (e <= 80) hBase = 3.2;
  else hBase = 2.8;

  const t = Math.min(90, Math.max(0, tiltFromHorizontalDeg));
  const tiltFactor = 0.65 + 0.35 * Math.sin((t * Math.PI) / 180);
  return hBase * tiltFactor;
}
