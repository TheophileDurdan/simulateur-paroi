import { MATERIALS, getMaterial } from "../materials";
import {
  WALL_PRESETS,
  type WallPreset,
  type WallPresetId,
} from "../presets/wallPresets";
import type { Layer, SimSpeed } from "../types";
import { DEFAULT_VENTILATION_ACH } from "../types";
import { simTimeToHour } from "../schedule";

import type { SchedulePoint } from "../schedule";
import { DEFAULT_SOLAR_SITE, type SolarSite } from "../facadeGeometry";
import { defaultWallPreset } from "../presets/wallPresets";
import { createFacadeWidget3D, type FacadeWidgetHandle } from "./facadeWidget3d";

export interface PanelCallbacks {
  onLayersChange: (layers: Layer[]) => void;
  onPlayToggle: () => void;
  onSpeedChange: (speed: SimSpeed) => void;
  onResetTemps: () => void;
  onExtAutoToggle: () => void;
  onFacadeChange: (tilt: number, azimuth: number, site: SolarSite) => void;
  onClimatePresetApply: (
    site: SolarSite,
    schedule: SchedulePoint[],
    initialTemp: number,
  ) => void;
  onWallPresetApply: (preset: WallPreset) => void;
  onVentilationChange: (achPerHour: number) => void;
  onInteriorHeatingChange: (powerWm2: number) => void;
}

export interface PanelState {
  playing: boolean;
  speed: SimSpeed;
  simTime: number;
  extAuto: boolean;
}

export interface PanelHandle {
  update: (state: PanelState) => void;
  setLayers: (layers: Layer[]) => void;
  setActiveWallPreset: (id: WallPresetId | null) => void;
}

export function createPanel(
  container: HTMLElement,
  initialLayers: Layer[],
  callbacks: PanelCallbacks,
): PanelHandle {
  container.innerHTML = `
    <div class="panel-row panel-title">
      <h1>Paroi multicouche V2 — convection &amp; rayonnement</h1>
      <div class="sim-controls">
        <button id="btn-play" type="button">▶ Lecture</button>
        <label>Vitesse
          <select id="sel-speed">
            <option value="10">×10</option>
            <option value="100" selected>×100</option>
            <option value="1000">×1000</option>
          </select>
        </label>
        <span id="sim-time">t = 0 s</span>
        <button id="btn-ext-auto" type="button" class="active">T ext. manuelle</button>
        <span id="read-ext-mode" class="ext-mode-hint"></span>
        <button id="btn-reset" type="button">Réinit. T</button>
        <label class="ventilation-field" title="Renouvellement d'air entre intérieur et extérieur">Ventilation
          <input type="number" id="inp-ventilation" min="0" max="20" step="0.1" value="${DEFAULT_VENTILATION_ACH}" />
          <span class="ventilation-unit">vol/h</span>
        </label>
      </div>
    </div>
    <div class="panel-row panel-wall-presets">
      <span class="wall-presets-label">Paroi type :</span>
      <div id="wall-preset-buttons" class="wall-preset-buttons"></div>
    </div>
    <div id="facade-controls-host" class="panel-row"></div>
    <div class="panel-row layers-header">
      <span>Couches (ext. → int.)</span>
      <button id="btn-add" type="button">+ Ajouter une couche</button>
    </div>
    <div id="layers-list" class="layers-list"></div>
  `;

  const btnPlay = container.querySelector<HTMLButtonElement>("#btn-play")!;
  const selSpeed = container.querySelector<HTMLSelectElement>("#sel-speed")!;
  const btnReset = container.querySelector<HTMLButtonElement>("#btn-reset")!;
  const btnExtAuto = container.querySelector<HTMLButtonElement>("#btn-ext-auto")!;
  const btnAdd = container.querySelector<HTMLButtonElement>("#btn-add")!;
  const layersList = container.querySelector<HTMLDivElement>("#layers-list")!;
  const readExtMode = container.querySelector<HTMLSpanElement>("#read-ext-mode")!;
  const simTimeEl = container.querySelector<HTMLSpanElement>("#sim-time")!;
  const facadeHost = container.querySelector<HTMLDivElement>("#facade-controls-host")!;
  const presetButtonsHost = container.querySelector<HTMLDivElement>("#wall-preset-buttons")!;
  const inpVentilation = container.querySelector<HTMLInputElement>("#inp-ventilation")!;

  let facadeWidget: FacadeWidgetHandle;

  facadeWidget = createFacadeWidget3D(
    facadeHost,
    defaultWallPreset().facade,
    DEFAULT_SOLAR_SITE,
    {
    onFacadeChange(f, site) {
      callbacks.onFacadeChange(f.tiltFromHorizontal, f.azimuthFacing, site);
    },
    onClimatePresetApply(site, schedule, initialTemp) {
      callbacks.onClimatePresetApply(site, schedule, initialTemp);
    },
    onInteriorHeatingChange(powerWm2) {
      callbacks.onInteriorHeatingChange(powerWm2);
    },
  });

  let layers: Layer[] = [...initialLayers];
  let activeWallPresetId: WallPresetId | null = "wall-concrete-south";

  function emit() {
    activeWallPresetId = null;
    updatePresetButtons();
    callbacks.onLayersChange([...layers]);
  }

  function updatePresetButtons() {
    presetButtonsHost.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === activeWallPresetId);
    });
  }

  WALL_PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wall-preset-btn";
    btn.dataset.preset = preset.id;
    btn.textContent = preset.name;
    btn.title = preset.name;
    btn.addEventListener("click", () => {
      activeWallPresetId = preset.id;
      layers = preset.layers.map((l) => ({ ...l, id: crypto.randomUUID() }));
      facadeWidget.setPose(preset.facade.tiltFromHorizontal, preset.facade.azimuthFacing);
      renderLayers();
      updatePresetButtons();
      callbacks.onWallPresetApply(preset);
    });
    presetButtonsHost.appendChild(btn);
  });
  updatePresetButtons();

  function renderLayers() {
    layersList.innerHTML = "";
    layers.forEach((layer, index) => {
      const preset = getMaterial(layer.materialId);
      const isGap = preset.kind === "air_gap" || preset.kind === "air_gap_ventilated";
      const isFilm = preset.kind === "thin_film";
      const row = document.createElement("div");
      row.className = "layer-row";
      row.innerHTML = `
        <div class="layer-order">
          <button type="button" class="btn-move" data-dir="-1" title="Monter">▲</button>
          <button type="button" class="btn-move" data-dir="1" title="Descendre">▼</button>
        </div>
        <input type="color" class="layer-color" value="${layer.color ?? preset.color}" title="Couleur" />
        <select class="layer-material">
          ${MATERIALS.map(
            (m) =>
              `<option value="${m.id}" ${m.id === layer.materialId ? "selected" : ""}>${m.name}</option>`,
          ).join("")}
        </select>
        <label class="layer-field">e (mm)
          <input type="number" class="layer-thick" min="${isGap ? 5 : isFilm ? 0.1 : 1}" step="${isFilm ? 0.1 : 1}" value="${layer.thicknessMm}" />
        </label>
        ${
          isGap
            ? `<span class="layer-gap-hint">${preset.kind === "air_gap_ventilated" ? "Lame ventilée" : "Cavité (conv. + IR)"}</span>`
            : isFilm
              ? `<label class="layer-field" title="Émissivité infrarouge (face cavité)">ε
          <input type="number" class="layer-epsilon" min="0.01" max="1" step="0.01" value="${(layer.epsilon ?? preset.epsilon).toFixed(2)}" />
        </label>
        <span class="layer-gap-hint">Feuille mince (sans inertie)</span>`
              : `
        <label class="layer-field">ρ
          <input type="number" class="layer-rho" min="1" step="1" value="${layer.rho ?? preset.rho}" />
        </label>
        <label class="layer-field">cp
          <input type="number" class="layer-cp" min="1" step="1" value="${layer.cp ?? preset.cp}" />
        </label>
        <label class="layer-field">λ
          <input type="number" class="layer-lambda" min="0.001" step="0.001" value="${layer.lambda ?? preset.lambda}" />
        </label>
        <label class="layer-field" title="Émissivité infrarouge">ε
          <input type="number" class="layer-epsilon" min="0.01" max="1" step="0.01" value="${(layer.epsilon ?? preset.epsilon).toFixed(2)}" />
        </label>`
        }
        <button type="button" class="btn-remove" title="Supprimer">✕</button>
      `;

      row.querySelector(".layer-color")!.addEventListener("input", (e) => {
        layer.color = (e.target as HTMLInputElement).value;
        emit();
      });

      row.querySelector(".layer-material")!.addEventListener("change", (e) => {
        layer.materialId = (e.target as HTMLSelectElement).value;
        const p = getMaterial(layer.materialId);
        layer.rho = p.rho;
        layer.cp = p.cp;
        layer.lambda = p.lambda;
        layer.color = p.color;
        layer.epsilon = p.epsilon;
        layer.alphaSolar = p.alphaSolar;
        renderLayers();
        emit();
      });

      row.querySelector(".layer-thick")!.addEventListener("change", (e) => {
        const kind = getMaterial(layer.materialId).kind;
        const min = kind === "air_gap" || kind === "air_gap_ventilated" ? 5 : kind === "thin_film" ? 0.1 : 1;
        layer.thicknessMm = Math.max(
          min,
          parseFloat((e.target as HTMLInputElement).value) || min,
        );
        emit();
      });

      for (const cls of ["layer-rho", "layer-cp", "layer-lambda"] as const) {
        const el = row.querySelector(`.${cls}`);
        if (!el) continue;
        el.addEventListener("change", (e) => {
          const v = parseFloat((e.target as HTMLInputElement).value);
          if (cls === "layer-rho") layer.rho = v;
          if (cls === "layer-cp") layer.cp = v;
          if (cls === "layer-lambda") layer.lambda = v;
          emit();
        });
      }

      const epsEl = row.querySelector(".layer-epsilon");
      epsEl?.addEventListener("change", (e) => {
        layer.epsilon = Math.min(1, Math.max(0.01, parseFloat((e.target as HTMLInputElement).value) || 0.9));
        emit();
      });

      row.querySelectorAll(".btn-move").forEach((btn) => {
        btn.addEventListener("click", () => {
          const dir = parseInt((btn as HTMLButtonElement).dataset.dir!, 10);
          const j = index + dir;
          if (j < 0 || j >= layers.length) return;
          [layers[index], layers[j]] = [layers[j], layers[index]];
          renderLayers();
          emit();
        });
      });

      row.querySelector(".btn-remove")!.addEventListener("click", () => {
        if (layers.length <= 1) return;
        layers.splice(index, 1);
        renderLayers();
        emit();
      });

      layersList.appendChild(row);
    });
  }

  btnPlay.addEventListener("click", () => callbacks.onPlayToggle());
  selSpeed.addEventListener("change", () =>
    callbacks.onSpeedChange(parseInt(selSpeed.value, 10) as SimSpeed),
  );
  btnReset.addEventListener("click", () => callbacks.onResetTemps());
  btnExtAuto.addEventListener("click", () => callbacks.onExtAutoToggle());
  inpVentilation.addEventListener("change", () => {
    const v = Math.max(0, parseFloat(inpVentilation.value) || 0);
    inpVentilation.value = String(v);
    callbacks.onVentilationChange(v);
  });
  btnAdd.addEventListener("click", () => {
    const p = MATERIALS[0];
    layers.push({
      id: crypto.randomUUID(),
      materialId: p.id,
      thicknessMm: 50,
      rho: p.rho,
      cp: p.cp,
      lambda: p.lambda,
      color: p.color,
    });
    renderLayers();
    emit();
  });

  renderLayers();

  return {
    update(state: PanelState) {
      btnPlay.textContent = state.playing ? "⏸ Pause" : "▶ Lecture";
      btnExtAuto.textContent = state.extAuto ? "T ext. manuelle" : "T ext. auto";
      btnExtAuto.classList.toggle("active", state.extAuto);
      if (state.extAuto) {
        const h = Math.floor(simTimeToHour(state.simTime));
        const m = Math.floor((simTimeToHour(state.simTime) % 1) * 60);
        readExtMode.textContent = `profil horaire (${h}h${m.toString().padStart(2, "0")})`;
      } else {
        readExtMode.textContent = "slider ext.";
      }
      const s = state.simTime;
      simTimeEl.textContent =
        s < 3600
          ? `t = ${s.toFixed(0)} s`
          : s < 86400
            ? `t = ${(s / 3600).toFixed(2)} h`
            : `t = ${(s / 86400).toFixed(2)} j`;
    },
    setLayers(newLayers) {
      layers = newLayers.map((l) => ({ ...l }));
      renderLayers();
    },
    setActiveWallPreset(id) {
      activeWallPresetId = id;
      updatePresetButtons();
    },
  };
}
