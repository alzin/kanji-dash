import type { Page } from "@playwright/test";

export const SAVE_PROMPT_KEY = "kanji-dash-save-prompt-v1";

export async function silenceSavePrompt(page: Page) {
  await page.addInitScript((key) => sessionStorage.setItem(key, "9999"), SAVE_PROMPT_KEY);
}
