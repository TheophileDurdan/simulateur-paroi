import {
  AIR_BAR_WIDTH,
  AIR_ZONE_WIDTH,
  MARGIN_BOTTOM,
} from "../types";
import type { ThermalMesh } from "../thermal/solver";
import { visualWeights } from "../thermal/solver";
import type { TempDisplayRange } from "./scheduleEditor";

const WALL_TOP_PAD = 8;
const TEMP_BAR_COLOR = "rgba(220, 40, 40, 0.5)";
const GAP_HATCH = "rgba(100, 180, 230, 0.35)";
const FILM_SHINE = "rgba(255, 255, 255, 0.45)";

export interface WallLayout {
  width: number;
  height: number;
  wallTop: number;
  wallX: number;
  wallW: number;
  colWidths: number[];
  baselineY: number;
  plotHeight: number;
  tempMin: number;
  tempMax: number;
  valueStep: number;
  extAuto: boolean;
}

export function computeWallLayout(
  canvasWidth: number,
  canvasHeight: number,
  mesh: ThermalMesh,
  extAuto: boolean,
  tempRange: TempDisplayRange,
): WallLayout {
  const wallTop = WALL_TOP_PAD;
  const baselineY = canvasHeight - MARGIN_BOTTOM;
  const plotHeight = Math.max(1, baselineY - wallTop);
  const wallW = Math.max(1, canvasWidth - 2 * AIR_ZONE_WIDTH);
  const weights = visualWeights(mesh);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const colWidths = weights.map((w) => (wallW * w) / total);

  return {
    width: canvasWidth,
    height: canvasHeight,
    wallTop,
    wallX: AIR_ZONE_WIDTH,
    wallW,
    colWidths,
    baselineY,
    plotHeight,
    tempMin: tempRange.min,
    tempMax: tempRange.max,
    valueStep: tempRange.step,
    extAuto,
  };
}

function tempToY(temp: number, layout: WallLayout): number {
  const span = layout.tempMax - layout.tempMin || 1;
  const ratio = Math.max(0, Math.min(1, (temp - layout.tempMin) / span));
  return layout.baselineY - ratio * layout.plotHeight;
}

function drawTempBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  layout: WallLayout,
  temp: number,
  interactive = false,
) {
  const top = Math.max(layout.wallTop, tempToY(temp, layout));

  ctx.fillStyle = TEMP_BAR_COLOR;
  ctx.fillRect(x, top, width, layout.baselineY - top);

  if (interactive) {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, top, width, layout.baselineY - top);
  }
}

function drawAirZoneTemp(
  ctx: CanvasRenderingContext2D,
  zoneX: number,
  zoneW: number,
  layout: WallLayout,
  temp: number,
  accent: string,
) {
  const barTop = Math.max(layout.wallTop, tempToY(temp, layout));
  const midY = (barTop + layout.baselineY) / 2;

  ctx.fillStyle = accent;
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${temp.toFixed(1)} °C`, zoneX + zoneW / 2, midY);
}

function drawScale(ctx: CanvasRenderingContext2D, layout: WallLayout) {
  const x = layout.wallX + 4;
  ctx.fillStyle = "#555";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "left";

  const span = layout.tempMax - layout.tempMin || 1;
  for (let t = layout.tempMin; t <= layout.tempMax + 0.001; t += layout.valueStep) {
    const ratio = (t - layout.tempMin) / span;
    const y = layout.baselineY - ratio * layout.plotHeight;
    ctx.strokeStyle = "#ccc";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y);
    ctx.stroke();
    ctx.fillText(`${Math.round(t)}°`, x + 8, y + 3);
  }
}

export function renderWall(
  ctx: CanvasRenderingContext2D,
  layout: WallLayout,
  mesh: ThermalMesh,
  wallTemps: number[],
  tAirInt: number,
  tExt: number,
) {
  const { width, height, wallTop, wallX, baselineY } = layout;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#e8f4fc";
  ctx.fillRect(0, wallTop, AIR_ZONE_WIDTH, height - wallTop);

  let x = wallX;
  let col = 0;
  for (const seg of mesh.segments) {
    if (seg.kind === "solid") {
      for (let i = 0; i < seg.nodeCount; i++) {
        const w = layout.colWidths[col++] ?? 0;
        ctx.fillStyle = mesh.nodes[seg.nodeStart + i].color;
        ctx.fillRect(x, wallTop, w, height - wallTop);
        x += w;
      }
    } else if (seg.kind === "film") {
      const w = layout.colWidths[col++] ?? 0;
      ctx.fillStyle = seg.color;
      ctx.fillRect(x, wallTop, w, height - wallTop);
      ctx.fillStyle = FILM_SHINE;
      ctx.fillRect(x + 1, wallTop + 2, Math.max(1, w - 2), height - wallTop - 4);
      x += w;
    } else {
      const w = layout.colWidths[col++] ?? 0;
      ctx.fillStyle = seg.color;
      ctx.fillRect(x, wallTop, w, height - wallTop);
      if (seg.ventilated) {
        ctx.strokeStyle = seg.open
          ? "rgba(30, 136, 229, 0.4)"
          : "rgba(30, 136, 229, 0.55)";
        ctx.lineWidth = 1;
        const step = seg.open ? 10 : 8;
        for (let hx = x + 4; hx < x + w - 4; hx += step) {
          ctx.beginPath();
          ctx.moveTo(hx, wallTop + 8);
          ctx.lineTo(hx, height - 8);
          ctx.stroke();
        }
        if (seg.open) {
          ctx.strokeStyle = "rgba(30, 136, 229, 0.25)";
          for (let hy = wallTop + 12; hy < height - 12; hy += 14) {
            ctx.beginPath();
            ctx.moveTo(x + 6, hy);
            ctx.lineTo(x + w - 6, hy + 6);
            ctx.stroke();
          }
        }
      } else {
        ctx.fillStyle = GAP_HATCH;
        for (let hx = x + 2; hx < x + w - 2; hx += 6) {
          ctx.fillRect(hx, wallTop + 4, 2, height - wallTop - 8);
        }
      }
      x += w;
    }
  }

  ctx.fillStyle = "#fce8e8";
  ctx.fillRect(width - AIR_ZONE_WIDTH, wallTop, AIR_ZONE_WIDTH, height - wallTop);

  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fillRect(0, baselineY, width, height - baselineY);

  const extBarX = (AIR_ZONE_WIDTH - AIR_BAR_WIDTH) / 2;
  drawTempBar(ctx, extBarX, AIR_BAR_WIDTH, layout, tExt, !layout.extAuto);

  const intBarX = width - AIR_ZONE_WIDTH + (AIR_ZONE_WIDTH - AIR_BAR_WIDTH) / 2;
  drawTempBar(ctx, intBarX, AIR_BAR_WIDTH, layout, tAirInt);

  x = wallX;
  col = 0;
  for (const seg of mesh.segments) {
    if (seg.kind === "solid") {
      for (let i = 0; i < seg.nodeCount; i++) {
        const w = layout.colWidths[col++] ?? 0;
        drawTempBar(ctx, x, w, layout, wallTemps[seg.nodeStart + i]);
        x += w;
      }
    } else if (seg.kind === "film" || seg.kind === "gap") {
      col++;
      x += layout.colWidths[col - 1] ?? 0;
    }
  }

  drawScale(ctx, layout);

  drawAirZoneTemp(ctx, 0, AIR_ZONE_WIDTH, layout, tExt, "#1565c0");
  drawAirZoneTemp(ctx, width - AIR_ZONE_WIDTH, AIR_ZONE_WIDTH, layout, tAirInt, "#c62828");
}

export function yToTExt(y: number, layout: WallLayout): number {
  const ratio = 1 - (y - layout.wallTop) / layout.plotHeight;
  const span = layout.tempMax - layout.tempMin;
  return Math.min(
    layout.tempMax,
    Math.max(layout.tempMin, layout.tempMin + ratio * span),
  );
}

export function isOnExtBar(mx: number, my: number, layout: WallLayout): boolean {
  if (layout.extAuto) return false;
  const extBarX = (AIR_ZONE_WIDTH - AIR_BAR_WIDTH) / 2;
  return (
    mx >= extBarX &&
    mx <= extBarX + AIR_BAR_WIDTH &&
    my >= layout.wallTop &&
    my <= layout.baselineY
  );
}

export {
  buildTempChartContext,
  computeTempDisplayRange,
  drawTempChartPanel,
  drawSolarChartPanel,
  DEFAULT_SERIES_VISIBILITY,
  chartMouseDown,
  chartMouseMove,
  chartMouseUp,
  type ChartSeriesVisibility,
  type ScheduleDragState,
  type TempDisplayRange,
} from "./scheduleEditor";
