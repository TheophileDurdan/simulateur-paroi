import type { SchedulePoint } from "../schedule";

export type ClimatePresetId =
  | "canicule"
  | "ete"
  | "printemps"
  | "automne"
  | "hiver"
  | "hiver-rude";

export interface ClimatePreset {
  id: ClimatePresetId;
  label: string;
  /** Mois-jour (MM-JJ) pour la date solaire, année courante. */
  monthDay: string;
  schedule: readonly { hour: number; temp: number }[];
  initialTemp: number;
}

export const DEFAULT_CLIMATE_PRESET_ID: ClimatePresetId = "canicule";

export const CLIMATE_PRESETS: ClimatePreset[] = [
  {
    id: "canicule",
    label: "Canicule",
    monthDay: "07-25",
    initialTemp: 26,
    schedule: [
      { hour: 0, temp: 26 },
      { hour: 4, temp: 24 },
      { hour: 7, temp: 27 },
      { hour: 10, temp: 33 },
      { hour: 13, temp: 37 },
      { hour: 16, temp: 39 },
      { hour: 19, temp: 36 },
      { hour: 22, temp: 30 },
    ],
  },
  {
    id: "ete",
    label: "Été",
    monthDay: "07-15",
    initialTemp: 18,
    schedule: [
      { hour: 0, temp: 18 },
      { hour: 4, temp: 16 },
      { hour: 7, temp: 18 },
      { hour: 10, temp: 23 },
      { hour: 13, temp: 27 },
      { hour: 16, temp: 30 },
      { hour: 19, temp: 27 },
      { hour: 22, temp: 21 },
    ],
  },
  {
    id: "printemps",
    label: "Printemps",
    monthDay: "04-15",
    initialTemp: 10,
    schedule: [
      { hour: 0, temp: 10 },
      { hour: 4, temp: 8 },
      { hour: 7, temp: 9 },
      { hour: 10, temp: 14 },
      { hour: 13, temp: 18 },
      { hour: 16, temp: 20 },
      { hour: 19, temp: 17 },
      { hour: 22, temp: 12 },
    ],
  },
  {
    id: "automne",
    label: "Automne",
    monthDay: "10-15",
    initialTemp: 11,
    schedule: [
      { hour: 0, temp: 11 },
      { hour: 4, temp: 9 },
      { hour: 7, temp: 10 },
      { hour: 10, temp: 13 },
      { hour: 13, temp: 16 },
      { hour: 16, temp: 18 },
      { hour: 19, temp: 15 },
      { hour: 22, temp: 12 },
    ],
  },
  {
    id: "hiver",
    label: "Hiver",
    monthDay: "01-15",
    initialTemp: 4,
    schedule: [
      { hour: 0, temp: 4 },
      { hour: 4, temp: 2 },
      { hour: 7, temp: 2 },
      { hour: 10, temp: 5 },
      { hour: 13, temp: 7 },
      { hour: 16, temp: 6 },
      { hour: 19, temp: 4 },
      { hour: 22, temp: 3 },
    ],
  },
  {
    id: "hiver-rude",
    label: "Hiver rude",
    monthDay: "02-08",
    initialTemp: -2,
    schedule: [
      { hour: 0, temp: -2 },
      { hour: 4, temp: -5 },
      { hour: 7, temp: -4 },
      { hour: 10, temp: -1 },
      { hour: 13, temp: 1 },
      { hour: 16, temp: 0 },
      { hour: 19, temp: -2 },
      { hour: 22, temp: -3 },
    ],
  },
];

export function getClimatePreset(id: ClimatePresetId): ClimatePreset {
  const p = CLIMATE_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Preset inconnu: ${id}`);
  return p;
}

export function presetDateISO(preset: ClimatePreset, year = new Date().getFullYear()): string {
  return `${year}-${preset.monthDay}`;
}

export function scheduleFromPreset(preset: ClimatePreset): SchedulePoint[] {
  return preset.schedule.map((p) => ({ ...p }));
}
