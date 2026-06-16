import * as THREE from "three";
import {
  computeFacadeDebugInfo,
  formatFacadeDebugLine,
  isFacadeDebugEnabled,
  logFacadeDebug,
} from "../facadeDebug";
import {
  type FacadeOrientation,
  type SolarSite,
  DEFAULT_FACADE,
  DEFAULT_SOLAR_SITE,
  declinationDegFromDateISO,
  facadeLabel,
  facadeYawRadians,
  parseSolarSite,
  solarDeclination,
  solarNoonAltitudeDeg,
  sunDirectionUnit,
} from "../facadeGeometry";
import { skyCoverOptionsHtml } from "../skyCover";
import {
  CLIMATE_PRESETS,
  DEFAULT_CLIMATE_PRESET_ID,
  type ClimatePresetId,
  getClimatePreset,
  presetDateISO,
  scheduleFromPreset,
} from "../presets/climatePresets";
import type { SchedulePoint } from "../schedule";
import { DEFAULT_VENTILATION_ACH } from "../types";
import { TIPS } from "./tooltips";

const SNAP_DEG = 5;
const WIDGET_SIZE = 150;
const SIM_THROTTLE_MS = 100;
const CAMERA_Z_OFFSET = 0.45;

function snap5(angle: number): number {
  return Math.round(angle / SNAP_DEG) * SNAP_DEG;
}

function normAzimuth(deg: number): number {
  let a = snap5(deg) % 360;
  if (a < 0) a += 360;
  if (a >= 360) a = 0;
  return a;
}

export interface FacadeWidget3DCallbacks {
  onFacadeChange: (facade: FacadeOrientation, site: SolarSite) => void;
  onClimatePresetApply: (
    site: SolarSite,
    schedule: SchedulePoint[],
    initialTemp: number,
  ) => void;
  onInteriorHeatingChange: (powerWm2: number) => void;
  onVentilationChange: (achPerHour: number) => void;
}

export interface FacadeWidgetHandle {
  getState: () => FacadeOrientation;
  getSite: () => SolarSite;
  setPose: (tiltFromHorizontal: number, azimuthFacing: number) => void;
  dispose: () => void;
}

function makeLabelSprite(text: string, color = "#333"): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.font = "bold 32px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 24, 26);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(0.55, 0.55, 1);
  spr.renderOrder = 10;
  return spr;
}

function addPolarCross(scene: THREE.Scene) {
  const y = 0.015;
  const len = 1.75;
  const lineMat = new THREE.LineBasicMaterial({ color: 0x999999 });

  const ns = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, y, -len),
    new THREE.Vector3(0, y, len),
  ]);
  const ew = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-len, y, 0),
    new THREE.Vector3(len, y, 0),
  ]);
  scene.add(new THREE.Line(ns, lineMat), new THREE.Line(ew, lineMat));

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.38, 1.43, 32),
    new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y;
  scene.add(ring);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.82, 32),
    new THREE.MeshLambertMaterial({ color: 0xe4e8ec }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.005;
  scene.add(ground);

  const labelR = len + 0.22;
  const labels: [string, number, number][] = [
    ["N", 0, -labelR],
    ["S", 0, labelR],
    ["E", labelR, 0],
    ["O", -labelR, 0],
  ];
  for (const [t, x, z] of labels) {
    const spr = makeLabelSprite(t, t === "S" ? "#c62828" : "#444");
    spr.scale.set(0.4, 0.4, 1);
    spr.position.set(x, 0.2, z);
    scene.add(spr);
  }
}

function buildWallAssembly(): THREE.Group {
  const group = new THREE.Group();
  const wallW = 1.4;
  const wallH = 1.0;
  const wallT = 0.1;
  const depth = 0.75;

  const gray = new THREE.MeshLambertMaterial({ color: 0xb8b8b8 });
  const facadeMat = new THREE.MeshLambertMaterial({ color: 0xd32f2f });

  const building = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, depth), gray);
  building.position.set(0, wallH / 2, -depth / 2 - wallT / 2);

  const wallMats = [gray, gray, gray, gray, facadeMat, gray];
  const wall = new THREE.Mesh(new THREE.BoxGeometry(wallW, wallH, wallT), wallMats);
  wall.position.set(0, wallH / 2, wallT / 2);

  group.add(building, wall);
  return group;
}

function presetOptionsHtml(selected: ClimatePresetId): string {
  return CLIMATE_PRESETS.map(
    (p) =>
      `<option value="${p.id}"${p.id === selected ? " selected" : ""} title="${TIPS.seasonOption(p)}">${p.label}</option>`,
  ).join("");
}

export function createFacadeWidget3D(
  container: HTMLElement,
  initial: FacadeOrientation = DEFAULT_FACADE,
  initialSite: SolarSite = DEFAULT_SOLAR_SITE,
  callbacks: FacadeWidget3DCallbacks,
): FacadeWidgetHandle {
  const debugOn = isFacadeDebugEnabled();

  container.innerHTML = `
    <div class="facade-3d-wrap">
      <div class="facade-3d-header">
        <span class="facade-3d-title">Paroi étudiée</span>
        <span id="facade-3d-summary" class="facade-3d-summary"></span>
      </div>
      <div class="facade-3d-row">
        <div class="facade-3d-col-view">
          <div id="facade-3d-host" class="facade-3d-host" title="${TIPS.facade3d}"></div>
          <div class="facade-3d-readouts">
            <span>Incl. <strong id="facade-3d-tilt">90°</strong></span>
            <span>Orient. <strong id="facade-3d-az">Sud</strong></span>
          </div>
          <span class="facade-3d-hint">Glisser ↔ orientation · ↕ inclinaison</span>
          <label
            class="facade-site-field facade-ventilation-field facade-heating-field"
            title="${TIPS.ventilation}"
          >Renouvellement air int.
            <input
              id="site-ventilation"
              type="range"
              min="0"
              max="4"
              step="0.1"
              value="${DEFAULT_VENTILATION_ACH}"
            />
            <span id="site-ventilation-val" class="facade-site-meta">${DEFAULT_VENTILATION_ACH.toFixed(1)} vol/h</span>
            <span class="facade-site-unit">0 = aucun · 1 = 100 % du volume / h</span>
          </label>
        </div>
        <div class="facade-3d-site">
          <label
            class="facade-site-field"
            title="${TIPS.latitude}"
          >Latitude
            <input
              id="site-lat"
              type="number"
              min="-60"
              max="70"
              step="0.5"
              value="${initialSite.latitudeDeg}"
            />
            <span class="facade-site-unit">° (N + / S −)</span>
          </label>
          <label
            class="facade-site-field"
            title="${TIPS.season}"
          >Saison
            <select id="site-preset">${presetOptionsHtml(DEFAULT_CLIMATE_PRESET_ID)}</select>
          </label>
          <label
            class="facade-site-field"
            title="${TIPS.date}"
          >Date
            <input id="site-date" type="date" value="${initialSite.dateISO}" />
          </label>
          <label
            class="facade-site-field"
            title="${TIPS.skyCover}"
          >Couverture du ciel
            <select id="site-sky-cover">${skyCoverOptionsHtml(initialSite.skyCover)}</select>
          </label>
          <label
            class="facade-site-field facade-heating-field"
            title="${TIPS.heating}"
          >Chauffage / clim.
            <input
              id="site-heating"
              type="range"
              min="-100"
              max="100"
              step="1"
              value="0"
            />
            <span id="site-heating-val" class="facade-site-meta">0 W/m²</span>
          </label>
          <span id="site-decl" class="facade-site-meta"></span>
        </div>
      </div>
      ${debugOn ? '<pre id="facade-3d-debug" class="facade-3d-debug"></pre>' : ""}
    </div>
  `;

  const host = container.querySelector<HTMLDivElement>("#facade-3d-host")!;
  const tiltEl = container.querySelector<HTMLSpanElement>("#facade-3d-tilt")!;
  const azEl = container.querySelector<HTMLSpanElement>("#facade-3d-az")!;
  const summaryEl = container.querySelector<HTMLSpanElement>("#facade-3d-summary")!;
  const debugEl = container.querySelector<HTMLPreElement>("#facade-3d-debug");
  const latInput = container.querySelector<HTMLInputElement>("#site-lat")!;
  const presetSelect = container.querySelector<HTMLSelectElement>("#site-preset")!;
  const dateInput = container.querySelector<HTMLInputElement>("#site-date")!;
  const skyCoverSelect = container.querySelector<HTMLSelectElement>("#site-sky-cover")!;
  const heatingInput = container.querySelector<HTMLInputElement>("#site-heating")!;
  const heatingValEl = container.querySelector<HTMLSpanElement>("#site-heating-val")!;
  const declEl = container.querySelector<HTMLSpanElement>("#site-decl")!;
  const ventilationInput = container.querySelector<HTMLInputElement>("#site-ventilation")!;
  const ventilationValEl = container.querySelector<HTMLSpanElement>("#site-ventilation-val")!;

  function updateHeatingReadout() {
    const w = parseInt(heatingInput.value, 10) || 0;
    const sign = w > 0 ? "+" : "";
    heatingValEl.textContent = `${sign}${w} W/m²`;
    heatingValEl.classList.toggle("heating-cool", w < 0);
    heatingValEl.classList.toggle("heating-heat", w > 0);
  }

  function emitHeating() {
    const w = parseInt(heatingInput.value, 10) || 0;
    updateHeatingReadout();
    callbacks.onInteriorHeatingChange(w);
  }

  updateHeatingReadout();
  heatingInput.addEventListener("input", emitHeating);

  function updateVentilationReadout(): number {
    const raw = parseFloat(ventilationInput.value);
    const v = Math.min(4, Math.max(0, Number.isFinite(raw) ? raw : 0));
    ventilationInput.value = v.toFixed(1);
    ventilationValEl.textContent = `${v.toFixed(1)} vol/h`;
    return v;
  }

  function emitVentilation() {
    const v = updateVentilationReadout();
    callbacks.onVentilationChange(v);
  }

  updateVentilationReadout();
  ventilationInput.addEventListener("input", emitVentilation);
  ventilationInput.addEventListener("change", emitVentilation);

  let tilt = initial.tiltFromHorizontal;
  let azimuth = initial.azimuthFacing;
  let site: SolarSite = { ...initialSite };
  let activePresetId: ClimatePresetId = DEFAULT_CLIMATE_PRESET_ID;

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setSize(WIDGET_SIZE, WIDGET_SIZE);
  renderer.setPixelRatio(1);
  host.appendChild(renderer.domElement);
  renderer.domElement.className = "facade-3d-canvas";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f4f8);

  const lookTarget = new THREE.Vector3(0, 0.45, CAMERA_Z_OFFSET);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const keyLight = new THREE.DirectionalLight(0xfff8e0, 0.95);
  scene.add(keyLight);

  function updateCameraFromSun() {
    const decl = solarDeclination(site);
    const sunDir = sunDirectionUnit(12, site.latitudeDeg, decl);
    if (sunDir) {
      camera.position.set(
        lookTarget.x + sunDir.x * 5.5,
        lookTarget.y + sunDir.y * 5.5,
        lookTarget.z + sunDir.z * 5.5,
      );
      keyLight.position.set(-sunDir.x * 8, -sunDir.y * 8, -sunDir.z * 8);
    } else {
      camera.position.set(0, 4, 5 + CAMERA_Z_OFFSET);
      keyLight.position.set(0, -6, -4);
    }
    camera.lookAt(lookTarget);
  }

  updateCameraFromSun();
  addPolarCross(scene);

  const pivot = new THREE.Group();
  pivot.add(buildWallAssembly());
  scene.add(pivot);

  const outwardNormal = new THREE.Vector3(0, 0, 1);
  let renderRaf = 0;
  let simTimer: ReturnType<typeof setTimeout> | null = null;
  let dragging = false;
  let activePointerId = -1;
  let lastX = 0;
  let lastY = 0;

  function applyPose() {
    pivot.rotation.set(0, 0, 0);
    pivot.rotation.order = "YXZ";
    pivot.rotation.y = facadeYawRadians(azimuth);
    pivot.rotation.x = ((tilt - 90) * Math.PI) / 180;
  }

  function facadeState(): FacadeOrientation {
    return { tiltFromHorizontal: tilt, azimuthFacing: azimuth };
  }

  function readSiteFromInputs(): SolarSite {
    return parseSolarSite(
      parseFloat(latInput.value) || 0,
      dateInput.value,
      skyCoverSelect.value as SolarSite["skyCover"],
    );
  }

  function syncSiteInputs() {
    latInput.value = String(site.latitudeDeg);
    dateInput.value = site.dateISO;
    skyCoverSelect.value = site.skyCover;
    presetSelect.value = activePresetId;
  }

  function updateSiteMeta() {
    const decl = declinationDegFromDateISO(site.dateISO);
    const alt = solarNoonAltitudeDeg(site);
    const altStr = alt !== null ? `${alt.toFixed(0)}°` : "—";
    declEl.textContent = `δ = ${decl.toFixed(1)}° · Hauteur soleil à midi ${altStr}`;
  }

  function runDebug() {
    if (!debugOn) return;
    pivot.updateMatrixWorld(true);
    outwardNormal.set(0, 0, 1).applyQuaternion(pivot.quaternion).normalize();
    const info = computeFacadeDebugInfo(facadeState(), site, outwardNormal);
    logFacadeDebug(info);
    if (debugEl) debugEl.textContent = formatFacadeDebugLine(info);
  }

  function updateReadouts() {
    tiltEl.textContent = `${Math.round(tilt)}°`;
    const dirs: Record<number, string> = {
      0: "Nord",
      45: "NE",
      90: "Est",
      135: "SE",
      180: "Sud",
      225: "SO",
      270: "Ouest",
      315: "NO",
    };
    const snap = (Math.round(azimuth / 45) * 45) % 360;
    azEl.textContent = dirs[snap] ?? `${Math.round(azimuth)}°`;
    summaryEl.textContent = facadeLabel(facadeState());
    updateSiteMeta();
  }

  function render() {
    renderer.render(scene, camera);
  }

  function scheduleRender() {
    if (renderRaf) return;
    renderRaf = requestAnimationFrame(() => {
      renderRaf = 0;
      render();
    });
  }

  function emitSimulation(immediate = false) {
    if (immediate) {
      if (simTimer) {
        clearTimeout(simTimer);
        simTimer = null;
      }
      callbacks.onFacadeChange(facadeState(), site);
      return;
    }
    if (simTimer) clearTimeout(simTimer);
    simTimer = setTimeout(() => {
      simTimer = null;
      callbacks.onFacadeChange(facadeState(), site);
    }, SIM_THROTTLE_MS);
  }

  function applyClimatePreset(id: ClimatePresetId) {
    const preset = getClimatePreset(id);
    activePresetId = id;
    site = { ...site, dateISO: presetDateISO(preset) };
    syncSiteInputs();
    updateCameraFromSun();
    callbacks.onClimatePresetApply(site, scheduleFromPreset(preset), preset.initialTemp);
    refreshAll(true);
  }

  function onSiteFieldChange() {
    site = readSiteFromInputs();
    syncSiteInputs();
    updateCameraFromSun();
    refreshAll(true);
  }

  latInput.addEventListener("change", onSiteFieldChange);
  dateInput.addEventListener("change", onSiteFieldChange);
  skyCoverSelect.addEventListener("change", onSiteFieldChange);
  presetSelect.addEventListener("change", () => {
    applyClimatePreset(presetSelect.value as ClimatePresetId);
  });

  function refreshVisuals() {
    applyPose();
    updateReadouts();
    scheduleRender();
  }

  function refreshAll(immediateSim: boolean) {
    refreshVisuals();
    emitSimulation(immediateSim);
    if (immediateSim) runDebug();
  }

  function snapPose() {
    azimuth = normAzimuth(azimuth);
    tilt = snap5(Math.min(90, Math.max(0, tilt)));
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== activePointerId) return;
    e.preventDefault();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (dx === 0 && dy === 0) return;
    lastX = e.clientX;
    lastY = e.clientY;
    azimuth = ((azimuth + dx * 0.6) % 360 + 360) % 360;
    tilt = Math.min(90, Math.max(0, tilt - dy * 0.5));
    refreshVisuals();
    emitSimulation(false);
  }

  function endDrag(e: PointerEvent) {
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = -1;
    host.classList.remove("dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    try {
      host.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    snapPose();
    refreshAll(true);
  }

  function startDrag(e: PointerEvent) {
    if (dragging) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    activePointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    host.classList.add("dragging");
    try {
      host.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    scheduleRender();
  }

  host.addEventListener("pointerdown", startDrag, { passive: false });
  host.addEventListener("lostpointercapture", () => {
    if (!dragging) return;
    dragging = false;
    activePointerId = -1;
    host.classList.remove("dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    snapPose();
    refreshAll(true);
  });

  refreshAll(true);

  if (debugOn) {
    console.info(
      "[facade] Mode debug actif (?debug=facade). Désactiver : localStorage.removeItem('facadeDebug')",
    );
  }

  return {
    getState: () => facadeState(),
    getSite: () => ({ ...site }),
    setPose(tiltFromHorizontal: number, azimuthFacing: number) {
      tilt = Math.min(90, Math.max(0, tiltFromHorizontal));
      azimuth = normAzimuth(azimuthFacing);
      refreshAll(true);
    },
    dispose: () => {
      if (renderRaf) cancelAnimationFrame(renderRaf);
      if (simTimer) clearTimeout(simTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      renderer.dispose();
      host.removeChild(renderer.domElement);
    },
  };
}
