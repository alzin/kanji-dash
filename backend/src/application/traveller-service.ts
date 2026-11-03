import { createHash } from "node:crypto";
import { CHAPTER_IDS } from "../domain/curriculum.js";
import { AppError } from "../domain/errors.js";
import { MAX_TRAVELLERS, ONLINE_MS, RECENT_DAYS, mapName, type PublicTraveller, type TravellerReport, type TravellerRow } from "../domain/travellers.js";
import type { TravellerRepository } from "./ports.js";

const STOPS = new Set<number>(CHAPTER_IDS);

function invalid(field: string): never {
  throw new AppError("INVALID_TRAVELLER", `Invalid traveller field: ${field}.`, 400);
}

export function parseTravellerReport(value: unknown): TravellerReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("body");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((k) => !["stop", "seals", "anonymous"].includes(k))) invalid("body");
  const { stop, seals, anonymous } = body;
  if (typeof stop !== "number" || !STOPS.has(stop)) invalid("stop");
  if (typeof seals !== "number" || !Number.isInteger(seals) || seals < 0 || seals > CHAPTER_IDS.length) invalid("seals");
  if (anonymous !== undefined && typeof anonymous !== "boolean") invalid("anonymous");
  return { stop, seals, ...(anonymous !== undefined ? { anonymous } : {}) };
}

/** Stable per account, but reveals nothing about the account id behind it. */
const publicId = (userId: string) => createHash("sha256").update(`traveller:${userId}`).digest("base64url").slice(0, 12);

export class TravellerService {
  private cached: { at: number; rows: Promise<TravellerRow[]> } | null = null;

  constructor(
    private readonly repository: TravellerRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly cacheMs = 5_000,
  ) {}

  async report(userId: string, value: unknown): Promise<void> {
    const report = parseTravellerReport(value);
    await this.repository.report(userId, report);
    if (report.anonymous !== undefined) this.cached = null;
  }

  /** Every map polls this, so one query per instance serves all of them for a few seconds. */
  private rows(): Promise<TravellerRow[]> {
    const at = this.now().getTime();
    if (!this.cached || at - this.cached.at >= this.cacheMs) {
      const rows = this.repository.recent(new Date(at - RECENT_DAYS * 86_400_000), MAX_TRAVELLERS + 1);
      this.cached = { at, rows };
      rows.catch(() => { if (this.cached?.rows === rows) this.cached = null; });
    }
    return this.cached.rows;
  }

  async list(viewerId?: string): Promise<{ travellers: PublicTraveller[]; me: { anonymous: boolean } | null }> {
    const rows = await this.rows();
    const at = this.now().getTime();
    const travellers = rows.filter((row) => row.userId !== viewerId).slice(0, MAX_TRAVELLERS).map((row) => ({
      id: publicId(row.userId),
      name: row.anonymous ? null : mapName(row.name),
      stop: row.stop,
      seals: row.seals,
      online: at - row.seenAt.getTime() < ONLINE_MS,
    }));
    const me = viewerId === undefined ? null : { anonymous: rows.find((row) => row.userId === viewerId)?.anonymous ?? false };
    return { travellers, me };
  }
}
