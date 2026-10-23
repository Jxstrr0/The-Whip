// The shared texture cache: CC0 colour, normal and roughness maps under assets/textures (see assets/LICENSES.md),
// loaded once and shared by every room. UVs are in metres (kit3d.worldUVs), so `tile` is a size in metres. The
// colour maps keep most of their own colour but are normalised to one brightness, so a room's vertex colour
// (PALETTE) still decides the hue and a kit prop's tint still multiplies through. The surfaces that fill a phone
// screen (oak, walnut, marble, carpet, leather) ship at 1024² or 768²; the rest at 512².
import * as THREE from 'three';
import { vertexMaterial, SHARED_TEXTURES } from './kit3d.js';

const BASE = new URL('../assets/textures/', import.meta.url).href;
const loader = new THREE.TextureLoader();
const cache = new Map();

// The roughness maps are normalised to this mean, so a surface's roughness below is what it averages to.
const ROUGH_MEAN = 0.9;

// How big one repeat of each surface is, how strong its relief reads, and which maps it ships with
// (c = colour, n = normal, r = roughness).
const SURFACES = {
  carpet: { tile: 0.9, relief: 0.8, roughness: 0.95, maps: 'cnr' },
  oak: { tile: 1.2, relief: 0.8, roughness: 0.5, maps: 'cnr', envMapIntensity: 0.5 },
  walnut: { tile: 1.2, relief: 0.8, roughness: 0.45, maps: 'cnr', envMapIntensity: 0.55 },
  // Light veined marble: the chamber's walls and the Speaker's steps.
  marble: { tile: 3.0, relief: 0.4, roughness: 0.55, maps: 'cnr', envMapIntensity: 0.5 },
  plaster: { tile: 2.0, relief: 0.5, roughness: 0.92, maps: 'cnr' },
  // Smooth leather, its colour from the vertex colour (the map is grey patina), with a soft sheen.
  leather: { tile: 0.6, relief: 0.6, roughness: 0.5, maps: 'cnr', envMapIntensity: 0.5 },
  // Buttoned (deep-buttoned, diamond-quilted) leather: the chesterfield, the Speaker's chair.
  buttoned: { tile: 0.7, relief: 0.9, roughness: 0.5, maps: 'cnr', envMapIntensity: 0.5 },
  wool: { tile: 1.2, relief: 0.6, roughness: 0.95, maps: 'cnr' },
  // Heavy wool weave for the drapes and the gallery cloth; hue from the vertex colour.
  drape: { tile: 0.5, relief: 0.7, roughness: 0.98, maps: 'cnr' },
  // Brushed brass: the hue is the vertex colour, the maps give it the brushing and the soft, uneven shine.
  brass: { tile: 0.5, relief: 0.35, roughness: 0.35, maps: 'nr', metalness: 0.7, envMapIntensity: 1 },
  // Laid paper, for pages and pads on the tables.
  paper: { tile: 0.3, relief: 0.4, roughness: 0.95, maps: 'cn' },
  // Suiting: a normal map only, laid over the figures' cloth at a light touch (see cloth()).
  cloth: { tile: 0.12, relief: 0.3, roughness: 0.82, maps: 'n' },
};

// Every file a surface needs, for the test page.
export function textureFiles() {
  const out = [];
  for (const [kind, s] of Object.entries(SURFACES)) for (const m of s.maps) out.push(`${kind}_${m}.jpg`);
  return out;
}

function load(file, tile, srgb, tileV = tile) {
  const key = `${file}@${tile}x${tileV}`;
  if (cache.has(key)) return cache.get(key);
  const t = loader.load(BASE + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tile, 1 / tileV);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  SHARED_TEXTURES.add(t);
  cache.set(key, t);
  return t;
}

// A vertex-coloured standard material with the surface's grain, relief and wear. Rooms pass the kind and any
// overrides; `roughness` is the average the roughness map is scaled to.
export function surface(kind, opts = {}) {
  const s = SURFACES[kind];
  const { tile, relief, maps, roughness, ...base } = s;
  const m = vertexMaterial({ roughness, ...base, ...opts });
  if (maps.includes('c')) m.map = load(`${kind}_c.jpg`, tile, true);
  if (maps.includes('n')) {
    m.normalMap = load(`${kind}_n.jpg`, tile, false);
    m.normalScale = new THREE.Vector2(relief, relief);
  }
  if (maps.includes('r')) {
    m.roughnessMap = load(`${kind}_r.jpg`, tile, false);
    m.roughness = Math.min(1, m.roughness / ROUGH_MEAN);
  }
  return m;
}

// Brass fittings: rails, brackets, the Mace, a nameplate. The same brushed maps everywhere, so one room's brass
// matches another's.
export function brass(opts = {}) {
  return surface('brass', opts);
}

// The weave of a suit on a figure's cloth parts. Figure geometry carries its own UVs (around the body, and
// metres down it), so the normal map repeats a set number of times around and per metre down, and only a
// little: at phone size it is a sheen that breaks up, not a visible weave.
export function cloth(material, { around = 8, relief = null } = {}) {
  const s = SURFACES.cloth;
  material.normalMap = load('cloth_n.jpg', 1 / around, false, s.tile);
  material.normalScale = new THREE.Vector2(relief ?? s.relief, relief ?? s.relief);
  return material;
}
