// The shared texture cache: a few CC0 grain and normal maps under assets/textures (see assets/LICENSES.md),
// loaded once and shared by every room. UVs are in metres (kit3d.worldUVs), so `tile` is a size in metres.
import * as THREE from 'three';
import { vertexMaterial, SHARED_TEXTURES } from './kit3d.js';

const BASE = new URL('../assets/textures/', import.meta.url).href;
const loader = new THREE.TextureLoader();
const cache = new Map();

// How big one repeat of each surface is, and how strong its relief reads.
const SURFACES = {
  carpet: { tile: 0.9, relief: 0.6, roughness: 0.95 },
  oak: { tile: 1.2, relief: 0.5, roughness: 0.6 },
  walnut: { tile: 1.2, relief: 0.5, roughness: 0.55 },
  stone: { tile: 2.4, relief: 0.7, roughness: 0.9 },
  plaster: { tile: 2.0, relief: 0.35, roughness: 0.92 },
  leather: { tile: 0.6, relief: 0.45, roughness: 0.55, normalOnly: true },
  wool: { tile: 1.2, relief: 0.5, roughness: 0.95 },
};

function load(file, tile, srgb) {
  if (cache.has(file)) return cache.get(file);
  const t = loader.load(BASE + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tile);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  SHARED_TEXTURES.add(t);
  cache.set(file, t);
  return t;
}

// A vertex-coloured standard material with the surface's grain and relief. Rooms pass the kind and any overrides.
export function surface(kind, opts = {}) {
  const s = SURFACES[kind];
  const m = vertexMaterial({ roughness: s.roughness, ...opts });
  if (!s.normalOnly) m.map = load(`${kind}_c.jpg`, s.tile, true);
  m.normalMap = load(`${kind}_n.jpg`, s.tile, false);
  m.normalScale = new THREE.Vector2(s.relief, s.relief);
  return m;
}
