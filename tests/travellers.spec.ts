import { expect, test, type Page } from "@playwright/test";
import { CURRICULUM_VERSION, LEVEL_CHAPTERS } from "../src/data";
import { silenceSavePrompt } from "./helpers/savePrompt";

test.use({ serviceWorkers: "block" });

const SEALS = [...LEVEL_CHAPTERS.N5, 7, 26, 27, 28, 29];
const SAVE = {
  curriculumVersion: CURRICULUM_VERSION, selectedLevel: "N4", clearedChapters: SEALS, gatesCleared: SEALS.length, unlockedChapters: [],
  progress: {}, coins: 300, runsCompleted: 30, streak: { count: 0, last: "" },
};
const traveller = (id: string, name: string | null, stop: number, seals: number, online: boolean) => ({ id: id.padEnd(12, "x"), name, stop, seals, online });
// Five share region 26, so one of them folds into its stop's "+1".
const CROWD = [
  traveller("aiko", "Aiko", 30, 30, true), traveller("ben", "Ben", 30, 2, false), traveller("anon", null, 1, 0, true),
  ...["c", "d", "e", "f", "g"].map((id, i) => traveller(id, `Five${i}`, 26, 20, i === 0)),
];

async function mockApi(page: Page, signedIn: boolean) {
  const api = { crowd: CROWD, reports: [] as { body: unknown; csrf: string | undefined }[] };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const user = signedIn ? { id: "me", name: "Me Learner", email: "me@example.com", picture: null } : null;
    if (path === "/api/auth/session") return route.fulfill({ json: { user, ...(user ? { csrfToken: "csrf-me" } : {}) } });
    if (path === "/api/progress") return route.fulfill({ json: { save: SAVE, version: 1 } });
    if (path === "/api/travellers") return route.fulfill({ json: { travellers: api.crowd, me: signedIn ? { anonymous: false } : null } });
    if (path === "/api/travellers/me" && request.method() === "PUT") {
      api.reports.push({ body: request.postDataJSON(), csrf: request.headers()["x-csrf-token"] });
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return api;
}

const canvas = (page: Page) => page.locator("canvas[data-ready]");
const pollNow = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

test("guests see every learner on the road, and an invitation to join them", async ({ page }, info) => {
  await silenceSavePrompt(page);
  await page.addInitScript((save) => { if (!sessionStorage.getItem("kanji-dash-guest-v1")) sessionStorage.setItem("kanji-dash-guest-v1", JSON.stringify(save)); }, SAVE);
  const api = await mockApi(page, false);
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(canvas(page)).toHaveAttribute("data-travellers", String(CROWD.length - 1));
  const crowd = page.getByTestId("world-crowd");
  await expect(crowd).toHaveText(`3 on the map now · ${CROWD.length} travellers on the road Join them`);
  await page.getByRole("button", { name: "Close checkpoint" }).click();
  await expect(page.locator(".hub-toast")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("travellers.png") });

  api.crowd = CROWD.filter((t) => !t.name?.startsWith("Five"));
  await pollNow(page);
  await expect(canvas(page)).toHaveAttribute("data-travellers", "3");
  await expect(crowd).toHaveText("2 on the map now · 3 travellers on the road Join them");
  expect(api.reports, "Guests never report a position").toEqual([]);

  await crowd.getByRole("button", { name: "Join them" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a signed-in learner reports their checkpoint, sees who is ahead, and can travel anonymously", async ({ page }) => {
  await silenceSavePrompt(page);
  const api = await mockApi(page, true);
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(canvas(page)).toHaveAttribute("data-travellers", String(CROWD.length - 1));
  await expect.poll(() => api.reports[0]).toEqual({ body: { stop: 30, seals: SEALS.length }, csrf: "csrf-me" });
  await expect(page.getByTestId("world-crowd")).toHaveText(`3 on the map now · 1 of ${CROWD.length} ahead of you`);

  await page.getByRole("button", { name: "Camp" }).click();
  const name = page.getByRole("switch", { name: "Name on the shared map shown" });
  await expect(name).toHaveAttribute("aria-checked", "true");
  await name.click();
  await expect(page.getByRole("switch", { name: "Name on the shared map hidden" })).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => api.reports.at(-1)?.body).toEqual({ stop: 30, seals: SEALS.length, anonymous: true });
  await expect(page.getByText("Other learners see your traveller at your checkpoint, as an anonymous 旅人.")).toBeVisible();
});
