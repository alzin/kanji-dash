/** A learner who stopped reporting from the map this long ago no longer counts as on it. */
export const ONLINE_MS = 2 * 60_000;
/** Travellers quiet for longer than this leave the shared map until they return. */
export const RECENT_DAYS = 14;
export const MAX_TRAVELLERS = 150;

export type TravellerReport = { stop: number; seals: number; anonymous?: boolean };

export type TravellerRow = { userId: string; name: string; stop: number; seals: number; anonymous: boolean; seenAt: Date };

/** What any visitor may see about another learner: never an email, picture or account id. */
export type PublicTraveller = { id: string; name: string | null; stop: number; seals: number; online: boolean };

/** First word of the Google display name only, so the map never shows a full name. */
export function mapName(name: string): string | null {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first ? [...first].slice(0, 12).join("") : null;
}
