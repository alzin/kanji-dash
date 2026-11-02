import { expect, type Locator, type Page } from "@playwright/test";
import { kanjiOfChapter } from "../../src/data";
import type { FireflyEntity, FireflyState } from "../../src/components/game/firefly/simulation";
import type { AdventureRecallEvent } from "../../src/lib/firefly-learning";
import type { GateMode, TrailId } from "../../src/lib/firefly-catalog";
import { silenceSavePrompt } from "./savePrompt";

export type FireflyGate = { id: number; index: number; mode: GateMode; answer: number; labels: string[]; lead: number };
export type FireflyInspection = Pick<FireflyState, "phase" | "stage" | "elapsed" | "hearts" | "charges" | "score" | "rescued" | "shield" | "magnet" | "trails" | "lane" | "gatesResolved" | "gatesCorrect" | "pace"> & {
  next: FireflyEntity[]; gate: FireflyGate | null; graded: number; scheduledCorrect: number; recalls: AdventureRecallEvent[];
};
export const inspectFirefly = (page: Page): Promise<FireflyInspection> => page.evaluate(() => (window as typeof window & { __fireflyInspect: () => FireflyInspection }).__fireflyInspect());
export const savedFirefly = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("kanji-dash-guest-v1")!));

export async function beginFirefly(page: Page, options: { known?: boolean; savePrompt?: boolean; gentle?: boolean; checkpoint?: boolean } = {}) {
  await page.clock.install();
  if (!options.savePrompt) await silenceSavePrompt(page);
  await page.route("**/api/auth/session", route => route.fulfill({ json: { user: null } }));
  if (options.known || options.checkpoint) {
    const progress = Object.fromEntries(kanjiOfChapter(1).map(k => [k.c, { mastery: 1, ivl: 1, ease: 2.5, due: Date.now() + 7 * 86400000, correct: 1, wrong: 0, rt: 0, prod: 0, fl: 0 }]));
    const steps = options.checkpoint ? { learned: [1], stacked: [1], rescued: [] } : undefined;
    await page.addInitScript(({ progress, steps }) => {
      if (!sessionStorage.getItem("kanji-dash-guest-v1")) sessionStorage.setItem("kanji-dash-guest-v1", JSON.stringify({ curriculumVersion: 2, unlockedChapters: [], progress, streak: { count: 0, last: "" }, coins: 0, runsCompleted: 0, gatesCleared: 0, clearedChapters: [], selectedLevel: "N5", ...(steps ? { checkpointSteps: steps } : {}) }));
    }, { progress, steps });
  }
  await page.goto(options.checkpoint ? "run?gate=1" : "run?mode=runner", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Light the lantern" })).toBeEnabled();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
  if (options.gentle) await page.getByRole("button", { name: /Gentle journey/ }).click();
  return clickToFireflyReady(page, page.getByRole("button", { name: "Light the lantern" }));
}

export async function readyFirefly(page: Page) {
  await expect.poll(async () => {
    await page.clock.runFor(50);
    return page.evaluate(() => !!document.querySelector(".ff-canvas canvas[data-ready]") &&
      document.querySelector<HTMLButtonElement>('button[aria-label="Pause adventure"]')?.disabled === false &&
      typeof (window as any).__fireflyInspect === "function");
  }).toBe(true);
}

let startSerial = 0;
export async function clickToFireflyReady(page: Page, button: Locator): Promise<number> {
  let started = 0;
  const callback = `__fireflyStartTime${++startSerial}`;
  await page.exposeFunction(callback, () => { started = Date.now(); });
  await button.evaluate((element, callback) => {
    element.addEventListener("click", () => { (window as any)[callback](); }, { once: true });
  }, callback);
  await button.click();
  await readyFirefly(page);
  expect(started).toBeGreaterThan(0);
  return Date.now() - started;
}

export async function travel(page: Page, milliseconds: number) {
  for (let left = milliseconds; left > 0; left -= 800) {
    await page.clock.fastForward(Math.min(800, left));
    await page.clock.runFor(20);
  }
}

const names: Record<TrailId, string> = { grove: "Firefly Grove", bramble: "Bramble Run", bridge: "Quiet Bridge", moonpath: "Moonpath" };
type Steering = {
  trails?: [TrailId, TrailId];
  until?: (s: FireflyInspection) => boolean;
  miss?: number[];
  lose?: boolean;
  pointer?: boolean;
};

export async function steerFirefly(page: Page, options: Steering = {}) {
  const trails = options.trails ?? ["grove", "bridge"];
  let firstCageRescued = false;
  let committedCage: number | null = null;
  for (let step = 0; step < 900; step++) {
    const s = await inspectFirefly(page);
    if (s.phase === "delivery" || s.phase === "lost" || options.until?.(s)) return { state: s };
    if (s.phase === "fork") {
      await page.getByRole("dialog", { name: "Choose your next trail" }).getByRole("button", { name: new RegExp(names[trails[s.stage]!]) }).click();
      continue;
    }
    const activeCage = s.next.find(e => e.id === committedCage);
    if (!activeCage) committedCage = null;
    const cage = s.next.find(e => e.kind === "cage" && e.time - s.elapsed <= 0.75);
    const hazard = s.next.find(e => e.kind === "hazard" && e.time - s.elapsed <= 0.75);
    const gate = s.gate && s.gate.lead <= 0.75 ? s.gate : null;
    let lane = s.lane;
    if (activeCage) lane = activeCage.lane;
    else if (cage && s.charges > 0 && (!options.lose || !firstCageRescued)) {
      lane = cage.lane;
      if (options.pointer) await page.getByRole("button", { name: /^Lantern Burst/ }).click();
      else await page.keyboard.press("Space");
      firstCageRescued = true;
      committedCage = cage.id;
    } else if (gate) {
      lane = options.miss?.includes(gate.index) && gate.mode !== "intro" ? (gate.answer + 1) % 3 : gate.answer;
    } else if (hazard) {
      const blocked = s.next.filter(e => e.kind === "hazard" && e.time === hazard.time).map(e => e.lane);
      lane = options.lose ? hazard.lane : [0, 1, 2].find(l => !blocked.includes(l))!;
    }
    if (lane !== s.lane) {
      if (options.pointer) {
        const canvas = page.locator(".ff-canvas"); const box = (await canvas.boundingBox())!;
        await canvas.click({ position: { x: box.width * (.2 + lane * .3), y: box.height * .62 } });
      } else await page.keyboard.press(String(lane + 1));
    }
    const upcoming = s.next.filter(e => e.kind !== "firefly");
    const arrival = upcoming.length ? Math.min(...upcoming.map(e => e.time - s.elapsed)) : Infinity;
    const seconds = arrival > .75 ? Math.min(1.5, arrival - .7) : Math.max(.08, Math.min(.75, arrival + .05));
    await travel(page, Math.ceil(seconds / Math.max(1, s.pace) * 1000));
  }
  throw new Error(`Adventure did not end: ${JSON.stringify(await inspectFirefly(page))}`);
}
