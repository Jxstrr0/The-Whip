// Small shared Three.js helpers for the primitive rooms: vertex-coloured boxes merged into one mesh, disposal.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmpColor = new THREE.Color();

// Paint every vertex of a geometry one colour, so many parts can share one material and one draw call.
export function paint(geo, color) {
  tmpColor.set(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = tmpColor.r;
    arr[i * 3 + 1] = tmpColor.g;
    arr[i * 3 + 2] = tmpColor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// A box given by its size and centre, optionally turned about y.
export function box(w, h, d, x, y, z, color, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return paint(g, color);
}

// A box given by its min and max corners, which is easier for floors, walls and platforms.
export function slab(x0, y0, z0, x1, y1, z1, color) {
  return box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, color);
}

// A one-sided panel facing a direction. Walls built from these vanish when the camera is outside the room,
// so the camera can sit beyond a wall (as the chamber's default view does) and still see in.
const FACING = { '+z': [0, 0], '-z': [0, Math.PI], '+x': [0, Math.PI / 2], '-x': [0, -Math.PI / 2], down: [Math.PI / 2, 0], up: [-Math.PI / 2, 0] };
export function panel(w, h, x, y, z, color, facing) {
  const g = new THREE.PlaneGeometry(w, h);
  const [rx, ry] = FACING[facing];
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return paint(g, color);
}

export function cylinder(rTop, rBottom, h, x, y, z, color, segments = 12, axis = 'y') {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return paint(g, color);
}

export function sphere(r, x, y, z, color, segments = 12) {
  const g = new THREE.SphereGeometry(r, segments, Math.max(6, segments >> 1));
  g.translate(x, y, z);
  return paint(g, color);
}

// Merge painted parts into one geometry. Non-indexed so boxes and cylinders mix freely.
export function merge(parts) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(flat, false);
  for (const g of parts) g.dispose();
  for (const g of flat) g.dispose();
  return merged;
}

export function vertexMaterial(opts = {}) {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...opts });
}

// Free GPU memory for everything under a root object, so leaving a room keeps phone memory flat.
export function disposeTree(root) {
  const seen = new Set();
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
    if (o.isInstancedMesh) o.dispose();
  });
}

// Standard soft lighting for every room: no real-time shadows on phones.
export function addSoftLights(scene, { warm = '#fff1dc', ground = '#3a3326', intensity = 1 } = {}) {
  const hemi = new THREE.HemisphereLight(warm, ground, 1.1 * intensity);
  const key = new THREE.DirectionalLight('#fff6e8', 1.2 * intensity);
  key.position.set(4, 12, 6);
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.35 * intensity);
  fill.position.set(-6, 6, -8);
  scene.add(hemi, key, fill);
  return [hemi, key, fill];
}
