import {
  PARIS_LAT_DEG,
  parisHeatwaveDateISO,
} from "./presets/parisHeatwave";
import { HOURS_PER_DAY } from "./schedule";
import type { SolarPoint } from "./solarSchedule";

export const DEFAULT_LAT_DEG = PARIS_LAT_DEG;
export const SUMMER_DECLINATION_DEG = 23.45;
const MAX_DECLINATION = 23.45;

const DEG = Math.PI / 180;

export interface FacadeOrientation {
  /** 90 = vertical, 0 = horizontal (toit) */
  tiltFromHorizontal: number;
  /** Azimut de la face extérieure (° depuis le nord, sens horaire). 180 = sud. */
  azimuthFacing: number;
}

export interface SolarSite {
  latitudeDeg: number;
  /** Date locale AAAA-MM-JJ (détermine la déclinaison solaire). */
  dateISO: string;
}

export function defaultSeasonDateISO(): string {
  return parisHeatwaveDateISO();
}

export const DEFAULT_SOLAR_SITE: SolarSite = {
  latitudeDeg: PARIS_LAT_DEG,
  dateISO: parisHeatwaveDateISO(),
};

export const DEFAULT_FACADE: FacadeOrientation = {
  tiltFromHorizontal: 90,
  azimuthFacing: 180,
};

function dayOfYear(y: number, m: number, d: number): number {
  const date = new Date(y, m - 1, d);
  const start = new Date(y, 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

/** Déclinaison solaire (°) — approximation sinusoïdale (N jour de l'année). */
export function declinationDegFromDateISO(dateISO: string): number {
  const [ys, ms, ds] = dateISO.split("-");
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  const d = parseInt(ds, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return SUMMER_DECLINATION_DEG;
  }
  const n = dayOfYear(y, m, d);
  // NOAA / Spencer : δ = 23,45° × sin(2π(284 + n)/365,25), n = jour de l'année
  return MAX_DECLINATION * Math.sin((2 * Math.PI * (284 + n)) / 365.25);
}

export function solarDeclination(site: SolarSite): number {
  return declinationDegFromDateISO(site.dateISO);
}

export function clampLatitude(lat: number): number {
  return Math.min(70, Math.max(-60, lat));
}

export function parseSolarSite(latitudeDeg: number, dateISO: string): SolarSite {
  return {
    latitudeDeg: clampLatitude(latitudeDeg),
    dateISO,
  };
}

export function sunPosition(
  hourSolar: number,
  latDeg = DEFAULT_LAT_DEG,
  declDeg = SUMMER_DECLINATION_DEG,
): { altitude: number; azimuthFromNorth: number } | null {
  const phi = latDeg * DEG;
  const delta = declDeg * DEG;
  const omega = (hourSolar - 12) * 15 * DEG;

  const sinAlpha =
    Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(omega);
  if (sinAlpha <= 0) return null;

  const altitude = Math.asin(Math.min(1, sinAlpha));
  const sinAz = Math.sin(omega) * Math.cos(delta);
  const cosAz = Math.cos(omega) * Math.cos(phi) - Math.tan(delta) * Math.sin(phi);
  // Azimut depuis le nord, sens horaire (0° = nord, 180° = sud à midi en hémisphère nord).
  const azimuthFromNorth = Math.atan2(-sinAz, -cosAz);

  return { altitude, azimuthFromNorth };
}

/** Vecteur unitaire du sol vers le soleil (X est, Y haut, Z sud). */
export function sunDirectionUnit(
  hourSolar: number,
  latDeg = DEFAULT_LAT_DEG,
  declDeg = SUMMER_DECLINATION_DEG,
): { x: number; y: number; z: number } | null {
  const sun = sunPosition(hourSolar, latDeg, declDeg);
  if (!sun) return null;
  const c = Math.cos(sun.altitude);
  const x = Math.sin(sun.azimuthFromNorth) * c;
  const y = Math.sin(sun.altitude);
  const z = -Math.cos(sun.azimuthFromNorth) * c;
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

/**
 * Facteur de rayonnement direct (0–1) sur une surface inclinée.
 * 1 = incidence perpendiculaire. β = inclinaison depuis l'horizontale (90 = vertical).
 */
export function facadeBeamFactor(
  hourSolar: number,
  facade: FacadeOrientation,
  latDeg = DEFAULT_LAT_DEG,
  declDeg = SUMMER_DECLINATION_DEG,
): number {
  const sun = sunPosition(hourSolar, latDeg, declDeg);
  if (!sun) return 0;

  const beta = facade.tiltFromHorizontal * DEG;
  const gamma = facade.azimuthFacing * DEG;
  const cosInc =
    Math.sin(sun.altitude) * Math.cos(beta) +
    Math.cos(sun.altitude) * Math.sin(beta) * Math.cos(sun.azimuthFromNorth - gamma);

  return Math.max(0, cosInc);
}

/** Facteur 0–1 à l'heure donnée (évaluation directe, pas d'interpolation circulaire). */
export function solarFactorAt(
  hourOfDay: number,
  facade: FacadeOrientation,
  site: SolarSite = DEFAULT_SOLAR_SITE,
): number {
  const h = ((hourOfDay % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const decl = solarDeclination(site);
  return facadeBeamFactor(h, facade, site.latitudeDeg, decl);
}

export function solarPercentAt(
  hourOfDay: number,
  facade: FacadeOrientation,
  site: SolarSite = DEFAULT_SOLAR_SITE,
): number {
  return solarFactorAt(hourOfDay, facade, site) * 100;
}

/** Profil horaire complet (0 la nuit) pour affichage graphique. */
export function computeSolarProfile(
  facade: FacadeOrientation,
  site: SolarSite = DEFAULT_SOLAR_SITE,
): SolarPoint[] {
  const decl = solarDeclination(site);
  const points: SolarPoint[] = [];
  for (let h = 0; h < HOURS_PER_DAY; h++) {
    points.push({
      hour: h,
      percent: Math.round(facadeBeamFactor(h, facade, site.latitudeDeg, decl) * 1000) / 10,
    });
  }
  return points;
}

export function solarNoonAltitudeDeg(site: SolarSite): number | null {
  const sun = sunPosition(12, site.latitudeDeg, solarDeclination(site));
  if (!sun) return null;
  return (sun.altitude * 180) / Math.PI;
}

export function solarSiteSummary(site: SolarSite): string {
  const decl = solarDeclination(site);
  const lat =
    site.latitudeDeg >= 0
      ? `${site.latitudeDeg.toFixed(1)}°N`
      : `${Math.abs(site.latitudeDeg).toFixed(1)}°S`;
  const [, mm, dd] = site.dateISO.split("-");
  const alt = solarNoonAltitudeDeg(site);
  const altStr = alt !== null ? `, αₘ=${alt.toFixed(0)}°` : ", nuit polaire";
  return `${lat}, ${dd}/${mm} (δ=${decl.toFixed(1)}°${altStr})`;
}

export function facadeLabel(facade: FacadeOrientation): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const i = Math.round(facade.azimuthFacing / 45) % 8;
  const tilt = `${Math.round(facade.tiltFromHorizontal)}°`;
  return `${dirs[i]}, ${tilt}`;
}

/** Rotation Y (rad) pour orienter la face extérieure (+Z local) vers l'azimut donné. */
export function facadeYawRadians(azimuthFacing: number): number {
  return ((180 - azimuthFacing) * Math.PI) / 180;
}
