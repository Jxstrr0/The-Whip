// The body kit under every figure: a jacket with square shoulders, a waist and a hem; a head with a flat
// crown and a jaw rather than an egg; limbs that taper and meet at a round joint; mitts for hands; the seat
// of the trousers; rounded shoes. Shared by the instanced crowds (figures.js) and the jointed office figure
// (visitor.js), so one person looks the same in every room. RIG is the skeleton both are built on.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { merge } from './kit3d.js';

// The skeleton, in metres: joint heights above the hips (the body's origin), limb lengths, and the radius
// of each limb segment at its top and bottom.
export const RIG = {
  hip: 0.86, // standing hip height off the floor
  seat: 0.47, // seated hip height
  shoulder: 0.54, // the shoulder line above the hips
  neck: 0.65, // where the head pivots
  skull: 0.12, // the head's centre above its pivot
  shoulderX: 0.22,
  hipX: 0.095,
  upper: 0.27,
  fore: 0.26,
  thigh: 0.39,
  shin: 0.39,
  arm: [0.062, 0.052, 0.044], // shoulder, elbow, wrist
  leg: [0.08, 0.07, 0.06], // hip, knee, ankle
};

export const HEAD_R = 0.115;
// The head is taller than it is wide and a touch deeper than wide.
export const HEAD_SCALE = [1, 1.12, 1.02];
// How far the head and the seat are pushed from a sphere toward a box: 1 is a sphere, 0 a cube. Puts a
// flat crown, a jaw and cheeks on the head instead of an egg.
export const HEAD_SQUARE = 0.74;
const SEAT_SQUARE = 0.7;

// Move a sphere's points toward the corners of its bounding box: a superellipsoid, in place. `r` is the
// sphere's radius (the geometry is centred on the origin when this runs).
export function squircle(g, r, e) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const map = (v) => Math.sign(v) * Math.pow(Math.abs(v) / r, e) * r;
    p.setXYZ(i, map(p.getX(i)), map(p.getY(i)), map(p.getZ(i)));
  }
  g.computeVertexNormals();
  return g;
}

// The z of the head's front surface at (x, y) from the head's centre, pushed out by `out`: where eyes, a
// nose and glasses sit.
export function onHead(x, y, out = 0) {
  const [, HY, HZ] = HEAD_SCALE;
  const back = (v) => Math.sign(v) * Math.pow(Math.min(1, Math.abs(v)), 1 / HEAD_SQUARE);
  const a = back(x / HEAD_R);
  const b = back(y / (HEAD_R * HY));
  const c = Math.sqrt(Math.max(0, 1 - a * a - b * b));
  return HEAD_R * HZ * Math.pow(c, HEAD_SQUARE) + out;
}

// A sphere of radius r squared off like the head, before the head's own stretch.
export function headSphere(r, segsW = 14, segsH = 10, ...rest) {
  const g = new THREE.SphereGeometry(r, segsW, segsH, ...rest);
  squircle(g, r, HEAD_SQUARE);
  g.scale(...HEAD_SCALE);
  return g;
}

// The head on its neck, centred on the head's pivot: the skull RIG.skull above it, the neck reaching down
// into the collar.
export function headGeometry() {
  const skull = headSphere(HEAD_R).translate(0, RIG.skull, 0);
  const neck = new THREE.CapsuleGeometry(0.05, 0.1, 3, 8).translate(0, -0.04, 0.01);
  return merge([skull, neck]);
}

// The jacket, ring by ring from the collar down: height from the shoulder line, half-width, half-depth,
// and how far forward the ring's centre sits (the chest leads the waist a little). The shoulders are a
// shelf: full width within three centimetres of the collar, the way a padded jacket hangs.
const JACKET = [
  [0.072, 0.076, 0.07, 0.0],
  [0.058, 0.15, 0.1, 0.0],
  [0.034, 0.205, 0.124, 0.0],
  [-0.03, 0.208, 0.13, 0.004],
  [-0.16, 0.19, 0.13, 0.01],
  [-0.29, 0.172, 0.118, 0.008],
  [-0.4, 0.18, 0.122, 0.004],
  [-0.49, 0.182, 0.118, 0.0],
];
// The cross-section is a rounded rectangle, not an ellipse: cloth over a chest, not a barrel.
const SQUARE = 0.62;
const AROUND = 20;

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
export function pelvis(hipY) {
  const g = new THREE.SphereGeometry(1, 12, 7);
  squircle(g, 1, SEAT_SQUARE);
  g.scale(0.15, 0.072, 0.1);
  g.translate(0, hipY + 0.03, 0);
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

// One upper arm hanging from the shoulder; the forearm is the same geometry scaled by FOREARM_SCALE.
export function armGeometry() {
  return hangingTaper(RIG.arm[0], RIG.arm[1], RIG.upper);
}
export const FOREARM_SCALE = [RIG.arm[1] / RIG.arm[0], RIG.fore / RIG.upper, RIG.arm[1] / RIG.arm[0]];
// One thigh hanging from the hip; the shin is the same geometry scaled by SHIN_SCALE.
export function legGeometry() {
  return hangingTaper(RIG.leg[0], RIG.leg[1], RIG.thigh);
}
export const SHIN_SCALE = [RIG.leg[1] / RIG.leg[0], RIG.shin / RIG.thigh, RIG.leg[1] / RIG.leg[0]];

// A hand as a mitt hanging from the wrist: a flattened block, fingers together.
export function handGeometry() {
  return new RoundedBoxGeometry(0.064, 0.088, 0.036, 2, 0.014).translate(0, -0.038, 0.004);
}

// A shoe, hanging from the ankle and pointing forward.
export function shoeGeometry() {
  return new RoundedBoxGeometry(0.1, 0.07, 0.26, 2, 0.024).translate(0, -0.04, 0.06);
}
