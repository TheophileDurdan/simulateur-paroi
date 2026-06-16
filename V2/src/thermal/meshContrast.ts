import { distinctFrom, hasMinContrast } from "../colorContrast";
import type { NodeProps } from "../types";
import type { VisualSegment } from "./mesh";

function segmentColor(seg: VisualSegment, nodes: NodeProps[]): string {
  if (seg.kind === "solid" && seg.nodeCount > 0) {
    return nodes[seg.nodeStart]?.color ?? seg.color;
  }
  return seg.color;
}

function setSegmentColor(seg: VisualSegment, nodes: NodeProps[], color: string): void {
  seg.color = color;
  if (seg.kind === "solid") {
    for (let i = 0; i < seg.nodeCount; i++) {
      nodes[seg.nodeStart + i].color = color;
    }
  }
}

/** Garantit un contraste visuel entre segments de matériaux adjacents. */
export function applySegmentContrast(segments: VisualSegment[], nodes: NodeProps[]): void {
  let prevColor: string | null = null;
  let prevLayerId: string | null = null;

  for (const seg of segments) {
    let color = segmentColor(seg, nodes);
    if (prevColor && prevLayerId !== seg.layerId && !hasMinContrast(prevColor, color)) {
      color = distinctFrom(color, prevColor);
      setSegmentColor(seg, nodes, color);
    }
    prevColor = segmentColor(seg, nodes);
    prevLayerId = seg.layerId;
  }
}
