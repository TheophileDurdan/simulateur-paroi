import { MATERIAL_CATEGORIES, defaultSolidMaterial, getMaterial, materialsByCategory } from "../materials";
import {
  WALL_PRESETS,
  type WallPreset,
  type WallPresetId,
} from "../presets/wallPresets";
import type { Layer, SimSpeed } from "../types";
import { isLayerEnabled } from "../types";
import { simTimeToHour } from "../schedule";

import type { SchedulePoint } from "../schedule";
import { DEFAULT_SOLAR_SITE, type SolarSite } from "../facadeGeometry";
import { defaultWallPreset } from "../presets/wallPresets";
import { createFacadeWidget3D, type FacadeWidgetHandle } from "./facadeWidget3d";
import type { ChartSeriesVisibility } from "../render/canvas";
import { LEGEND_TIPS, TIPS, setNativeTip } from "./tooltips";

export type ChartSeriesId = keyof ChartSeriesVisibility;

export interface PanelRoots {
  banner: HTMLElement;
  layersZone: HTMLElement;
  facadeHost: HTMLElement;
  tempHeader: HTMLElement;
  tempLegend: HTMLElement;
}

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
  onSeriesVisibilityChange: (series: ChartSeriesId, visible: boolean) => void;
}

export interface PanelState {
  playing: boolean;
  speed: SimSpeed;
  simTime: number;
  extAuto: boolean;
  temps: {
    schedule: number;
    airInt: number;
    wallExt: number;
    wallInt: number;
    feltInt: number;
  };
}

export interface PanelHandle {
  update: (state: PanelState) => void;
  setLayers: (layers: Layer[]) => void;
  setActiveWallPreset: (id: WallPresetId | null) => void;
}

const LEGEND_ITEMS: { id: ChartSeriesId; label: string; color: string }[] = [
  { id: "schedule", label: "T air ext.", color: "#1565c0" },
  { id: "airInt", label: "T air int.", color: "#e65100" },
  { id: "wallExt", label: "T paroi ext.", color: "#c62828" },
  { id: "wallInt", label: "T paroi int.", color: "#2e7d32" },
  { id: "feltInt", label: "T int. ressenti", color: "#6a1b9a" },
];

export function createPanel(
  roots: PanelRoots,
  initialLayers: Layer[],
  callbacks: PanelCallbacks,
): PanelHandle {
  roots.banner.innerHTML = `
    <div class="banner-row banner-title">
      <h1>Simulateur paroi</h1>
      <div class="sim-controls">
        <button id="btn-play" type="button" aria-pressed="false" title="${TIPS.play}">▶ Lecture</button>
        <label>Vitesse
          <select id="sel-speed" title="${TIPS.speed}">
            <option value="10" title="${TIPS.speed10}">×10</option>
            <option value="100" selected title="${TIPS.speed100}">×100</option>
            <option value="1000" title="${TIPS.speed1000}">×1000</option>
          </select>
        </label>
        <button
          id="btn-ext-auto"
          type="button"
          class="active"
          title="${TIPS.extAutoOn}"
        >T ext. manuelle</button>
        <button
          id="btn-reset"
          type="button"
          title="${TIPS.resetTemps}"
        >Réinit. T</button>
        <button
          id="btn-fullscreen"
          type="button"
          aria-pressed="false"
          title="${TIPS.fullscreen}"
        >⛶ Plein écran</button>
      </div>
    </div>
    <div class="banner-row banner-wall-presets">
      <span class="wall-presets-label" title="${TIPS.wallPresets}">Paroi type :</span>
      <div id="wall-preset-buttons" class="wall-preset-buttons"></div>
    </div>
  `;

  roots.layersZone.innerHTML = `
    <div class="layers-header">
      <span title="${TIPS.layersHeader}">Couches (ext. → int.)</span>
      <button id="btn-add" type="button" title="${TIPS.addLayer}">+ Ajouter une couche</button>
    </div>
    <div id="layers-list" class="layers-list"></div>
  `;

  roots.tempHeader.innerHTML = `
    <span id="sim-time" class="sim-time" title="${TIPS.simTime}">t = 0 s</span>
    <span id="read-ext-mode" class="ext-mode-hint"></span>
  `;

  roots.tempLegend.innerHTML = `
    <div class="chart-legend">
      ${LEGEND_ITEMS.map(
        (item) => `
        <label
          class="legend-item"
          data-series="${item.id}"
          title="${LEGEND_TIPS[item.id]}"
        >
          <input
            type="checkbox"
            class="legend-check"
            data-series="${item.id}"
            checked
            aria-label="Afficher / masquer ${item.label}"
          />
          <span class="legend-swatch" style="background:${item.color}"></span>
          <span class="legend-label">${item.label}</span>
          <span class="legend-value" id="legend-val-${item.id}">—</span>
        </label>`,
      ).join("")}
    </div>
  `;

  const btnPlay = roots.banner.querySelector<HTMLButtonElement>("#btn-play")!;
  const selSpeed = roots.banner.querySelector<HTMLSelectElement>("#sel-speed")!;
  const btnReset = roots.banner.querySelector<HTMLButtonElement>("#btn-reset")!;
  const btnExtAuto = roots.banner.querySelector<HTMLButtonElement>("#btn-ext-auto")!;
  const btnFullscreen = roots.banner.querySelector<HTMLButtonElement>("#btn-fullscreen")!;
  const appEl = document.querySelector<HTMLDivElement>("#app")!;
  const btnAdd = roots.layersZone.querySelector<HTMLButtonElement>("#btn-add")!;
  const layersList = roots.layersZone.querySelector<HTMLDivElement>("#layers-list")!;
  const readExtMode = roots.tempHeader.querySelector<HTMLSpanElement>("#read-ext-mode")!;
  const simTimeEl = roots.tempHeader.querySelector<HTMLSpanElement>("#sim-time")!;
  const presetButtonsHost = roots.banner.querySelector<HTMLDivElement>("#wall-preset-buttons")!;

  roots.tempLegend.querySelectorAll<HTMLInputElement>(".legend-check").forEach((input) => {
    input.addEventListener("change", () => {
      const series = input.dataset.series as ChartSeriesId;
      callbacks.onSeriesVisibilityChange(series, input.checked);
    });
  });

  let facadeWidget: FacadeWidgetHandle;

  facadeWidget = createFacadeWidget3D(
    roots.facadeHost,
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
      onVentilationChange(achPerHour) {
        callbacks.onVentilationChange(achPerHour);
      },
    },
  );

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
    btn.title = TIPS.wallPreset(preset);
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

  function enabledLayerCount() {
    return layers.filter(isLayerEnabled).length;
  }

  function renderLayers() {
    layersList.innerHTML = "";
    layers.forEach((layer, index) => {
      const preset = getMaterial(layer.materialId);
      const enabled = isLayerEnabled(layer);
      const isGap =
        preset.kind === "air_gap" ||
        preset.kind === "air_gap_ventilated" ||
        preset.kind === "air_gap_open";
      const isFilm = preset.kind === "thin_film";
      const row = document.createElement("div");
      row.className = enabled ? "layer-row" : "layer-row layer-row-disabled";
      const disabledAttr = enabled ? "" : "disabled";
      row.innerHTML = `
        <div class="layer-order">
          <button type="button" class="btn-move" data-dir="-1" title="${TIPS.layerMoveUp}" ${disabledAttr}>▲</button>
          <button type="button" class="btn-move" data-dir="1" title="${TIPS.layerMoveDown}" ${disabledAttr}>▼</button>
        </div>
        <input type="color" class="layer-color" value="${layer.color ?? preset.color}" title="${TIPS.layerColor}" ${disabledAttr} />
        <select class="layer-material" title="${TIPS.layerMaterial}" ${disabledAttr}>
          ${MATERIAL_CATEGORIES.map(
            (cat) => `
            <optgroup label="${cat.label}">
              ${materialsByCategory(cat.id)
                .map(
                  (m) =>
                    `<option value="${m.id}" ${m.id === layer.materialId ? "selected" : ""}>${m.name}</option>`,
                )
                .join("")}
            </optgroup>`,
          ).join("")}
        </select>
        <label class="layer-field" title="${TIPS.layerThickness}">e (mm)
          <input type="number" class="layer-thick" min="${isGap ? 5 : isFilm ? 0.1 : 1}" step="${isFilm ? 0.1 : 1}" value="${layer.thicknessMm}" ${disabledAttr} />
        </label>
        ${
          isGap
            ? `<span class="layer-gap-hint">${
                preset.kind === "air_gap_ventilated"
                  ? "Lame ventilée"
                  : preset.kind === "air_gap_open"
                    ? "Lame ouverte"
                    : "Cavité (conv. + IR)"
              }</span>`
            : isFilm
              ? `<label class="layer-field" title="${TIPS.layerEpsilon}">ε
          <input type="number" class="layer-epsilon" min="0.01" max="1" step="0.01" value="${(layer.epsilon ?? preset.epsilon).toFixed(2)}" ${disabledAttr} />
        </label>
        <span class="layer-gap-hint">Feuille mince (sans inertie)</span>`
              : `
        <label class="layer-field" title="${TIPS.layerRho}">ρ
          <input type="number" class="layer-rho" min="1" step="1" value="${layer.rho ?? preset.rho}" ${disabledAttr} />
        </label>
        <label class="layer-field" title="${TIPS.layerCp}">cp
          <input type="number" class="layer-cp" min="1" step="1" value="${layer.cp ?? preset.cp}" ${disabledAttr} />
        </label>
        <label class="layer-field" title="${TIPS.layerLambda}">λ
          <input type="number" class="layer-lambda" min="0.001" step="0.001" value="${layer.lambda ?? preset.lambda}" ${disabledAttr} />
        </label>
        <label class="layer-field" title="${TIPS.layerEpsilon}">ε
          <input type="number" class="layer-epsilon" min="0.01" max="1" step="0.01" value="${(layer.epsilon ?? preset.epsilon).toFixed(2)}" ${disabledAttr} />
        </label>`
        }
        <div class="layer-actions">
          <button type="button" class="btn-toggle ${enabled ? "is-enabled" : "is-disabled"}" title="${enabled ? TIPS.layerToggleOff : TIPS.layerToggleOn}">${enabled ? "✓" : "✕"}</button>
          <button type="button" class="btn-delete" title="${TIPS.layerDelete}">🗑</button>
        </div>
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
        const min =
          kind === "air_gap" || kind === "air_gap_ventilated" || kind === "air_gap_open"
            ? 5
            : kind === "thin_film"
              ? 0.1
              : 1;
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

      row.querySelector(".btn-toggle")!.addEventListener("click", () => {
        if (enabled) {
          if (enabledLayerCount() <= 1) return;
          layer.enabled = false;
        } else {
          layer.enabled = true;
        }
        renderLayers();
        emit();
      });

      row.querySelector(".btn-delete")!.addEventListener("click", () => {
        if (layers.length <= 1) return;
        layers.splice(index, 1);
        if (enabledLayerCount() === 0 && layers.length > 0) {
          layers[0].enabled = true;
        }
        renderLayers();
        emit();
      });

      layersList.appendChild(row);
    });
  }

  btnPlay.addEventListener("click", (e) => {
    e.preventDefault();
    callbacks.onPlayToggle();
  });
  selSpeed.addEventListener("change", () =>
    callbacks.onSpeedChange(parseInt(selSpeed.value, 10) as SimSpeed),
  );
  btnReset.addEventListener("click", () => callbacks.onResetTemps());
  btnExtAuto.addEventListener("click", () => callbacks.onExtAutoToggle());

  function updateFullscreenButton() {
    const on = document.fullscreenElement === appEl;
    btnFullscreen.textContent = on ? "⛶ Quitter plein écran" : "⛶ Plein écran";
    btnFullscreen.setAttribute("aria-pressed", on ? "true" : "false");
    setNativeTip(btnFullscreen, on ? TIPS.exitFullscreen : TIPS.fullscreen);
    document.body.classList.toggle("is-fullscreen", on);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === appEl) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await appEl.requestFullscreen();
      }
    } catch {
      /* navigateur sans support ou permission refusée */
    }
  }

  btnFullscreen.addEventListener("click", () => {
    void toggleFullscreen();
  });
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  updateFullscreenButton();

  btnAdd.addEventListener("click", () => {
    const p = defaultSolidMaterial();
    layers.push({
      id: crypto.randomUUID(),
      materialId: p.id,
      thicknessMm: 50,
      enabled: true,
      rho: p.rho,
      cp: p.cp,
      lambda: p.lambda,
      color: p.color,
    });
    renderLayers();
    emit();
  });

  renderLayers();

  let lastPlaying: boolean | null = null;
  let lastExtAuto: boolean | null = null;

  function formatTemp(v: number): string {
    return `${v.toFixed(1)} °C`;
  }

  return {
    update(state: PanelState) {
      if (state.playing !== lastPlaying) {
        btnPlay.textContent = state.playing ? "⏸ Pause" : "▶ Lecture";
        btnPlay.setAttribute("aria-pressed", state.playing ? "true" : "false");
        setNativeTip(btnPlay, state.playing ? TIPS.pause : TIPS.play);
        lastPlaying = state.playing;
      }
      if (state.extAuto !== lastExtAuto) {
        btnExtAuto.textContent = state.extAuto ? "T ext. manuelle" : "T ext. auto";
        btnExtAuto.classList.toggle("active", state.extAuto);
        setNativeTip(btnExtAuto, state.extAuto ? TIPS.extAutoOn : TIPS.extAutoOff);
        lastExtAuto = state.extAuto;
      }
      if (state.extAuto) {
        const h = Math.floor(simTimeToHour(state.simTime));
        const m = Math.floor((simTimeToHour(state.simTime) % 1) * 60);
        readExtMode.textContent = `profil horaire (${h}h${m.toString().padStart(2, "0")})`;
        setNativeTip(readExtMode, TIPS.extModeAuto);
      } else {
        readExtMode.textContent = "slider ext.";
        setNativeTip(readExtMode, TIPS.extModeManual);
      }
      const s = state.simTime;
      simTimeEl.textContent =
        s < 3600
          ? `t = ${s.toFixed(0)} s`
          : s < 86400
            ? `t = ${(s / 3600).toFixed(2)} h`
            : `t = ${(s / 86400).toFixed(2)} j`;

      const temps = state.temps;
      const scheduleEl = roots.tempLegend.querySelector("#legend-val-schedule");
      const airIntEl = roots.tempLegend.querySelector("#legend-val-airInt");
      const wallExtEl = roots.tempLegend.querySelector("#legend-val-wallExt");
      const wallIntEl = roots.tempLegend.querySelector("#legend-val-wallInt");
      const feltIntEl = roots.tempLegend.querySelector("#legend-val-feltInt");
      scheduleEl!.textContent = formatTemp(temps.schedule);
      airIntEl!.textContent = formatTemp(temps.airInt);
      wallExtEl!.textContent = formatTemp(temps.wallExt);
      wallIntEl!.textContent = formatTemp(temps.wallInt);
      feltIntEl!.textContent = formatTemp(temps.feltInt);
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
