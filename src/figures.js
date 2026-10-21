// The shared figure kit: a stylised silhouette (shoulders, neck, an egg of a head under a hair cap, a white
// collar, a lap when seated) built once per body part and drawn as instanced crowds, so a full House costs a
// handful of draw calls. Faces are earned (see faces.js): a stranger is a blank egg. Expression lives in pose
// and in the UI's mood pill.
import * as THREE from 'three';
import { merge, figureMaterial } from './kit3d.js';
import { HEAD_R, HEAD_PARTS, BODY_PARTS, headGeometries, bodyGeometries, hairCap, partsFor, partColour, tieColour, growScale } from './faces.js';

export { HEAD_R };

export const SKIN_TONES = ['#f1c8a5', '#e0ac85', '#c68d63', '#a26b45', '#7c4f31', '#5b3a24', '#efd2b8', '#d6a07a'];
export const HAIR_COLOURS = ['#1a1412', '#2e1f16', '#4a3222', '#6b3a1f', '#8a8580', '#d9d4cc'];
// Hair caps as a vertical scale of one cap: full, receding, none (one in eight).
const HAIR_STYLES = [1, 1, 1, 1, 0.78, 0.78, 0.6, 0];

// Cosmetic only, so a cheap string hash is fine here (sim randomness never comes from this).
export function hashOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Everything about one figure that comes from who they are: stable across sessions, costs nothing.
export function lookFor(id) {
  const h = hashOf(id || 'x');
  return {
    skin: SKIN_TONES[h % SKIN_TONES.length],
    hair: HAIR_COLOURS[(h >>> 3) % HAIR_COLOURS.length],
    hairStyle: HAIR_STYLES[(h >>> 6) % HAIR_STYLES.length],
    height: 0.94 + ((h >>> 9) % 13) / 100, // 0.94–1.06
    yaw: (((h >>> 13) % 25) - 12) / 100, // ±0.12 rad: nobody sits perfectly square
    lean: 0.02 + ((h >>> 18) % 7) / 100,
  };
}

// The party colour with a little per-person variation, so a bench isn't one flat block.
const tmp = new THREE.Color();
const hsl = { h: 0, s: 0, l: 0 };
export function shade(color, id, amount = 0.06) {
  tmp.set(color).getHSL(hsl);
  const k = ((hashOf(id || 'x') >>> 21) % 101) / 100 - 0.5;
  tmp.setHSL(hsl.h, Math.max(0, Math.min(1, hsl.s - Math.abs(k) * 0.08)), Math.max(0, Math.min(1, hsl.l + k * 2 * amount)));
  return '#' + tmp.getHexString();
}

// What people wear. Up close (the caucus table, the office) suits are real suit colours and the party shows
// in the tie and the lapel pin; on the benches the suit keeps the party colour so the House reads from your
// seat, and the tie goes neutral. Every member wears the pin.
export const SUIT_COLOURS = ['#2b2d33', '#1f2a44', '#3a3d45', '#4a3a2e', '#15161a', '#2f3b36', '#55575e', '#3b2b3a'];
export const TIE_NEUTRALS = ['#1f2a44', '#6b1f2a', '#2b2d33', '#8a8f98', '#2f4a3a', '#4a3a2e'];
export function wardrobe(id, partyColor, { bench = false } = {}) {
  const h = hashOf(id || 'x');
  const neutral = TIE_NEUTRALS[(h >>> 7) % TIE_NEUTRALS.length];
  return {
    suit: bench ? shade(partyColor, id) : shade(SUIT_COLOURS[(h >>> 4) % SUIT_COLOURS.length], id, 0.04),
    // Two in three wear the party's tie at the table; on the benches the suit already says it.
    tie: !bench && (h >>> 10) % 3 ? shade(partyColor, id, 0.1) : neutral,
    pin: partyColor,
  };
}

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();

// A capsule between two points: arms, legs, the neck.
export function limb(a, b, r, segs = 8) {
  _a.set(...a);
  _b.set(...b);
  const len = _a.distanceTo(_b);
  const g = new THREE.CapsuleGeometry(r, len, 3, segs);
  _q.setFromUnitVectors(UP, _b.clone().sub(_a).normalize());
  g.applyQuaternion(_q);
  g.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
  return g;
}
function egg(r, x, y, z, sx = 1, sy = 1, sz = 1, segs = 12) {
  const g = new THREE.SphereGeometry(r, segs, Math.max(6, segs >> 1));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}
function block(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}
// A tie: the knot under the collar and a blade that narrows toward it.
export function tieParts(shoulderY) {
  const blade = new THREE.BoxGeometry(0.046, 0.2, 0.014);
  const p = blade.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * 0.7);
  blade.translate(0, shoulderY - 0.215, 0.138);
  return [block(0.05, 0.045, 0.022, 0, shoulderY - 0.1, 0.134), blade];
}
// The lapel pin: a small flattened disc on the left lapel.
export function pinPart(shoulderY) {
  return egg(0.017, 0.082, shoulderY - 0.075, 0.121, 1, 1, 0.35, 8);
}

// Proportions in metres, facing +z, origin on the floor between the feet.
// arms: shoulder, elbow, hand. legs: hip, knee, ankle. Both mirrored in x.
export const POSES = {
  seated: {
    hip: 0.47,
    shoulderY: 1.02,
    headY: 1.25,
    arms: [[0.22, 1.0, 0.0], [0.25, 0.77, 0.1], [0.13, 0.6, 0.3]],
    legs: [[0.1, 0.5, 0.0], [0.1, 0.5, 0.36], [0.1, 0.08, 0.34]],
    lap: true,
  },
  standing: {
    hip: 0.86,
    shoulderY: 1.4,
    headY: 1.63,
    arms: [[0.22, 1.38, 0.0], [0.25, 1.1, 0.03], [0.26, 0.85, 0.08]],
    legs: [[0.1, 0.86, 0.0], [0.1, 0.47, 0.02], [0.1, 0.08, 0.0]],
    lap: false,
  },
};

// One geometry per body part. Parts that take a per-person colour (suit, skin, hair) are separate from the
// ones that don't (the white collar, the dark shoes), so instance colours stay simple.
export function figureParts(pose = 'seated') {
  const P = POSES[pose];
  const suit = [];
  const hands = [];
  const head = [];
  const hair = [];
  const shirt = [];
  const dark = [];
  const tie = tieParts(P.shoulderY);
  const pin = [pinPart(P.shoulderY)];
  const torsoH = P.shoulderY - P.hip + 0.1;
  suit.push(egg(1, 0, P.hip + torsoH * 0.48, 0, 0.2, torsoH / 2, 0.14, 14));
  suit.push(limb([-0.19, P.shoulderY, 0], [0.19, P.shoulderY, 0], 0.085, 10));
  for (const s of [-1, 1]) {
    const [sh, el, ha] = P.arms.map(([x, y, z]) => [x * s, y, z]);
    suit.push(limb(sh, el, 0.058));
    suit.push(limb(el, ha, 0.05));
    hands.push(egg(0.045, ...ha, 1, 0.8, 1.2, 8));
    const [hp, kn, an] = P.legs.map(([x, y, z]) => [x * s, y, z]);
    if (!P.lap) suit.push(limb(hp, kn, 0.08));
    suit.push(limb(kn, an, 0.065));
    dark.push(block(0.11, 0.07, 0.25, an[0], 0.035, an[2] + 0.05));
  }
  if (P.lap) suit.push(block(0.36, 0.13, 0.42, 0, P.hip + 0.03, 0.17));
  hands.push(limb([0, P.shoulderY - 0.02, 0.01], [0, P.headY - 0.09, 0.01], 0.05, 8));
  head.push(egg(HEAD_R, 0, P.headY, 0, 1, 1.12, 1.02, 14));
  hair.push(hairCap().translate(0, P.headY, 0));
  shirt.push(block(0.12, 0.09, 0.02, 0, P.shoulderY - 0.05, 0.133));
  const face = headGeometries();
  for (const g of Object.values(face)) g.translate(0, P.headY, 0);
  const body = bodyGeometries(P.shoulderY);
  return { suit: merge(suit), hands: merge(hands), head: merge(head), hair: merge(hair), shirt: merge(shirt), dark: merge(dark), tie: merge(tie), pin: merge(pin), face, body, pose: P };
}

// An instanced crowd of n figures in one pose. Eight draw calls however many people, plus one for each kind
// of face part someone in the crowd has earned.
export function createFigureCrowd(n, { pose = 'seated' } = {}) {
  const parts = figureParts(pose);
  const P = parts.pose;
  const mats = {
    suit: figureMaterial({ roughness: 0.82 }),
    hands: figureMaterial({ roughness: 0.6 }),
    head: figureMaterial({ roughness: 0.6 }),
    hair: figureMaterial({ roughness: 0.95 }),
    shirt: figureMaterial({ color: '#e9e3d8', roughness: 0.7 }),
    dark: figureMaterial({ color: '#1d1a16', roughness: 0.8 }),
    tie: figureMaterial({ roughness: 0.55 }),
    pin: figureMaterial({ roughness: 0.3, metalness: 0.6 }),
  };
  const meshes = {};
  for (const k of Object.keys(mats)) {
    meshes[k] = new THREE.InstancedMesh(parts[k], mats[k], n);
    meshes[k].frustumCulled = false;
  }
  // Face parts and keepsakes: one instanced mesh per kind, hidden while nobody in the crowd wears it.
  const fixed = { eyes: { color: '#1b1714', roughness: 0.35 }, earrings: { color: '#d4b25a', roughness: 0.3, metalness: 0.7 } };
  const faceMeshes = {};
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const k of [...HEAD_PARTS, ...BODY_PARTS]) {
    const geo = HEAD_PARTS.includes(k) ? parts.face[k] : parts.body.geos[k];
    const mat = figureMaterial({ roughness: 0.7, ...(fixed[k] || {}), ...(['round', 'square', 'halfMoons'].includes(k) ? { roughness: 0.4, metalness: 0.3 } : {}), side: k === 'beard' ? THREE.DoubleSide : THREE.FrontSide });
    faceMeshes[k] = new THREE.InstancedMesh(geo, mat, n);
    faceMeshes[k].frustumCulled = false;
    faceMeshes[k].visible = false;
    // Instances start at the identity matrix, which would draw an unworn part at the crowd's origin.
    for (let i = 0; i < n; i++) faceMeshes[k].setMatrixAt(i, hidden);
  }
  const group = new THREE.Group();
  group.add(...Object.values(meshes), ...Object.values(faceMeshes));

  const base = Array.from({ length: n }, () => new THREE.Matrix4().makeScale(0, 0, 0));
  const shown = new Array(n).fill(false);
  const hairStyle = new Float32Array(n).fill(1);
  // Ties and pins only on people dressed with one (members, not clerks or the gallery).
  const tieOn = new Uint8Array(n);
  const pinOn = new Uint8Array(n);
  const headYaw = new Float32Array(n);
  // Earned face parts per person ([part, tier it arrives with]), and the grow-in when the tier rises.
  const worn = Array.from({ length: n }, () => []);
  const tierOf = new Int8Array(n).fill(-1);
  const growFrom = new Int8Array(n).fill(9);
  const growT = new Float32Array(n).fill(1);
  const growing = new Set();
  const anchors = parts.body.anchors;
  const m = new THREE.Matrix4();
  const m2 = new THREE.Matrix4();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const color = new THREE.Color();
  const neckY = P.headY - 0.12;

  function write(i) {
    if (!shown[i]) {
      for (const k of Object.keys(meshes)) meshes[k].setMatrixAt(i, zero);
      for (const [k] of worn[i]) faceMeshes[k].setMatrixAt(i, zero);
      return;
    }
    const b = base[i];
    meshes.suit.setMatrixAt(i, b);
    meshes.hands.setMatrixAt(i, b);
    meshes.shirt.setMatrixAt(i, b);
    meshes.dark.setMatrixAt(i, b);
    meshes.tie.setMatrixAt(i, tieOn[i] ? b : zero);
    meshes.pin.setMatrixAt(i, pinOn[i] ? b : zero);
    // The head turns about the neck; the hair rides on the head and squashes for its style.
    m.makeTranslation(0, neckY, 0).multiply(m2.makeRotationY(headYaw[i])).multiply(new THREE.Matrix4().makeTranslation(0, -neckY, 0));
    m.premultiply(b);
    meshes.head.setMatrixAt(i, m);
    if (hairStyle[i] <= 0) meshes.hair.setMatrixAt(i, zero);
    else {
      m2.makeTranslation(0, P.headY, 0).multiply(new THREE.Matrix4().makeScale(1, hairStyle[i], 1)).multiply(new THREE.Matrix4().makeTranslation(0, -P.headY, 0));
      meshes.hair.setMatrixAt(i, m.clone().multiply(m2));
    }
    // Face parts ride on the head; keepsakes sit on the jacket. New ones grow out of the head (or the lapel).
    for (const [k, level] of worn[i]) {
      const g = level > growFrom[i] ? growScale(growT[i]) : 1;
      if (HEAD_PARTS.includes(k)) {
        m2.makeTranslation(0, P.headY, 0).multiply(new THREE.Matrix4().makeScale(g, g, g)).multiply(new THREE.Matrix4().makeTranslation(0, -P.headY, 0));
      } else {
        const [ax, ay, az] = anchors[k];
        m2.makeTranslation(ax, ay, az).multiply(new THREE.Matrix4().makeScale(g, g, g));
      }
      faceMeshes[k].setMatrixAt(i, (HEAD_PARTS.includes(k) ? m : b).clone().multiply(m2));
    }
  }

  // Idle life: now and then one person turns their head toward a neighbour and back.
  let idle = null;
  let nextIdle = 1.5;
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  return {
    group,
    meshes,
    parts,
    torsos: meshes.suit,
    place(i, { x, y = 0, z, rotY = 0, scale = 1, lean = 0, yaw = 0 }) {
      pos.set(x, y, z);
      quat.setFromAxisAngle(UP, rotY + yaw);
      if (lean) quat.multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean));
      scl.set(scale, scale, scale);
      base[i].compose(pos, quat, scl);
      shown[i] = true;
      write(i);
    },
    // Colours and hair for one person. `look` comes from lookFor(id); `suit`, `tie` and `pin` from
    // wardrobe() (or a plain suit colour with no tie or pin, for staff and the gallery).
    // `face` is a faces.js faceFor()/faceOf() result (or null for a stranger); when its tier rises on a
    // figure already dressed, the new parts grow in.
    dress(i, { suit, skin, hair, hairStyle: style = 1, tie = null, pin = null, face = null }) {
      const look = { skin, hair, hairStyle: style };
      for (const [k] of worn[i]) faceMeshes[k].setMatrixAt(i, zero);
      worn[i] = partsFor(face);
      const tier = face?.tier || 0;
      if (tierOf[i] >= 0 && tier > tierOf[i]) {
        growFrom[i] = tierOf[i];
        growT[i] = 0;
        growing.add(i);
      } else if (tier !== tierOf[i]) {
        growFrom[i] = 9;
        growT[i] = 1;
        growing.delete(i);
      }
      tierOf[i] = tier;
      for (const [k] of worn[i]) {
        const c = partColour(k, face, look);
        if (c) faceMeshes[k].setColorAt(i, color.set(c));
      }
      tie = tie && tieColour(face, tie);
      if (face?.tier >= 3 && face.signature === 'bowtie') tie = null;
      meshes.suit.setColorAt(i, color.set(suit));
      meshes.hands.setColorAt(i, color.set(skin));
      meshes.head.setColorAt(i, color.set(skin));
      meshes.hair.setColorAt(i, color.set(hair));
      if (tie) meshes.tie.setColorAt(i, color.set(tie));
      if (pin) meshes.pin.setColorAt(i, color.set(pin));
      tieOn[i] = tie ? 1 : 0;
      pinOn[i] = pin ? 1 : 0;
      hairStyle[i] = style;
      write(i);
    },
    show(i, on) {
      shown[i] = on;
      write(i);
    },
    baseMatrix: (i) => base[i],
    isShown: (i) => shown[i],
    commit() {
      for (const im of Object.values(meshes)) {
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      const used = new Set();
      for (let i = 0; i < n; i++) if (shown[i]) for (const [k] of worn[i]) used.add(k);
      for (const [k, im] of Object.entries(faceMeshes)) {
        im.visible = used.has(k);
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      meshes.suit.computeBoundingSphere();
    },
    update(dt) {
      if (growing.size) {
        for (const i of growing) {
          growT[i] = Math.min(1, growT[i] + dt / 0.7);
          write(i);
          if (growT[i] >= 1) growing.delete(i);
        }
        for (const im of Object.values(faceMeshes)) im.instanceMatrix.needsUpdate = true;
      }
      if (idle) {
        idle.t += dt;
        const { i, dir } = idle;
        const T = idle.t;
        // Turn over 0.5 s, hold 0.9 s, turn back over 0.5 s.
        const k = T < 0.5 ? T / 0.5 : T < 1.4 ? 1 : T < 1.9 ? 1 - (T - 1.4) / 0.5 : 0;
        headYaw[i] = dir * 0.38 * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, k)));
        write(i);
        meshes.head.instanceMatrix.needsUpdate = true;
        meshes.hair.instanceMatrix.needsUpdate = true;
        for (const [k] of worn[i]) faceMeshes[k].instanceMatrix.needsUpdate = true;
        if (T >= 1.9) {
          headYaw[i] = 0;
          write(i);
          idle = null;
        }
        return;
      }
      nextIdle -= dt;
      if (nextIdle > 0) return;
      nextIdle = 1.2 + Math.random() * 1.6;
      const candidates = [];
      for (let i = 0; i < n; i++) if (shown[i]) candidates.push(i);
      if (!candidates.length) return;
      idle = { i: candidates[Math.floor(Math.random() * candidates.length)], dir: Math.random() < 0.5 ? -1 : 1, t: 0 };
    },
    dispose() {
      for (const im of [...Object.values(meshes), ...Object.values(faceMeshes)]) {
        im.geometry.dispose();
        im.material.dispose();
        im.dispose();
      }
    },
  };
}
