// The press photograph: the member, rendered once off screen with the game's own figure and wardrobe, then
// screened into newspaper halftone (ink dots on a tilted lattice over cream paper). The front page runs it
// beside any story the player is in. Cached per member and party colour; one render each.
import * as THREE from 'three';
import { createFigure, poseFigure } from './office/visitor.js';
import { wardrobe } from './figures.js';

const W = 300;
const H = 380;
const PAPER = [0xec, 0xe3, 0xcf];
const INK = [0x24, 0x1f, 0x1a];
const cache = new Map();

export function pressPhoto(renderer, environment, mp, color) {
  const key = `${mp.id}:${color}`;
  if (cache.has(key)) return cache.get(key);
  let url = null;
  try {
    url = halftone(renderFigure(renderer, environment, mp, color));
  } catch (e) {
    console.warn('press photo failed', e);
  }
  cache.set(key, url);
  return url;
}

// A three-quarter head-and-shoulders portrait, lit like a lobby at dusk: one hard key, soft fill from the
// studio environment. Returns linear RGBA pixels, bottom row first (how WebGL hands them back).
function renderFigure(renderer, environment, mp, color) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfc7b8');
  scene.environment = environment;
  const f = createFigure(color, mp.id, wardrobe(mp.id, color));
  poseFigure(f, 'standing', 1);
  f.group.rotation.y = -0.35;
  f.head.rotation.y = 0.2;
  scene.add(f.group);
  const key = new THREE.DirectionalLight('#fff2dc', 4.5);
  key.position.set(1.2, 2.4, 1.6);
  const fill = new THREE.DirectionalLight('#dfe6f0', 1.8);
  fill.position.set(-1.5, 1.6, 1.2);
  scene.add(key, fill, new THREE.HemisphereLight('#d8d2c4', '#3a342c', 1.6));
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 10);
  camera.position.set(0.3, 1.5, 1.3);
  camera.lookAt(0, 1.42, 0);

  const target = new THREE.WebGLRenderTarget(W, H);
  const prevTarget = renderer.getRenderTarget();
  const pixels = new Uint8Array(W * H * 4);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, W, H, pixels);
  renderer.setRenderTarget(prevTarget);

  target.dispose();
  f.group.traverse((o) => o.geometry?.dispose());
  f.materials.forEach((m) => m.dispose());
  key.dispose();
  fill.dispose();
  return pixels;
}

// Screen the render into dots. The lattice is rotated 15° (as a printed photo's would be) and each cell's dot
// is sized by the darkness under it, sampled from the gamma-corrected luminance. The deepest shadow keeps a
// few specks of paper, as newsprint does.
function halftone(pixels) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  const lum = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4;
      const l = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      // Linear to roughly sRGB, lifted a little so the suit keeps its folds.
      lum[y * W + x] = Math.min(1, Math.pow(l / 255, 1 / 2.2) * 1.05);
    }
  }
  ctx.fillStyle = `rgb(${PAPER.join(',')})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `rgb(${INK.join(',')})`;
  const cell = 3.1 * dpr;
  const angle = (15 * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const diag = Math.hypot(canvas.width, canvas.height);
  for (let v = -diag; v < diag; v += cell) {
    for (let u = -diag; u < diag; u += cell) {
      const cx = u * cos - v * sin + canvas.width / 2;
      const cy = u * sin + v * cos + canvas.height / 2;
      if (cx < -cell || cy < -cell || cx > canvas.width + cell || cy > canvas.height + cell) continue;
      const sx = Math.min(W - 1, Math.max(0, Math.round(cx / dpr)));
      const sy = Math.min(H - 1, Math.max(0, Math.round(cy / dpr)));
      const dark = (1 - lum[sy * W + sx]) * 0.9;
      const r = cell * 0.56 * Math.sqrt(dark);
      if (r < 0.25) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas.toDataURL('image/png');
}
