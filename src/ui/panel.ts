import { MATERIALS, getMaterial } from "../materials";
import type { Layer, SimSpeed } from "../types";
import { simTimeToHour } from "../schedule";

import type { SchedulePoint } from "../schedule";
import { DEFAULT_FACADE, DEFAULT_SOLAR_SITE, type SolarSite } from "../facadeGeometry";
import { createFacadeWidget3D } from "./facadeWidget3d";

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
}

export interface PanelState {
  playing: boolean;
  speed: SimSpeed;
  simTime: number;
  tAirInt: number;
  tExt: number;
  solarPercent: number;
  extAuto: boolean;
}

export function createPanel(
  container: HTMLElement,
  initialLayers: Layer[],
  callbacks: PanelCallbacks,
): { update: (state: PanelState) => void } {
  container.innerHTML = `
    <div class="panel-row panel-title">
      <h1>Paroi multicouche — conduction 1D</h1>
      <div class="sim-controls">
        <button id="btn-play" type="button">▶ Lecture</button>
        <label>Vitesse
          <select id="sel-speed">
            <option value="1">×1</option>
            <option value="10">×10</option>
            <option value="100" selected>×100</option>
          </select>
        </label>
        <span id="sim-time">t = 0 s</span>
        <button id="btn-ext-auto" type="button" class="active">T ext. manuelle</button>
        <button id="btn-reset" type="button">Réinit. T</button>
      </div>
    </div>
    <div class="panel-row panel-readouts">
      <span>T<sub>air int.</sub> = <strong id="read-tint">26.0</strong> °C</span>
      <span>T<sub>ext</sub> = <strong id="read-text">26.0</strong> °C</span>
      <span>Soleil = <strong id="read-solar">0</strong> %</span>
      <span id="read-ext-mode" class="ext-mode-hint">— profil horaire</span>
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
  const readTint = container.querySelector<HTMLSpanElement>("#read-tint")!;
  const readText = container.querySelector<HTMLSpanElement>("#read-text")!;
  const readSolar = container.querySelector<HTMLSpanElement>("#read-solar")!;
  const readExtMode = container.querySelector<HTMLSpanElement>("#read-ext-mode")!;
  const simTimeEl = container.querySelector<HTMLSpanElement>("#sim-time")!;
  const facadeHost = container.querySelector<HTMLDivElement>("#facade-controls-host")!;

  createFacadeWidget3D(facadeHost, DEFAULT_FACADE, DEFAULT_SOLAR_SITE, {
    onFacadeChange(f, site) {
      callbacks.onFacadeChange(f.tiltFromHorizontal, f.azimuthFacing, site);
    },
    onClimatePresetApply(site, schedule, initialTemp) {
      callbacks.onClimatePresetApply(site, schedule, initialTemp);
    },
  });

  let layers: Layer[] = [...initialLayers];

  function emit() {
    callbacks.onLayersChange([...layers]);
  }

  function renderLayers() {
    layersList.innerHTML = "";
    layers.forEach((layer, index) => {
      const preset = getMaterial(layer.materialId);
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
          <input type="number" class="layer-thick" min="1" step="1" value="${layer.thicknessMm}" />
        </label>
        <label class="layer-field">ρ
          <input type="number" class="layer-rho" min="1" step="1" value="${layer.rho ?? preset.rho}" />
        </label>
        <label class="layer-field">cp
          <input type="number" class="layer-cp" min="1" step="1" value="${layer.cp ?? preset.cp}" />
        </label>
        <label class="layer-field">λ
          <input type="number" class="layer-lambda" min="0.001" step="0.001" value="${layer.lambda ?? preset.lambda}" />
        </label>
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
        renderLayers();
        emit();
      });

      row.querySelector(".layer-thick")!.addEventListener("change", (e) => {
        layer.thicknessMm = Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 1);
        emit();
      });

      for (const cls of ["layer-rho", "layer-cp", "layer-lambda"] as const) {
        row.querySelector(`.${cls}`)!.addEventListener("change", (e) => {
          const v = parseFloat((e.target as HTMLInputElement).value);
          if (cls === "layer-rho") layer.rho = v;
          if (cls === "layer-cp") layer.cp = v;
          if (cls === "layer-lambda") layer.lambda = v;
          emit();
        });
      }

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
      readTint.textContent = state.tAirInt.toFixed(1);
      readText.textContent = state.tExt.toFixed(1);
      readSolar.textContent = state.solarPercent.toFixed(0);
      btnExtAuto.textContent = state.extAuto ? "T ext. manuelle" : "T ext. auto";
      btnExtAuto.classList.toggle("active", state.extAuto);
      if (state.extAuto) {
        const h = Math.floor(simTimeToHour(state.simTime));
        const m = Math.floor((simTimeToHour(state.simTime) % 1) * 60);
        readExtMode.textContent = `— profil horaire (${h}h${m.toString().padStart(2, "0")})`;
      } else {
        readExtMode.textContent = "— slider gauche";
      }
      const s = state.simTime;
      simTimeEl.textContent =
        s < 3600
          ? `t = ${s.toFixed(0)} s`
          : s < 86400
            ? `t = ${(s / 3600).toFixed(2)} h`
            : `t = ${(s / 86400).toFixed(2)} j`;
    },
  };
}
