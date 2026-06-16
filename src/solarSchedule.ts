import type { FacadeOrientation, SolarSite } from "./facadeGeometry";
import { solarPercentAt } from "./facadeGeometry";
import { simTimeToHour } from "./schedule";

export interface SolarPoint {
  hour: number;
  percent: number;
}

export const SOLAR_MIN = 0;
export const SOLAR_MAX = 100;

export function interpolateSolar(
  facade: FacadeOrientation,
  hourOfDay: number,
  site: SolarSite,
): number {
  return solarPercentAt(hourOfDay, facade, site);
}

export { simTimeToHour };
