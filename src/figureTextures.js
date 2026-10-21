// What the figures are made of, painted once on small canvases: suiting cloth (plain, pinstripe, chalk
// stripe), hair in strands, a fine grain for skin and shoe leather, silk ribs and rep stripes for ties.
// Every map is a seamless tile sized in metres, like the rooms' textures, so a weave reads at the same
// density on a sleeve as on a lapel. Greyscale colour maps sit near 0.84 so the instance or material colour
// carries the hue; the normal maps are OpenGL-style, like the ambientCG ones under assets/textures.
import * as THREE from 'three';
import { SHARED_TEXTURES } from './kit3d.js';

// A tiny deterministic hash for the fibre noise (cosmetic; the sim's randomness never comes from here).
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise on a lattice that wraps every `period` cells, so the tile is seamless.
function vnoise(x, y, period) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (i, j) => hash2(((i % period) + period) % period, ((j % period) + period) % period);
  const a = w(x0, y0) + (w(x0 + 1, y0) - w(x0, y0)) * sx;
  const b = w(x0, y0 + 1) + (w(x0 + 1, y0 + 1) - w(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}
// Layered noise in 0..1 over a tile of n pixels, with `cells` lattice cells across the tile.
function fbm(x, y, n, cells, octaves = 3) {
  let v = 0;
  let amp = 0.5;
  let c = cells;
  for (let o = 0; o < octaves; o++) {
    v += amp * vnoise((x / n) * c, (y / n) * c, c);
    amp *= 0.5;
    c *= 2;
  }
  return v;
}

const TAU = Math.PI * 2;

// Build a height field and a colour field over an n×n tile, and bake them to textures.
// `fn(x, y)` returns [height 0..1, colour 0..1]. Heights become an OpenGL tangent-space normal map.
function bake(n, tile, fn, { relief = 1, colour = true } = {}) {
  const H = new Float32Array(n * n);
  const C = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const [h, c] = fn(x, y);
      H[y * n + x] = h;
      C[y * n + x] = c;
    }
  const out = {};
  const normal = new ImageData(n, n);
  const k = relief * n * 0.02;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (H[y * n + ((x + 1) % n)] - H[y * n + ((x + n - 1) % n)]) * k;
      const dy = (H[((y + 1) % n) * n + x] - H[((y + n - 1) % n) * n + x]) * k;
      // Tangent +u is +x on the canvas; +v is up the canvas (the texture is flipped on upload).
      const len = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      normal.data[i] = Math.round((-dx / len) * 127.5 + 127.5);
      normal.data[i + 1] = Math.round((dy / len) * 127.5 + 127.5);
      normal.data[i + 2] = Math.round((1 / len) * 127.5 + 127.5);
      normal.data[i + 3] = 255;
    }
  out.normal = toTexture(normal, tile, false);
  if (colour) {
    const col = new ImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = Math.round(Math.max(0, Math.min(1, C[i])) * 255);
      col.data[i * 4] = col.data[i * 4 + 1] = col.data[i * 4 + 2] = v;
      col.data[i * 4 + 3] = 255;
    }
    out.map = toTexture(col, tile, true);
  }
  return out;
}

function toTexture(imageData, tile, srgb) {
  const c = document.createElement('canvas');
  c.width = imageData.width;
  c.height = imageData.height;
  c.getContext('2d').putImageData(imageData, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tile);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  SHARED_TEXTURES.add(t);
  return t;
}

// Worsted suiting: a fine twill (diagonal ribs about 3 mm apart) over a fibre fuzz.
function suiting(n, stripe = null) {
  return bake(256, 0.09, (x, y) => {
    const rib = 0.5 + 0.5 * Math.sin((TAU * 30 * (x + y)) / n);
    const cross = 0.5 + 0.5 * Math.sin((TAU * 60 * x) / n) * Math.sin((TAU * 60 * y) / n);
    const fuzz = fbm(x, y, n, 16, 3);
    const h = rib * 0.55 + cross * 0.2 + fuzz * 0.25;
    let c = 0.8 + rib * 0.05 + (fuzz - 0.5) * 0.08;
    if (stripe) c = Math.max(c, c + stripe(x, y) * (1 - c) * 1.2);
    return [h, c];
  }, { relief: 0.9 });
}
// Pinstripes about 11 mm apart, a thread wide; chalk stripes 15 mm apart, softer and wider.
const pin = (x) => {
  const p = 256 / 8;
  const d = Math.abs(((x % p) + p) % p - p / 2);
  return d < 1.2 ? 0.75 : d < 2 ? 0.3 : 0;
};
const chalk = (x, y) => {
  const p = 256 / 6;
  const d = Math.abs(((x % p) + p) % p - p / 2);
  const broken = 0.75 + 0.25 * Math.sin((TAU * 9 * y) / 256 + x);
  return d < 2.5 ? 0.42 * broken : d < 4 ? 0.14 * broken : 0;
};

// Hair in strands running down from the crown: ridges along v that drift a little, lighter and darker.
function hair(n) {
  return bake(n, 0.035, (x, y) => {
    const drift = 3 * Math.sin((TAU * 2 * y) / n) + 2 * Math.sin((TAU * 3 * y) / n + 1.7);
    const u = x + drift;
    const strand = 0.5 + 0.5 * Math.sin((TAU * 14 * u) / n) * 0.7 + 0.3 * Math.sin((TAU * 29 * u) / n + 0.9) * 0.5;
    const fuzz = fbm(x, y, n, 8, 2);
    const h = strand * 0.75 + fuzz * 0.25;
    const c = 0.72 + strand * 0.22 + (fuzz - 0.5) * 0.1;
    return [h, c];
  }, { relief: 1.3 });
}

// A faint even grain: skin, and the leather of shoes.
function grain(n) {
  return bake(n, 0.05, (x, y) => [fbm(x, y, n, 12, 3), 0.84], { relief: 0.5, colour: false });
}

// Silk: fine ribs across the tie, so it catches the light in bands.
function silk(n) {
  return bake(n, 0.02, (x, y) => [0.5 + 0.5 * Math.sin((TAU * 24 * y) / n) * 0.8 + fbm(x, y, n, 8, 2) * 0.2, 0.84], { relief: 0.35, colour: false });
}

// Rep stripes: diagonal bands, two thirds the tie's own colour and a third darker, with a thin light edge.
function rep(n) {
  const c = new ImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const t = ((((x - y) % n) + n) % n) / n;
      let v = 1;
      if (t > 0.62 && t < 0.92) v = 0.58;
      else if (t >= 0.92 && t < 0.96) v = 1.08;
      const i = (y * n + x) * 4;
      c.data[i] = c.data[i + 1] = c.data[i + 2] = Math.round(Math.min(1, v) * 255);
      c.data[i + 3] = 255;
    }
  return { map: toTexture(c, 0.04, true) };
}

let cache = null;
// Every figure map, built on first use and shared by every room for the life of the page.
export function figureTextures() {
  if (cache) return cache;
  const plain = suiting(256);
  const hr = hair(256);
  cache = {
    cloth: plain.map,
    clothN: plain.normal,
    pinstripe: suiting(256, pin).map,
    chalk: suiting(256, chalk).map,
    hair: hr.map,
    hairN: hr.normal,
    grainN: grain(128).normal,
    silkN: silk(128).normal,
    rep: rep(128).map,
  };
  return cache;
}
