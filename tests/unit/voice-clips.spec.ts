import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { allKanji } from "../../src/data";
import { vocabKana } from "../../src/lib/words";
import { VOICE_DIRECTORY, clipFile, clipScript } from "../../src/lib/voice-clips";

test("homophones get their own clips, and a word's clip name never changes", () => {
  expect(clipFile("橋", "はし")).not.toBe(clipFile("箸", "はし"));
  expect(clipFile("橋", "はし")).toBe(clipFile("橋", "はし"));
  expect(clipFile("一日", "いちにち")).not.toBe(clipFile("一日", "ついたち"));
  expect(clipFile("橋", "はし")).toMatch(/^[0-9a-f]{14}\.mp3$/);
});

test("the voice reads the kanji with the taught reading pinned", () => {
  expect(clipScript("一人", "ひとり")).toBe('<sub alias="ひとり">一人</sub>');
  expect(clipScript("ひらがな", "ひらがな")).toBe("ひらがな");
  expect(clipScript("A&B", "えー")).toBe('<sub alias="えー">A&amp;B</sub>');
  // One-kana readings go as the sound alone: the alias let 木 come out as こ.
  // Katakana keeps a lone は from being read as the particle わ.
  expect(clipScript("木", "き")).toBe("キ");
  expect(clipScript("歯", "は")).toBe("ハ");
});

test("every vocabulary word has a recorded clip (run npm run voice:generate after adding words)", () => {
  const missing = allKanji.flatMap((kanji) => kanji.vocab)
    .filter((vocab) => !existsSync(join("public", VOICE_DIRECTORY, clipFile(vocab.w, vocabKana(vocab)))))
    .map((vocab) => `${vocab.w} (${vocabKana(vocab)})`);
  expect(missing).toEqual([]);
});
