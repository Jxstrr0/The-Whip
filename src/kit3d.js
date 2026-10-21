// Small shared Three.js helpers for the rooms: vertex-coloured parts merged into one mesh, fake baked shading
// (vertex occlusion and contact shadows), the standard lights, painted textures, and disposal.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tuning } from './sim/config.js';

const tmpColor = new THREE.Color();
const look = () => tuning().look;

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

// Subdivisions for a span: big surfaces need vertices along them for the baked shading to vary.
const segs = (len, metres) => (metres ? Math.max(1, Math.ceil(len / metres)) : 1);

// A box given by its size and centre, optionally turned about y. `seg` is metres per subdivision (0 = none).
export function box(w, h, d, x, y, z, color, rotY = 0, seg = 0) {
  const g = new THREE.BoxGeometry(w, h, d, segs(w, seg), segs(h, seg), segs(d, seg));
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return paint(g, color);
}

// A box given by its min and max corners, which is easier for floors, walls and platforms.
export function slab(x0, y0, z0, x1, y1, z1, color, seg = 0) {
  return box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, color, 0, seg);
}

// A one-sided panel facing a direction. Walls built from these vanish when the camera is outside the room,
// so the camera can sit beyond a wall (as the chamber's default view does) and still see in.
const FACING = { '+z': [0, 0], '-z': [0, Math.PI], '+x': [0, Math.PI / 2], '-x': [0, -Math.PI / 2], down: [Math.PI / 2, 0], up: [-Math.PI / 2, 0] };
export function panel(w, h, x, y, z, color, facing, seg = 0) {
  const g = new THREE.PlaneGeometry(w, h, segs(w, seg), segs(h, seg));
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

// Fake baked light. Vertices close to the floor, the walls or the ceiling get darker, and downward-facing
// surfaces (the undersides of desks and tables) darker still. Cheap, static, and it stops rooms floating.
export function bakeAO(geo, { floorY = 0, ceilY = null, bounds = null, strength = null, reach = 0.9 } = {}) {
  const k = strength ?? look().aoStrength;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const col = geo.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let d = Math.max(0, y - floorY);
    if (bounds) d = Math.min(d, x - bounds.x0, bounds.x1 - x, z - bounds.z0, bounds.z1 - z);
    if (ceilY != null) d = Math.min(d, (ceilY - y) * 2);
    const occ = Math.max(0, Math.min(1, 1 - d / reach));
    let f = 1 - k * occ * occ;
    if (nor && nor.getY(i) < -0.5) f *= 0.7;
    col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
  }
  col.needsUpdate = true;
  return geo;
}

// Soft dark blobs on the floor under furniture and people, one instanced mesh per room (one draw call).
// points: [{ x, y, z, sx, sz, rotY }], sx/sz scale the blob, which is `radius` across by default.
let blobTexture = null;
function blobTex() {
  if (blobTexture) return blobTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  blobTexture = new THREE.CanvasTexture(c);
  return blobTexture;
}
export function blobMaterial(opacity = null) {
  return new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: opacity ?? look().contactShadow, toneMapped: false });
}
export function contactShadows(points, { radius = 0.5, opacity = null } = {}) {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, blobMaterial(opacity), points.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  points.forEach((pt, i) => {
    q.setFromAxisAngle(up, pt.rotY || 0);
    p.set(pt.x, (pt.y || 0) + 0.012, pt.z);
    s.set(pt.sx || 1, 1, pt.sz || 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = -1;
  return mesh;
}

// Vertex-coloured standard material. The shared environment map does most of the soft light, scaled here.
export function vertexMaterial(opts = {}) {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: look().envIntensity, ...opts });
}

// Plain-coloured standard material for figures and props that use instance colours rather than vertex colours.
export function figureMaterial(opts = {}) {
  return new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, envMapIntensity: look().envIntensity, ...opts });
}

// Unlit vertex colours, for things that are themselves light: window panes, lamp shades, chandeliers.
export function glowMaterial(opts = {}) {
  return new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, ...opts });
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
      for (const v of Object.values(m)) if (v && v.isTexture && v !== blobTexture) v.dispose();
      m.dispose();
    }
    if (o.isInstancedMesh) o.dispose();
  });
}

// The standard lights for a room: a sky/ground hemisphere, a warm key, a cool fill. Physically based
// (decay 2 on point lights), no shadow maps. Rooms add their own lamps with `lamp()`.
export function roomLights(scene, { hemi = 0.55, key = 1.3, fill = 0.3, warm = '#fff1dc', ground = '#3a3326', keyPos = [4, 12, 6], fillPos = [-6, 6, -8] } = {}) {
  const h = new THREE.HemisphereLight(warm, ground, hemi);
  const k = new THREE.DirectionalLight('#fff6e8', key);
  k.position.set(...keyPos);
  const f = new THREE.DirectionalLight('#dfe8ff', fill);
  f.position.set(...fillPos);
  scene.add(h, k, f);
  return { hemi: h, key: k, fill: f };
}

export function lamp(scene, { color = '#ffd9a0', intensity = 10, distance = 8, x = 0, y = 2, z = 0 } = {}) {
  const l = new THREE.PointLight(color, intensity, distance, 2);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}

// A flat painted texture from a canvas drawing function (windows, boards, photos). No image files needed.
export function paintedTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.canvas = c;
  return tex;
}

export function texturedPanel(w, h, tex, { x = 0, y = 0, z = 0, rotY = 0 } = {}) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  return mesh;
}
