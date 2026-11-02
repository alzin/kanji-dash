import { ROADS, type Road } from "@/data";

export type WorldNode = {
  index: number;
  ch?: number;
  road: Road;
  roadIndex: number;
  regionIndex: number;
  x: number;
  y: number;
};

export type Band = {
  road: Road;
  roadIndex: number;
  top: number;
  bottom: number;
  gate: { x: number; y: number };
};

export const WORLD_WIDTH = 1440;
const SPACING = 78;
const GATE_GAP = 150;
const BOTTOM = 680;
const TOP = 460;
const AMPLITUDE = 250;
export const UNCHARTED_STOPS = 10;

const pathX = (i: number) =>
  Math.round(WORLD_WIDTH / 2 + AMPLITUDE * Math.sin(i * 0.45) + 50 * Math.sin(i * 0.13));

export type WorldLayout = {
  nodes: WorldNode[];
  bands: Band[];
  height: number;
  summit: { x: number; y: number };
  camp: { x: number; y: number };
};

let cached: WorldLayout | undefined;

export function worldLayout(): WorldLayout {
  if (cached) return cached;
  const stops = ROADS.reduce((n, road) => n + (road.regions.length || UNCHARTED_STOPS), 0);
  const height = BOTTOM + TOP + stops * SPACING + ROADS.length * GATE_GAP;
  const nodes: WorldNode[] = [];
  const bands: Band[] = [];
  let y = height - BOTTOM;
  ROADS.forEach((road, roadIndex) => {
    const gateY = y;
    y -= GATE_GAP;
    const count = road.regions.length || UNCHARTED_STOPS;
    const first = nodes.length;
    for (let regionIndex = 0; regionIndex < count; regionIndex++) {
      const index = nodes.length;
      nodes.push({ index, road, roadIndex, regionIndex, x: pathX(index), y, ...(road.regions[regionIndex] !== undefined ? { ch: road.regions[regionIndex]! } : {}) });
      y -= SPACING;
    }
    const before = nodes[first - 1];
    bands.push({
      road,
      roadIndex,
      top: 0,
      bottom: roadIndex === 0 ? height : gateY + GATE_GAP / 2,
      gate: { x: Math.round(before ? (before.x + nodes[first]!.x) / 2 : nodes[first]!.x), y: gateY },
    });
  });
  bands.forEach((band, i) => { band.top = bands[i + 1]?.bottom ?? 0; });
  const last = nodes[nodes.length - 1]!;
  const first = nodes[0]!;
  cached = { nodes, bands, height, summit: { x: WORLD_WIDTH / 2, y: last.y - 190 }, camp: { x: first.x - 150, y: first.y + 110 } };
  return cached;
}

export function nodeOfRegion(ch: number): WorldNode | undefined {
  return worldLayout().nodes.find((node) => node.ch === ch);
}
