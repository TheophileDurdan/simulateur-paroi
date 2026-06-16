import type { HourlyPoint } from "../schedule";
import { HOURS_PER_DAY, simTimeToHour } from "../schedule";

export const TEMP_CHART_HEIGHT = 260;
export const SOLAR_CHART_HEIGHT = 130;
export const CHART_HEIGHT = TEMP_CHART_HEIGHT + SOLAR_CHART_HEIGHT;

const SCALE_WIDTH = 36;
const GRAPH_PAD_RIGHT = 10;
const GRAPH_TOP = 18;
const GRAPH_BOTTOM_PAD = 14;
const POINT_RADIUS = 6;
const DRAG_THRESHOLD = 4;

export interface ChartGraphLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  bottom: number;
  valueMin: number;
  valueMax: number;
}

export interface ChartStyle {
  bg: string;
  grid: string;
  line: string;
  pointStroke: string;
  label: string;
  labelColor: string;
  unit: string;
  valueStep: number;
}

export interface ScheduleDragState {
  pointIndex: number;
  startX: number;
  startY: number;
  moved: boolean;
  createdOnDown: boolean;
}

function graphLayout(
  canvasWidth: number,
  top: number,
  blockHeight: number,
  valueMin: number,
  valueMax: number,
): ChartGraphLayout {
  return {
    x: SCALE_WIDTH + 4,
    y: top + GRAPH_TOP,
    width: canvasWidth - SCALE_WIDTH - GRAPH_PAD_RIGHT - 4,
    height: blockHeight - GRAPH_TOP - GRAPH_BOTTOM_PAD,
    bottom: top + blockHeight,
    valueMin,
    valueMax,
  };
}

export function tempGraphLayout(
  canvasWidth: number,
  valueMin = 0,
  valueMax = 50,
): ChartGraphLayout {
  return graphLayout(canvasWidth, 0, TEMP_CHART_HEIGHT, valueMin, valueMax);
}

export function valueToY(value: number, g: ChartGraphLayout): number {
  const v = Math.min(g.valueMax, Math.max(g.valueMin, value));
  const range = g.valueMax - g.valueMin || 1;
  const ratio = (v - g.valueMin) / range;
  return g.y + g.height * (1 - ratio);
}

export function solarGraphLayout(canvasWidth: number): ChartGraphLayout {
  return graphLayout(canvasWidth, TEMP_CHART_HEIGHT, SOLAR_CHART_HEIGHT, 0, 100);
}

/** @deprecated use tempGraphLayout */
export function scheduleGraphLayout(canvasWidth: number): ChartGraphLayout {
  return tempGraphLayout(canvasWidth);
}

function hourToX(hour: number, g: ChartGraphLayout): number {
  return g.x + (hour / HOURS_PER_DAY) * g.width;
}

function xToHour(x: number, g: ChartGraphLayout): number {
  const ratio = (x - g.x) / g.width;
  const hour = Math.round(ratio * HOURS_PER_DAY) % HOURS_PER_DAY;
  return hour < 0 ? hour + HOURS_PER_DAY : hour;
}

function yToValue(y: number, g: ChartGraphLayout): number {
  const ratio = 1 - (y - g.y) / g.height;
  const range = g.valueMax - g.valueMin;
  return Math.min(
    g.valueMax,
    Math.max(g.valueMin, g.valueMin + ratio * range),
  );
}

function drawValueScale(ctx: CanvasRenderingContext2D, g: ChartGraphLayout, step: number, unit: string) {
  ctx.fillStyle = "#555";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "right";

  for (let v = g.valueMin; v <= g.valueMax; v += step) {
    const y = valueToY(v, g);
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.x - 5, y);
    ctx.lineTo(g.x, y);
    ctx.stroke();
    ctx.fillText(`${Math.round(v)}`, g.x - 7, y + 3);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#666";
  ctx.font = "9px system-ui, sans-serif";
  ctx.fillText(unit, SCALE_WIDTH / 2, g.y - 4);
}

function drawHourGrid(ctx: CanvasRenderingContext2D, g: ChartGraphLayout, showHourLabels: boolean) {
  ctx.strokeStyle = "#b0c4de";
  ctx.lineWidth = 1;
  for (let h = 0; h <= HOURS_PER_DAY; h += 6) {
    const x = hourToX(h, g);
    ctx.beginPath();
    ctx.moveTo(x, g.y);
    ctx.lineTo(x, g.y + g.height);
    ctx.stroke();
    if (showHourLabels && h < HOURS_PER_DAY) {
      ctx.fillStyle = "#666";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${h}h`, x, g.bottom - 2);
    }
  }
}

function drawValueGrid(ctx: CanvasRenderingContext2D, g: ChartGraphLayout, step: number) {
  for (let v = g.valueMin; v <= g.valueMax; v += step) {
    const y = valueToY(v, g);
    ctx.strokeStyle = "#c5d8eb";
    ctx.beginPath();
    ctx.moveTo(g.x, y);
    ctx.lineTo(g.x + g.width, y);
    ctx.stroke();
  }
}

function drawCurrentHourLine(
  ctx: CanvasRenderingContext2D,
  g: ChartGraphLayout,
  simTimeSec: number,
) {
  const cx = hourToX(simTimeToHour(simTimeSec), g);
  ctx.strokeStyle = "rgba(120, 120, 120, 0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, g.y);
  ctx.lineTo(cx, g.y + g.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawControlPoints(
  ctx: CanvasRenderingContext2D,
  g: ChartGraphLayout,
  points: HourlyPoint[],
  strokeColor: string,
) {
  for (const p of points) {
    const px = hourToX(p.hour % HOURS_PER_DAY, g);
    const py = valueToY(p.value, g);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

export function drawHourlyChart(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  top: number,
  blockHeight: number,
  g: ChartGraphLayout,
  points: HourlyPoint[],
  simTimeSec: number,
  style: ChartStyle,
  interpolate: (pts: HourlyPoint[], hour: number) => number,
  showHourLabels: boolean,
  editable = true,
) {
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, top, canvasWidth, blockHeight);

  drawHourGrid(ctx, g, showHourLabels);
  drawValueGrid(ctx, g, style.valueStep);

  ctx.strokeStyle = "#78909c";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(g.x, g.y, g.width, g.height);

  drawValueScale(ctx, g, style.valueStep, style.unit);

  ctx.strokeStyle = style.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const samples = 96;
  for (let i = 0; i <= samples; i++) {
    const hour = (i / samples) * HOURS_PER_DAY;
    const value = interpolate(points, hour);
    const x = hourToX(hour, g);
    const y = valueToY(value, g);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  drawCurrentHourLine(ctx, g, simTimeSec);
  if (editable) drawControlPoints(ctx, g, points, style.pointStroke);

  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = style.labelColor;
  ctx.fillText(style.label, g.x + 4, top + 12);
}

export function hitChartPoint(
  mx: number,
  my: number,
  g: ChartGraphLayout,
  points: HourlyPoint[],
): number {
  for (let i = points.length - 1; i >= 0; i--) {
    const px = hourToX(points[i].hour % HOURS_PER_DAY, g);
    const py = valueToY(points[i].value, g);
    const dx = mx - px;
    const dy = my - py;
    if (dx * dx + dy * dy <= (POINT_RADIUS + 3) ** 2) return i;
  }
  return -1;
}

export function isInsideChart(mx: number, my: number, g: ChartGraphLayout): boolean {
  return mx >= g.x && mx <= g.x + g.width && my >= g.y && my <= g.y + g.height;
}

export function chartMouseDown(
  mx: number,
  my: number,
  g: ChartGraphLayout,
  points: HourlyPoint[],
): { drag: ScheduleDragState | null; points: HourlyPoint[] } {
  const hit = hitChartPoint(mx, my, g, points);
  if (hit >= 0) {
    return {
      drag: { pointIndex: hit, startX: mx, startY: my, moved: false, createdOnDown: false },
      points,
    };
  }

  if (!isInsideChart(mx, my, g)) {
    return { drag: null, points };
  }

  const hour = xToHour(mx, g);
  const existing = points.findIndex(
    (p) => Math.round(p.hour) % HOURS_PER_DAY === hour,
  );
  if (existing >= 0) {
    return {
      drag: {
        pointIndex: existing,
        startX: mx,
        startY: my,
        moved: false,
        createdOnDown: false,
      },
      points,
    };
  }

  const value = yToValue(my, g);
  const next = [...points, { hour, value }];
  return {
    drag: {
      pointIndex: next.length - 1,
      startX: mx,
      startY: my,
      moved: false,
      createdOnDown: true,
    },
    points: next,
  };
}

export function chartMouseMove(
  mx: number,
  my: number,
  g: ChartGraphLayout,
  points: HourlyPoint[],
  drag: ScheduleDragState,
): HourlyPoint[] {
  const dx = mx - drag.startX;
  const dy = my - drag.startY;
  if (!drag.moved && dx * dx + dy * dy > DRAG_THRESHOLD ** 2) {
    drag.moved = true;
  }
  if (!drag.moved) return points;

  const next = [...points];
  next[drag.pointIndex] = {
    hour: xToHour(mx, g),
    value: yToValue(my, g),
  };
  return next;
}

export function chartMouseUp(
  points: HourlyPoint[],
  drag: ScheduleDragState | null,
): HourlyPoint[] {
  if (!drag) return points;
  if (!drag.moved && !drag.createdOnDown) {
    return points.filter((_, i) => i !== drag.pointIndex);
  }
  return points;
}

export function isInTempChartArea(my: number): boolean {
  return my >= 0 && my < TEMP_CHART_HEIGHT;
}

export function isInSolarChartArea(my: number): boolean {
  return my >= TEMP_CHART_HEIGHT && my < CHART_HEIGHT;
}

export function isInChartArea(my: number): boolean {
  return my >= 0 && my < CHART_HEIGHT;
}

export type ChartTarget = "temp" | "solar";

export function chartTargetAt(my: number): ChartTarget | null {
  if (isInTempChartArea(my)) return "temp";
  return null;
}
