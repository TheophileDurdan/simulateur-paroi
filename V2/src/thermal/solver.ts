import type { FacadeOrientation } from "../facadeGeometry";
import { hCavityConvection, hExterior, hInterior, hOpenCavity, hVentilatedCavity, ventilationHeatCoeff } from "./convection";
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
  tExt = INITIAL_TEMP;
  simTime = 0;
  facade: FacadeOrientation = { tiltFromHorizontal: 90, azimuthFacing: 180 };
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
  }

  rebuildMesh(layers: Layer[], preserve = true) {
    const oldPositions = this.mesh.positionsMm;
    const oldTemps = this.wallTemps;
    const oldAir = this.tAirInt;

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
    tExt: number,
    nodes: ThermalMesh["nodes"],
  ): number {
    const iface = this.mesh.interfaces[i];
    if (iface?.gap?.ventilated) {
      const g = iface.gap;
      const hV = g.open ? hOpenCavity(g.thicknessMm) : hVentilatedCavity(g.thicknessMm);
      return (
        hV * (temps[i] - tExt) +
        radiantFluxT4(temps[i], temps[i + 1], g.epsilonLeft, g.epsilonRight)
      );
    }
    return this.fluxBetween(temps, i, i + 1, nodes);
  }

  /** Flux entrant dans le nœud i depuis l'interface gauche ((i-1) | i), W/m². */
  private fluxEnteringFromLeft(
    temps: number[],
    i: number,
    tExt: number,
    nodes: ThermalMesh["nodes"],
  ): number {
    const iface = this.mesh.interfaces[i - 1];
    if (iface?.gap?.ventilated) {
      const g = iface.gap;
      const hV = g.open ? hOpenCavity(g.thicknessMm) : hVentilatedCavity(g.thicknessMm);
      return (
        radiantFluxT4(temps[i - 1], temps[i], g.epsilonLeft, g.epsilonRight) +
        hV * (tExt - temps[i])
      );
    }
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
      let q = qConv + qRad;
      if (iface.filmResistance && iface.filmResistance > 0) {
        q += (temps[i] - temps[j]) / iface.filmResistance;
      }
      return q;
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
  ): { dWall: number[]; dAir: number } {
    const n = wallTemps.length;
    const dWall = new Array<number>(n).fill(0);
    if (n === 0) return { dWall, dAir: 0 };

    const nodes = this.mesh.nodes;
    const hExt = hExterior(this.facade.tiltFromHorizontal);
    const hInt = hInterior();
    const tSurf = wallTemps[0];
    const epsSurf = nodes[0].epsilon;
    const fSky = skyViewFactor(this.facade.tiltFromHorizontal);
    const tSky = effectiveSkyTempC(tExt);
    const qConvExt = hExt * (tExt - tSurf);
    const qSkyRad = skyRadiationFlux(tSurf, tSky, epsSurf, fSky);

    const qRight0 =
      n > 1
        ? this.fluxLeavingRight(wallTemps, 0, tExt, nodes)
        : hInt * (wallTemps[0] - tAirInt);
    dWall[0] = (qConvExt + qSkyRad + qSolar - qRight0) / nodeCap(nodes[0]);

    for (let i = 1; i < n - 1; i++) {
      const qIn = this.fluxEnteringFromLeft(wallTemps, i, tExt, nodes);
      const qOut = this.fluxLeavingRight(wallTemps, i, tExt, nodes);
      dWall[i] = (qIn - qOut) / nodeCap(nodes[i]);
    }

    if (n === 1) {
      dWall[0] =
        (qConvExt + qSkyRad + qSolar - hInt * (wallTemps[0] - tAirInt)) / nodeCap(nodes[0]);
    } else {
      const qIn = this.fluxEnteringFromLeft(wallTemps, n - 1, tExt, nodes);
      const qInt = hInt * (wallTemps[n - 1] - tAirInt);
      dWall[n - 1] = (qIn - qInt) / nodeCap(nodes[n - 1]);
    }

    const qWall = n > 0 ? hInt * (wallTemps[n - 1] - tAirInt) : 0;
    const qVent = this.ventilationFlux(tAirInt, tExt);
    const dAir = (qWall + qVent + this.interiorHeatingWm2) / this.airCap();

    return { dWall, dAir };
  }

  private rk4Step(dt: number, tExt: number, qSolar: number) {
    const y0 = [...this.wallTemps];
    const a0 = this.tAirInt;

    const k1 = this.derivatives(y0, a0, tExt, qSolar);
    const w2 = y0.map((v, i) => v + 0.5 * dt * k1.dWall[i]);
    const a2 = a0 + 0.5 * dt * k1.dAir;
    const k2 = this.derivatives(w2, a2, tExt, qSolar);
    const w3 = y0.map((v, i) => v + 0.5 * dt * k2.dWall[i]);
    const a3 = a0 + 0.5 * dt * k2.dAir;
    const k3 = this.derivatives(w3, a3, tExt, qSolar);
    const w4 = y0.map((v, i) => v + dt * k3.dWall[i]);
    const a4 = a0 + dt * k3.dAir;
    const k4 = this.derivatives(w4, a4, tExt, qSolar);

    this.wallTemps = y0.map(
      (v, i) =>
        v +
        (dt / 6) *
          (k1.dWall[i] + 2 * k2.dWall[i] + 2 * k3.dWall[i] + k4.dWall[i]),
    );
    this.tAirInt =
      a0 + (dt / 6) * (k1.dAir + 2 * k2.dAir + 2 * k3.dAir + k4.dAir);
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
