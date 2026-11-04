/**
 * Pre-generated word audio, shared by the app and scripts/generate-voice.ts so both
 * agree on where each word's clip lives. Changing the voice or its settings needs a
 * new VOICE.id, which moves every clip to a fresh folder that browsers have not cached.
 */
export const VOICE = {
  id: "morioki-v1",
  /** AivisHub model, licensed ACML 1.0: free and commercial use, credit optional (shown on the collection page). */
  modelUuid: "baaae3c0-7b22-4605-8ba5-80c959b41a48",
  speakingRate: 0.9,
  bitrateKbps: 64,
  samplingRateHz: 24000,
} as const;

export const VOICE_DIRECTORY = `audio/words/${VOICE.id}`;

/** cyrb53: a fast, synchronous 53-bit string hash, so the app needs no lookup table. */
function hash53(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** The clip for a word read a particular way; homophones like 橋 and 箸 get separate clips. */
export function clipFile(word: string, reading: string): string {
  return `${hash53(`${word}\u0000${reading}`)}.mp3`;
}

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The kanji give the voice the word's accent; the alias pins the reading we teach,
 * so a word with several readings is never read the wrong way.
 */
export function clipScript(word: string, reading: string): string {
  return word === reading ? escapeXml(word) : `<sub alias="${escapeXml(reading)}">${escapeXml(word)}</sub>`;
}
