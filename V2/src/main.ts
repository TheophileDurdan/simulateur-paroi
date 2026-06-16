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
  CHART_HEIGHT,
  buildTempChartContext,
  chartMouseDown,
  chartMouseMove,
  chartMouseUp,
  computeLayout,
  computeTempDisplayRange,
  isInChartArea,
  isInTempChartArea,
  isOnExtBar,
  renderSimulation,
  wallZoneMinHeight,
  yToTExt,
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
import { createPanel } from "./ui/panel";
import type { Layer, SimSpeed } from "./types";
import {
  G_MAX,
  INITIAL_TEMP,
  MIN_DT,
} from "./types";

const canvas = document.querySelector<HTMLCanvasElement>("#sim-canvas")!;
const panelEl = document.querySelector<HTMLElement>("#panel")!;
const ctx = canvas.getContext("2d")!;

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

const panel = createPanel(panelEl, layers, {
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
    resize();
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
    lastTempRangeKey = "";
    resize();
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
    lastTempRangeKey = "";
    resize();
    draw();
  },
  onVentilationChange(achPerHour) {
    solver.setVentilationAch(achPerHour);
  },
  onInteriorHeatingChange(powerWm2) {
    solver.setInteriorHeatingWm2(powerWm2);
  },
});

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
    [solver.tAirInt, currentTExt(), ...solver.wallTemps],
  );
}

function tempChartForInteraction() {
  const range = tempDisplayRange();
  return buildTempChartContext(
    canvas.width,
    schedulePoints,
    thermalHistory.last24h(solver.simTime),
    range,
  );
}

let lastTempRangeKey = "";

function syncCanvasToRange(range: ReturnType<typeof tempDisplayRange>) {
  const key = `${range.min}:${range.max}`;
  const chartExtra = extAuto ? CHART_HEIGHT : 0;
  const minWall = wallZoneMinHeight(range);
  if (key !== lastTempRangeKey || canvas.height - chartExtra < minWall) {
    lastTempRangeKey = key;
    resize();
  }
}

function resize() {
  const main = canvas.parentElement!;
  const w = main.clientWidth;
  const chartExtra = extAuto ? CHART_HEIGHT : 0;
  const minTotal = wallZoneMinHeight(tempDisplayRange()) + chartExtra;
  const h = Math.max(minTotal, window.innerHeight - panelEl.offsetHeight - 24);
  canvas.width = w;
  canvas.height = h;
  canvas.style.height = `${h}px`;
  canvas.style.minHeight = `${minTotal}px`;
}

function layout() {
  return computeLayout(
    canvas.width,
    canvas.height,
    solver.mesh,
    extAuto,
    tempDisplayRange(),
  );
}

function draw() {
  const range = tempDisplayRange();
  syncCanvasToRange(range);
  const l = computeLayout(
    canvas.width,
    canvas.height,
    solver.mesh,
    extAuto,
    range,
  );
  renderSimulation(
    ctx,
    l,
    solver.mesh,
    solver.wallTemps,
    solver.tAirInt,
    currentTExt(),
    extAuto,
    schedulePoints,
    facade,
    solarSite,
    solver.simTime,
    thermalHistory.last24h(solver.simTime),
    facadeChartSummary(),
  );
}

recordThermalHistory();

let lastFrame = performance.now();

function frame(now: number) {
  const dtReal = (now - lastFrame) / 1000;
  lastFrame = now;

  if (playing) {
    const dtSim = speed * Math.max(MIN_DT, dtReal);
    solver.step(dtSim, currentTExt(), currentQSolar());
    recordThermalHistory();
  }

  panel.update({
    playing,
    speed,
    simTime: solver.simTime,
    extAuto,
  });

  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (extAuto && isInTempChartArea(my)) {
    const { layout: g, tempPts } = tempChartForInteraction();
    const result = chartMouseDown(mx, my, g, tempPts);
    schedulePoints = fromHourlyPoints(result.points);
    scheduleDrag = result.drag;
    draw();
    return;
  }

  const l = layout();
  if (isOnExtBar(mx, my, l)) {
    draggingExt = true;
    tExt = yToTExt(my, l);
    draw();
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (extAuto && (scheduleDrag || isInTempChartArea(my))) {
    canvas.style.cursor = scheduleDrag ? "grabbing" : "crosshair";
    if (!scheduleDrag) return;
    const { layout: g } = tempChartForInteraction();
    schedulePoints = fromHourlyPoints(
      chartMouseMove(mx, my, g, toHourlyPoints(schedulePoints), scheduleDrag),
    );
    return;
  }

  if (extAuto && isInChartArea(my)) {
    canvas.style.cursor = "default";
  }

  const l = layout();
  canvas.style.cursor =
    isOnExtBar(mx, my, l) || draggingExt ? "ns-resize" : canvas.style.cursor || "default";
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
