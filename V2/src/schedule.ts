import {
  DEFAULT_CLIMATE_PRESET_ID,
  getClimatePreset,
  scheduleFromPreset,
} from "./presets/climatePresets";
import { INITIAL_TEMP } from "./types";

export interface SchedulePoint {
  hour: number;
  temp: number;
}

export interface HourlyPoint {
  hour: number;
  value: number;
}

export const SCHEDULE_TEMP_MIN = -15;
export const SCHEDULE_TEMP_MAX = 50;
export const HOURS_PER_DAY = 24;

export function defaultSchedule(): SchedulePoint[] {
  return scheduleFromPreset(getClimatePreset(DEFAULT_CLIMATE_PRESET_ID));
}

export function sortHourly<T extends HourlyPoint>(points: T[]): T[] {
  return [...points].sort((a, b) => a.hour - b.hour);
}

export function interpolateHourly(
  points: HourlyPoint[],
  hourOfDay: number,
  defaultValue: number,
): number {
  if (points.length === 0) return defaultValue;
  if (points.length === 1) return points[0].value;

  const sorted = sortHourly(points);
  const h = ((hourOfDay % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    let h1 = curr.hour;
    let h2 = next.hour;
    if (h2 <= h1) h2 += HOURS_PER_DAY;
    let hh = h;
    if (h < sorted[0].hour && i === sorted.length - 1) hh += HOURS_PER_DAY;

    if (hh >= h1 && hh < h2) {
      const f = (hh - h1) / (h2 - h1);
      return curr.value + f * (next.value - curr.value);
    }
    if (hh === h2 && h2 === HOURS_PER_DAY && next === sorted[0]) {
      return next.value;
    }
  }

  return sorted[sorted.length - 1].value;
}

export function interpolateSchedule(points: SchedulePoint[], hourOfDay: number): number {
  if (points.length === 0) return INITIAL_TEMP;
  return interpolateHourly(
    points.map((p) => ({ hour: p.hour, value: p.temp })),
    hourOfDay,
    INITIAL_TEMP,
  );
}

export function simTimeToHour(simTimeSec: number): number {
  return ((simTimeSec / 3600) % HOURS_PER_DAY + HOURS_PER_DAY) % HOURS_PER_DAY;
}

export function toHourlyPoints(
  points: SchedulePoint[],
): HourlyPoint[] {
  return points.map((p) => ({ hour: p.hour, value: p.temp }));
}

export function fromHourlyPoints(points: HourlyPoint[]): SchedulePoint[] {
  return points.map((p) => ({ hour: p.hour, temp: p.value }));
}
