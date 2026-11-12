import type Phaser from "phaser";
import { KODAMA, type AreaDefinition, type Grade } from "./areas";
import { onTrail, riverX, seeded, WORLD } from "./world";

const CHARACTERS = ["forest-player", "forest-fox"];
const FLAT = ["forest-glow", "forest-rain"];
const INK = "#22362f";

export const ART_DETAIL = 4;
export const TRAVELLER_ROBE: readonly string[] = ["#e2ad5d", "#f1cd7b", "#bc633f", "#e38b51", "#806442", "#d5b56e", "#f1d18b", "#98844f"];

type Ctx = CanvasRenderingContext2D;
type Tone = (color: string) => string;

function fit(frame: Phaser.Textures.Frame, x: number, y: number, w: number, h: number, detail: number) {
  frame.setSize(w, h, x * detail, y * detail);
  frame.setCutSize(w * detail, h * detail);
}

export function addArt(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, detail: number) {
  const texture = scene.textures.addCanvas(key, canvas)!;
  texture.source[0]!.resolution = detail;
  fit(texture.get(), 0, 0, canvas.width / detail, canvas.height / detail, detail);
  return texture;
}

export function addSheet(texture: Phaser.Textures.Texture, columns: number, rows: number, w: number, h: number) {
  const detail = texture.source[0]!.resolution;
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++)
      fit(texture.add(row * columns + column, 0, column * w * detail, row * h * detail, w * detail, h * detail)!, column * w, row * h, w, h, detail);
}

export function artCanvas(w: number, h: number, detail: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * detail);
  canvas.height = Math.round(h * detail);
  const c = canvas.getContext("2d")!;
  c.scale(detail, detail);
  c.lineJoin = "round";
  c.lineCap = "round";
  return { canvas, c };
}

export function round(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
}

function shape(c: Ctx, fill: string, path: () => void, ink = 0.9, line = INK) {
  c.beginPath();
  path();
  c.fillStyle = fill;
  c.fill();
  if (!ink) return;
  c.lineWidth = ink;
  c.strokeStyle = line;
  c.stroke();
}

function stroke(c: Ctx, color: string, x: number, y: number, length: number, tilt: number, width: number) {
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + length * 0.5, y - length * 0.35 + tilt, x + length, y + tilt);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

function dot(c: Ctx, fill: string, x: number, y: number, rx: number, ry = rx) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

export function drawTraveller(c: Ctx, dir: number, frame: number, robe: readonly string[] = TRAVELLER_ROBE) {
  const [coat, coatLight, scarf, scarfTail, hatShade, hat, hatLight, hatBand] = robe as [string, string, string, string, string, string, string, string];
  const bob = frame % 2,
    swing = frame === 1 ? 1 : frame === 3 ? -1 : 0,
    side = dir === 2 ? -1 : dir === 3 ? 1 : 0;
  const legs: [number, boolean, string][] = [[10.2, swing > 0, "#947446"], [17.4, swing < 0, "#b0925b"]];
  for (const [x, lifted, cloth] of legs) {
    const lift = lifted ? 2 : 0;
    shape(c, cloth, () => round(c, x, 27.5, 4.6, 7.5 - lift, 2));
    shape(c, "#2a403a", () => round(c, x - 0.9, 34 - lift, 6.4, 3.8, 1.9));
  }
  const arms: [number, number][] = [[4.8, -swing], [22.8, swing]];
  for (const [x, dy] of arms) {
    shape(c, "#b7774f", () => round(c, x, 21.2 - bob + dy, 4.4, 8.6, 2.2));
    shape(c, "#f0c791", () => c.arc(x + 2.2, 29.6 - bob + dy, 1.9, 0, Math.PI * 2), 0.7);
  }
  shape(c, coat, () => round(c, 8.6, 18.6 - bob, 14.8, 14.2, 4.6));
  c.save();
  c.beginPath();
  round(c, 8.6, 18.6 - bob, 14.8, 14.2, 4.6);
  c.clip();
  dot(c, coatLight, 11.6, 25 - bob, 2.3, 6.4);
  c.fillStyle = "#3a2a1a26";
  c.fillRect(8, 30.4 - bob, 16, 3);
  c.restore();
  if (dir === 1) {
    shape(c, "#566d56", () => round(c, 10.6, 21.4 - bob, 10.8, 10.4, 3));
    shape(c, "#91a075", () => round(c, 12.6, 23.4 - bob, 6.8, 5.6, 2), 0);
  }
  shape(c, scarfTail, () => round(c, dir === 2 ? 21.2 : 7.4, 20.8 - bob, 3.4, 7.2, 1.7));
  shape(c, scarf, () => round(c, 8.4, 19.4 - bob, 15.2, 3.6, 1.8));
  const hy = 14.6 - bob;
  shape(c, dir === 1 ? "#573f32" : "#523e32", () => c.ellipse(16, hy, 7.6, 7, 0, 0, Math.PI * 2));
  if (dir !== 1) {
    dot(c, "#f0c791", 16 + side * 1.2, hy + 1.3, 6, 5.3);
    const eyes = dir === 0 ? [13.5, 18.5] : dir === 2 ? [12.6] : [19.4];
    for (const x of eyes) dot(c, "#33372e", x, hy + 3, 0.95, 1.3);
    const cheeks = dir === 0 ? [11.9, 20.1] : dir === 2 ? [14.6] : [17.4];
    for (const x of cheeks) dot(c, "#e58f7470", x, hy + 4.7, 1.3, 0.8);
  }
  const by = 12 - bob;
  shape(c, hatShade, () => c.ellipse(16, by + 0.5, 13.6, 2.9, 0, 0, Math.PI * 2));
  shape(c, hat, () => {
    c.moveTo(2.8, by);
    c.quadraticCurveTo(10.5, by - 3.4, 13.2, by - 8);
    c.quadraticCurveTo(16, by - 10.2, 18.8, by - 8);
    c.quadraticCurveTo(21.5, by - 3.4, 29.2, by);
    c.quadraticCurveTo(16, by + 2.8, 2.8, by);
    c.closePath();
  });
  shape(c, hatLight, () => {
    c.moveTo(11.4, by - 3.8);
    c.quadraticCurveTo(13.5, by - 5.8, 14.1, by - 7.7);
    c.quadraticCurveTo(16, by - 9.2, 17.9, by - 7.7);
    c.quadraticCurveTo(18.5, by - 5.8, 20.6, by - 3.8);
    c.quadraticCurveTo(16, by - 2.6, 11.4, by - 3.8);
    c.closePath();
  }, 0);
  c.beginPath();
  c.moveTo(5, by + 0.5);
  c.quadraticCurveTo(16, by + 2.5, 27, by + 0.5);
  c.strokeStyle = hatBand;
  c.lineWidth = 1.1;
  c.stroke();
}

export function drawFox(c: Ctx, frame: number) {
  const step = frame % 2;
  shape(c, "#b96f45", () => {
    c.moveTo(19, 22);
    c.bezierCurveTo(22, 16, 23, 9.5, 28, 8.5);
    c.bezierCurveTo(31.5, 9, 31, 16, 27, 21);
    c.bezierCurveTo(25, 23.5, 21.5, 24.5, 19, 22);
    c.closePath();
  });
  shape(c, "#f3e2bb", () => {
    c.moveTo(26, 9.4);
    c.quadraticCurveTo(28.4, 7.9, 30, 9.7);
    c.quadraticCurveTo(30.8, 12, 29.3, 14.2);
    c.quadraticCurveTo(27.4, 12.4, 26, 9.4);
    c.closePath();
  }, 0);
  const feet: [number, boolean][] = [[8.6, step === 1], [19, step === 0]];
  for (const [x, up] of feet) shape(c, "#5b4935", () => round(c, x, 25.4 - (up ? 1 : 0), 4.4, 3.2, 1.6));
  shape(c, "#c9824d", () => c.ellipse(15.6, 21.6, 8.6, 5.6, 0, 0, Math.PI * 2));
  const ears: [number, number, number, number, number, number][] = [[4.4, 15.4, 4.8, 5.2, 11.6, 10.8], [23.6, 15.4, 22.8, 4.6, 16.4, 10.4]];
  for (const [ax, ay, bx, by, cx, cy] of ears) {
    shape(c, "#d59253", () => { c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx, cy); c.closePath(); });
    shape(c, "#f3dfb2", () => {
      c.moveTo(ax + (cx - ax) * 0.28, ay - 3.2);
      c.lineTo(bx + (cx - bx) * 0.12, by + 3);
      c.lineTo(cx - (cx - ax) * 0.3, cy + 0.6);
      c.closePath();
    }, 0);
  }
  shape(c, "#d59253", () => c.ellipse(14, 16.8, 9.4, 7.4, 0, 0, Math.PI * 2));
  dot(c, "#e9b672", 11.2, 13.4, 4.2, 2.6);
  dot(c, "#f3dfb2", 14, 20.3, 6, 3.3);
  for (const x of [9.6, 18.4]) dot(c, "#242f28", x, 16.2, 0.95, 1.35);
  dot(c, "#303a2a", 14, 19.5, 1.15, 0.8);
  shape(c, "#669779", () => round(c, 7, 23.3, 14.2, 3, 1.5));
}

const UNGRADED = [...CHARACTERS, "forest-glow", "forest-spark", "forest-rain"];

function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function rgb(h: number, s: number, l: number): [number, number, number] {
  if (!s) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const channel = (t: number) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

const graders = new Map<string, Tone>();
function toner(grade: Grade, foliageOnly: boolean): Tone {
  if (grade.hue === 0 && grade.sat === 1 && grade.light === 1) return (color) => color;
  const id = `${grade.hue}/${grade.sat}/${grade.light}/${foliageOnly}`;
  const cached = graders.get(id);
  if (cached) return cached;
  const seen = new Map<string, string>();
  const shift = (color: string) => {
    const known = seen.get(color);
    if (known) return known;
    const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color);
    if (!m) return color;
    const n = parseInt(m[1]!, 16);
    const [h, s, l] = hsl((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    const turn = foliageOnly && !isFoliage(h) ? 0 : grade.hue / 360;
    const out = rgb((h + turn + 1) % 1, Math.min(1, s * grade.sat), Math.min(1, l * grade.light))
      .map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
    const shifted = `#${out}${m[2] ?? ""}`;
    seen.set(color, shifted);
    return shifted;
  };
  graders.set(id, shift);
  return shift;
}

export function grader(grade: Grade): Tone {
  return toner(grade, false);
}

export function foliageTone(grade: Grade): Tone {
  return toner(grade, true);
}

const isFoliage = (h: number) => h > 70 / 360 && h < 200 / 360;

const TREE_DETAIL = 3;

function drawTree(c: Ctx, v: number, tone: Tone) {
  const blob = (c: Ctx, color: string, circles: number[][], dx: number, dy: number, grow: number, ink = 0) => {
    const trace = () => {
      c.beginPath();
      for (const [x, y, r] of circles) {
        const radius = Math.max(1, r! * grow);
        c.moveTo(x! + dx + radius, y! + dy);
        c.arc(x! + dx, y! + dy, radius, 0, Math.PI * 2);
      }
    };
    if (ink) {
      trace();
      c.lineWidth = ink * 2;
      c.strokeStyle = tone(INK);
      c.stroke();
    }
    trace();
    c.fillStyle = tone(color);
    c.fill();
  };
  const dab = (c: Ctx, color: string, x: number, y: number, length: number, tilt: number, width: number) => stroke(c, tone(color), x, y, length, tilt, width);
  const trunk = (c: Ctx) => {
    c.fillStyle = tone("#112c2a66");
    c.beginPath();
    c.ellipse(50, 114, 40, 9, -0.15, 0, 7);
    c.fill();
    c.beginPath();
    c.moveTo(43, 111.5);
    c.quadraticCurveTo(46.4, 96, 45.6, 64);
    c.lineTo(55.6, 64);
    c.quadraticCurveTo(55, 96, 59, 111.5);
    c.quadraticCurveTo(63.5, 114.5, 67.5, 116);
    c.quadraticCurveTo(58.5, 118, 52, 114.6);
    c.quadraticCurveTo(45, 118.6, 32.5, 115.6);
    c.quadraticCurveTo(39.5, 114.6, 43, 111.5);
    c.closePath();
    c.fillStyle = tone("#655c3e");
    c.fill();
    c.lineWidth = 1.3;
    c.strokeStyle = tone("#263c31");
    c.stroke();
    dab(c, "#847249", 48.6, 70, 0.4, 36, 2.4);
    dab(c, "#443f2d", 54, 72, 0.6, 34, 1.8);
  };
  const broadleaf = () => {
    const random = seeded(100 + v),
      colors = [
        ["#15382f", "#1b4838", "#286042", "#3b774b", "#58884e"],
        ["#173e35", "#20543d", "#326946", "#477d4f", "#699350"],
        ["#153b36", "#1b4b3e", "#2b6045", "#3d7450", "#59834e"],
      ][v]!;
    trunk(c);
    const circles: number[][] = [[50, 49, 30]];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + random() * 0.5,
        reach = 21 + random() * 6;
      circles.push([50 + Math.cos(a) * reach * 1.08, 49 + Math.sin(a) * reach * 0.98, 15 + random() * 6]);
    }
    blob(c, colors[0]!, circles, 0, 0, 1, 1.3);
    blob(c, colors[1]!, circles, -1.6, -2.6, 0.84);
    blob(c, colors[2]!, circles.filter(([x, y]) => x! < 66 && y! < 66), -4.4, -6.4, 0.6);
    blob(c, colors[3]!, circles.filter(([x, y]) => x! < 56 && y! < 54), -6.6, -9.4, 0.34);
    for (let i = 0; i < 46; i++) {
      const x = 16 + random() * 66,
        y = 14 + random() * 64;
      if (((x - 49) / 36) ** 2 + ((y - 48) / 36) ** 2 >= 1) continue;
      dab(c, colors[Math.floor(random() * 4) + 1]!, x, y, 3.5 + random() * 5, (random() - 0.5) * 2, 1.5 + random() * 1.1);
    }
    dab(c, "#9fa776", 33, 26, 6, -0.6, 1.8);
    dab(c, "#819458", 29.5, 30.5, 4.2, -0.4, 1.6);
  };
  const conifer = () => {
    const random = seeded(103),
      colors = ["#123630", "#18463a", "#225843", "#33704d", "#4f8456"];
    c.fillStyle = tone("#112c2a66");
    c.beginPath();
    c.ellipse(50, 114, 30, 7, -0.15, 0, 7);
    c.fill();
    c.beginPath();
    c.moveTo(46.2, 88);
    c.lineTo(53.8, 88);
    c.quadraticCurveTo(54, 106, 56.5, 113.5);
    c.quadraticCurveTo(50, 116, 43.5, 113.5);
    c.quadraticCurveTo(46, 106, 46.2, 88);
    c.closePath();
    c.fillStyle = tone("#5d4c34");
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = tone("#2b241c");
    c.stroke();
    const tier = (color: string, top: number, bottom: number, left: number, right: number, ink = 0) => {
      const drop = bottom - top,
        scallops = 4,
        span = (right - left) / scallops;
      c.beginPath();
      c.moveTo(50, top);
      c.quadraticCurveTo(50 + (right - 50) * 0.42, top + drop * 0.62, right, bottom);
      for (let k = 0; k < scallops; k++) c.quadraticCurveTo(right - span * (k + 0.5), bottom + 4.4, right - span * (k + 1), bottom - (k === scallops - 1 ? 0 : 1.2));
      c.quadraticCurveTo(50 + (left - 50) * 0.42, top + drop * 0.62, 50, top);
      c.closePath();
      c.fillStyle = tone(color);
      c.fill();
      if (!ink) return;
      c.lineWidth = ink;
      c.strokeStyle = tone(INK);
      c.stroke();
    };
    for (let k = 4; k >= 0; k--) {
      const top = 4 + k * 18,
        bottom = top + 33,
        half = 13 + k * 8;
      tier(colors[0]!, top, bottom, 50 - half - 2, 50 + half + 2, 1.2);
      tier(colors[1]!, top + 2.4, bottom - 1.6, 50 - half, 50 + half * 0.82);
      tier(colors[2]!, top + 5, bottom - 4.6, 50 - half + 2.6, 50 + half * 0.3);
      tier(colors[3]!, top + 8.6, bottom - 8.4, 50 - half + 6.4, 50 - half * 0.16);
    }
    for (let i = 0; i < 34; i++) {
      const y = 12 + random() * 92,
        spread = (y / 110) * 42;
      dab(c, colors[Math.floor(random() * 3) + 2]!, 50 - spread + random() * spread * 1.5, y, 2.6 + random() * 3.4, 0.5, 1.2);
    }
  };
  if (v < 3) broadleaf();
  else conifer();
}

export function addTree(scene: Phaser.Scene, key: string, variant: number, tone: Tone) {
  if (scene.textures.exists(key)) return;
  const { canvas, c } = artCanvas(100, 126, TREE_DETAIL);
  drawTree(c, variant, tone);
  addArt(scene, key, canvas, TREE_DETAIL);
}

export function makeForestArt(scene: Phaser.Scene, essentialsOnly = false, area: AreaDefinition = KODAMA, without: readonly string[] = []) {
  const grade = grader(area.grade);
  let tone = grade;
  function texture(
    key: string,
    w: number,
    h: number,
    draw: (c: CanvasRenderingContext2D) => void,
  ) {
    if (essentialsOnly && !["forest-player", "forest-fox", "forest-glow"].includes(key) && !key.startsWith("forest-tree-")) return;
    if (without.some((skipped) => key.startsWith(skipped))) return;
    const detail = FLAT.includes(key) ? 1 : key === "forest-ground" ? 2 : key.startsWith("forest-tree-") ? TREE_DETAIL : ART_DETAIL;
    const { canvas, c } = artCanvas(w, h, detail);
    tone = UNGRADED.includes(key) ? (color: string) => color : grade;
    draw(c);
    addArt(scene, key, canvas, detail);
  }
  const dab = (c: Ctx, color: string, x: number, y: number, length: number, tilt: number, width: number) => stroke(c, tone(color), x, y, length, tilt, width);
  const rect = (
    c: CanvasRenderingContext2D,
    color: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    c.fillStyle = tone(color);
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const poly = (
    c: CanvasRenderingContext2D,
    color: string,
    points: number[][],
  ) => {
    c.fillStyle = tone(color);
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x!, y!) : c.moveTo(x!, y!)));
    c.closePath();
    c.fill();
  };
  const stone = area.ground.trail === "stone";
  texture("forest-ground", WORLD.width / 2, WORLD.height / 2, (c) => {
    const random = seeded(16);
    rect(c, "#27483d", 0, 0, 768, 480);
    const wash = document.createElement("canvas");
    wash.width = 192;
    wash.height = 120;
    const paint = wash.getContext("2d")!;
    for (let y = 0; y < 480; y += 4)
      for (let x = 0; x < 768; x += 4) {
        const p = { x: x * 2, y: y * 2 },
          trail = onTrail(p, 58, area),
          edge = !trail && onTrail(p, 70, area);
        const colors = trail
          ? stone
            ? ["#7a7f76", "#83877d", "#8b8e83", "#74796f"]
            : ["#7c8157", "#84885a", "#8d8e61", "#929363"]
          : edge
            ? ["#516647", "#5a704c", "#687c50"]
            : ["#31543f", "#345943", "#385b43", "#3a5e45", "#3e6247"];
        paint.fillStyle = tone(colors[Math.floor(random() * colors.length)]!);
        paint.fillRect(x / 4, y / 4, 1, 1);
      }
    c.imageSmoothingQuality = "high";
    c.drawImage(wash, 0, 0, 768, 480);
    if (stone)
      for (let y = 0; y < 480; y += 4)
        for (let x = 0; x < 768; x += 4) {
          if (!onTrail({ x: x * 2, y: y * 2 }, 58, area)) continue;
          if (y % 12 === 0) rect(c, "#555a5299", x, y, 4, 1);
          if ((x + (Math.floor(y / 12) % 2) * 8) % 16 === 0) rect(c, "#555a5299", x, y, 1, 4);
        }
    for (let i = 0; i < 10500; i++) {
      const x = Math.floor(random() * 768),
        y = Math.floor(random() * 480),
        trail = onTrail({ x: x * 2, y: y * 2 }, 53, area);
      const shade = random();
      rect(
        c,
        trail
          ? shade > 0.5
            ? stone ? "#9a9d92" : "#a2a271"
            : stone ? "#62675f" : "#707a52"
          : shade > 0.75
            ? "#68834d"
            : shade > 0.4
              ? "#466c49"
              : "#294d3d",
        x,
        y,
        1 + Math.floor(random() * 3),
        1,
      );
      if (!trail && shade > 0.93) rect(c, "#729455", x + 1, y - 2, 1, 3);
      if (!trail && shade > 0.993) {
        rect(c, "#d9c68a", x, y - 2, 2, 2);
        rect(c, "#537c50", x, y, 1, 3);
      }
    }
    const bands: [string, number][] = [["#203e37", 88], ["#668476", 76], ["#326d70", 68], ["#347c7f", 54], ["#3b8586", 33]];
    c.lineCap = "butt";
    for (const [color, width] of bands) {
      c.beginPath();
      for (let y = -4; y <= 484; y += 2) c.lineTo(riverX(y * 2, area) / 2, y);
      c.strokeStyle = tone(color);
      c.lineWidth = width;
      c.stroke();
    }
    c.lineCap = "round";
    for (let y = 0; y < 480; y += 14) {
      const x = riverX(y * 2, area) / 2;
      dab(c, "#77aaa0", x - 24 + random() * 26, y, 12 + Math.floor(random() * 16), 0, 1.3);
      dab(c, "#4c9290", x - 13 + random() * 20, y + 3, 12, 0, 1.2);
    }
    const sx = area.shrine.x / 2,
      sy = area.shrine.y / 2,
      [bloom, blossom] = area.ground.flowers;
    for (let y = Math.round(sy - 10.5); y < Math.round(sy + 30.5); y += 10)
      for (let x = sx - 49; x < sx + 44; x += 15) {
        rect(c, "#647770", x, y, 14, 9);
        rect(c, "#84938a", x + 1, y, 12, 2);
        if (random() > 0.65) rect(c, "#4d7350", x, y + 6, 4, 3);
      }
    for (let i = 0; i < 95; i++) {
      const t = random() * Math.PI * 2,
        radius = 70 + random() * 32;
      const x = sx + Math.cos(t) * radius,
        y = sy + 5.5 + Math.sin(t) * radius * 0.6;
      rect(c, "#799759", x, y, 1, 4);
      rect(c, random() > 0.5 ? bloom : blossom, x - 1, y, 3, 2);
    }
    for (let placed = 0, tries = 0; placed < area.ground.trailFlowers && tries < area.ground.trailFlowers * 40; tries++) {
      const x = Math.floor(random() * 768),
        y = Math.floor(random() * 480),
        p = { x: x * 2, y: y * 2 };
      if (onTrail(p, 58, area) || !onTrail(p, 88, area) || Math.abs(p.x - riverX(p.y, area)) < 100) continue;
      placed++;
      rect(c, "#3d6648", x - 3, y + 2, 8, 3);
      for (let k = 0; k < 5; k++)
        rect(c, k % 2 ? bloom : blossom, x - 3 + ((k * 3) % 7), y - 2 + ((k * 2) % 4), 3, 2);
    }
  });
  for (let v = 0; v < 4; v++) texture(`forest-tree-${v}`, 100, 126, (c) => drawTree(c, v, tone));
  texture("forest-inn", 160, 124, (c) => {
    rect(c, "#2c302c", 4, 114, 152, 8);
    rect(c, "#44312a", 10, 62, 140, 54);
    for (let x = 14; x < 148; x += 9) rect(c, "#56402f", x, 64, 2, 50);
    rect(c, "#2a2420", 10, 62, 140, 3);
    for (const x of [20, 104]) {
      rect(c, "#d9b46c", x, 74, 34, 24);
      for (let k = x + 3; k < x + 34; k += 5) rect(c, "#5a4130", k, 74, 1, 24);
      rect(c, "#5a4130", x, 85, 34, 1);
    }
    rect(c, "#26414f", 64, 66, 30, 22);
    for (let x = 71; x < 94; x += 8) rect(c, "#1b2f39", x, 66, 1, 22);
    rect(c, "#2c2420", 64, 88, 30, 26);
    rect(c, "#4a3529", 16, 30, 128, 30);
    rect(c, "#d1aa66", 28, 38, 104, 14);
    for (let x = 30; x < 132; x += 4) rect(c, "#5a4130", x, 38, 1, 14);
    poly(c, "#3a4146", [[0, 64], [160, 64], [148, 52], [12, 52]]);
    poly(c, "#525c62", [[4, 60], [156, 60], [146, 54], [14, 54]]);
    poly(c, "#363d42", [[8, 34], [152, 34], [128, 8], [32, 8]]);
    poly(c, "#4d575d", [[14, 31], [146, 31], [126, 11], [34, 11]]);
    for (let y = 14; y < 31; y += 4) rect(c, "#3e474c", 28 - (y - 14) * 0.9, y, 104 + (y - 14) * 1.8, 1);
    rect(c, "#2b3135", 30, 6, 100, 4);
    rect(c, "#c9b48a", 56, 42, 48, 8);
    rect(c, "#3a2c23", 60, 44, 40, 1);
  });
  texture("forest-rain", 2, 14, (c) => {
    rect(c, "#d8ecf2", 0, 0, 1, 14);
    rect(c, "#9fc2cf", 1, 4, 1, 8);
  });
  texture("forest-rock", 30, 23, (c) => {
    poly(c, "#284c3e", [
      [2, 16],
      [7, 7],
      [20, 4],
      [29, 12],
      [28, 19],
      [10, 22],
    ]);
    poly(c, "#63766c", [
      [4, 13],
      [9, 4],
      [20, 3],
      [27, 10],
      [25, 18],
      [8, 18],
    ]);
    poly(c, "#94a090", [
      [8, 11],
      [10, 5],
      [19, 4],
      [24, 10],
      [19, 13],
    ]);
    rect(c, "#719155", 4, 14, 9, 3);
    rect(c, "#859a5d", 6, 12, 5, 3);
  });
  for (let lit = 0; lit < 2; lit++)
    texture(`forest-lantern-${lit}`, 36, 66, (c) => {
      rect(c, "#283b36", 7, 61, 25, 4);
      rect(c, "#6e7a6d", 10, 55, 20, 7);
      rect(c, "#9d9e80", 13, 52, 14, 4);
      rect(c, "#58685e", 16, 31, 8, 22);
      rect(c, "#8b9177", 16, 32, 3, 22);
      rect(c, "#283c37", 10, 17, 20, 18);
      rect(c, lit ? "#ffce70" : "#6d7965", 13, 20, 14, 11);
      if (lit) {
        rect(c, "#fff1b5", 16, 21, 6, 9);
        rect(c, "#9b683d", 19, 20, 1, 13);
      }
      poly(c, "#536f5f", [
        [5, 19],
        [10, 14],
        [13, 12],
        [16, 8],
        [24, 8],
        [27, 13],
        [34, 19],
      ]);
      rect(c, "#91a07a", 11, 13, 17, 2);
      rect(c, "#b0aa7c", 18, 3, 4, 5);
    });
  for (let lit = 0; lit < 2; lit++)
    texture(`forest-shrine-${lit}`, 124, 122, (c) => {
      rect(c, "#2a4038", 5, 111, 114, 8);
      rect(c, "#6a7c70", 11, 106, 102, 8);
      rect(c, "#9ba28b", 16, 101, 92, 6);
      rect(c, "#693e32", 25, 45, 76, 55);
      rect(c, "#a66343", 30, 44, 66, 54);
      rect(c, "#c18a55", 34, 52, 57, 44);
      rect(c, "#553d30", 45, 58, 35, 42);
      rect(c, lit ? "#e7b65d" : "#343e33", 50, 63, 25, 32);
      if (lit) rect(c, "#ffdf8b", 57, 69, 11, 24);
      for (const x of [28, 87]) {
        rect(c, "#804833", x, 42, 9, 58);
        rect(c, "#cd8a57", x, 43, 3, 54);
      }
      poly(c, "#182f2c", [
        [1, 49],
        [17, 37],
        [43, 17],
        [62, 8],
        [83, 21],
        [108, 38],
        [123, 48],
        [106, 54],
        [18, 54],
      ]);
      poly(c, "#37574b", [
        [8, 44],
        [29, 30],
        [62, 13],
        [93, 32],
        [117, 45],
        [102, 48],
        [24, 48],
      ]);
      for (let y = 27; y < 46; y += 6)
        rect(c, "#5c7460", 53 - (y - 20), y, (y - 20) * 2 + 18, 2);
      rect(c, "#96a078", 45, 15, 34, 3);
      rect(c, "#c3ab77", 57, 5, 10, 9);
      rect(c, "#dcc087", 36, 53, 53, 2);
      for (const x of [40, 54, 70, 83]) rect(c, "#e6d6ad", x, 54, 3, 8);
      rect(c, "#374f3a", 17, 97, 17, 5);
      rect(c, "#68824b", 19, 94, 11, 4);
    });
  texture("forest-torii", 120, 106, (c) => {
    for (const x of [22, 87]) {
      rect(c, "#572f2b", x + 3, 18, 11, 85);
      rect(c, "#ad6046", x, 17, 10, 83);
      rect(c, "#d58e61", x, 18, 3, 76);
      rect(c, "#4e5145", x - 3, 97, 17, 7);
    }
    rect(c, "#a5573e", 11, 31, 101, 8);
    rect(c, "#d98958", 11, 31, 101, 2);
    poly(c, "#1c3530", [
      [2, 6],
      [25, 12],
      [94, 12],
      [119, 6],
      [117, 16],
      [96, 22],
      [24, 22],
      [4, 16],
    ]);
    rect(c, "#c67951", 20, 20, 82, 6);
    rect(c, "#d6ad6d", 55, 24, 12, 21);
    rect(c, "#714b34", 60, 28, 2, 12);
  });
  texture("forest-player", 128, 160, (c) => {
    for (let dir = 0; dir < 4; dir++)
      for (let f = 0; f < 4; f++) {
        c.save();
        c.translate(f * 32, dir * 40);
        drawTraveller(c, dir, f);
        c.restore();
      }
  });
  addSheet(scene.textures.get("forest-player"), 4, 4, 32, 40);
  texture("forest-fox", 128, 32, (c) => {
    for (let f = 0; f < 4; f++) {
      c.save();
      c.translate(f * 32, f % 2);
      drawFox(c, f);
      c.restore();
    }
  });
  addSheet(scene.textures.get("forest-fox"), 4, 1, 32, 32);
  texture("forest-glow", 96, 96, (c) => {
    const g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, "#ffdf9977");
    g.addColorStop(0.3, "#f4c97633");
    g.addColorStop(1, "#ecc77800");
    c.fillStyle = g;
    c.fillRect(0, 0, 96, 96);
  });
  texture("forest-spark", 7, 7, (c) => {
    rect(c, "#fff0b2", 3, 0, 1, 7);
    rect(c, "#fff0b2", 0, 3, 7, 1);
    rect(c, "#ffffff", 2, 2, 3, 3);
  });
}
