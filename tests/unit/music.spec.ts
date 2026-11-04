import { test, expect } from "@playwright/test";
import { MUSIC_TRACKS, TRACK_STEPS, musicStep } from "../../src/lib/music";

test("every track is well formed and stays in a playable range", () => {
  expect(MUSIC_TRACKS.length).toBeGreaterThanOrEqual(5);
  expect(new Set(MUSIC_TRACKS.map((t) => t.title)).size).toBe(MUSIC_TRACKS.length);
  for (const track of MUSIC_TRACKS) {
    expect(track.bpm, track.title).toBeGreaterThanOrEqual(125);
    expect(track.chords, track.title).toMatch(/^[1-7]{8}$/);
    expect(track.melody, track.title).toHaveLength(8);
    for (const bar of track.melody) expect(bar, track.title).toMatch(/^[.0-9a-c]{16}$/);
    for (let step = 0; step < TRACK_STEPS; step++) {
      for (const note of musicStep(track, "menu", step)) {
        if (["kick", "snare", "hat"].includes(note.instrument)) continue;
        expect(note.midi, `${track.title} step ${step}`).toBeGreaterThanOrEqual(26);
        expect(note.midi, `${track.title} step ${step}`).toBeLessThanOrEqual(96);
      }
    }
  }
});

test("tracks open with a beat and keep driving through the song", () => {
  for (const track of MUSIC_TRACKS) {
    expect(musicStep(track, "menu", 0).map((n) => n.instrument), track.title).toContain("kick");
    let kicks = 0, leads = 0;
    for (let step = 0; step < TRACK_STEPS; step++) {
      for (const note of musicStep(track, "menu", step)) {
        if (note.instrument === "kick") kicks++;
        if (note.instrument === track.lead) leads++;
      }
    }
    expect(kicks, track.title).toBeGreaterThan(TRACK_STEPS / 8);
    expect(leads, track.title).toBeGreaterThan(100);
  }
});
