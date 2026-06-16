import {
  type FacadeOrientation,
  type SolarSite,
  solarFactorAt,
  solarDeclination,
  sunPosition,
} from "./facadeGeometry";

const CARDINAL: Record<number, string> = {
  0: "Nord",
  45: "NE",
  90: "Est",
  135: "SE",
  180: "Sud",
  225: "SO",
  270: "Ouest",
  315: "NO",
};

export function cardinalLabel(azimuthDeg: number): string {
  const snap = (Math.round(azimuthDeg / 45) * 45) % 360;
  return CARDINAL[snap] ?? `${Math.round(azimuthDeg)}°`;
}

/** Azimut (° nord, horaire) depuis la normale horizontale (X est, Z sud). */
export function azimuthFromHorizontalNormal(nx: number, nz: number): number {
  let deg = (Math.atan2(nx, -nz) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return Math.round(deg);
}

export function isFacadeDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get("debug") === "facade" || q.has("debug")) return true;
  try {
    return localStorage.getItem("facadeDebug") === "1";
  } catch {
    return false;
  }
}

export interface FacadeDebugInfo {
  tiltDeg: number;
  azimuthStored: number;
  azimuthFromNormal: number;
  labelStored: string;
  labelFromNormal: string;
  normal: { x: number; y: number; z: number };
  azimuthMismatchDeg: number;
  solarNoonFactor: number;
  solarPeakHour: number;
  solarPeakFactor: number;
  sunNoonAzDeg: number | null;
}

export function computeFacadeDebugInfo(
  facade: FacadeOrientation,
  site: SolarSite,
  normal?: { x: number; y: number; z: number },
): FacadeDebugInfo {
  const n = normal ?? { x: 0, y: 0, z: 1 };
  const azFromNormal = azimuthFromHorizontalNormal(n.x, n.z);
  const decl = solarDeclination(site);

  let peakH = 0;
  let peakF = 0;
  for (let h = 0; h < 24; h += 0.25) {
    const f = solarFactorAt(h, facade, site);
    if (f > peakF) {
      peakF = f;
      peakH = h;
    }
  }

  const noonSun = sunPosition(12, site.latitudeDeg, decl);
  let mismatch = Math.abs(facade.azimuthFacing - azFromNormal);
  if (mismatch > 180) mismatch = 360 - mismatch;

  return {
    tiltDeg: facade.tiltFromHorizontal,
    azimuthStored: facade.azimuthFacing,
    azimuthFromNormal: azFromNormal,
    labelStored: cardinalLabel(facade.azimuthFacing),
    labelFromNormal: cardinalLabel(azFromNormal),
    normal: {
      x: Math.round(n.x * 1000) / 1000,
      y: Math.round(n.y * 1000) / 1000,
      z: Math.round(n.z * 1000) / 1000,
    },
    azimuthMismatchDeg: Math.round(mismatch),
    solarNoonFactor: Math.round(solarFactorAt(12, facade, site) * 1000) / 1000,
    solarPeakHour: Math.round(peakH * 10) / 10,
    solarPeakFactor: Math.round(peakF * 1000) / 1000,
    sunNoonAzDeg: noonSun ? Math.round((noonSun.azimuthFromNorth * 180) / Math.PI) : null,
  };
}

export function logFacadeDebug(info: FacadeDebugInfo): void {
  const warn =
    info.azimuthMismatchDeg > 15 && info.tiltDeg >= 80
      ? " ⚠ écart azimut 3D / valeur stockée"
      : "";
  console.groupCollapsed(
    `[facade] ${info.labelStored} ${info.tiltDeg}° · pic ${info.solarPeakHour}h (${(info.solarPeakFactor * 100).toFixed(0)}%)${warn}`,
  );
  console.table(info);
  console.groupEnd();
}

export function formatFacadeDebugLine(info: FacadeDebugInfo): string {
  const mismatch =
    info.azimuthMismatchDeg > 15 && info.tiltDeg >= 80
      ? ` · ⚠ 3D=${info.labelFromNormal} (${info.azimuthFromNormal}°)`
      : "";
  return (
    `az=${info.azimuthStored}° (${info.labelStored})` +
    ` · normale→${info.azimuthFromNormal}°` +
    ` · pic sol ${info.solarPeakHour}h (${(info.solarPeakFactor * 100).toFixed(0)}%)` +
    ` · midi=${(info.solarNoonFactor * 100).toFixed(0)}%` +
    mismatch
  );
}

export function enableFacadeDebugInConsole(): void {
  try {
    localStorage.setItem("facadeDebug", "1");
  } catch {
    /* ignore */
  }
  console.info(
    "[facade] Debug activé. Désactiver : localStorage.removeItem('facadeDebug') ou ?debug=facade dans l’URL",
  );
}

if (typeof window !== "undefined" && isFacadeDebugEnabled()) {
  (window as unknown as { enableFacadeDebug: () => void }).enableFacadeDebug =
    enableFacadeDebugInConsole;
}
