import { useEffect, useRef, useSyncExternalStore } from "react";
import { getGameAudio, getSoundEnabled, subscribeSound, unlock } from "./sfx";

export type MusicScene = "menu" | "forest" | "shrine" | "puzzle" | "run";
type Instrument = "lead" | "bell" | "pluck" | "bass" | "kick" | "snare" | "hat";
export type MusicNote = { midi: number; instrument: Instrument; gain: number };

/*
 * Melody bars are 16 sixteenth-notes: "." is a rest, "0"-"9" and "a"-"c" index the
 * track's scale upward from `key` (7 = one octave up). Chords are one scale degree
 * (1-7) per bar; their triads are built from the same scale.
 */
export type MusicTrack = {
  title: string;
  bpm: number;
  key: number;
  minor: boolean;
  chords: string;
  melody: readonly string[];
  lead: "lead" | "bell";
  bass: "octave" | "drive" | "offbeat";
  drums: "four" | "rock";
  comp: "arp" | "stab";
};

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    title: "Lantern Sprint", bpm: 150, key: 69, minor: true, chords: "16371645", lead: "lead", bass: "octave", drums: "four", comp: "arp",
    melody: ["7.4.7.9.b..9.7.4", "5.7.9.7.c..9.7..", "9.b.9.6.4..6.9..", "8.a.8.6.a...8...", "7.7.4.7.9.7.b...", "c.b.9.7.9...5...", "a.7.5.7.a.c.a...", "b.8.6.4.b...b.b."],
  },
  {
    title: "Shrine Stairs Rush", bpm: 140, key: 62, minor: false, chords: "15641545", lead: "bell", bass: "drive", drums: "rock", comp: "stab",
    melody: ["7...9.b.9.7.4...", "6...8.b.8.6.4...", "5...7.9.c.9.7...", "a...9.7.5.7.a...", "7.9.b.9.7.9.b.c.", "b...8...6.8.b...", "a.9.7.5.7.9.a...", "8...6...4...b..."],
  },
  {
    title: "Comet Courier", bpm: 160, key: 64, minor: true, chords: "16714677", lead: "lead", bass: "offbeat", drums: "four", comp: "arp",
    melody: ["b.b.9.b.7...4.7.", "9.9.c.9.b...9...", "a.a.8.a.6...8.a.", "b.9.7.4.7.......", "a.c.a.7.a.c.a.7.", "9.b.9.5.9.b.c...", "a.8.6.8.a.c.a.8.", "a...8...6...8.a."],
  },
  {
    title: "Torii Turbo", bpm: 132, key: 67, minor: false, chords: "14654515", lead: "bell", bass: "octave", drums: "rock", comp: "stab",
    melody: ["7.9.b.9.7...4...", "a.c.a.7.5...7...", "9.7.5.7.9...c...", "b.a.8.6.4.......", "7.7.a.a.c.c.a...", "b.b.8.8.6.8.b...", "9.b.c.b.9.7.4.7.", "8...6...8...b..."],
  },
  {
    title: "Firefly Overdrive", bpm: 145, key: 60, minor: true, chords: "14736451", lead: "lead", bass: "drive", drums: "four", comp: "arp",
    melody: ["7.4.7.9.7.4.2.4.", "a.7.a.c.a.7.5.7.", "8.6.8.a.8.6.3.6.", "9.6.9.b.9...b...", "c.b.9.7.9.c.9.7.", "a.c.a.7.5.7.a...", "b.8.6.4.8.6.b...", "7...4...7.9.b..."],
  },
  {
    title: "Paper Kite Dash", bpm: 128, key: 65, minor: false, chords: "16454511", lead: "bell", bass: "octave", drums: "rock", comp: "arp",
    melody: ["4.7.9.b.9.7.4.7.", "5.7.9.c.9.7.5.7.", "a.9.7.5.3.5.7.a.", "b.a.8.6.4...b...", "c.a.7.a.c...a...", "b.8.6.8.b...8...", "9.b.9.7.4.7.9.b.", "7...4...7...0..."],
  },
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const INTRO_BARS = 4, PASSES = 4;
export const TRACK_STEPS = (INTRO_BARS + 8 * PASSES) * 16;
export const MUSIC_PREF_KEY = "kanji-dash-music";

function pitch(track: MusicTrack, index: number): number {
  const scale = track.minor ? MINOR : MAJOR;
  return track.key + Math.floor(index / 7) * 12 + scale[((index % 7) + 7) % 7]!;
}

// A track is an intro groove, then the 8-bar melody four times; the third pass opens with
// a four-bar breakdown (no kick or bass) that builds back in with a snare roll.
export function musicStep(track: MusicTrack, scene: MusicScene, step: number): MusicNote[] {
  const s = ((step % TRACK_STEPS) + TRACK_STEPS) % TRACK_STEPS;
  const bar = Math.floor(s / 16), beat = s % 16;
  const intro = bar < INTRO_BARS, songBar = bar - INTRO_BARS;
  const phraseBar = intro ? bar : songBar % 8, pass = intro ? -1 : Math.floor(songBar / 8);
  const breakdown = pass === 2 && phraseBar < 4;
  const fill = (phraseBar === 7 || (breakdown && phraseBar === 3)) && beat >= 12;
  const dense = scene === "run" || pass === 1 || pass === 3;
  const degree = Number(track.chords[phraseBar % 8]) - 1;
  const notes: MusicNote[] = [];

  if (!breakdown) {
    const kick = track.drums === "four" ? beat % 4 === 0 : beat === 0 || beat === 8 || beat === 10 || (beat === 7 && phraseBar % 2 === 1);
    if (kick) notes.push({ midi: 0, instrument: "kick", gain: .5 });
  }
  if (fill ? beat % (breakdown ? 1 : 2) === 0 || beat === 15 : beat === 4 || beat === 12) {
    notes.push({ midi: 0, instrument: "snare", gain: fill ? .16 + (beat - 12) * .04 : .28 });
  }
  const hat = track.drums === "four" ? (dense ? beat % 2 === 0 || beat % 4 === 2 : beat % 4 === 2) : dense || beat % 2 === 0;
  if (hat && !fill) notes.push({ midi: 0, instrument: "hat", gain: beat % 4 === 2 ? .13 : .07 });

  if (!breakdown) {
    const root = pitch(track, degree) - 24;
    if (track.bass === "octave" && beat % 2 === 0) notes.push({ midi: root + (beat % 4 === 2 ? 12 : 0), instrument: "bass", gain: .3 });
    else if (track.bass === "drive" && beat % 2 === 0) notes.push({ midi: root, instrument: "bass", gain: beat % 4 === 0 ? .32 : .22 });
    else if (track.bass === "offbeat" && (beat % 4 === 2 || beat === 15)) notes.push({ midi: root, instrument: "bass", gain: .32 });
  }

  const triad = [0, 2, 4].map((n) => pitch(track, degree + n) - 12);
  if (track.comp === "arp") notes.push({ midi: [...triad, triad[0]! + 12][beat % 4]!, instrument: "pluck", gain: beat % 4 === 0 ? .075 : .05 });
  else if (beat % 4 === 2) for (const midi of triad) notes.push({ midi, instrument: "pluck", gain: .045 });

  const symbol = intro ? "." : track.melody[phraseBar]![beat]!;
  if (symbol !== ".") {
    const index = parseInt(symbol, 16);
    notes.push({ midi: pitch(track, index), instrument: breakdown ? "bell" : track.lead, gain: track.lead === "bell" || breakdown ? .19 : .13 });
  }
  return notes;
}

let enabled = true, loaded = false;
const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { enabled = localStorage.getItem(MUSIC_PREF_KEY) !== "off"; } catch {}
  window.addEventListener("storage", (e) => {
    if (e.key !== MUSIC_PREF_KEY && e.key !== null) return;
    try { enabled = localStorage.getItem(MUSIC_PREF_KEY) !== "off"; } catch { enabled = true; }
    sync(); notify();
  });
}
function subscribe(listener: () => void) { load(); listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getMusicEnabled() { load(); return enabled; }
export function setMusicEnabled(on: boolean) {
  load(); enabled = on;
  try { localStorage.setItem(MUSIC_PREF_KEY, on ? "on" : "off"); } catch {}
  if (on) unlock();
  sync(); notify();
}
export function useMusicEnabled() {
  return useSyncExternalStore(subscribe, getMusicEnabled, () => true);
}

function pickTrack(previous?: MusicTrack): MusicTrack {
  const choices = MUSIC_TRACKS.filter((t) => t !== previous);
  return choices[Math.floor(Math.random() * choices.length)] ?? MUSIC_TRACKS[0]!;
}
let track: MusicTrack | null = null;
function currentTrack() { return track ??= pickTrack(); }
export function useNowPlaying() {
  return useSyncExternalStore(subscribe, () => currentTrack().title, () => "");
}

// The site soundtrack sits underneath; a mounted game takes over scene and pause until it unmounts.
type Session = { owner: object; scene: MusicScene; paused: boolean };
let site: Session | null = null;
const games: Session[] = [];
let timer: ReturnType<typeof setInterval> | undefined, offSound: (() => void) | undefined;
let audioContext: AudioContext | null = null, bus: GainNode | null = null;
let nextBeat = 0, step = 0;
const playing = new Map<AudioBufferSourceNode, GainNode>();
const samples = new Map<string, AudioBuffer>();
const ducks = new Set<object>();
let audible = false;

function active() { return games[games.length - 1] ?? site; }

export function duckMusic(token: object) { ducks.add(token); updateGain(); }
export function releaseMusicDuck(token: object) { ducks.delete(token); updateGain(); }
function updateGain() {
  if (!bus || !audioContext) return;
  try {
    bus.gain.cancelScheduledValues(audioContext.currentTime);
    bus.gain.setTargetAtTime(ducks.size ? .045 : .3, audioContext.currentTime, ducks.size ? .035 : .25);
  } catch {}
}

function stopNotes() {
  for (const [source, gain] of playing) {
    source.onended = null;
    try { source.stop(); } catch {}
    source.disconnect(); gain.disconnect();
  }
  playing.clear(); audible = false; nextBeat = 0;
}

const DURATION: Record<Instrument, number> = { lead: .45, bell: .9, pluck: .28, bass: .32, kick: .32, snare: .22, hat: .06 };
function sample(context: AudioContext, midi: number, instrument: Instrument): AudioBuffer {
  const key = `${instrument}-${midi}`;
  const existing = samples.get(key); if (existing) return existing;
  const duration = DURATION[instrument];
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0), rate = context.sampleRate, frequency = 440 * 2 ** ((midi - 69) / 12);
  let seed = 0x9e3779b9, previous = 0, phase = 0;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };
  for (let i = 0; i < data.length; i++) {
    const t = i / rate, p = 2 * Math.PI * frequency * t;
    const edge = Math.min(1, t / .004, (duration - t) / .02);
    let v = 0;
    switch (instrument) {
      case "lead": for (let n = 1; n <= 7; n++) v += Math.sin(p * n) / n; v *= .32 * Math.exp(-t * 4.5); break;
      case "bell": v = (Math.sin(p) + .28 * Math.sin(p * 2) + .07 * Math.sin(p * 3)) * .5 * Math.exp(-t * 4.8); break;
      case "pluck": for (let n = 1; n <= 7; n += 2) v += Math.sin(p * n) / n; v *= .45 * Math.exp(-t * 13); break;
      case "bass": v = (Math.sin(p) + .45 * Math.sin(p * 2) + .2 * Math.sin(p * 3)) * .55 * Math.exp(-t * 5.5); break;
      case "kick": phase += 2 * Math.PI * (46 + 115 * Math.exp(-t * 32)) / rate; v = Math.sin(phase) * Math.exp(-t * 9); break;
      case "snare": v = noise() * .6 * Math.exp(-t * 20) + Math.sin(2 * Math.PI * 185 * t) * .35 * Math.exp(-t * 32); break;
      case "hat": { const n = noise(); v = (n - previous) * .45 * Math.exp(-t * 70); previous = n; break; }
    }
    data[i] = v * edge;
  }
  samples.set(key, buffer); return buffer;
}

function sync() {
  try {
    const session = active(), audio = getGameAudio();
    if (!session || session.paused || !getMusicEnabled() || !getSoundEnabled() || document.hidden || !audio) { stopNotes(); return; }
    if (audioContext !== audio.context || !bus) {
      stopNotes(); try { bus?.disconnect(); } catch {}
      audioContext = audio.context; samples.clear(); bus = audioContext.createGain();
      bus.gain.value = ducks.size ? .045 : .3;
      bus.connect(audio.output); updateGain();
    }
    const now = audio.context.currentTime;
    if (!nextBeat || nextBeat < now - .5) nextBeat = now + .06;
    while (nextBeat < now + .18) {
      const playingTrack = currentTrack();
      for (const note of musicStep(playingTrack, session.scene, step)) {
        if (playing.size >= 32) break;
        const source = audio.context.createBufferSource(), gain = audio.context.createGain();
        source.buffer = sample(audio.context, note.midi, note.instrument);
        gain.gain.value = note.gain;
        source.connect(gain); gain.connect(bus!); playing.set(source, gain);
        source.onended = () => { playing.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(nextBeat); audible = true;
      }
      nextBeat += 60 / playingTrack.bpm / 4;
      if (++step >= TRACK_STEPS) { step = 0; track = pickTrack(playingTrack); notify(); }
    }
  } catch { stopNotes(); }
}

function start() {
  if (timer !== undefined) return;
  offSound = subscribeSound(sync);
  document.addEventListener("visibilitychange", sync);
  timer = setInterval(sync, 100);
}
function stopIfIdle() {
  if (site || games.length) { sync(); return; }
  clearInterval(timer); timer = undefined; offSound?.(); offSound = undefined;
  document.removeEventListener("visibilitychange", sync);
  stopNotes(); try { bus?.disconnect(); } catch {} bus = null;
}

export function musicStatus() {
  const session = active();
  return { audible, voices: playing.size, track: track?.title ?? null, scene: session?.scene ?? null, paused: session?.paused ?? false, ducked: ducks.size > 0 };
}

// Mounted once at the root: the soundtrack starts on landing. Browsers that hold audio
// until a user gesture get it on the first tap, click or key press anywhere (see sfx boot()).
export function useSiteMusic() {
  useEffect(() => {
    site = { owner: {}, scene: "menu", paused: false };
    start();
    if (getMusicEnabled()) unlock();
    sync();
    return () => { site = null; stopIfIdle(); };
  }, []);
}

export function useGameMusic(scene: MusicScene, paused = false) {
  const owner = useRef({}).current;
  useEffect(() => {
    games.push({ owner, scene, paused });
    start(); sync();
    return () => {
      const index = games.findIndex((s) => s.owner === owner);
      if (index >= 0) games.splice(index, 1);
      stopIfIdle();
    };
  }, [owner]);
  useEffect(() => {
    const session = games.find((s) => s.owner === owner);
    if (session) { session.scene = scene; session.paused = paused; sync(); }
  }, [owner, scene, paused]);
}
