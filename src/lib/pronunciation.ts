import { duckMusic, releaseMusicDuck } from "./music";
import { getVoiceEnabled } from "./voice-preference";
import { VOICE_DIRECTORY, clipFile } from "./voice-clips";

export type VoiceStatus = "ready" | "blocked" | "unavailable";
export type Playback = { stop: () => void };

// Played inside a tap so iOS lets this element start later clips on its own.
const SILENT = "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";
const MAX_CLIPS = 200;
// On a slow connection the device voice covers this word, and the clip is kept for next time.
const CLIP_WAIT_MS = 4000;

const clips = new Map<string, Promise<string | null>>();
let player: HTMLAudioElement | null = null;
let owner: object | null = null;
let releaseOwner: (() => void) | null = null;
const live = new Set<() => void>();

function audioElement(): HTMLAudioElement | null {
  if (!player && typeof Audio !== "undefined") player = new Audio();
  return player;
}

/** A blob URL for the word's recorded clip, or null when it has none (a new word) or cannot be fetched. */
function clip(word: string, reading: string): Promise<string | null> {
  const file = clipFile(word, reading);
  const known = clips.get(file);
  if (known) {
    clips.delete(file);
    clips.set(file, known);
    return known;
  }
  let missing = false;
  const pending = fetch(`${import.meta.env.BASE_URL}${VOICE_DIRECTORY}/${file}`)
    .then(async (response) => {
      // A single-page host can answer a missing file with the app's HTML.
      if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) { missing = true; return null; }
      return URL.createObjectURL(await response.blob());
    })
    .catch(() => null);
  clips.set(file, pending);
  // A missing clip stays missing; a network failure is retried on the next play.
  void pending.then((url) => { if (!url && !missing && clips.get(file) === pending) clips.delete(file); });
  while (clips.size > MAX_CLIPS) {
    const [oldest, old] = clips.entries().next().value!;
    clips.delete(oldest);
    void old.then((url) => { if (url) URL.revokeObjectURL(url); });
  }
  return pending;
}

function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** Speaks a silent sound inside a tap so later automatic speech is allowed on mobile browsers. */
export function primeSpeech(): void {
  if (!getVoiceEnabled()) return;
  const audio = audioElement();
  if (audio && !owner) {
    audio.src = SILENT;
    audio.play().catch(() => { /* The next clip retries inside its own tap. */ });
  }
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  try { window.speechSynthesis.speak(silent); }
  catch { /* Speech remains available through the replay buttons. */ }
}

/**
 * Plays the word's recorded clip, falling back to the device's Japanese voice reading
 * the kana when the word has no clip yet, the clip is slow to arrive, or it fails to play.
 */
export function pronounce(word: string, reading: string, onStatus?: (status: VoiceStatus) => void): Playback {
  const token = {};
  let stopped = false;
  let speech: SpeechSynthesisUtterance | null = null;
  const done = () => { releaseMusicDuck(token); live.delete(stop); };
  function stop() {
    if (stopped) return;
    stopped = true;
    if (owner === token) { player?.pause(); owner = null; releaseOwner = null; }
    if (speech) {
      speech.onend = speech.onerror = null;
      speech = null;
      window.speechSynthesis?.cancel();
    }
    done();
  }
  live.add(stop);

  const device = () => {
    if (stopped) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) { done(); onStatus?.("unavailable"); return; }
    const utterance = new SpeechSynthesisUtterance(reading);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    const voice = window.speechSynthesis.getVoices().find((v) => /^ja(?:[-_]|$)/i.test(v.lang));
    if (voice) utterance.voice = voice;
    const finished = () => { done(); if (speech === utterance) speech = null; };
    utterance.onend = finished;
    utterance.onerror = (event) => {
      finished();
      if (event.error !== "interrupted" && event.error !== "canceled") onStatus?.("blocked");
    };
    speech = utterance;
    duckMusic(token);
    onStatus?.("ready");
    try { window.speechSynthesis.speak(utterance); }
    catch { finished(); onStatus?.("blocked"); }
  };

  const audio = audioElement();
  if (!audio) { device(); return { stop }; }
  void within(clip(word, reading), CLIP_WAIT_MS, null).then((url) => {
    if (stopped) return;
    if (!url) { device(); return; }
    releaseOwner?.();
    owner = token;
    releaseOwner = done;
    const fallBack = () => {
      if (owner !== token || stopped) return;
      owner = null;
      releaseOwner = null;
      releaseMusicDuck(token);
      device();
    };
    audio.onended = () => { if (owner === token) { owner = null; releaseOwner = null; } done(); };
    audio.onerror = fallBack;
    audio.src = url;
    duckMusic(token);
    onStatus?.("ready");
    audio.play().catch(fallBack);
  });
  return { stop };
}

/** Silences whatever is being pronounced, from any screen. */
export function stopPronunciation(): void {
  [...live].forEach((stop) => stop());
  window.speechSynthesis?.cancel();
}
