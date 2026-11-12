import { expect, test } from "@playwright/test";
import { densityFor, easeDensity } from "../../src/components/game/density";

test("game canvases draw at the screen's density, sharper on low-density screens, inside a pixel budget", () => {
  expect(densityFor(390, 844, 3, false)).toBe(3);
  expect(densityFor(390, 844, 2, false)).toBe(3);
  expect(densityFor(1366, 1024, 2, false)).toBe(2);
  const desktop = densityFor(1440, 900, 1, false);
  expect(desktop).toBeGreaterThan(1.9);
  expect(desktop).toBeLessThanOrEqual(2);
  const wide = densityFor(2560, 1440, 1, false);
  expect(wide).toBeGreaterThanOrEqual(1);
  expect(2560 * 1440 * wide * wide).toBeLessThanOrEqual(5_000_001);
});

test("a browser drawing without a graphics card keeps the plain one-to-one canvas", () => {
  expect(densityFor(390, 844, 3, true)).toBe(1);
  expect(densityFor(1440, 900, 1, true)).toBe(1);
});

test("a device that cannot keep its frame rate eases the density down, never below half the screen's", () => {
  easeDensity(3);
  expect(densityFor(390, 844, 3, false)).toBeCloseTo(2.1);
  easeDensity(2.1);
  easeDensity(1.47);
  expect(densityFor(390, 844, 3, false)).toBe(1.5);
  expect(densityFor(1440, 900, 1, false)).toBeGreaterThanOrEqual(1);
  expect(densityFor(1440, 900, 1, false)).toBeLessThan(1.1);
});
