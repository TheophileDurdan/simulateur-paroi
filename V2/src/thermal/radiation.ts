import type { SkyCover } from "../skyCover";
import { DEFAULT_SKY_COVER } from "../skyCover";
import { STEFAN_BOLTZMANN } from "../types";

export function kelvin(celsius: number): number {
  return celsius + 273.15;
}

/** Émissivité équivalente entre deux surfaces infinies parallèles. */
export function effectiveEmissivity(eps1: number, eps2: number): number {
  const e1 = Math.min(0.999, Math.max(0.01, eps1));
  const e2 = Math.min(0.999, Math.max(0.01, eps2));
  return 1 / (1 / e1 + 1 / e2 - 1);
}

/** Flux radiatif net (W/m²), modèle T⁴ entre deux surfaces. */
export function radiantFluxT4(t1C: number, t2C: number, eps1: number, eps2: number): number {
  const T1 = kelvin(t1C);
  const T2 = kelvin(t2C);
  const epsEff = effectiveEmissivity(eps1, eps2);
  return epsEff * STEFAN_BOLTZMANN * (T1 ** 4 - T2 ** 4);
}

/** Coefficient radiatif linéarisé hr (W/m²·K) au voisinage de T_mean. */
export function linearizedHr(t1C: number, t2C: number, eps1: number, eps2: number): number {
  const Tm = (kelvin(t1C) + kelvin(t2C)) / 2;
  const epsEff = effectiveEmissivity(eps1, eps2);
  return 4 * epsEff * STEFAN_BOLTZMANN * Tm ** 3;
}

/**
 * Fraction de l'hémisphère extérieur rayonnant vers le ciel.
 * toit plat (0°) → 1 ; mur vertical (90°) → 0,5 (sol à T_paroi → échange nul).
 */
export function skyViewFactor(tiltFromHorizontalDeg: number): number {
  const beta = (Math.min(90, Math.max(0, tiltFromHorizontalDeg)) * Math.PI) / 180;
  return (1 + Math.cos(beta)) / 2;
}

/**
 * Température effective du ciel pour le rayonnement IR, °C.
 * Ciel dégagé : Swinbank (ciel froid). Voilé / couvert : rapprochement de T_air.
 */
export function effectiveSkyTempC(
  tExtC: number,
  skyCover: SkyCover = DEFAULT_SKY_COVER,
): number {
  const TairK = kelvin(tExtC);
  const tClear = 0.0552 * TairK ** 1.5 - 273.15;
  switch (skyCover) {
    case "clear":
      return tClear;
    case "hazy":
      return 0.4 * tClear + 0.6 * (tExtC - 5);
    case "overcast":
      return tExtC - 1.5;
  }
}

/**
 * Flux net ciel → surface (W/m²), positif = gain thermique vers la paroi.
 * Le sol (complément de l'hémisphère) est à T_paroi : pas de terme additionnel.
 */
export function skyRadiationFlux(
  tSurfC: number,
  tSkyC: number,
  epsilon: number,
  skyFactor: number,
): number {
  const Ts = kelvin(tSurfC);
  const Tsky = kelvin(tSkyC);
  const eps = Math.min(0.999, Math.max(0.01, epsilon));
  return skyFactor * eps * STEFAN_BOLTZMANN * (Tsky ** 4 - Ts ** 4);
}
