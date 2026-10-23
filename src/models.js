// CC0 props from assets/models (see assets/LICENSES.md), loaded once and cloned per use. Kenney's kits ship flat
// materials with plain names (wood, metal, carpet, lamp...); each name maps to one of the game's own surfaces,
// so a desk from the kit is the same oak as the chamber's benches.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { worldUVs, figureMaterial, glowMaterial } from './kit3d.js';
import { surface, brass } from './textures.js';
import { PALETTE } from './look.js';

const BASE = new URL('../assets/models/', import.meta.url).href;
const loader = new GLTFLoader();
const templates = new Map();

// The hue each textured surface takes on a kit prop: the maps are normalised to one brightness, so the colour
// comes from here (Kenney's names: `carpet` is the seat of a chair, `carpetWhite` the pages of a book).
const TINTS = { wood: '#6e4a2b', woodDark: '#3b2616', carpet: '#2f5a3c', carpetWhite: PALETTE.paper, carpetDarker: '#5b2a2a', metal: '#8a8f98', metalMedium: '#4a4d54', metalDark: '#23252b' };

// One material per Kenney name, shared by every prop (so twenty props cost twenty draw calls, not sixty).
let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    wood: surface('oak', { roughness: 0.55 }),
    woodDark: surface('walnut', { roughness: 0.5 }),
    // Steel in three shades, brushed like the brass: lamp stems, chair legs, the coat rack.
    metal: brass({ metalness: 0.6, roughness: 0.4, envMapIntensity: 0.8 }),
    metalMedium: brass({ metalness: 0.5, roughness: 0.5, envMapIntensity: 0.8 }),
    metalDark: brass({ metalness: 0.4, roughness: 0.6, envMapIntensity: 0.8 }),
    carpet: surface('leather', { roughness: 0.6 }),
    carpetWhite: surface('paper'),
    carpetDarker: surface('wool', { roughness: 0.9 }),
    lamp: glowMaterial({ vertexColors: false, color: PALETTE.paneWarm }),
    plant: figureMaterial({ color: '#4f7a3a', roughness: 0.9 }),
  };
  // Each keeps the kit's name, so a placement can swap one (a sofa's seat for buttoned leather).
  for (const [name, m] of Object.entries(mats)) m.name = name;
  return mats;
}

// Each pack: its scale to metres, its file type, and whether its materials are swapped for the game's
// surfaces (Kenney's flat colours) or kept (KayKit's painted atlas).
export const PACKS = {
  furniture: { scale: 1.9, ext: 'glb', retint: true },
  street: { scale: 5, ext: 'gltf', retint: false },
  food: { scale: 0.42, ext: 'glb', retint: false },
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
      // Swap each material by name (a chair has two: frame and seat), and paint the vertices of each
      // group the hue its surface needs.
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const groups = o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count, materialIndex: 0 }];
      worldUVs(o.geometry);
      const count = o.geometry.attributes.position.count;
      const colors = new Float32Array(count * 3).fill(1);
      const tint = new THREE.Color();
      const idx = o.geometry.index;
      for (const grp of groups) {
        const name = mats[grp.materialIndex]?.name || '';
        if (!TINTS[name]) continue;
        tint.set(TINTS[name]);
        for (let k = grp.start; k < grp.start + grp.count; k++) {
          const v = idx ? idx.getX(k) : k;
          colors[v * 3] = tint.r;
          colors[v * 3 + 1] = tint.g;
          colors[v * 3 + 2] = tint.b;
        }
      }
      o.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const swapped = mats.map((mm) => M[mm?.name] || M.wood);
      o.material = Array.isArray(o.material) ? swapped : swapped[0];
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

export const loadTemplate = template;

// Many copies of one prop as a single instanced mesh (chairs round a table, glasses along it). The group is
// returned at once and fills itself when the model has loaded. placements: [{ x, y, z, rotY, scale }].
export function instancedModel(parent, name, placements, { pack = 'furniture', onReady } = {}) {
  const holder = new THREE.Group();
  parent.add(holder);
  let alive = true;
  holder.userData.cancel = () => (alive = false);
  template(pack, name).then((root) => {
    if (!alive) return;
    root.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const inst = new THREE.InstancedMesh(geo, o.material, placements.length);
      placements.forEach((pl, i) => {
        q.setFromAxisAngle(up, pl.rotY || 0);
        p.set(pl.x || 0, pl.y || 0, pl.z || 0);
        s.setScalar(pl.scale || 1);
        m.compose(p, q, s);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      holder.add(inst);
    });
    onReady?.(holder);
  }).catch((e) => console.warn('model failed', name, e));
  return holder;
}

// Place a prop. Returns a group added at once (so disposal and visibility work immediately); the model
// appears inside it when loaded. `onReady` gets the group, for anything that needs the loaded size. `swap`
// replaces the shared materials by kit name on this copy only ({ carpet: buttonedLeather }); a swapped-in
// material should ignore vertex colours, since the kit mesh's are painted for the shared one.
export function placeModel(parent, name, { pack = 'furniture', x = 0, y = 0, z = 0, rotY = 0, scale = 1, swap = null, onReady } = {}) {
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
    if (swap) {
      inst.traverse((o) => {
        if (!o.isMesh) return;
        const pick = (m) => swap[m?.name] || m;
        o.material = Array.isArray(o.material) ? o.material.map(pick) : pick(o.material);
      });
    }
    holder.add(inst);
    onReady?.(holder);
  }).catch((e) => console.warn('model failed', name, e));
  return holder;
}
