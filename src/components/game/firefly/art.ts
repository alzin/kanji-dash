import type Phaser from "phaser";
import { SPIRITS } from "@/lib/firefly-catalog";
import { ART_DETAIL, addArt, addSheet, artCanvas, round } from "../forest/art";

export function makeFireflyArt(scene: Phaser.Scene) {
  for (const spirit of SPIRITS) {
    const key = `rescue-${spirit.id}`;
    if (scene.textures.exists(key)) continue;
    const { canvas, c } = artCanvas(128, 32, ART_DETAIL);
    const pill = (x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); round(c, x, y, w, h, r); c.fill(); };
    const oval = (x: number, y: number, rx: number, ry: number) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
    for (let frame = 0; frame < 4; frame++) {
      c.save(); c.translate(frame * 32, frame % 2);
      c.fillStyle = spirit.color;
      if (spirit.shape === "moth") {
        const flap = frame % 2 * 2;
        oval(7.5, 14.5 + flap, 5, 5); oval(24.5, 14.5 + flap, 5, 5);
        oval(9, 21.5, 3.4, 2.8); oval(23, 21.5, 3.4, 2.8);
      } else if (spirit.shape === "fox") {
        c.lineJoin = "round"; c.lineWidth = 1.6; c.strokeStyle = spirit.color;
        c.beginPath(); c.moveTo(7.6, 13); c.lineTo(7.6, 4); c.lineTo(13.6, 11); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(18.4, 11); c.lineTo(24.4, 4); c.lineTo(24.4, 14); c.closePath(); c.fill(); c.stroke();
      } else {
        pill(11, 3, 3, 12, 1.5); pill(19, 3, 3, 12, 1.5);
      }
      pill(9, 11, 14, 14, 5); pill(6, 14, 20, 7, 3.5);
      pill(12, 23.4, 8, 3.6, 1.8);
      c.fillStyle = "#fff9dc"; pill(11, 13, 10, 9, 3.6);
      c.fillStyle = "#273d45"; oval(12.2, 17.4, 1.05, 1.5); oval(19.8, 17.4, 1.05, 1.5);
      c.fillStyle = "#d6b189"; oval(16, 20.4, 1.1, 0.6);
      c.restore();
    }
    addSheet(addArt(scene, key, canvas, ART_DETAIL), 4, 1, 32, 32);
  }
}
