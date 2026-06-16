import { getMaterial } from "../materials";
import type { Layer, NodeProps } from "../types";
import {
  AIR_CP,
  AIR_DEPTH,
  AIR_RHO,
  DX,
  INITIAL_TEMP,
  MIN_DT,
  R_SE,
  R_SI,
} from "../types";

export interface ThermalMesh {
  nodes: NodeProps[];
  /** mm from exterior face for each node center */
  positionsMm: number[];
}

export function buildMesh(layers: Layer[]): ThermalMesh {
  const nodes: NodeProps[] = [];
  const positionsMm: number[] = [];
  let pos = 0.5;

  for (const layer of layers) {
    const preset = getMaterial(layer.materialId);
    const rho = layer.rho ?? preset.rho;
    const cp = layer.cp ?? preset.cp;
    const lambda = layer.lambda ?? preset.lambda;
    const color = layer.color ?? preset.color;
    const n = Math.max(1, Math.round(layer.thicknessMm));

    for (let i = 0; i < n; i++) {
      nodes.push({ rho, cp, lambda, color, layerId: layer.id });
      positionsMm.push(pos);
      pos += 1;
    }
  }

  return { nodes, positionsMm };
}

export function interfaceLambda(a: number, b: number): number {
  return Math.min(a, b);
}

export class ThermalSolver {
  mesh: ThermalMesh;
  tAirInt = INITIAL_TEMP;
  wallTemps: number[] = [];
  tExt = INITIAL_TEMP;
  simTime = 0;

  constructor(layers: Layer[]) {
    this.mesh = buildMesh(layers);
    this.resetTemps();
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

  private nodeCap(node: NodeProps): number {
    return node.rho * node.cp * DX;
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

  /** Stable explicit sub-step (s) */
  stableDt(): number {
    const alpha = this.maxAlpha();
    if (alpha <= 0) return MIN_DT;
    return 0.35 * (DX * DX) / alpha;
  }

  private derivatives(tExt: number, qSolar: number): { dWall: number[]; dAir: number } {
    const n = this.mesh.nodes.length;
    const dWall = new Array<number>(n).fill(0);
    if (n === 0) return { dWall, dAir: 0 };

    const temps = this.wallTemps;
    const nodes = this.mesh.nodes;

    const flux = (tLeft: number, tRight: number, lamLeft: number, lamRight: number) =>
      (interfaceLambda(lamLeft, lamRight) * (tLeft - tRight)) / DX;

    const qExt = (tExt - temps[0]) / R_SE;
    const qTo1 = n > 1 ? flux(temps[0], temps[1], nodes[0].lambda, nodes[1].lambda) : 0;
    dWall[0] = (qExt + qSolar - qTo1) / this.nodeCap(nodes[0]);

    for (let i = 1; i < n - 1; i++) {
      const qIn = flux(temps[i - 1], temps[i], nodes[i - 1].lambda, nodes[i].lambda);
      const qOut = flux(temps[i], temps[i + 1], nodes[i].lambda, nodes[i + 1].lambda);
      dWall[i] = (qIn - qOut) / this.nodeCap(nodes[i]);
    }

    if (n === 1) {
      const qInt = (temps[0] - this.tAirInt) / R_SI;
      dWall[0] = (qExt + qSolar - qInt) / this.nodeCap(nodes[0]);
    } else {
      const qIn = flux(temps[n - 2], temps[n - 1], nodes[n - 2].lambda, nodes[n - 1].lambda);
      const qInt = (temps[n - 1] - this.tAirInt) / R_SI;
      dWall[n - 1] = (qIn - qInt) / this.nodeCap(nodes[n - 1]);
    }

    const qAir = (temps[n - 1] - this.tAirInt) / R_SI;
    const dAir = qAir / this.airCap();

    return { dWall, dAir };
  }

  private rk4Step(dt: number, tExt: number, qSolar: number) {
    const y0 = [...this.wallTemps];
    const a0 = this.tAirInt;

    const computeDeriv = (wall: number[], air: number) => {
      const savedW = this.wallTemps;
      const savedA = this.tAirInt;
      this.wallTemps = wall;
      this.tAirInt = air;
      const d = this.derivatives(tExt, qSolar);
      this.wallTemps = savedW;
      this.tAirInt = savedA;
      return d;
    };

    const k1 = computeDeriv(y0, a0);
    const w2 = y0.map((v, i) => v + 0.5 * dt * k1.dWall[i]);
    const k2 = computeDeriv(w2, a0 + 0.5 * dt * k1.dAir);
    const w3 = y0.map((v, i) => v + 0.5 * dt * k2.dWall[i]);
    const k3 = computeDeriv(w3, a0 + 0.5 * dt * k2.dAir);
    const w4 = y0.map((v, i) => v + dt * k3.dWall[i]);
    const k4 = computeDeriv(w4, a0 + dt * k3.dAir);

    this.wallTemps = y0.map(
      (v, i) =>
        v +
        (dt / 6) *
          (k1.dWall[i] + 2 * k2.dWall[i] + 2 * k3.dWall[i] + k4.dWall[i]),
    );
    this.tAirInt =
      a0 + (dt / 6) * (k1.dAir + 2 * k2.dAir + 2 * k3.dAir + k4.dAir);
  }

  /** Advance simulation by `dtSim` simulated seconds using RK4 sub-steps */
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
}
