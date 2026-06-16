import {
  DEFAULT_SOLAR_SITE,
  facadeLabel,
  solarSiteSummary,
  type FacadeOrientation,
  type SolarSite,
} from "./facadeGeometry";
import { defaultWallPreset } from "./presets/wallPresets";
import { ThermalHistory } from "./thermalHistory";
import {
  buildTempChartContext,
  chartMouseDown,
  chartMouseMove,
  chartMouseUp,
  computeWallLayout,
  computeTempDisplayRange,
  DEFAULT_SERIES_VISIBILITY,
  drawSolarChartPanel,
  drawTempChartPanel,
  isOnExtBar,
  renderWall,
  yToTExt,
  type ChartSeriesVisibility,
  type ScheduleDragState,
} from "./render/canvas";
import {
  defaultSchedule,
  fromHourlyPoints,
  interpolateHourly,
  interpolateSchedule,
  simTimeToHour,
  toHourlyPoints,
  type HourlyPoint,
  type SchedulePoint,
} from "./schedule";
import { interpolateSolar } from "./solarSchedule";
import { ThermalSolver } from "./thermal/solver";
import { createPanel, type ChartSeriesId } from "./ui/panel";
import type { Layer, SimSpeed } from "./types";
import { G_MAX, INITIAL_TEMP, MIN_DT } from "./types";

const wallCanvas = document.querySelector<HTMLCanvasElement>("#wall-canvas")!;
const tempChartCanvas = document.querySelector<HTMLCanvasElement>("#temp-chart-canvas")!;
const solarChartCanvas = document.querySelector<HTMLCanvasElement>("#solar-chart-canvas")!;
const wallCtx = wallCanvas.getContext("2d")!;
const tempChartCtx = tempChartCanvas.getContext("2d")!;
const solarChartCtx = solarChartCanvas.getContext("2d")!;

const defaultPreset = defaultWallPreset();
let layers: Layer[] = defaultPreset.layers.map((l) => ({ ...l, id: crypto.randomUUID() }));
let solver = new ThermalSolver(layers);
let thermalHistory = new ThermalHistory();
let playing = false;
let speed: SimSpeed = 100;
let tExt = INITIAL_TEMP;
let extAuto = true;
let schedulePoints: SchedulePoint[] = defaultSchedule();
let facade: FacadeOrientation = { ...defaultPreset.facade };
let solarSite: SolarSite = { ...DEFAULT_SOLAR_SITE };
solver.setFacade(facade);
let draggingExt = false;
let scheduleDrag: ScheduleDragState | null = null;
let seriesVisible: ChartSeriesVisibility = { ...DEFAULT_SERIES_VISIBILITY };

const panel = createPanel(
  {
    banner: document.querySelector("#banner")!,
    layersZone: document.querySelector("#zone-layers")!,
    facadeHost: document.querySelector("#facade-host")!,
    tempHeader: document.querySelector("#temp-zone-header")!,
    tempLegend: document.querySelector("#temp-legend")!,
  },
  layers,
  {
    onLayersChange(newLayers) {
      layers = newLayers;
      solver.rebuildMesh(layers, true);
    },
    onPlayToggle() {
      playing = !playing;
    },
    onSpeedChange(s) {
      speed = s;
    },
    onResetTemps() {
      solver.resetTemps();
      solver.simTime = 0;
      thermalHistory.clear();
      recordThermalHistory();
    },
    onExtAutoToggle() {
      extAuto = !extAuto;
      if (extAuto) {
        tExt = interpolateSchedule(schedulePoints, simTimeToHour(solver.simTime));
      }
    },
    onFacadeChange(tilt, azimuth, site) {
      facade = { tiltFromHorizontal: tilt, azimuthFacing: azimuth };
      solarSite = { ...site };
      solver.setFacade(facade);
    },
    onClimatePresetApply(site, schedule, initialTemp) {
      solarSite = { ...site };
      schedulePoints = schedule.map((p) => ({ ...p }));
      solver.resetTemps();
      solver.tAirInt = initialTemp;
      solver.wallTemps = solver.wallTemps.map(() => initialTemp);
      solver.simTime = 0;
      thermalHistory.clear();
      recordThermalHistory();
      tExt = interpolateSchedule(schedulePoints, 0);
      draw();
    },
    onWallPresetApply(preset) {
      layers = preset.layers.map((l) => ({ ...l, id: crypto.randomUUID() }));
      solver.rebuildMesh(layers, false);
      facade = { ...preset.facade };
      solver.setFacade(facade);
      solver.resetTemps();
      solver.simTime = 0;
      thermalHistory.clear();
      recordThermalHistory();
      draw();
    },
    onVentilationChange(achPerHour) {
      solver.setVentilationAch(achPerHour);
    },
    onInteriorHeatingChange(powerWm2) {
      solver.setInteriorHeatingWm2(powerWm2);
    },
    onSeriesVisibilityChange(series: ChartSeriesId, visible: boolean) {
      seriesVisible[series] = visible;
    },
  },
);

function currentTExt(): number {
  if (extAuto) {
    return interpolateSchedule(schedulePoints, simTimeToHour(solver.simTime));
  }
  return tExt;
}

function currentSolarPercent(): number {
  return interpolateSolar(facade, simTimeToHour(solver.simTime), solarSite);
}

function facadeChartSummary(): string {
  return `${facadeLabel(facade)} · ${solarSiteSummary(solarSite)}`;
}

function currentQSolar(): number {
  return solver.exteriorAlphaSolar() * (currentSolarPercent() / 100) * G_MAX;
}

function recordThermalHistory() {
  const wt = solver.wallTemps;
  const wallExt = wt[0] ?? INITIAL_TEMP;
  const wallInt = wt[wt.length - 1] ?? INITIAL_TEMP;
  thermalHistory.record(solver.simTime, solver.tAirInt, wallInt, wallExt);
}

function tempDisplayRange() {
  const history = thermalHistory.last24h(solver.simTime);
  const tempPts = toHourlyPoints(schedulePoints);
  const interpolate = (pts: HourlyPoint[], h: number) =>
    interpolateHourly(pts, h, INITIAL_TEMP);
  return computeTempDisplayRange(
    tempPts,
    [history.airInt, history.wallInt, history.wallExt],
    (h) => interpolate(tempPts, h),
    [solver.tAirInt, currentTExt(), ...solver.wallTemps, ...solver.cavityTemps],
  );
}

function tempChartForInteraction() {
  const range = tempDisplayRange();
  return buildTempChartContext(
    tempChartCanvas.width,
    tempChartCanvas.height,
    schedulePoints,
    thermalHistory.last24h(solver.simTime),
    range,
  );
}

function syncCanvasSize(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
): { w: number; h: number } {
  const w = Math.max(1, container.clientWidth);
  const h = Math.max(1, container.clientHeight);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h };
}

function resize() {
  syncCanvasSize(wallCanvas, document.querySelector("#right-column")!);
  syncCanvasSize(tempChartCanvas, tempChartCanvas.parentElement!);
  syncCanvasSize(solarChartCanvas, solarChartCanvas.parentElement!);
}

function wallLayout() {
  return computeWallLayout(
    wallCanvas.width,
    wallCanvas.height,
    solver.mesh,
    extAuto,
    tempDisplayRange(),
  );
}

function draw() {
  resize();

  const range = tempDisplayRange();
  const history = thermalHistory.last24h(solver.simTime);

  renderWall(
    wallCtx,
    wallLayout(),
    solver.mesh,
    solver.wallTemps,
    solver.cavityTemps,
    solver.tAirInt,
    currentTExt(),
  );

  drawTempChartPanel(
    tempChartCtx,
    tempChartCanvas.width,
    tempChartCanvas.height,
    schedulePoints,
    solver.simTime,
    history,
    range,
    seriesVisible,
    extAuto,
  );

  drawSolarChartPanel(
    solarChartCtx,
    solarChartCanvas.width,
    solarChartCanvas.height,
    facade,
    solarSite,
    solver.simTime,
    facadeChartSummary(),
  );
}

recordThermalHistory();

let lastFrame = performance.now();
const PHYSICS_BUDGET_MS = 16;

function advanceSimulation(dtSimTotal: number) {
  if (dtSimTotal <= 0) return;
  const t0 = performance.now();
  let remaining = dtSimTotal;
  while (remaining > 0 && performance.now() - t0 < PHYSICS_BUDGET_MS) {
    const chunk = Math.min(remaining, Math.max(solver.stableDt() * 40, 2));
    solver.step(chunk, currentTExt(), currentQSolar());
    remaining -= chunk;
  }
}

function frame(now: number) {
  const dtReal = (now - lastFrame) / 1000;
  lastFrame = now;

  if (playing) {
    const dtSim = speed * Math.max(MIN_DT, dtReal);
    advanceSimulation(dtSim);
    recordThermalHistory();
  }

  const wt = solver.wallTemps;
  panel.update({
    playing,
    speed,
    simTime: solver.simTime,
    extAuto,
    temps: {
      schedule: currentTExt(),
      airInt: solver.tAirInt,
      wallExt: wt[0] ?? INITIAL_TEMP,
      wallInt: wt[wt.length - 1] ?? INITIAL_TEMP,
    },
  });

  draw();
  requestAnimationFrame(frame);
}

tempChartCanvas.addEventListener("mousedown", (e) => {
  if (!extAuto) return;
  const rect = tempChartCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const { layout: g, tempPts } = tempChartForInteraction();
  const result = chartMouseDown(mx, my, g, tempPts);
  schedulePoints = fromHourlyPoints(result.points);
  scheduleDrag = result.drag;
  draw();
});

tempChartCanvas.addEventListener("mousemove", (e) => {
  const rect = tempChartCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (extAuto) {
    tempChartCanvas.style.cursor = scheduleDrag ? "grabbing" : "crosshair";
    if (!scheduleDrag) return;
    const { layout: g } = tempChartForInteraction();
    schedulePoints = fromHourlyPoints(
      chartMouseMove(mx, my, g, toHourlyPoints(schedulePoints), scheduleDrag),
    );
    return;
  }
  tempChartCanvas.style.cursor = "default";
});

wallCanvas.addEventListener("mousedown", (e) => {
  const rect = wallCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const l = wallLayout();
  if (isOnExtBar(mx, my, l)) {
    draggingExt = true;
    tExt = yToTExt(my, l);
    draw();
  }
});

wallCanvas.addEventListener("mousemove", (e) => {
  const rect = wallCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const l = wallLayout();
  wallCanvas.style.cursor =
    isOnExtBar(mx, my, l) || draggingExt ? "ns-resize" : "default";
  if (!draggingExt) return;
  tExt = yToTExt(my, l);
});

window.addEventListener("mouseup", () => {
  if (scheduleDrag) {
    schedulePoints = fromHourlyPoints(chartMouseUp(toHourlyPoints(schedulePoints), scheduleDrag));
    scheduleDrag = null;
  }
  draggingExt = false;
});

window.addEventListener("resize", () => {
  resize();
  draw();
});

resize();
draw();
requestAnimationFrame(frame);
