import { ROADS, roadOfLevel, type Road } from "@/data";
import { completedSteps } from "./checkpoint-steps";
import { isChapterUnlocked, isGateCleared, type SaveData } from "./srs";
import { stackOf } from "./stack-progress";

export type StopStatus = "sealed" | "open" | "locked";

export type StopState = { status: StopStatus; steps: number; perfect: boolean };

export function stopState(save: SaveData, ch: number): StopState {
  const sealed = isGateCleared(save, ch);
  return {
    status: sealed ? "sealed" : isChapterUnlocked(save, ch) ? "open" : "locked",
    steps: sealed ? 0 : completedSteps(save, ch),
    perfect: sealed && stackOf(save).perfectGates.includes(ch),
  };
}

export function nextOnRoad(save: SaveData, road: Road): number | undefined {
  return road.regions.find((ch) => isChapterUnlocked(save, ch) && !isGateCleared(save, ch));
}

export function roadSeals(save: SaveData, road: Road): number {
  return road.regions.filter((ch) => isGateCleared(save, ch)).length;
}

export function isRoadSealed(save: SaveData, road: Road): boolean {
  return road.regions.length > 0 && roadSeals(save, road) === road.regions.length;
}

export function journeyHere(save: SaveData): { road: Road; ch: number | undefined } {
  const road = roadOfLevel(save.selectedLevel);
  return { road, ch: nextOnRoad(save, road) };
}

export function journeySeals(save: SaveData): number {
  return ROADS.reduce((sum, road) => sum + roadSeals(save, road), 0);
}
