/**
 * Generates one Aivis clip per vocabulary word into public/audio/words/<voice id>/.
 * Existing clips are kept, so a rerun only pays for new words.
 *
 *   npm run voice:generate                 every missing clip
 *   npm run voice:generate -- --dry-run    count what would be generated and its cost
 *   npm run voice:generate -- --limit 20   try a few first
 *   npm run voice:generate -- --redo 橋    regenerate one word after a fix
 *
 * Reads AIVIS_API_KEY from the environment or backend/.env; the key never enters the app.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { allKanji } from "../src/data";
import { vocabKana } from "../src/lib/words";
import { VOICE, VOICE_DIRECTORY, clipFile, clipScript } from "../src/lib/voice-clips";

const ENDPOINT = "https://api.aivis-project.com/v1/tts/synthesize";
const CREDITS_PER_CHARACTER = 0.044;
const CONCURRENCY = 3;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limit = Number(args[args.indexOf("--limit") + 1]) || Infinity;
const redo = new Set(args.flatMap((arg, i) => (args[i - 1] === "--redo" ? arg.split(",") : [])));

const root = resolve(import.meta.dirname, "..");
const outDir = join(root, "public", VOICE_DIRECTORY);

const words = new Map<string, { word: string; reading: string }>();
for (const kanji of allKanji) {
  for (const vocab of kanji.vocab) {
    const reading = vocabKana(vocab);
    const file = clipFile(vocab.w, reading);
    const other = words.get(file);
    if (other && (other.word !== vocab.w || other.reading !== reading)) {
      throw new Error(`Clip name collision: ${other.word}/${other.reading} and ${vocab.w}/${reading}`);
    }
    words.set(file, { word: vocab.w, reading });
  }
}

const pending = [...words].filter(([file, { word }]) => redo.has(word) || !existsSync(join(outDir, file)));
const todo = pending.slice(0, limit);
const characters = todo.reduce((sum, [, { word }]) => sum + word.length, 0);
console.log(`${words.size} words, ${words.size - pending.length} already generated, ${todo.length} to generate now`);
console.log(`About ${characters} characters, ~${Math.ceil(characters * CREDITS_PER_CHARACTER)} credits`);
if (dryRun || !todo.length) process.exit(0);

function apiKey(): string {
  if (process.env["AIVIS_API_KEY"]) return process.env["AIVIS_API_KEY"];
  const envFile = join(root, "backend", ".env");
  const match = existsSync(envFile) && readFileSync(envFile, "utf8").match(/^AIVIS_API_KEY=(.+)$/m);
  if (!match) throw new Error("Set AIVIS_API_KEY in the environment or backend/.env");
  return match[1]!.trim();
}
const key = apiKey();
await mkdir(outDir, { recursive: true });

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
let done = 0, failed = 0, remaining: string | null = null;

async function generate(file: string, word: string, reading: string) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_uuid: VOICE.modelUuid,
        text: clipScript(word, reading),
        use_ssml: true,
        speaking_rate: VOICE.speakingRate,
        output_format: "mp3",
        output_bitrate: VOICE.bitrateKbps,
        output_sampling_rate: VOICE.samplingRateHz,
        leading_silence_seconds: 0,
        trailing_silence_seconds: 0.15,
      }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (response?.ok) {
      const target = join(outDir, file);
      await writeFile(`${target}.part`, Buffer.from(await response.arrayBuffer()));
      await rename(`${target}.part`, target);
      remaining = response.headers.get("x-aivis-credits-remaining") ?? remaining;
      return;
    }
    // Out of credit or a bad key will not fix itself: stop instead of burning retries.
    if (response && [401, 402, 403].includes(response.status)) throw new Error(`Aivis refused the request (HTTP ${response.status}). Check the key and credit balance.`);
    const wait = Number(response?.headers.get("retry-after")) || 2 ** attempt;
    if (attempt < 5) await sleep(wait * 1000);
    else throw new Error(`${word} (${reading}) failed: ${response ? `HTTP ${response.status}` : "network error"}`);
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [file, { word, reading }] = next;
    try { await generate(file, word, reading); done++; }
    catch (error) {
      if (String(error).includes("refused")) { queue.length = 0; throw error; }
      failed++;
      console.error(String(error));
    }
    if ((done + failed) % 50 === 0) console.log(`${done + failed}/${todo.length} (credits left: ${remaining ?? "?"})`);
  }
}));
console.log(`Generated ${done}, failed ${failed}. Credits left: ${remaining ?? "?"}`);
if (failed) process.exitCode = 1;
