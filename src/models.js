// CC0 props from assets/models (see assets/LICENSES.md), loaded once and cloned per use. Kenney's kits ship flat
// materials with plain names (wood, metal, carpet, lamp...); each name maps to one of the game's own surfaces,
// so a desk from the kit is the same oak as the chamber's benches.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { worldUVs, figureMaterial, glowMaterial } from './kit3d.js';
import { surface } from './textures.js';
import { PALETTE } from './look.js';

const BASE = new URL('../assets/models/', import.meta.url).href;
const loader = new GLTFLoader();
const templates = new Map();

// One material per Kenney name, shared by every prop (so twenty props cost twenty draw calls, not sixty).
let mats = null;
function materials() {
  if (mats) return mats;
  const metal = figureMaterial({ color: '#8a8f98', metalness: 0.6, roughness: 0.4, envMapIntensity: 0.8 });
  mats = {
    wood: surface('oak', { roughness: 0.55 }),
    woodDark: surface('walnut', { roughness: 0.5 }),
    metal,
    metalMedium: figureMaterial({ color: '#4a4d54', metalness: 0.5, roughness: 0.5 }),
    metalDark: figureMaterial({ color: '#23252b', metalness: 0.4, roughness: 0.6 }),
    carpet: surface('leather', { roughness: 0.6 }),
    carpetWhite: figureMaterial({ color: PALETTE.paper, roughness: 0.9 }),
    carpetDarker: figureMaterial({ color: '#5b2a2a', roughness: 0.9 }),
    lamp: glowMaterial({ vertexColors: false, color: PALETTE.paneWarm }),
    plant: figureMaterial({ color: '#4f7a3a', roughness: 0.9 }),
  };
  return mats;
}

// Each pack: its scale to metres, its file type, and whether its materials are swapped for the game's
// surfaces (Kenney's flat colours) or kept (KayKit's painted atlas).
export const PACKS = {
  furniture: { scale: 1.9, ext: 'glb', retint: true },
  street: { scale: 5, ext: 'gltf', retint: false },
};

// Fetch and prepare a template once: swap materials by name, give every mesh UVs in metres (after scale) and
// vertex colours of white so the textured materials tint correctly.
async function template(pack, name) {
  const key = `${pack}/${name}`;
  if (templates.has(key)) return templates.get(key);
  const { scale, ext, retint } = PACKS[pack];
  const p = loader.loadAsync(`${BASE}${pack}/${name}.${ext}`).then((gltf) => {
    const root = gltf.scene;
    const M = materials();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry = o.geometry.clone();
      o.geometry.scale(scale, scale, scale);
      if (!retint) {
        o.material.roughness = 0.85;
        o.material.envMapIntensity = 0.4;
        return;
      }
      const n = o.material?.name || '';
      o.material = M[n] || M.wood;
      worldUVs(o.geometry);
      const count = o.geometry.attributes.position.count;
      o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
    });
    // Bake the pack scale into the geometry so callers place props in metres.
    root.traverse((o) => {
      if (o.isMesh || o.isGroup) o.position.multiplyScalar(scale);
    });
    return root;
  });
  templates.set(key, p);
  return p;
}

// Place a prop. Returns a group added at once (so disposal and visibility work immediately); the model
// appears inside it when loaded. `onReady` gets the group, for anything that needs the loaded size.
export function placeModel(parent, name, { pack = 'furniture', x = 0, y = 0, z = 0, rotY = 0, scale = 1, onReady } = {}) {
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.y = rotY;
  holder.scale.setScalar(scale);
  parent.add(holder);
  let alive = true;
  holder.userData.cancel = () => (alive = false);
  template(pack, name).then((root) => {
    if (!alive) return;
    const inst = root.clone(true);
    holder.add(inst);
    onReady?.(holder);
  }).catch((e) => console.warn('model failed', name, e));
  return holder;
}
