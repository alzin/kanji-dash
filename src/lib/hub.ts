import type { SaveData } from "@/lib/srs";

export const TITLE_SEEN_KEY = "kanji-dash-title-v1";

export function isNewTraveller(save: SaveData): boolean {
  const steps = save.checkpointSteps;
  return save.runsCompleted === 0
    && Object.keys(save.progress).length === 0
    && save.clearedChapters.length === 0
    && (!steps || steps.learned.length + steps.stacked.length + steps.rescued.length === 0);
}

export function titleSeen(): boolean {
  try {
    return sessionStorage.getItem(TITLE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberTitleSeen(): void {
  try {
    sessionStorage.setItem(TITLE_SEEN_KEY, "1");
  } catch {}
}
