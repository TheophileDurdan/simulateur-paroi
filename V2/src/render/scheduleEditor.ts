import type { FacadeOrientation, SolarSite } from "../facadeGeometry";
import { solarPercentAt } from "../facadeGeometry";
import type { TempSample, ThermalHistoryData } from "../thermalHistory";
import {
  HOURS_PER_DAY,
  interpolateHourly,
  toHourlyPoints,
  type SchedulePoint,
  type HourlyPoint,
} from "../schedule";
import { INITIAL_TEMP } from "../types";
import {
  CHART_HEIGHT,
  TEMP_CHART_HEIGHT,
  type ChartGraphLayout,
  drawHourlyChart,
  solarGraphLayout,
  tempGraphLayout,
  valueToY,
} from "./chartEditor";

export function computeTempDisplayRange(
  scheduleHourly: HourlyPoint[],
  histories: TempSample[][],
  sampleCurve: (hour: number) => number,
  extraTemps: number[] = [],
): { min: number; max: number; step: number } {
  let min = Infinity;
  let max = -Infinity;

  const add = (v: number) => {
    if (Number.isFinite(v)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  };

  for (const p of scheduleHourly) add(p.value);
  for (let i = 0; i <= 96; i++) add(sampleCurve((i / 96) * HOURS_PER_DAY));
  for (const hist of histories) {
    for (const s of hist) add(s.temp);
  }
  for (const t of extraTemps) add(t);

  if (!Number.isFinite(min)) return { min: 0, max: 50, step: 10 };

  const pad = Math.max(2, (max - min) * 0.06);
  min -= pad;
  max += pad;

  const rawRange = max - min;
  let step = 10;
  if (rawRange <= 12) step = 2;
  else if (rawRange <= 25) step = 5;

  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  if (max - min < step * 2) max = min + step * 2;

  return { min, max, step };
}

export type TempDisplayRange = ReturnType<typeof computeTempDisplayRange>;

export interface TempChartContext {
  layout: ChartGraphLayout;
  tempPts: HourlyPoint[];
  valueStep: number;
  interpolate: (pts: HourlyPoint[], hour: number) => number;
}

export function buildTempChartContext(
  canvasWidth: number,
  schedulePoints: SchedulePoint[],
  history: ThermalHistoryData,
  tempRange?: TempDisplayRange,
  extraTemps: number[] = [],
): TempChartContext {
  const tempPts = toHourlyPoints(schedulePoints);
  const interpolate = (pts: HourlyPoint[], h: number) =>
    interpolateHourly(pts, h, INITIAL_TEMP);
  const range =
    tempRange ??
    computeTempDisplayRange(
      tempPts,
      [history.airInt, history.wallInt, history.wallExt],
      (h) => interpolate(tempPts, h),
      extraTemps,
    );
  return {
    layout: tempGraphLayout(canvasWidth, range.min, range.max),
    tempPts,
    valueStep: range.step,
    interpolate,
  };
}

function drawHistoryTrace(
  ctx: CanvasRenderingContext2D,
  g: ChartGraphLayout,
  history: TempSample[],
  simTimeSec: number,
  color: string,
) {
  const cutoff = simTimeSec - 86400;
  const pts = history
    .filter((s) => s.simTime >= cutoff)
    .sort((a, b) => a.simTime - b.simTime);

  if (pts.length < 1) return;

  if (pts.length === 1) {
    const hour = ((pts[0].simTime / 3600) % HOURS_PER_DAY + HOURS_PER_DAY) % HOURS_PER_DAY;
    const px = g.x + (hour / HOURS_PER_DAY) * g.width;
    const py = valueToY(pts[0].temp, g);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;

  for (let i = 0; i < pts.length; i++) {
    const hour =
      ((pts[i].simTime / 3600) % HOURS_PER_DAY + HOURS_PER_DAY) % HOURS_PER_DAY;
    const px = g.x + (hour / HOURS_PER_DAY) * g.width;
    const py = valueToY(pts[i].temp, g);

    if (!started) {
      ctx.moveTo(px, py);
      started = true;
      continue;
    }

    const prevHour =
      ((pts[i - 1].simTime / 3600) % HOURS_PER_DAY + HOURS_PER_DAY) % HOURS_PER_DAY;
    const dt = pts[i].simTime - pts[i - 1].simTime;
    if (hour < prevHour - 0.5 || dt > 7200) {
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
}

function drawLegendLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(text, x, y);
}

export function drawChartsPanel(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  schedulePoints: SchedulePoint[],
  facade: FacadeOrientation,
  site: SolarSite,
  simTimeSec: number,
  history: ThermalHistoryData,
  facadeSummary: string,
  tempRange: TempDisplayRange,
) {
  const { layout: tempG, tempPts, valueStep, interpolate } = buildTempChartContext(
    canvasWidth,
    schedulePoints,
    history,
    tempRange,
  );

  drawHourlyChart(
    ctx,
    canvasWidth,
    0,
    tempG.bottom,
    tempG,
    tempPts,
    simTimeSec,
    {
      bg: "#eef5fb",
      grid: "#b0c4de",
      line: "#1565c0",
      pointStroke: "#1565c0",
      label: "— T ext. consigne",
      labelColor: "#1565c0",
      unit: "°C",
      valueStep,
    },
    interpolate,
    true,
    true,
  );

  drawLegendLine(ctx, tempG.x + 118, 12, "— T air int.", "#e65100");
  drawLegendLine(ctx, tempG.x + 218, 12, "— T paroi ext.", "#c62828");
  drawLegendLine(ctx, tempG.x + 328, 12, "— T paroi int.", "#2e7d32");

  drawHistoryTrace(ctx, tempG, history.airInt, simTimeSec, "#e65100");
  drawHistoryTrace(ctx, tempG, history.wallExt, simTimeSec, "#c62828");
  drawHistoryTrace(ctx, tempG, history.wallInt, simTimeSec, "#2e7d32");

  const solarG = solarGraphLayout(canvasWidth);

  drawHourlyChart(
    ctx,
    canvasWidth,
    TEMP_CHART_HEIGHT,
    solarG.bottom - TEMP_CHART_HEIGHT,
    solarG,
    [],
    simTimeSec,
    {
      bg: "#fff8e7",
      grid: "#e8d4a8",
      line: "#f57f17",
      pointStroke: "#e65100",
      label: `— Rayonnement solaire (${facadeSummary})`,
      labelColor: "#f57f17",
      unit: "%",
      valueStep: 25,
    },
    (_pts, h) => solarPercentAt(h, facade, site),
    false,
    false,
  );

  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, CHART_HEIGHT);
  ctx.lineTo(canvasWidth, CHART_HEIGHT);
  ctx.stroke();
}

export {
  CHART_HEIGHT,
  TEMP_CHART_HEIGHT,
  chartMouseDown,
  chartMouseMove,
  chartMouseUp,
  chartTargetAt,
  isInChartArea,
  isInSolarChartArea,
  isInTempChartArea,
  scheduleGraphLayout,
  solarGraphLayout,
  tempGraphLayout,
  type ChartTarget,
  type ScheduleDragState,
} from "./chartEditor";
