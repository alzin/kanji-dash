// Run after changing the logo in docs/brand: node scripts/build-icons.mjs
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const master = await readFile(resolve(root, "docs/brand/kanji-dash-logo.webp"));

const icons = [
  { file: "public/icons/icon-192.png", size: 192, fit: 0.86 },
  { file: "public/icons/icon-512.png", size: 512, fit: 0.86 },
  { file: "public/icons/icon-maskable-512.png", size: 512, maskable: true },
  { file: "public/apple-touch-icon.png", size: 180, fit: 0.8 },
];
const gold = [0xe9, 0xc5, 0x80];
const marks = [{ file: "public/icons/brand-mark.png", size: 256, fit: 0.98, mark: { body: gold } }];
const favicons = [16, 32, 48, 256].map((size) => ({ size, fit: 0.97, mark: { body: gold } }));

const browser = await chromium.launch();
const page = await browser.newPage();
const rendered = await page.evaluate(async ({ source, requests }) => {
  const image = new Image();
  image.src = source;
  await image.decode();
  const { naturalWidth: width, naturalHeight: height } = image;
  const scan = new OffscreenCanvas(width, height).getContext("2d");
  scan.drawImage(image, 0, 0);
  const pixels = scan.getImageData(0, 0, width, height).data;
  const background = [pixels[0], pixels[1], pixels[2]];

  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const distance = Math.abs(pixels[i] - background[0]) + Math.abs(pixels[i + 1] - background[1]) + Math.abs(pixels[i + 2] - background[2]);
      if (distance > 60) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  const longest = Math.max(right - left, bottom - top);
  const halfDiagonal = Math.hypot(right - left, bottom - top) / 2;

  const ink = (test) => {
    const sum = [0, 0, 0];
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (!test(pixels[i], pixels[i + 1], pixels[i + 2])) continue;
      sum[0] += pixels[i]; sum[1] += pixels[i + 1]; sum[2] += pixels[i + 2]; count++;
    }
    return sum.map((value) => value / count);
  };
  const navy = ink((r, g, b) => r < 80 && g < 80 && b > 60);
  const orange = ink((r, g, b) => r > 200 && g < 150 && b < 100);

  const repaint = (context, size, body) => {
    const frame = context.getImageData(0, 0, size, size);
    const data = frame.data;
    const n = navy.map((value, k) => value - background[k]);
    const o = orange.map((value, k) => value - background[k]);
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const nn = dot(n, n), oo = dot(o, o), no = dot(n, o), det = nn * oo - no * no;
    for (let i = 0; i < data.length; i += 4) {
      const d = [data[i] - background[0], data[i + 1] - background[1], data[i + 2] - background[2]];
      const dn = dot(n, d), dO = dot(o, d);
      let a = Math.max(0, (oo * dn - no * dO) / det);
      let b = Math.max(0, (nn * dO - no * dn) / det);
      const total = a + b;
      if (total > 1) { a /= total; b /= total; }
      const alpha = Math.min(1, total);
      for (let k = 0; k < 3; k++) data[i + k] = alpha ? (a * body[k] + b * orange[k]) / (a + b) : 0;
      data[i + 3] = Math.round(alpha * 255);
    }
    context.putImageData(frame, 0, 0);
  };

  return Promise.all(requests.map(async ({ size, fit, maskable, mark, round, tile }) => {
    const side = maskable ? halfDiagonal / 0.38 : longest / fit;
    const art = new OffscreenCanvas(size, size);
    const context = art.getContext("2d");
    context.fillStyle = `rgb(${background.join(",")})`;
    context.fillRect(0, 0, size, size);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
    if (mark) repaint(context, size, mark.body);

    let canvas = art;
    if (round) {
      canvas = new OffscreenCanvas(size, size);
      const framed = canvas.getContext("2d");
      framed.beginPath();
      framed.roundRect(0, 0, size, size, size * round);
      framed.clip();
      if (tile) {
        framed.fillStyle = `rgb(${tile.join(",")})`;
        framed.fillRect(0, 0, size, size);
      }
      framed.drawImage(art, 0, 0);
    }
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return [...new Uint8Array(await blob.arrayBuffer())];
  }));
}, { source: `data:image/webp;base64,${master.toString("base64")}`, requests: [...icons, ...marks, ...favicons] });
await browser.close();

const pngs = rendered.map((bytes) => Buffer.from(bytes));
const files = [...icons, ...marks];
await Promise.all(files.map((icon, i) => writeFile(resolve(root, icon.file), pngs[i])));

const entries = pngs.slice(files.length);
const header = Buffer.alloc(6 + entries.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((png, i) => {
  const size = favicons[i].size;
  const entry = 6 + i * 16;
  header.writeUInt8(size % 256, entry);
  header.writeUInt8(size % 256, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(resolve(root, "public/favicon.ico"), Buffer.concat([header, ...entries]));
console.log(`Wrote ${icons.length} icons, ${marks.length} wordmark logo and a ${favicons.length}-size favicon.ico.`);
