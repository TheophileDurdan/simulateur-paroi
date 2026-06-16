import type { FacadeOrientation } from "../facadeGeometry";
import type { SkyCover } from "../skyCover";
import { DEFAULT_SKY_COVER } from "../skyCover";
import { hCavityConvection, hCavityToExterior, cavityAirCapacitance, hExterior, hInterior, ventilationHeatCoeff } from "./convection";
import {
  buildMesh,
  interfaceLambda,
  nodeCap,
  type ThermalMesh,
} from "./mesh";
import { effectiveSkyTempC, radiantFluxT4, skyRadiationFlux, skyViewFactor } from "./radiation";
import type { Layer } from "../types";
import {
  AIR_CP,
  AIR_DEPTH,
  AIR_RHO,
  DEFAULT_VENTILATION_ACH,
  DX,
  MAX_INTERIOR_HEATING_W,
  INITIAL_TEMP,
  MIN_DT,
} from "../types";

export type { ThermalMesh } from "./mesh";
export { buildMesh, visualWeights } from "./mesh";

export class ThermalSolver {
  mesh: ThermalMesh;
  tAirInt = INITIAL_TEMP;
  wallTemps: number[] = [];
  /** Température de l'air dans chaque lame ventilée/ouverte (une entrée par cavité). */
  cavityTemps: number[] = [];
  tExt = INITIAL_TEMP;
  simTime = 0;
  facade: FacadeOrientation = { tiltFromHorizontal: 90, azimuthFacing: 180 };
  skyCover: SkyCover = DEFAULT_SKY_COVER;
  /** Renouvellements d'air int. ↔ ext. (volumes/heure). */
  ventilationAch = DEFAULT_VENTILATION_ACH;
  /** Apport thermique air int. (W/m²), + = chauffe, − = refroidit. */
  interiorHeatingWm2 = 0;

  constructor(layers: Layer[]) {
    this.mesh = buildMesh(layers);
    this.resetTemps();
  }

  setFacade(facade: FacadeOrientation) {
    this.facade = { ...facade };
  }

  setSkyCover(cover: SkyCover) {
    this.skyCover = cover;
  }

  setVentilationAch(achPerHour: number) {
    this.ventilationAch = Math.max(0, achPerHour);
  }

  setInteriorHeatingWm2(powerWm2: number) {
    this.interiorHeatingWm2 = Math.min(
      MAX_INTERIOR_HEATING_W,
      Math.max(-MAX_INTERIOR_HEATING_W, powerWm2),
    );
  }

  /** Flux thermique ventilation ext. → air int. (W/m²), positif = gain vers l'intérieur. */
  private ventilationFlux(tAirInt: number, tExt: number): number {
    const hVent = ventilationHeatCoeff(this.ventilationAch, AIR_DEPTH, AIR_RHO, AIR_CP);
    return hVent * (tExt - tAirInt);
  }

  resetTemps() {
    this.tAirInt = INITIAL_TEMP;
    this.wallTemps = this.mesh.nodes.map(() => INITIAL_TEMP);
    this.syncCavityTemps(INITIAL_TEMP);
  }

  private syncCavityTemps(value: number) {
    this.cavityTemps = this.mesh.gaps.map(() => value);
  }

  rebuildMesh(layers: Layer[], preserve = true) {
    const oldPositions = this.mesh.positionsMm;
    const oldTemps = this.wallTemps;
    const oldAir = this.tAirInt;
    const oldCavityByLayer = new Map<string, number>();
    for (let i = 0; i < this.mesh.gaps.length; i++) {
      oldCavityByLayer.set(this.mesh.gaps[i].layerId, this.cavityTemps[i] ?? oldAir);
    }

    this.mesh = buildMesh(layers);

    if (!preserve || oldTemps.length === 0) {
      this.resetTemps();
      return;
    }

    this.tAirInt = oldAir;
    this.wallTemps = this.mesh.positionsMm.map((pos) => {
      let best = INITIAL_TEMP;
      let bestDist = Infinity;
      for (let i = 0; i < oldPositions.length; i++) {
        const d = Math.abs(oldPositions[i] - pos);
        if (d < bestDist) {
          bestDist = d;
          best = oldTemps[i];
        }
      }
      return best;
    });
    this.cavityTemps = this.mesh.gaps.map(
      (g) => oldCavityByLayer.get(g.layerId) ?? oldAir,
    );
  }

  private airCap(): number {
    return AIR_RHO * AIR_CP * AIR_DEPTH;
  }

  private maxAlpha(): number {
    let max = 0;
    for (const n of this.mesh.nodes) {
      max = Math.max(max, n.lambda / (n.rho * n.cp));
    }
    return max;
  }

  stableDt(): number {
    const alpha = this.maxAlpha();
    if (alpha <= 0) return MIN_DT;
    return 0.35 * (DX * DX) / alpha;
  }

  /** Flux sortant du nœud i vers l'interface droite (i | i+1), W/m². */
  private fluxLeavingRight(
    temps: number[],
    i: number,
    nodes: ThermalMesh["nodes"],
  ): number {
    return this.fluxBetween(temps, i, i + 1, nodes);
  }

  /** Flux entrant dans le nœud i depuis l'interface gauche ((i-1) | i), W/m². */
  private fluxEnteringFromLeft(
    temps: number[],
    i: number,
    nodes: ThermalMesh["nodes"],
  ): number {
    return this.fluxBetween(temps, i - 1, i, nodes);
  }

  /** Flux thermique de i vers j (W/m²), nœuds adjacents avec i < j. */
  private fluxBetween(
    temps: number[],
    i: number,
    j: number,
    nodes: ThermalMesh["nodes"],
  ): number {
    const iface = this.mesh.interfaces[i];
    if (!iface) {
      const lam = interfaceLambda(nodes[i].lambda, nodes[j].lambda);
      return (lam * (temps[i] - temps[j])) / DX;
    }

    if (iface.gap) {
      const gap = iface.gap;
      const hCv = hCavityConvection(this.facade.tiltFromHorizontal, gap.thicknessMm);
      const qConv = hCv * (temps[i] - temps[j]);
      const qRad = radiantFluxT4(temps[i], temps[j], gap.epsilonLeft, gap.epsilonRight);
      // Ne pas ajouter la conductance de la feuille mince en parallèle : elle court-circuiterait
      // le rayonnement IR de la cavité (Al λ≈160 W/m·K pour 0,1 mm).
      return qConv + qRad;
    }

    if (iface.filmResistance && iface.filmResistance > 0) {
      return (temps[i] - temps[j]) / iface.filmResistance;
    }

    const lam = interfaceLambda(nodes[i].lambda, nodes[j].lambda);
    return (lam * (temps[i] - temps[j])) / DX;
  }

  private derivatives(
    wallTemps: number[],
    tAirInt: number,
    tExt: number,
    qSolar: number,
    cavityTemps: number[],
  ): { dWall: number[]; dAir: number; dCavity: number[] } {
    const n = wallTemps.length;
    const dWall = new Array<number>(n).fill(0);
    const dCavity = this.mesh.gaps.map((gap, idx) => {
      if (!gap.ventilated) return 0;
      const tCav = cavityTemps[idx];
      const tL = wallTemps[gap.leftNodeIndex];
      const tR = wallTemps[gap.rightNodeIndex];
      const hS = hCavityConvection(this.facade.tiltFromHorizontal, gap.thicknessMm);
      const hV = hCavityToExterior(gap.thicknessMm, !!gap.open);
      const cap = cavityAirCapacitance(gap.thicknessMm, AIR_RHO, AIR_CP);
      const q =
        hS * (tL - tCav) + hS * (tR - tCav) + hV * (tExt - tCav);
      return q / cap;
    });

    if (n === 0) return { dWall, dAir: 0, dCavity };

    const nodes = this.mesh.nodes;
    const hExt = hExterior(this.facade.tiltFromHorizontal);
    const hInt = hInterior();
    const tSurf = wallTemps[0];
    const epsSurf = nodes[0].epsilon;
    const fSky = skyViewFactor(this.facade.tiltFromHorizontal);
    const tSky = effectiveSkyTempC(tExt, this.skyCover);
    const qConvExt = hExt * (tExt - tSurf);
    const qSkyRad = skyRadiationFlux(tSurf, tSky, epsSurf, fSky);

    const qRight0 =
      n > 1
        ? this.fluxLeavingRight(wallTemps, 0, nodes)
        : hInt * (wallTemps[0] - tAirInt);
    dWall[0] = (qConvExt + qSkyRad + qSolar - qRight0) / nodeCap(nodes[0]);

    for (let i = 1; i < n - 1; i++) {
      const qIn = this.fluxEnteringFromLeft(wallTemps, i, nodes);
      const qOut = this.fluxLeavingRight(wallTemps, i, nodes);
      dWall[i] = (qIn - qOut) / nodeCap(nodes[i]);
    }

    if (n === 1) {
      dWall[0] =
        (qConvExt + qSkyRad + qSolar - hInt * (wallTemps[0] - tAirInt)) / nodeCap(nodes[0]);
    } else {
      const qIn = this.fluxEnteringFromLeft(wallTemps, n - 1, nodes);
      const qInt = hInt * (wallTemps[n - 1] - tAirInt);
      dWall[n - 1] = (qIn - qInt) / nodeCap(nodes[n - 1]);
    }

    const qWall = n > 0 ? hInt * (wallTemps[n - 1] - tAirInt) : 0;
    const qVent = this.ventilationFlux(tAirInt, tExt);
    const dAir = (qWall + qVent + this.interiorHeatingWm2) / this.airCap();

    return { dWall, dAir, dCavity };
  }

  private rk4Step(dt: number, tExt: number, qSolar: number) {
    const y0 = [...this.wallTemps];
    const a0 = this.tAirInt;
    const c0 = [...this.cavityTemps];

    const k1 = this.derivatives(y0, a0, tExt, qSolar, c0);
    const w2 = y0.map((v, i) => v + 0.5 * dt * k1.dWall[i]);
    const a2 = a0 + 0.5 * dt * k1.dAir;
    const c2 = c0.map((v, i) => v + 0.5 * dt * k1.dCavity[i]);
    const k2 = this.derivatives(w2, a2, tExt, qSolar, c2);
    const w3 = y0.map((v, i) => v + 0.5 * dt * k2.dWall[i]);
    const a3 = a0 + 0.5 * dt * k2.dAir;
    const c3 = c0.map((v, i) => v + 0.5 * dt * k2.dCavity[i]);
    const k3 = this.derivatives(w3, a3, tExt, qSolar, c3);
    const w4 = y0.map((v, i) => v + dt * k3.dWall[i]);
    const a4 = a0 + dt * k3.dAir;
    const c4 = c0.map((v, i) => v + dt * k3.dCavity[i]);
    const k4 = this.derivatives(w4, a4, tExt, qSolar, c4);

    this.wallTemps = y0.map(
      (v, i) =>
        v +
        (dt / 6) *
          (k1.dWall[i] + 2 * k2.dWall[i] + 2 * k3.dWall[i] + k4.dWall[i]),
    );
    this.tAirInt =
      a0 + (dt / 6) * (k1.dAir + 2 * k2.dAir + 2 * k3.dAir + k4.dAir);
    this.cavityTemps = c0.map(
      (v, i) =>
        v +
        (dt / 6) *
          (k1.dCavity[i] + 2 * k2.dCavity[i] + 2 * k3.dCavity[i] + k4.dCavity[i]),
    );
  }

  step(dtSim: number, tExt: number, qSolar: number) {
    this.tExt = tExt;
    if (dtSim <= 0) return;
    const sub = this.stableDt();
    let remaining = dtSim;
    while (remaining > 0) {
      const h = Math.min(sub, remaining);
      this.rk4Step(h, tExt, qSolar);
      remaining -= h;
    }
    this.simTime += dtSim;
  }

  /** Absorptivité solaire de la face extérieure. */
  exteriorAlphaSolar(): number {
    if (this.mesh.nodes.length === 0) return 0.65;
    return this.mesh.nodes[0].alphaSolar;
  }
}
