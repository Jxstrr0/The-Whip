// The body kit under every figure: a jacket with real shoulders, a waist and a hem; limbs that taper and
// meet at a round joint; the seat of the trousers; rounded shoes. Shared by the instanced crowds
// (figures.js) and the jointed office figure (visitor.js), so one person looks the same in every room.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { merge } from './kit3d.js';

// The jacket, ring by ring from the collar down: height from the shoulder line, half-width, half-depth,
// and how far forward the ring's centre sits (the chest leads the waist a little).
const JACKET = [
  [0.072, 0.08, 0.074, 0.0],
  [0.05, 0.13, 0.094, 0.0],
  [0.01, 0.2, 0.12, 0.0],
  [-0.045, 0.205, 0.128, 0.004],
  [-0.16, 0.185, 0.13, 0.01],
  [-0.29, 0.168, 0.118, 0.008],
  [-0.4, 0.18, 0.124, 0.004],
  [-0.49, 0.178, 0.118, 0.0],
];
// The cross-section is a rounded rectangle rather than an ellipse: cloth over a chest, not a barrel.
const SQUARE = 0.8;
const AROUND = 18;

function ringAt(dy) {
  let lo = JACKET[0];
  let hi = JACKET[JACKET.length - 1];
  for (let i = 0; i < JACKET.length - 1; i++) {
    if (dy <= JACKET[i][0] && dy >= JACKET[i + 1][0]) {
      lo = JACKET[i];
      hi = JACKET[i + 1];
      break;
    }
  }
  const k = lo[0] === hi[0] ? 0 : (lo[0] - dy) / (lo[0] - hi[0]);
  return lo.map((v, j) => v + (hi[j] - v) * k);
}

// Where the jacket's front surface is at x, dy below the shoulder line: for pins, flowers and pockets.
export function jacketFrontZ(x, dy) {
  const [, rx, rz, zc] = ringAt(dy);
  const u = Math.min(1, Math.abs(x) / rx);
  return zc + rz * Math.pow(1 - Math.pow(u, 2 / SQUARE), SQUARE / 2);
}

// The jacket as one smooth skin, closed at the collar and the hem.
export function jacketGeometry(shoulderY) {
  const pos = [];
  const uv = [];
  const idx = [];
  const sq = (c) => Math.sign(c) * Math.pow(Math.abs(c), SQUARE);
  for (const [dy, rx, rz, zc] of JACKET) {
    for (let i = 0; i < AROUND; i++) {
      const t = (i / AROUND) * Math.PI * 2;
      pos.push(rx * sq(Math.cos(t)), shoulderY + dy, zc + rz * sq(Math.sin(t)));
      uv.push(i / AROUND, dy);
    }
  }
  for (let r = 0; r < JACKET.length - 1; r++) {
    for (let i = 0; i < AROUND; i++) {
      const a = r * AROUND + i;
      const b = r * AROUND + ((i + 1) % AROUND);
      idx.push(a, a + AROUND, b, b, a + AROUND, b + AROUND);
    }
  }
  const top = pos.length / 3;
  pos.push(0, shoulderY + JACKET[0][0] + 0.004, 0);
  uv.push(0.5, 0);
  for (let i = 0; i < AROUND; i++) idx.push(top, (i + 1) % AROUND, i);
  const bottom = pos.length / 3;
  const last = (JACKET.length - 1) * AROUND;
  pos.push(0, shoulderY + JACKET[JACKET.length - 1][0], JACKET[JACKET.length - 1][3]);
  uv.push(0.5, 1);
  for (let i = 0; i < AROUND; i++) idx.push(bottom, last + i, last + ((i + 1) % AROUND));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The shirt: a collar standing above the jacket, and the V showing between the lapels down to the tie
// knot, leaning with the chest so it lies on the cloth.
export function shirtFront(shoulderY) {
  const v = new THREE.BoxGeometry(0.074, 0.175, 0.012);
  const p = v.attributes.position;
  const top = 0.06;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 0) p.setX(i, 0);
    const dy = top + y - 0.0875;
    p.setZ(i, jacketFrontZ(p.getX(i), dy) + (p.getZ(i) > 0 ? 0.005 : -0.007));
    p.setY(i, shoulderY + dy);
  }
  v.computeVertexNormals();
  const collar = new THREE.CylinderGeometry(0.06, 0.057, 0.04, 12, 1, true).translate(0, shoulderY + 0.08, 0.005);
  return merge([v, collar]);
}

// The seat of the trousers between the hips, mostly under the hem.
export function pelvis(hipY, { seated = false } = {}) {
  const g = new THREE.SphereGeometry(1, 12, 7);
  g.scale(seated ? 0.17 : 0.145, seated ? 0.09 : 0.07, seated ? 0.12 : 0.095);
  g.translate(0, hipY + 0.03, seated ? 0.02 : 0);
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
// A limb segment from a to b, radius ra at a tapering to rb at b, with a round joint at a (and at b when
// nothing else covers it). Two segments that share a point and a radius meet as one bent tube.
export function taper(a, b, ra, rb, { jointA = true, jointB = false, segs = 8 } = {}) {
  _a.set(...a);
  _b.set(...b);
  const len = _a.distanceTo(_b);
  const parts = [new THREE.CylinderGeometry(ra, rb, len, segs, 1, true).translate(0, -len / 2, 0)];
  if (jointA) parts.push(new THREE.SphereGeometry(ra, segs, 6));
  if (jointB) parts.push(new THREE.SphereGeometry(rb, segs, 6).translate(0, -len, 0));
  const g = merge(parts);
  _q.setFromUnitVectors(UP, _a.clone().sub(_b).normalize());
  g.applyQuaternion(_q);
  g.translate(_a.x, _a.y, _a.z);
  return g;
}
// The same, hanging straight down from the origin: what a jointed limb is built from.
export function hangingTaper(ra, rb, len, { jointB = false } = {}) {
  return taper([0, 0, 0], [0, -len, 0], ra, rb, { jointB });
}

export function shoe() {
  return new RoundedBoxGeometry(0.1, 0.07, 0.26, 2, 0.024);
}

