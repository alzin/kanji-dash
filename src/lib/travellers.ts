import { useEffect, useSyncExternalStore } from "react";
import { request, sendAsUser, useAccount } from "./account";

/** Another learner on the shared map, as the API shows them to everyone. */
export type Traveller = { id: string; name: string | null; stop: number; seals: number; online: boolean };
export type Position = { stop: number; seals: number };
type Feed = { travellers: readonly Traveller[]; anonymous: boolean; signedIn: boolean };

const POLL_MS = 20_000;
const POLL_MAX_MS = 320_000;
const REPORT_MS = 45_000;

let feed: Feed = { travellers: [], anonymous: false, signedIn: false };
const listeners = new Set<() => void>();
let position: Position | null = null;

function update(patch: Partial<Feed>) {
  feed = { ...feed, ...patch };
  listeners.forEach((listener) => listener());
}

export function useTravellers(): Feed {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => feed, () => feed);
}

async function poll() {
  try {
    const body = await request<{ travellers: Traveller[]; me: { anonymous: boolean } | null }>("/travellers");
    update({ travellers: body.travellers, signedIn: !!body.me, anonymous: body.me?.anonymous ?? false });
    return true;
  } catch { /* The map stays as it was; the next poll tries again. */ return false; }
}

async function report(extra: { anonymous?: boolean } = {}) {
  if (!position) return;
  try { await sendAsUser("/travellers/me", "PUT", { ...position, ...extra }); } catch { /* Reported again on the next beat. */ }
}

/**
 * Keeps the shared map live while it is open: polls who is on the road and, for a
 * signed-in learner, reports where they stand. Both pause in a hidden tab.
 */
export function useTravellerFeed(here: Position) {
  const account = useAccount();
  const settled = account.phase !== "checking";
  const user = account.user?.id ?? null;
  // The session is usable for writes once its cloud progress has loaded.
  const reporting = !!user && account.phase !== "loading";
  useEffect(() => {
    position = here;
    if (reporting) void report();
  }, [here.stop, here.seals, reporting]);
  useEffect(() => {
    if (!settled) return;
    let polls: number | undefined, beats: number | undefined, run = 0;
    const start = () => {
      const mine = ++run;
      let misses = 0;
      const next = async () => {
        misses = (await poll()) ? 0 : misses + 1;
        if (mine === run) polls = window.setTimeout(next, Math.min(POLL_MAX_MS, POLL_MS * 2 ** misses));
      };
      void next();
      if (user) beats = window.setInterval(() => { void report(); }, REPORT_MS);
    };
    const stop = () => { run++; window.clearTimeout(polls); window.clearInterval(beats); };
    const visibility = () => {
      stop();
      if (document.visibilityState === "visible") {
        if (user) void report();
        start();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", visibility);
    return () => { stop(); document.removeEventListener("visibilitychange", visibility); };
  }, [settled, user]);
}

export async function setTravelAnonymously(anonymous: boolean) {
  const previous = feed.anonymous;
  update({ anonymous });
  try {
    if (!position || !(await sendAsUser("/travellers/me", "PUT", { ...position, anonymous }))) update({ anonymous: previous });
  } catch { update({ anonymous: previous }); }
}
