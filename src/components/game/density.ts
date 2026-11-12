import type Phaser from "phaser";

const PIXEL_BUDGET = 5_000_000;
const SLOW_FPS = 20;
const SETTLE_MS = 4000;
const SAMPLE_MS = 1500;

let ceiling = Infinity;
let software: boolean | undefined;

function softwareRendered() {
  if (software !== undefined) return software;
  software = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    software = false;
  }
  return software;
}

export function densityFor(width: number, height: number, ratio = window.devicePixelRatio || 1, slow = softwareRendered()) {
  if (slow) return 1;
  const wanted = Math.max(ratio, Math.min(3, ratio * 2));
  const affordable = Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height));
  const sharp = Math.max(Math.min(ratio, 2), Math.min(wanted, affordable));
  return Math.max(1, ratio / 2, Math.min(sharp, ceiling));
}

export function easeDensity(current: number) {
  ceiling = Math.min(ceiling, current * 0.7);
}

export function watchFrames(game: Phaser.Game, host: HTMLElement, resize: () => void) {
  const started = performance.now();
  let slow = 0;
  const timer = window.setInterval(() => {
    const idle = !game.isBooted || !game.loop.running || document.visibilityState !== "visible" || performance.now() - started < SETTLE_MS;
    slow = !idle && game.loop.actualFps < SLOW_FPS ? slow + 1 : 0;
    if (slow < 2) return;
    slow = 0;
    const before = densityFor(host.clientWidth, host.clientHeight);
    easeDensity(game.scale.width / Math.max(1, host.clientWidth));
    if (densityFor(host.clientWidth, host.clientHeight) < before) resize();
  }, SAMPLE_MS);
  return () => window.clearInterval(timer);
}

export function fitToHost(game: Phaser.Game, host: HTMLElement, onDensity: (density: number) => void) {
  const resize = () => {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!game.isBooted || width <= 0 || height <= 0) return;
    const density = densityFor(width, height);
    onDensity(density);
    game.canvas.dataset["density"] = density.toFixed(2);
    const w = Math.round(width * density),
      h = Math.round(height * density);
    if (game.scale.width !== w || game.scale.height !== h) game.scale.resize(w, h);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  game.events.once("ready", resize);
  const unwatch = watchFrames(game, host, resize);
  return () => {
    unwatch();
    observer.disconnect();
    game.events.off("ready", resize);
  };
}
