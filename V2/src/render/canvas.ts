import {
  AIR_BAR_WIDTH,
  AIR_ZONE_WIDTH,
  MARGIN_BOTTOM,
} from "../types";
import type { ThermalMesh } from "../thermal/solver";
import { visualWeights } from "../thermal/solver";
import type { VisualSegment } from "../thermal/mesh";
import { INITIAL_TEMP } from "../types";
import type { TempDisplayRange } from "./scheduleEditor";

const WALL_TOP_PAD = 8;
/** Échelle de couleur fixe des barres thermomètre (°C). */
const BAR_COLOR_TEMP_MIN = -10;
const BAR_COLOR_TEMP_MAX = 50;
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

function lerpByte(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Bleu froid (-10 °C) → rouge vif (+50 °C). */
function tempToBarColor(tempC: number): string {
  const t = Math.max(BAR_COLOR_TEMP_MIN, Math.min(BAR_COLOR_TEMP_MAX, tempC));
  const u = (t - BAR_COLOR_TEMP_MIN) / (BAR_COLOR_TEMP_MAX - BAR_COLOR_TEMP_MIN);
  if (u <= 0.35) {
    const v = u / 0.35;
    return `rgb(${lerpByte(0, 0, v)}, ${lerpByte(70, 190, v)}, ${lerpByte(255, 255, v)})`;
  }
  if (u <= 0.65) {
    const v = (u - 0.35) / 0.3;
    return `rgb(${lerpByte(0, 255, v)}, ${lerpByte(190, 220, v)}, ${lerpByte(255, 0, v)})`;
  }
  const v = (u - 0.65) / 0.35;
  return `rgb(${lerpByte(255, 255, v)}, ${lerpByte(220, 30, v)}, ${lerpByte(0, 0, v)})`;
}

function barLabelColor(tempC: number): string {
  return tempC > 32 ? "#fff" : "#1a1a1a";
}

function drawTempBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  layout: WallLayout,
  temp: number,
  interactive = false,
) {
  const fillTop = Math.max(layout.wallTop, tempToY(temp, layout));
  const h = layout.baselineY - fillTop;
  if (h <= 0) return;

  ctx.fillStyle = tempToBarColor(temp);
  ctx.fillRect(x, fillTop, width, h);

  if (interactive) {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, fillTop, width, h);
  }
}

function drawAirZoneTemp(
  ctx: CanvasRenderingContext2D,
  zoneX: number,
  zoneW: number,
  layout: WallLayout,
  temp: number,
) {
  const barTop = Math.max(layout.wallTop, tempToY(temp, layout));
  const midY = (barTop + layout.baselineY) / 2;

  ctx.fillStyle = barLabelColor(temp);
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${temp.toFixed(1)} °C`, zoneX + zoneW / 2, midY);
}

function gapDisplayTemp(
  seg: VisualSegment,
  mesh: ThermalMesh,
  wallTemps: number[],
  cavityTemps: number[],
): number {
  const gap = mesh.gaps.find((g) => g.layerId === seg.layerId);
  if (!gap) return INITIAL_TEMP;
  if (gap.ventilated) {
    const idx = mesh.gaps.indexOf(gap);
    return cavityTemps[idx] ?? INITIAL_TEMP;
  }
  const tL = wallTemps[gap.leftNodeIndex] ?? INITIAL_TEMP;
  const tR = wallTemps[gap.rightNodeIndex] ?? INITIAL_TEMP;
  return (tL + tR) / 2;
}

function drawGapTempGauge(
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  layout: WallLayout,
  temp: number,
) {
  drawTempBar(ctx, x, width, layout, temp);

  if (width < 18) return;

  const barTop = Math.max(layout.wallTop, tempToY(temp, layout));
  const midY = (barTop + layout.baselineY) / 2;

  ctx.fillStyle = barLabelColor(temp);
  ctx.font = width >= 44 ? "bold 10px system-ui, sans-serif" : "bold 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (width >= 44) {
    ctx.fillText(`${temp.toFixed(1)} °C`, x + width / 2, midY);
  } else {
    ctx.fillText(`${temp.toFixed(0)}°`, x + width / 2, midY);
  }
}

function drawHorizontalGrid(ctx: CanvasRenderingContext2D, layout: WallLayout) {
  const { wallTop, baselineY, width, tempMin, tempMax } = layout;
  const tStart = Math.ceil(tempMin);
  const tEnd = Math.floor(tempMax);

  for (let t = tStart; t <= tEnd; t++) {
    const y = tempToY(t, layout);
    if (y < wallTop - 0.5 || y > baselineY + 0.5) continue;

    const isMajor = t % 10 === 0;
    ctx.strokeStyle = isMajor ? "rgba(0, 0, 0, 0.16)" : "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
}

/** Graduations dans la zone air ext., le long du bord paroi. */
function drawExtAirScale(ctx: CanvasRenderingContext2D, layout: WallLayout) {
  const { wallTop, baselineY, wallX, tempMin, tempMax } = layout;
  const tStart = Math.ceil(tempMin);
  const tEnd = Math.floor(tempMax);

  for (let t = tStart; t <= tEnd; t++) {
    const y = tempToY(t, layout);
    if (y < wallTop - 0.5 || y > baselineY + 0.5) continue;

    const isMajor = t % 10 === 0;
    const tickLen = isMajor ? 10 : 5;

    ctx.strokeStyle = isMajor ? "#78909c" : "#b0bec5";
    ctx.lineWidth = isMajor ? 1.25 : 0.75;
    ctx.beginPath();
    ctx.moveTo(wallX - tickLen, y + 0.5);
    ctx.lineTo(wallX, y + 0.5);
    ctx.stroke();

    if (isMajor) {
      ctx.fillStyle = "#455a64";
      ctx.font = isMajor ? "10px system-ui, sans-serif" : "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`${t}°`, wallX - tickLen - 4, y);
    }
  }
}

export function renderWall(
  ctx: CanvasRenderingContext2D,
  layout: WallLayout,
  mesh: ThermalMesh,
  wallTemps: number[],
  cavityTemps: number[],
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

  drawHorizontalGrid(ctx, layout);

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
    } else if (seg.kind === "gap") {
      const w = layout.colWidths[col++] ?? 0;
      const temp = gapDisplayTemp(seg, mesh, wallTemps, cavityTemps);
      drawGapTempGauge(ctx, x, w, layout, temp);
      x += w;
    } else if (seg.kind === "film") {
      col++;
      x += layout.colWidths[col - 1] ?? 0;
    }
  }

  drawExtAirScale(ctx, layout);

  drawAirZoneTemp(ctx, 0, AIR_ZONE_WIDTH, layout, tExt);
  drawAirZoneTemp(ctx, width - AIR_ZONE_WIDTH, AIR_ZONE_WIDTH, layout, tAirInt);
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
  computeChartTempDisplayRange,
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
