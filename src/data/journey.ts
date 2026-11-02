import { LEVELS, LEVEL_CHAPTERS, type JLPTLevel } from "./regions";

export type RoadId = JLPTLevel | "N1";

export type Road = {
  id: RoadId;
  level?: JLPTLevel;
  romaji: string;
  jp: string;
  hue: number;
  regions: readonly number[];
};

const HIGHWAYS: Record<RoadId, { romaji: string; jp: string; hue: number }> = {
  N5: { romaji: "Tōkaidō", jp: "東海道", hue: 230 },
  N4: { romaji: "Nakasendō", jp: "中山道", hue: 150 },
  N3: { romaji: "Kōshū Kaidō", jp: "甲州街道", hue: 320 },
  N2: { romaji: "Nikkō Kaidō", jp: "日光街道", hue: 40 },
  N1: { romaji: "Ōshū Kaidō", jp: "奥州街道", hue: 265 },
};

const isLevel = (id: RoadId): id is JLPTLevel => (LEVELS as readonly string[]).includes(id);

export const ROADS: readonly Road[] = (["N5", "N4", "N3", "N2", "N1"] as const).map((id) => ({
  id,
  ...HIGHWAYS[id],
  ...(isLevel(id) ? { level: id, regions: LEVEL_CHAPTERS[id] } : { regions: [] }),
}));

export const JOURNEY_STOPS: readonly number[] = ROADS.flatMap((road) => road.regions);

export function roadOfLevel(level: JLPTLevel): Road {
  return ROADS.find((road) => road.level === level)!;
}

export function journeyNumber(ch: number): number {
  return JOURNEY_STOPS.indexOf(ch) + 1;
}
