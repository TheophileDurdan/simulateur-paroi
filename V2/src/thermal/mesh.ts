import { resolveLayer } from "../materials";
import type { Layer, NodeProps } from "../types";
import { activeLayers, DX } from "../types";
import { applySegmentContrast } from "./meshContrast";

export interface AirGapLink {
  leftNodeIndex: number;
  rightNodeIndex: number;
  thicknessMm: number;
  epsilonLeft: number;
  epsilonRight: number;
  layerId: string;
  ventilated: boolean;
  open?: boolean;
}

export interface ThinFilmLink {
  leftNodeIndex: number;
  rightNodeIndex: number;
  /** Résistance thermique m²·K/W */
  resistance: number;
  layerId: string;
}

export type VisualSegmentKind = "solid" | "gap" | "film";

export interface VisualSegment {
  kind: VisualSegmentKind;
  layerId: string;
  color: string;
  nodeStart: number;
  nodeCount: number;
  thicknessMm: number;
  ventilated?: boolean;
  open?: boolean;
}

/** Interface entre nœuds consécutifs i et i+1. */
export interface NodeInterface {
  gap?: AirGapLink;
  /** Résistance d'une feuille mince (sans nœud), m²·K/W */
  filmResistance?: number;
}

export interface ThermalMesh {
  nodes: NodeProps[];
  positionsMm: number[];
  gaps: AirGapLink[];
  films: ThinFilmLink[];
  segments: VisualSegment[];
  /** interfaces[i] = lien entre nœud i et i+1 */
  interfaces: NodeInterface[];
}

interface PendingGap {
  thicknessMm: number;
  layerId: string;
  color: string;
  ventilated: boolean;
  open?: boolean;
}

interface PendingFilm {
  thicknessMm: number;
  lambda: number;
  epsilon: number;
  layerId: string;
  color: string;
}

function buildInterfaces(
  nodeCount: number,
  gaps: AirGapLink[],
  films: ThinFilmLink[],
): NodeInterface[] {
  const interfaces: NodeInterface[] = Array.from({ length: Math.max(0, nodeCount - 1) }, () => ({}));
  for (const g of gaps) {
    if (g.leftNodeIndex >= 0 && g.leftNodeIndex < interfaces.length) {
      interfaces[g.leftNodeIndex].gap = g;
    }
  }
  for (const f of films) {
    if (f.leftNodeIndex >= 0 && f.leftNodeIndex < interfaces.length) {
      interfaces[f.leftNodeIndex].filmResistance = f.resistance;
    }
  }
  return interfaces;
}

export function buildMesh(layers: Layer[]): ThermalMesh {
  const active = activeLayers(layers);
  const nodes: NodeProps[] = [];
  const positionsMm: number[] = [];
  const gaps: AirGapLink[] = [];
  const films: ThinFilmLink[] = [];
  const segments: VisualSegment[] = [];
  let pending: PendingGap | null = null;
  let pendingFilm: PendingFilm | null = null;
  let pos = 0.5;

  for (const layer of active) {
    const props = resolveLayer(layer);

    if (
      props.kind === "air_gap" ||
      props.kind === "air_gap_ventilated" ||
      props.kind === "air_gap_open"
    ) {
      pending = {
        thicknessMm: Math.max(5, layer.thicknessMm),
        layerId: layer.id,
        color: props.color,
        ventilated: props.kind !== "air_gap",
        open: props.kind === "air_gap_open",
      };
      continue;
    }

    if (props.kind === "thin_film") {
      pendingFilm = {
        thicknessMm: Math.max(0.1, layer.thicknessMm),
        lambda: props.lambda,
        epsilon: props.epsilon,
        layerId: layer.id,
        color: props.color,
      };
      continue;
    }

    const n = Math.max(1, Math.round(layer.thicknessMm));
    const nodeStart = nodes.length;
    const filmForGap = pendingFilm;

    if (pending && nodes.length > 0) {
      segments.push({
        kind: "gap",
        layerId: pending.layerId,
        color: pending.color,
        nodeStart: nodes.length,
        nodeCount: 0,
        thicknessMm: pending.thicknessMm,
        ventilated: pending.ventilated,
        open: pending.open,
      });
      if (filmForGap) {
        segments.push({
          kind: "film",
          layerId: filmForGap.layerId,
          color: filmForGap.color,
          nodeStart: nodes.length,
          nodeCount: 0,
          thicknessMm: filmForGap.thicknessMm,
        });
      }
      gaps.push({
        leftNodeIndex: nodes.length - 1,
        rightNodeIndex: nodes.length,
        thicknessMm: pending.thicknessMm,
        epsilonLeft: nodes[nodes.length - 1].epsilon,
        epsilonRight: filmForGap?.epsilon ?? props.epsilon,
        layerId: pending.layerId,
        ventilated: pending.ventilated,
        open: pending.open,
      });
      pending = null;
      pendingFilm = null;
    } else if (pendingFilm && nodes.length > 0) {
      const eM = pendingFilm.thicknessMm / 1000;
      films.push({
        leftNodeIndex: nodes.length - 1,
        rightNodeIndex: nodes.length,
        resistance: eM / pendingFilm.lambda,
        layerId: pendingFilm.layerId,
      });
      segments.push({
        kind: "film",
        layerId: pendingFilm.layerId,
        color: pendingFilm.color,
        nodeStart: nodes.length,
        nodeCount: 0,
        thicknessMm: pendingFilm.thicknessMm,
      });
      pendingFilm = null;
    }

    for (let i = 0; i < n; i++) {
      nodes.push({
        rho: props.rho,
        cp: props.cp,
        lambda: props.lambda,
        color: props.color,
        epsilon: props.epsilon,
        alphaSolar: props.alphaSolar,
        layerId: layer.id,
      });
      positionsMm.push(pos);
      pos += 1;
    }

    segments.push({
      kind: "solid",
      layerId: layer.id,
      color: props.color,
      nodeStart,
      nodeCount: n,
      thicknessMm: layer.thicknessMm,
    });
  }

  const interfaces = buildInterfaces(nodes.length, gaps, films);

  applySegmentContrast(segments, nodes);

  return { nodes, positionsMm, gaps, films, segments, interfaces };
}

export function interfaceLambda(a: number, b: number): number {
  return Math.min(a, b);
}

/** Poids relatifs des colonnes d'affichage (nœuds solides + cavités + films). */
export function visualWeights(mesh: ThermalMesh): number[] {
  const weights: number[] = [];
  for (const seg of mesh.segments) {
    if (seg.kind === "solid") {
      for (let i = 0; i < seg.nodeCount; i++) weights.push(1);
    } else if (seg.kind === "gap") {
      weights.push(Math.max(1, Math.round(seg.thicknessMm)));
    } else {
      weights.push(Math.max(1, Math.round(seg.thicknessMm)));
    }
  }
  return weights;
}

export function nodeCap(node: NodeProps): number {
  return node.rho * node.cp * DX;
}
