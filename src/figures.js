// The shared figure kit: a stylised silhouette (square shoulders, a neck, a head with a jaw under a hair cap,
// a white collar, limbs that bend at the elbow and the knee) built once per body part and drawn as instanced
// crowds, so a full House costs eleven draw calls. Every figure in a crowd is jointed and alive: it breathes,
// glances, shifts its weight, folds its arms, stands to be counted, turns to whoever is on their feet, thumps
// the desk. Faces are earned (see faces.js): a stranger is a blank head. All of it is cosmetic: the sim never
// reads anything here, and the randomness is plain Math.random.
import * as THREE from 'three';
import { merge, figureMaterial } from './kit3d.js';
import { RIG, jacketGeometry, jacketFrontZ, shirtFront, pelvis, headGeometry, armGeometry, legGeometry, handGeometry, shoeGeometry, FOREARM_SCALE, SHIN_SCALE } from './body.js';
import { HEAD_R, HEAD_PARTS, BODY_PARTS, headGeometries, bodyGeometries, hairCap, partsFor, partColour, tieColour, growScale } from './faces.js';
import { NCH, IX, poseChannels, startFidget, endFidget, stepFidget, pickFidget, breathe, toChannels, wrapAngle } from './motion.js';
import { tuning } from './sim/config.js';

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

// Trousers a shade under the jacket, so the hem reads and the legs sit back.
export function trouserColour(suit) {
  tmp.set(suit).getHSL(hsl);
  tmp.setHSL(hsl.h, hsl.s, Math.max(0, hsl.l - 0.035));
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

function egg(r, x, y, z, sx = 1, sy = 1, sz = 1, segs = 12) {
  const g = new THREE.SphereGeometry(r, segs, Math.max(6, segs >> 1));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}
// A tie: the knot where the shirt's V closes and a blade that narrows toward it, lying on the chest.
export function tieParts(shoulderY) {
  const blade = new THREE.BoxGeometry(0.046, 0.21, 0.012);
  const p = blade.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > 0) p.setX(i, p.getX(i) * 0.7);
    p.setZ(i, p.getZ(i) + y * 0.06);
  }
  blade.translate(0, shoulderY - 0.235, jacketFrontZ(0, -0.235) + 0.004);
  const knot = new THREE.BoxGeometry(0.05, 0.045, 0.022);
  knot.translate(0, shoulderY - 0.108, jacketFrontZ(0, -0.108) + 0.004);
  return [knot, blade];
}
// The lapel pin: a small flattened disc on the left lapel.
export function pinPart(shoulderY) {
  return egg(0.017, 0.082, shoulderY - 0.075, jacketFrontZ(0.082, -0.075) + 0.004, 1, 1, 0.35, 8);
}

// One geometry per body part, each in the frame of the joint it hangs from: the trunk parts from the hips,
// the head from the neck, an arm or leg segment from its own joint. Parts that take a per-person colour
// (suit, trousers, skin, hair) are separate from the ones that don't (the shirt, the shoes).
export function figureParts() {
  const S = RIG.shoulder;
  return {
    jacket: jacketGeometry(S),
    pelvis: pelvis(0),
    shirt: shirtFront(S),
    tie: merge(tieParts(S)),
    pin: pinPart(S),
    head: headGeometry(),
    hair: hairCap(),
    arm: armGeometry(),
    hand: handGeometry(),
    leg: legGeometry(),
    shoe: shoeGeometry(),
    face: headGeometries(),
    body: bodyGeometries(S),
  };
}
// How many instances of a part each figure uses (two arms of two segments, two hands, and so on).
const PER = { arm: 4, hand: 2, leg: 4, shoe: 2 };

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const rnd = Math.random;

// An instanced crowd of n figures, all starting in one pose. Eleven draw calls however many people, plus one
// for each kind of face part someone in the crowd has earned.
export function createFigureCrowd(n, { pose = 'seated' } = {}) {
  const parts = figureParts();
  const mats = {
    jacket: figureMaterial({ roughness: 0.82 }),
    pelvis: figureMaterial({ roughness: 0.85 }),
    shirt: figureMaterial({ color: '#e9e3d8', roughness: 0.7 }),
    tie: figureMaterial({ roughness: 0.55 }),
    pin: figureMaterial({ roughness: 0.3, metalness: 0.6 }),
    head: figureMaterial({ roughness: 0.6 }),
    hair: figureMaterial({ roughness: 0.95 }),
    arm: figureMaterial({ roughness: 0.82 }),
    hand: figureMaterial({ roughness: 0.6 }),
    leg: figureMaterial({ roughness: 0.85 }),
    shoe: figureMaterial({ color: '#1d1a16', roughness: 0.8 }),
  };
  const meshes = {};
  for (const k of Object.keys(mats)) {
    meshes[k] = new THREE.InstancedMesh(parts[k], mats[k], n * (PER[k] || 1));
    meshes[k].frustumCulled = false;
    for (let i = 0; i < meshes[k].count; i++) meshes[k].setMatrixAt(i, ZERO);
  }
  // Face parts and keepsakes: one instanced mesh per kind, hidden while nobody in the crowd wears it.
  const fixed = { eyes: { color: '#1b1714', roughness: 0.35 }, earrings: { color: '#d4b25a', roughness: 0.3, metalness: 0.7 } };
  const faceMeshes = {};
  for (const k of [...HEAD_PARTS, ...BODY_PARTS]) {
    const geo = HEAD_PARTS.includes(k) ? parts.face[k] : parts.body.geos[k];
    const mat = figureMaterial({ roughness: 0.7, ...(fixed[k] || {}), ...(['round', 'square', 'halfMoons'].includes(k) ? { roughness: 0.4, metalness: 0.3 } : {}), side: k === 'beard' ? THREE.DoubleSide : THREE.FrontSide });
    faceMeshes[k] = new THREE.InstancedMesh(geo, mat, n);
    faceMeshes[k].frustumCulled = false;
    faceMeshes[k].visible = false;
    // Instances start at the identity matrix, which would draw an unworn part at the crowd's origin.
    for (let i = 0; i < n; i++) faceMeshes[k].setMatrixAt(i, ZERO);
  }
  const group = new THREE.Group();
  group.add(...Object.values(meshes), ...Object.values(faceMeshes));

  // Where each person is and what they wear.
  const base = Array.from({ length: n }, () => new THREE.Matrix4().makeScale(0, 0, 0));
  const bodyM = Array.from({ length: n }, () => new THREE.Matrix4());
  const shown = new Uint8Array(n);
  const facing = new Float32Array(n);
  const px = new Float32Array(n);
  const pz = new Float32Array(n);
  const hairStyle = new Float32Array(n).fill(1);
  const tieOn = new Uint8Array(n);
  const pinOn = new Uint8Array(n);
  // Earned face parts per person ([part, tier it arrives with]), and the grow-in when the tier rises.
  const worn = Array.from({ length: n }, () => []);
  const tierOf = new Int8Array(n).fill(-1);
  const growFrom = new Int8Array(n).fill(9);
  const growT = new Float32Array(n).fill(1);
  const growing = new Set();
  const anchors = parts.body.anchors;

  // How each person is moving: the pose they hold (blending toward `goal`), anything held over it (a sign
  // in one hand), the fidget under way or waiting its turn, and where their attention is.
  const cur = new Float32Array(n * NCH);
  const goal = new Array(n).fill(poseChannels(pose));
  const moving = new Uint8Array(n);
  const rate = new Float32Array(n).fill(4);
  const pool = new Array(n).fill(pose);
  const held = new Array(n).fill(null);
  const fidget = new Array(n).fill(null);
  const queued = new Array(n).fill(null);
  const idleT = new Float32Array(n);
  const phase = new Float32Array(n);
  const attOn = new Uint8Array(n);
  const attAt = new Float32Array(n);
  const attK = new Float32Array(n);
  const attYaw = new Float32Array(n);
  const attLean = new Float32Array(n);
  let time = 0;
  for (let i = 0; i < n; i++) {
    cur.set(goal[i], i * NCH);
    phase[i] = rnd() * Math.PI * 2;
    idleT[i] = nextIdle() * rnd();
  }
  function nextIdle() {
    return (tuning().look.fidgetEvery ?? 14) * (0.5 + rnd());
  }

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const color = new THREE.Color();
  const e = new THREE.Euler();
  const mH = new THREE.Matrix4();
  const mS = new THREE.Matrix4();
  const mE = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const out = new Float32Array(NCH);

  function hide(i) {
    for (const k of Object.keys(meshes)) for (let j = 0; j < (PER[k] || 1); j++) meshes[k].setMatrixAt(i * (PER[k] || 1) + j, ZERO);
    for (const [k] of worn[i]) faceMeshes[k].setMatrixAt(i, ZERO);
  }

  // Every matrix for one person from their channels: the trunk from the hips, the head from the neck, each
  // limb segment from the joint above it. Legs hang from the hips but don't lean with the trunk: a seated
  // person's thighs stay on the chair, a standing one's feet stay on the floor.
  function write(i, c) {
    const b = base[i];
    const body = bodyM[i];
    body.makeRotationFromEuler(e.set(c[IX.lean], c[IX.turn], c[IX.sway], 'YXZ')).setPosition(0, c[IX.bodyY], c[IX.bodyZ]).premultiply(b);
    meshes.jacket.setMatrixAt(i, body);
    meshes.pelvis.setMatrixAt(i, body);
    meshes.shirt.setMatrixAt(i, body);
    if (tieOn[i]) meshes.tie.setMatrixAt(i, body);
    if (pinOn[i]) meshes.pin.setMatrixAt(i, body);
    mH.makeRotationFromEuler(e.set(c[IX.headX], c[IX.headY], c[IX.headZ], 'YXZ')).setPosition(0, RIG.neck, 0).premultiply(body);
    meshes.head.setMatrixAt(i, mH);
    if (hairStyle[i] > 0) meshes.hair.setMatrixAt(i, m.makeScale(1, hairStyle[i], 1).setPosition(0, RIG.skull, 0).premultiply(mH));
    for (const [k, level] of worn[i]) {
      const g = level > growFrom[i] ? growScale(growT[i]) : 1;
      if (HEAD_PARTS.includes(k)) m.makeScale(g, g, g).setPosition(0, RIG.skull, 0).premultiply(mH);
      else {
        const [ax, ay, az] = anchors[k];
        m.makeScale(g, g, g).setPosition(ax, ay, az).premultiply(body);
      }
      faceMeshes[k].setMatrixAt(i, m);
    }
    for (let s = 0; s < 2; s++) {
      const sx = s ? 1 : -1;
      const a = s ? IX.aRx : IX.aLx;
      const el = s ? IX.eRx : IX.eLx;
      mS.makeRotationFromEuler(e.set(c[a], c[a + 1], c[a + 2], 'XYZ')).setPosition(sx * RIG.shoulderX, RIG.shoulder, 0).premultiply(body);
      meshes.arm.setMatrixAt(i * 4 + s * 2, mS);
      mE.makeRotationFromEuler(e.set(c[el], c[el + 1], 0, 'YXZ')).setPosition(0, -RIG.upper, 0).premultiply(mS);
      meshes.arm.setMatrixAt(i * 4 + s * 2 + 1, m.makeScale(...FOREARM_SCALE).premultiply(mE));
      meshes.hand.setMatrixAt(i * 2 + s, m.makeTranslation(0, -RIG.fore, 0).premultiply(mE));
      const hip = s ? IX.hipR : IX.hipL;
      const knee = s ? IX.kneeR : IX.kneeL;
      mS.makeRotationX(c[hip]).setPosition(sx * RIG.hipX, c[IX.bodyY], c[IX.bodyZ]).premultiply(b);
      meshes.leg.setMatrixAt(i * 4 + s * 2, mS);
      mE.makeRotationX(c[knee]).setPosition(0, -RIG.thigh, 0).premultiply(mS);
      meshes.leg.setMatrixAt(i * 4 + s * 2 + 1, m.makeScale(...SHIN_SCALE).premultiply(mE));
      meshes.shoe.setMatrixAt(i * 2 + s, m.makeTranslation(0, -RIG.shin, 0).premultiply(mE));
    }
  }

  // One frame of one person: the pose they're settling into, what they hold, breathing, the fidget, and the
  // turn of the head toward whatever has their attention.
  function animate(i, dt) {
    const o = i * NCH;
    if (moving[i]) {
      const k = Math.min(1, dt * rate[i]);
      let far = 0;
      for (let c = 0; c < NCH; c++) {
        cur[o + c] += (goal[i][c] - cur[o + c]) * k;
        far = Math.max(far, Math.abs(goal[i][c] - cur[o + c]));
      }
      if (far < 0.002) {
        cur.set(goal[i], o);
        moving[i] = 0;
      }
    }
    for (let c = 0; c < NCH; c++) out[c] = cur[o + c];
    if (held[i]) for (let c = 0; c < NCH; c++) out[c] += held[i][c];
    breathe(out, time, phase[i]);
    const q = queued[i];
    if (q && time >= q.at) {
      queued[i] = null;
      if (fidget[i]) endFidget(fidget[i]);
      else fidget[i] = startFidget(q.name, cur.subarray(o, o + NCH), q);
      if (fidget[i] && fidget[i].ending) queued[i] = { ...q, at: time + fidget[i].fall + 0.05 };
    }
    if (fidget[i]) {
      if (!stepFidget(fidget[i], dt, out)) {
        fidget[i] = null;
        idleT[i] = nextIdle();
      }
    } else if (!queued[i]) {
      idleT[i] -= dt;
      if (idleT[i] <= 0) {
        const name = pickFidget(pool[i]);
        if (name) fidget[i] = startFidget(name, cur.subarray(o, o + NCH));
        else idleT[i] = nextIdle();
      }
    }
    if (attOn[i] || attK[i] > 0) {
      if (time >= attAt[i]) attK[i] += ((attOn[i] ? 1 : 0) - attK[i]) * Math.min(1, dt * 3.5);
      if (!attOn[i] && attK[i] < 0.01) attK[i] = 0;
      out[IX.headY] += attYaw[i] * 0.72 * attK[i];
      out[IX.turn] += attYaw[i] * 0.28 * attK[i];
      out[IX.lean] += attLean[i] * attK[i];
    }
    write(i, out);
  }

  function flag() {
    for (const im of Object.values(meshes)) im.instanceMatrix.needsUpdate = true;
    for (const im of Object.values(faceMeshes)) if (im.visible) im.instanceMatrix.needsUpdate = true;
  }
  const each = (only, fn) => {
    if (only) for (const i of only) fn(i);
    else for (let i = 0; i < n; i++) if (shown[i]) fn(i);
  };
  function attend(i, point, lean) {
    if (!point) {
      attOn[i] = 0;
      return;
    }
    const [x, , z] = point;
    attYaw[i] = Math.max(-1.1, Math.min(1.1, wrapAngle(Math.atan2(x - px[i], z - pz[i]) - facing[i])));
    attLean[i] = lean;
    attOn[i] = 1;
  }

  return {
    group,
    meshes,
    parts,
    torsos: meshes.jacket,
    place(i, { x, y = 0, z, rotY = 0, scale = 1, lean = 0, yaw = 0 }) {
      pos.set(x, y, z);
      quat.setFromAxisAngle(UP, rotY + yaw);
      if (lean) quat.multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean));
      scl.set(scale, scale, scale);
      base[i].compose(pos, quat, scl);
      facing[i] = rotY + yaw;
      px[i] = x;
      pz[i] = z;
      shown[i] = 1;
      animate(i, 0);
    },
    // Colours and hair for one person. `look` comes from lookFor(id); `suit`, `tie` and `pin` from
    // wardrobe() (or a plain suit colour with no tie or pin, for staff and the gallery).
    // `face` is a faces.js faceFor()/faceOf() result (or null for a stranger); when its tier rises on a
    // figure already dressed, the new parts grow in.
    dress(i, { suit, skin, hair, hairStyle: style = 1, tie = null, pin = null, face = null }) {
      const look = { skin, hair, hairStyle: style };
      for (const [k] of worn[i]) faceMeshes[k].setMatrixAt(i, ZERO);
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
      meshes.jacket.setColorAt(i, color.set(suit));
      for (let j = 0; j < 4; j++) meshes.arm.setColorAt(i * 4 + j, color);
      meshes.pelvis.setColorAt(i, color.set(trouserColour(suit)));
      for (let j = 0; j < 4; j++) meshes.leg.setColorAt(i * 4 + j, color);
      meshes.head.setColorAt(i, color.set(skin));
      meshes.hand.setColorAt(i * 2, color);
      meshes.hand.setColorAt(i * 2 + 1, color);
      meshes.hair.setColorAt(i, color.set(hair));
      if (tie) meshes.tie.setColorAt(i, color.set(tie));
      if (pin) meshes.pin.setColorAt(i, color.set(pin));
      if (!tie) meshes.tie.setMatrixAt(i, ZERO);
      if (!pin) meshes.pin.setMatrixAt(i, ZERO);
      if (style <= 0) meshes.hair.setMatrixAt(i, ZERO);
      tieOn[i] = tie ? 1 : 0;
      pinOn[i] = pin ? 1 : 0;
      hairStyle[i] = style;
      if (shown[i]) animate(i, 0);
    },
    show(i, on) {
      shown[i] = on ? 1 : 0;
      if (on) animate(i, 0);
      else hide(i);
    },
    baseMatrix: (i) => base[i],
    // Where the trunk is this frame (the base matrix with the pose's hips, lean and breathing on it).
    bodyMatrix: (i) => bodyM[i],
    isShown: (i) => !!shown[i],
    // Settle into another pose over a moment; `rate` is how quickly (per second). The fidgets that follow
    // come from the new pose's pool.
    setPose(i, name, { rate: r = 4 } = {}) {
      goal[i] = poseChannels(name);
      rate[i] = r;
      moving[i] = 1;
      pool[i] = name;
    },
    // On your feet at your seat (to be counted, or to speak), and down again.
    rise(i, on) {
      const was = pool[i];
      this.setPose(i, on ? 'risen' : pose, { rate: on ? 3.5 : 3 });
      if (on) pool[i] = 'standing';
      if (on !== (was === 'standing')) this.fidget(i, on ? 'standUp' : 'sitDown', { delay: 0 });
    },
    // A fidget for one person now (or after `delay` seconds): any name from motion.js FIDGETS. A long one
    // already running (speaking, clapping) is let fall first.
    fidget(i, name, { delay = 0, hold = null } = {}) {
      queued[i] = { name, at: time + delay * rnd(), hold };
    },
    // Let a held fidget (speaking, clapping) fall away.
    calm(i) {
      queued[i] = null;
      if (fidget[i]) endFidget(fidget[i]);
    },
    // The same fidget across the crowd (or `only` these), each on their own beat so it reads as a room
    // reacting, not a drill; `chance` is the share who join in.
    react(name, { only = null, chance = 0.8, delay = 1, hold = null } = {}) {
      each(only, (i) => {
        if (rnd() < chance) this.fidget(i, name, { delay, hold });
      });
    },
    // Heads (and a little of the shoulders) turn toward a point in the room, staggered across the crowd;
    // null lets them drift back. `lean` tips the trunk toward it too (two people leaning in to talk).
    attention(point, { only = null, delay = 0.8, lean = 0 } = {}) {
      each(only, (i) => {
        attAt[i] = time + delay * rnd();
        attend(i, point, lean);
      });
    },
    // Channels held over the pose for as long as they're set (a placard in one hand); null lets go.
    hold(i, channels) {
      held[i] = channels ? toChannels(channels) : null;
    },
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
      meshes.jacket.computeBoundingSphere();
    },
    update(dt) {
      if (!group.visible) return;
      time += dt;
      for (const i of growing) {
        growT[i] = Math.min(1, growT[i] + dt / 0.7);
        if (growT[i] >= 1) growing.delete(i);
      }
      for (let i = 0; i < n; i++) if (shown[i]) animate(i, dt);
      flag();
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
