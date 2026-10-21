// The shared figure kit: a stylised silhouette (a turned jacket with sloped shoulders, a neck, an egg of a
// head under a hair cap, a V of shirt and a tie, trousers) built once per body part and drawn as instanced crowds, so a full House
// costs eight draw calls. Expression lives in pose, in the brows of a painted face, and in the UI's mood pill. What the parts are
// made of (worsted, hair, skin, silk) is painted by figureTextures.js and worn through partMaterial().
import * as THREE from 'three';
import { merge, figureMaterial, worldUVs } from './kit3d.js';
import { figureTextures, faceTexture } from './figureTextures.js';

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
// seat, and the tie goes neutral. Every member wears the pin. The cloth (plain, pinstripe, chalk stripe) and
// the tie's pattern (solid or rep stripes) are worn by the articulated figures, who are seen close enough for
// them to read; the instanced crowds share one plain weave and one silk.
export const WEAVES = ['plain', 'plain', 'plain', 'plain', 'pinstripe', 'pinstripe', 'pinstripe', 'chalk'];
export const SUIT_COLOURS = ['#2b2d33', '#1f2a44', '#3a3d45', '#4a3a2e', '#15161a', '#2f3b36', '#55575e', '#3b2b3a'];
export const SHIRT_WHITE = '#e9e3d8';
// What shows at the neck of someone not in a suit and tie: a sweater, a polo, an open collar.
export const CASUAL_NECKS = ['#d8d0c0', '#9fb0c7', '#c9b8a0', '#8a9a8a', '#b4a7c7', '#e9e3d8', '#c77f6a', '#6f7f99'];
export const TIE_NEUTRALS = ['#1f2a44', '#6b1f2a', '#2b2d33', '#8a8f98', '#2f4a3a', '#4a3a2e'];
export function wardrobe(id, partyColor, { bench = false } = {}) {
  const h = hashOf(id || 'x');
  const neutral = TIE_NEUTRALS[(h >>> 7) % TIE_NEUTRALS.length];
  return {
    suit: bench ? shade(partyColor, id) : shade(SUIT_COLOURS[(h >>> 4) % SUIT_COLOURS.length], id, 0.04),
    // Two in three wear the party's tie at the table; on the benches the suit already says it.
    tie: !bench && (h >>> 10) % 3 ? shade(partyColor, id, 0.1) : neutral,
    pin: partyColor,
    weave: WEAVES[(h >>> 12) % WEAVES.length],
    tieStyle: (h >>> 15) % 2 ? 'rep' : 'solid',
  };
}

// UVs in metres, so one tile reads at the same size on every part (the rooms do the same with worldUVs).
export function metricUV(geo, uMetres, vMetres) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uMetres, uv.getY(i) * vMetres);
  return geo;
}
// A capsule along y at the origin, with v following the arc length of the profile (three's own capsule UVs
// give the shaft one step of v however long it is, which stretches any weave along a sleeve).
export function capsule(r, len, segs = 8) {
  const g = new THREE.CapsuleGeometry(r, len, 3, segs);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const quarter = (Math.PI / 2) * r;
  const total = quarter * 2 + len;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const rho = Math.hypot(pos.getX(i), pos.getZ(i));
    let s;
    if (y <= -len / 2) s = r * Math.atan2(rho, -len / 2 - y);
    else if (y >= len / 2) s = quarter + len + r * Math.atan2(y - len / 2, rho);
    else s = quarter + (y + len / 2);
    uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, s);
  }
  return g;
}

// Materials for the parts of a figure, with their cloth, hair, grain and silk. Crowds leave `color` unset
// (instance colours carry it); the articulated figure sets one per part. `weave` and `tieStyle` come from
// wardrobe(); crowds take the defaults.
export function partMaterial(part, { color = null, weave = 'plain', tieStyle = 'solid', mood = 'neutral' } = {}) {
  const T = figureTextures();
  const opts = color ? { color } : {};
  const n = (scale) => new THREE.Vector2(scale, scale);
  switch (part) {
    case 'suit':
      return figureMaterial({ ...opts, roughness: 0.84, map: weave === 'pinstripe' ? T.pinstripe : weave === 'chalk' ? T.chalk : T.cloth, normalMap: T.clothN, normalScale: n(0.55) });
    case 'hands':
    case 'skin':
      return figureMaterial({ ...opts, roughness: 0.62, normalMap: T.grainN, normalScale: n(0.3) });
    case 'head':
      return figureMaterial({ ...opts, roughness: 0.62, map: faceTexture(mood), normalMap: T.grainN, normalScale: n(0.3) });
    case 'hair':
      return figureMaterial({ ...opts, roughness: 0.78, map: T.hair, normalMap: T.hairN, normalScale: n(0.9) });
    case 'shirt':
      return figureMaterial({ color: color || '#e9e3d8', roughness: 0.7, normalMap: T.clothN, normalScale: n(0.3) });
    case 'dark':
      return figureMaterial({ color: color || '#1d1a16', roughness: 0.42, normalMap: T.grainN, normalScale: n(0.35) });
    case 'tie':
      return figureMaterial({ ...opts, roughness: 0.4, map: tieStyle === 'rep' ? T.rep : null, normalMap: T.silkN, normalScale: n(0.25) });
    case 'pin':
      return figureMaterial({ ...opts, roughness: 0.3, metalness: 0.6 });
    default:
      return figureMaterial(opts);
  }
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
  const g = capsule(r, len, segs);
  _q.setFromUnitVectors(UP, _b.clone().sub(_a).normalize());
  g.applyQuaternion(_q);
  g.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2);
  return g;
}
// An ellipsoid, with UVs in metres around and over it.
export function egg(r, x, y, z, sx = 1, sy = 1, sz = 1, segs = 12) {
  const g = new THREE.SphereGeometry(r, segs, Math.max(6, segs >> 1));
  g.scale(sx, sy, sz);
  metricUV(g, Math.PI * 2 * r * ((sx + sz) / 2), Math.PI * r * sy);
  g.translate(x, y, z);
  return g;
}
function block(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return worldUVs(g);
}
// The jacket: one turned silhouette from the hem to the collar (sloped shoulders, a chest, a waist, a hem
// over the hips), elliptical in section. Half-widths at heights; the chest and shoulders are set from the
// shoulder line and the hem and waist from the hips, so the seated and standing jackets share a cut.
const JACKET_DEPTH = 0.62;
function jacketProfile(hip, shoulder) {
  return [
    [0, hip - 0.045],
    [0.16, hip - 0.04],
    [0.17, hip + 0.04],
    [0.155, hip + 0.2],
    [0.185, shoulder - 0.15],
    [0.215, shoulder - 0.05],
    [0.235, shoulder - 0.005],
    [0.195, shoulder + 0.05],
    [0.1, shoulder + 0.085],
    [0, shoulder + 0.09],
  ];
}
// The jacket's half-width at a height, from the profile.
function jacketR(y, hip, shoulder) {
  const pts = jacketProfile(hip, shoulder);
  for (let i = 1; i < pts.length; i++) {
    const [r0, y0] = pts[i - 1];
    const [r1, y1] = pts[i];
    if (y <= y1) return y1 === y0 ? r1 : r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}
// How far forward the jacket's front is at a height and an offset across the chest.
export function jacketFront(y, shoulder, x = 0, hip = shoulder - 0.54) {
  const r = jacketR(y, hip, shoulder);
  return JACKET_DEPTH * Math.sqrt(Math.max(0, r * r - x * x));
}
export function jacket(hip, shoulder) {
  const g = new THREE.LatheGeometry(jacketProfile(hip, shoulder).map(([r, y]) => new THREE.Vector2(r, y)), 18);
  g.scale(1, 1, JACKET_DEPTH);
  // Lathe UVs count points, not metres: u once round the chest, v up from the hem.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, uv.getX(i) * 1.0, pos.getY(i) - (hip - 0.045));
  return g;
}
// The shirt: a V of white between the lapels, from the collar to behind the tie's knot. The chest is
// convex, so the V is a small grid with every vertex lying on the jacket, a few millimetres proud of it.
export function shirtFront(shoulder) {
  const top = shoulder + 0.035;
  const bottom = shoulder - 0.19;
  const w = 0.062;
  const rows = 6;
  const cols = 4;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const y = top - t * (top - bottom);
    const half = w * (1 - t);
    for (let i = 0; i <= cols; i++) {
      const x = -half + (2 * half * i) / cols;
      pos.push(x, y, jacketFront(y, shoulder, x) + 0.004);
      uv.push(x, y);
      if (i < cols && j < rows) {
        const a = j * (cols + 1) + i;
        const b = a + cols + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// A tie: the knot under the collar and a blade that narrows toward it, lying along the chest.
export function tieParts(shoulderY) {
  const blade = new THREE.BoxGeometry(0.046, 0.2, 0.012);
  const p = blade.attributes.position;
  const mid = shoulderY - 0.215;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) p.setX(i, p.getX(i) * 0.7);
    p.setZ(i, jacketFront(mid + p.getY(i), shoulderY, p.getX(i)) + 0.004 + (p.getZ(i) > 0 ? 0.012 : 0));
  }
  blade.translate(0, mid, 0);
  const knot = block(0.05, 0.045, 0.022, 0, shoulderY - 0.1, 0);
  knot.translate(0, 0, jacketFront(shoulderY - 0.1, shoulderY) + 0.012);
  return [knot, worldUVs(blade)];
}
// The lapel pin: a small flattened disc on the left lapel.
export function pinPart(shoulderY) {
  return egg(0.017, 0.082, shoulderY - 0.075, jacketFront(shoulderY - 0.075, shoulderY, 0.082) + 0.004, 1, 1, 0.35, 8);
}

// Proportions in metres, facing +z, origin on the floor between the feet.
// arms: shoulder, elbow, hand. legs: hip, knee, ankle. Both mirrored in x.
export const POSES = {
  seated: {
    hip: 0.47,
    shoulderY: 1.02,
    headY: 1.25,
    arms: [[0.21, 0.98, 0.0], [0.25, 0.75, 0.1], [0.13, 0.58, 0.3]],
    legs: [[0.1, 0.5, 0.0], [0.1, 0.5, 0.36], [0.1, 0.08, 0.34]],
    lap: true,
  },
  standing: {
    hip: 0.86,
    shoulderY: 1.4,
    headY: 1.63,
    arms: [[0.21, 1.36, 0.0], [0.25, 1.08, 0.03], [0.26, 0.83, 0.08]],
    legs: [[0.1, 0.86, 0.0], [0.1, 0.47, 0.02], [0.1, 0.08, 0.0]],
    lap: false,
  },
};
export const HEAD_R = 0.115;

// The hair cap: a shell a little larger than the head, its lower edge rising to a hairline above the brows
// at the front and dropping to the nape at the back, standing proud of the skull so the two never fight.
// Strands run down from the crown (v is the arc from the crown). CAP_TOP is the crown's height above the
// head's centre: hair styles squash the cap about the crown, so a receding cap keeps its top and loses its
// hairline, rather than shrinking all over.
export const CAP_TOP = 0.145;
export function hairCap(headY) {
  const R = HEAD_R + 0.012;
  const W = 16;
  const H = 8;
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= H; j++) {
    for (let i = 0; i <= W; i++) {
      const phi = (i / W) * Math.PI * 2;
      // Front (+z) is phi = π/2: the shortest edge there, the longest at the back.
      const thetaMax = Math.PI * (0.52 - 0.15 * Math.sin(phi));
      const theta = (j / H) * thetaMax;
      const x = -Math.cos(phi) * Math.sin(theta);
      const y = Math.cos(theta);
      const z = Math.sin(phi) * Math.sin(theta);
      pos.push(x * R, y * R * 1.1 + 0.005, z * R * 1.02 - 0.004);
      nor.push(x, y, z);
      uv.push(phi * R, theta * R * 1.1);
      if (i < W && j < H) {
        const a = j * (W + 1) + i;
        const b = a + W + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.translate(0, headY, 0);
  return g;
}

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
  suit.push(jacket(P.hip, P.shoulderY));
  for (const s of [-1, 1]) {
    const [sh, el, ha] = P.arms.map(([x, y, z]) => [x * s, y, z]);
    suit.push(limb(sh, el, 0.064));
    suit.push(limb(el, ha, 0.056));
    hands.push(egg(0.05, ...ha, 0.75, 1.3, 1, 8));
    const [hp, kn, an] = P.legs.map(([x, y, z]) => [x * s, y, z]);
    suit.push(limb(hp, kn, 0.085));
    suit.push(limb(kn, an, 0.07));
    dark.push(block(0.11, 0.07, 0.25, an[0], 0.035, an[2] + 0.05));
  }
  hands.push(limb([0, P.shoulderY - 0.02, 0.01], [0, P.headY - 0.09, 0.01], 0.052, 8));
  head.push(egg(HEAD_R, 0, P.headY, 0, 1, 1.12, 1.02, 14));
  hair.push(hairCap(P.headY));
  shirt.push(shirtFront(P.shoulderY));
  return { suit: merge(suit), hands: merge(hands), head: merge(head), hair: merge(hair), shirt: merge(shirt), dark: merge(dark), tie: merge(tie), pin: merge(pin), pose: P };
}

// An instanced crowd of n figures in one pose. Six draw calls however many people.
export function createFigureCrowd(n, { pose = 'seated' } = {}) {
  const parts = figureParts(pose);
  const P = parts.pose;
  const mats = {};
  for (const k of ['suit', 'hands', 'head', 'hair', 'shirt', 'dark', 'tie', 'pin']) mats[k] = partMaterial(k, k === 'shirt' ? { color: '#ffffff' } : {});
  const meshes = {};
  for (const k of Object.keys(mats)) {
    meshes[k] = new THREE.InstancedMesh(parts[k], mats[k], n);
    meshes[k].frustumCulled = false;
  }
  const group = new THREE.Group();
  group.add(...Object.values(meshes));

  const base = Array.from({ length: n }, () => new THREE.Matrix4().makeScale(0, 0, 0));
  const shown = new Array(n).fill(false);
  const hairStyle = new Float32Array(n).fill(1);
  // Ties and pins only on people dressed with one (members, not clerks or the gallery).
  const tieOn = new Uint8Array(n);
  const pinOn = new Uint8Array(n);
  const headYaw = new Float32Array(n);
  const m = new THREE.Matrix4();
  const m2 = new THREE.Matrix4();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const color = new THREE.Color();
  const neckY = P.headY - 0.12;

  function write(i) {
    if (!shown[i]) {
      for (const k of Object.keys(meshes)) meshes[k].setMatrixAt(i, zero);
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
      const crown = P.headY + CAP_TOP;
      m2.makeTranslation(0, crown, 0).multiply(new THREE.Matrix4().makeScale(1, hairStyle[i], 1)).multiply(new THREE.Matrix4().makeTranslation(0, -crown, 0));
      meshes.hair.setMatrixAt(i, m.clone().multiply(m2));
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
    // wardrobe() (or a plain suit colour with no tie or pin, for staff and the gallery). The shirt is
    // white unless told otherwise (a town hall crowd wears sweaters and open collars).
    dress(i, { suit, skin, hair, hairStyle: style = 1, tie = null, pin = null, shirt = SHIRT_WHITE }) {
      meshes.suit.setColorAt(i, color.set(suit));
      meshes.shirt.setColorAt(i, color.set(shirt));
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
      meshes.suit.computeBoundingSphere();
    },
    update(dt) {
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
      for (const k of Object.keys(meshes)) {
        meshes[k].geometry.dispose();
        meshes[k].material.dispose();
        meshes[k].dispose();
      }
    },
  };
}
