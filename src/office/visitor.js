// The articulated figure for the office and the riding: the crowds' body on real pivots (neck, shoulders,
// elbows, hips, knees), moved by the same channels and fidgets as the crowds (motion.js), so it can walk in,
// sit, hold a pose that says how the meeting is going, and never quite sit still.
import * as THREE from 'three';
import { blobMaterial, figureMaterial, vertexMaterial, merge, paint } from '../kit3d.js';
import { lookFor, shade, trouserColour, tieParts, pinPart } from '../figures.js';
import { RIG, jacketGeometry, shirtFront, pelvis, headGeometry, armGeometry, legGeometry, handGeometry, shoeGeometry, FOREARM_SCALE, SHIN_SCALE } from '../body.js';
import { headGeometries, bodyGeometries, hairCap, partsFor, partColour, tieColour, growScale, HEAD_PARTS } from '../faces.js';
import { NCH, IX, POSES, poseChannels, startFidget, endFidget, stepFidget, pickFidget, breathe, stride as strideChannels, addChannels, wrapAngle } from '../motion.js';
import { tuning } from '../sim/config.js';

// `outfit` is a wardrobe() result: its suit replaces `color`, and its tie and pin are worn; without one the
// figure is a plain suit (the player seen from behind, a constituent). `face` is a faces.js result: how much
// of a face the player has earned on them (none for a stranger); setFace() changes it later, growing new parts.
const SHIRT = '#e9e3d8';
const DARK = '#1d1a16';

export function createFigure(color, mpId = 'x', outfit = null, face = null) {
  const look = lookFor(mpId);
  const suit = outfit?.suit || shade(color, mpId);
  const trousers = trouserColour(suit);
  // Every moving part is one mesh with its colours painted into the vertices (jacket, shirt and pin as one
  // body; sleeve and hand as one forearm), so a figure costs a dozen draw calls rather than twenty.
  const mat = vertexMaterial({ roughness: 0.78 });
  const mats = { body: mat };
  const part = (pieces) => new THREE.Mesh(merge(pieces.map(([geo, colour]) => paint(geo, colour))), mat);
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = RIG.hip;
  body.rotation.order = 'YXZ';

  const torsoPieces = [[jacketGeometry(RIG.shoulder), suit], [pelvis(0), trousers], [shirtFront(RIG.shoulder), SHIRT]];
  if (outfit?.pin) torsoPieces.push([pinPart(RIG.shoulder), outfit.pin]);
  const torso = part(torsoPieces);
  // The head (with its neck) turns and nods about the top of the collar; the hair sits on the skull.
  const head = new THREE.Group();
  head.position.set(0, RIG.neck, 0);
  head.rotation.order = 'YXZ';
  const headPieces = [[headGeometry(), look.skin]];
  if (look.hairStyle > 0) headPieces.push([hairCap().scale(1, look.hairStyle, 1).translate(0, RIG.skull, 0), look.hair]);
  head.add(part(headPieces));
  body.add(torso, head);
  // The tie stays its own mesh: it changes colour with the face tiers and goes when a bow tie is earned.
  let tieMesh = null;
  if (outfit?.tie) {
    mats.tie = figureMaterial({ color: outfit.tie, roughness: 0.55 });
    tieMesh = new THREE.Mesh(merge(tieParts(RIG.shoulder)), mats.tie);
    body.add(tieMesh);
  }

  // One geometry each for an upper arm, a forearm with its hand, a thigh and a shin with its shoe; both sides share them.
  const upperGeo = paint(armGeometry(), suit);
  const foreGeo = merge([paint(armGeometry().scale(...FOREARM_SCALE), suit), paint(handGeometry().translate(0, -RIG.fore, 0), look.skin)]);
  const thighGeo = paint(legGeometry(), trousers);
  const shinGeo = merge([paint(legGeometry().scale(...SHIN_SCALE), trousers), paint(shoeGeometry().translate(0, -RIG.shin, 0), DARK)]);
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(RIG.shoulderX * s, RIG.shoulder, 0);
    const el = new THREE.Group();
    el.position.y = -RIG.upper;
    // Fold first (x), then turn the folded forearm across the chest (y): needed for crossed arms.
    el.rotation.order = 'YXZ';
    el.add(new THREE.Mesh(foreGeo, mat));
    sh.add(new THREE.Mesh(upperGeo, mat), el);
    body.add(sh);
    return { sh, el };
  });
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(RIG.hipX * s, RIG.hip, 0);
    const knee = new THREE.Group();
    knee.position.y = -RIG.thigh;
    knee.add(new THREE.Mesh(shinGeo, mat));
    hip.add(new THREE.Mesh(thighGeo, mat), knee);
    g.add(hip);
    return { hip, knee };
  });

  // The face: every part this person could earn is built once and shown as the tier allows. Head parts sit
  // on a pivot at the head's centre, keepsakes at their spot on the jacket, so each can grow in place.
  const faceParts = {};
  let tier = 0;
  let growFrom = 9;
  let growT = 1;
  if (face) {
    const full = partsFor({ ...face, tier: 3 });
    const heads = headGeometries();
    const bodies = bodyGeometries(RIG.shoulder);
    const lookC = { skin: look.skin, hair: look.hair, hairStyle: look.hairStyle };
    const addPart = (k, geo) => {
      const fixed = k === 'eyes' ? '#1b1714' : k === 'earrings' ? '#d4b25a' : null;
      const mat = figureMaterial({ color: fixed || partColour(k, face, lookC), roughness: k === 'eyes' ? 0.35 : 0.7, metalness: k === 'earrings' ? 0.7 : ['round', 'square', 'halfMoons'].includes(k) ? 0.3 : 0, side: k === 'beard' ? THREE.DoubleSide : THREE.FrontSide });
      mats[`face_${k}`] = mat;
      const pivot = new THREE.Group();
      if (HEAD_PARTS.includes(k)) {
        pivot.position.y = RIG.skull;
        head.add(pivot);
      } else {
        pivot.position.set(...bodies.anchors[k]);
        body.add(pivot);
      }
      pivot.add(new THREE.Mesh(geo, mat));
      faceParts[k] = { pivot, level: 0 };
    };
    for (const [k] of full) addPart(k, HEAD_PARTS.includes(k) ? heads[k] : bodies.geos[k]);
    // The heavy brows replace the plain ones, so both are built for a brows person.
    if (face.feature === 'brows' && !faceParts.brows) addPart('brows', heads.brows);
    for (const [k, geo] of Object.entries(heads)) if (!faceParts[k]) geo.dispose();
    for (const [k, geo] of Object.entries(bodies.geos)) if (!faceParts[k]) geo.dispose();
  }
  function showFace() {
    const on = new Map(partsFor(face && { ...face, tier }));
    for (const [k, p] of Object.entries(faceParts)) {
      const level = on.get(k);
      p.pivot.visible = level != null;
      p.pivot.scale.setScalar(level != null && level > growFrom ? growScale(growT) : 1);
    }
    if (tieMesh) {
      tieMesh.visible = !(tier >= 3 && face.signature === 'bowtie');
      mats.tie.color.set(tieColour(face && { ...face, tier }, outfit.tie));
    }
  }
  function setFace(next, { grow = false } = {}) {
    if (!face || !next) return;
    const t = Math.min(3, next.tier || 0);
    if (grow && t > tier) {
      growFrom = tier;
      growT = 0;
    }
    tier = t;
    showFace();
  }
  setFace(face);

  // A soft shadow that travels with the figure.
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), blobMaterial());
  shadow.position.y = 0.012;
  g.add(shadow, body);
  g.scale.setScalar(look.height);

  // Motion: the pose being settled into, what's held over it, the fidget under way, and the walk.
  let poseName = 'standing';
  const cur = new Float32Array(poseChannels('standing'));
  let goal = poseChannels('standing');
  let rate = 4;
  let moving = false;
  let held = null;
  let fidget = null;
  let queued = null;
  let idleT = 1 + Math.random() * 2;
  let time = 0;
  const phase = Math.random() * Math.PI * 2;
  let walkK = 0;
  let walkT = 0;
  let scale = 1;
  const out = new Float32Array(NCH);
  const nextIdle = () => (tuning().look.fidgetEvery ?? 14) * 0.5 * (0.5 + Math.random());

  // Every pivot from the channels. Legs hang from the hips but don't lean with the trunk.
  function apply(c) {
    body.position.set(0, c[IX.bodyY], c[IX.bodyZ]);
    body.rotation.set(c[IX.lean], c[IX.turn], c[IX.sway]);
    head.rotation.set(c[IX.headX], c[IX.headY], c[IX.headZ]);
    for (let s = 0; s < 2; s++) {
      const a = s ? IX.aRx : IX.aLx;
      const e = s ? IX.eRx : IX.eLx;
      arms[s].sh.rotation.set(c[a], c[a + 1], c[a + 2]);
      arms[s].el.rotation.set(c[e], c[e + 1], 0);
      legs[s].hip.position.set(RIG.hipX * (s ? 1 : -1), c[IX.bodyY], c[IX.bodyZ]);
      legs[s].hip.rotation.x = c[s ? IX.hipR : IX.hipL];
      legs[s].knee.rotation.x = c[s ? IX.kneeR : IX.kneeL];
    }
  }
  apply(cur);

  const f = {
    group: g,
    body,
    head,
    arms,
    legs,
    baseScale: look.height,
    materials: [...Object.values(mats), shadow.material],
    // The player's own head is hidden in over-the-shoulder shots: the shoulder at the frame edge is the point.
    setHeadVisible(v) {
      head.visible = v;
    },
    get faceTier() {
      return tier;
    },
    setFace,
    get pose() {
      return poseName;
    },
    // Settle into a pose over a moment (or at once with `snap`); the fidgets that follow come with it.
    setPose(name, { rate: r = 4, snap = false } = {}) {
      if (!POSES[name]) name = 'standing';
      poseName = name;
      goal = poseChannels(name);
      rate = r;
      moving = true;
      if (snap) {
        cur.set(goal);
        scale = POSES[name].scale || 1;
        moving = false;
        apply(cur);
        g.scale.setScalar(scale * look.height);
      }
    },
    // A fidget now (or after up to `delay` seconds): any name from motion.js FIDGETS.
    fidget(name, { delay = 0, hold = null } = {}) {
      queued = { name, at: time + delay * Math.random(), hold };
    },
    // Let a held fidget (speaking, clapping) fall away.
    calm() {
      queued = null;
      if (fidget) endFidget(fidget);
    },
    // Channels held over the pose until let go (null): hands kept on a keyboard, a glass held up.
    hold(channels) {
      if (!channels) {
        held = null;
        return;
      }
      held = held || new Float32Array(NCH);
      held.fill(0);
      addChannels(held, channels);
    },
    // Advance any parts growing in (kept for callers that drive the pivots themselves).
    tick(dt) {
      if (growT >= 1) return;
      growT = Math.min(1, growT + dt / 0.7);
      showFace();
    },
    // One frame: the pose blend, breathing, the fidget (or the walk, when `walk` is on), the face growing in.
    update(dt, { walk = false } = {}) {
      time += dt;
      this.tick(dt);
      if (moving) {
        const k = Math.min(1, dt * rate);
        let far = 0;
        for (let c = 0; c < NCH; c++) {
          cur[c] += (goal[c] - cur[c]) * k;
          far = Math.max(far, Math.abs(goal[c] - cur[c]));
        }
        if (far < 0.002) {
          cur.set(goal);
          moving = false;
        }
      }
      out.set(cur);
      if (held) for (let c = 0; c < NCH; c++) out[c] += held[c];
      breathe(out, time, phase);
      walkK += ((walk ? 1 : 0) - walkK) * Math.min(1, dt * 6);
      if (walkK > 0.01) {
        walkT += dt;
        strideChannels(out, walkT, walkK);
      }
      if (walk) {
        if (fidget) endFidget(fidget);
        queued = null;
      } else if (queued && time >= queued.at) {
        if (fidget) endFidget(fidget);
        else {
          fidget = startFidget(queued.name, cur, queued);
          queued = null;
        }
      }
      if (fidget) {
        if (!stepFidget(fidget, dt, out)) {
          fidget = null;
          idleT = nextIdle();
        }
      } else if (!queued && !walk) {
        idleT -= dt;
        if (idleT <= 0) {
          const name = pickFidget(poseName);
          if (name) fidget = startFidget(name, cur);
          else idleT = nextIdle();
        }
      }
      apply(out);
      const want = (POSES[poseName].scale || 1) * look.height;
      g.scale.setScalar(g.scale.x + (want - g.scale.x) * Math.min(1, dt * 4));
    },
  };
  return f;
}

// Put a figure straight into a pose (k = 1) or start settling toward it. Kept for the rooms that place a
// figure once and leave it; `f.setPose` says the same thing.
export function poseFigure(f, name, k = 1) {
  f.setPose(name, { snap: k >= 1 });
}

// The walk, for callers that move a figure along a path themselves: one frame at time t.
export function stride(f, dt) {
  f.update(dt, { walk: true });
}

// A visitor that follows waypoints from the door to a chair. update(dt) animates; `seated` tells the camera.
// `face` is how well the player knows them now; `faceFrom` the tier they walk in with, so the rest of the face
// comes into focus once they've sat down and the conversation starts.
export function createVisitor(scene, { color, mpId, path, seat, facing, outfit = null, face = null, faceFrom = null }) {
  const f = createFigure(color, mpId, outfit, face);
  let faceNext = null;
  if (face && faceFrom != null && faceFrom < face.tier) {
    f.setFace({ ...face, tier: faceFrom });
    faceNext = face;
  }
  let focusIn = 0.6;
  scene.add(f.group);
  let phase = 'entering';
  let mood = 'cooperative';
  let leg = 0;
  let t = 0;
  const pts = path.map((p) => new THREE.Vector3(p[0], 0, p[1]));
  f.group.position.copy(pts[0]);
  const speed = 3.2;
  let onSeated = null;
  let onGone = null;
  const dir = new THREE.Vector3();

  // Along the path, turning toward each new leg over a few frames rather than snapping to it.
  function walk(dt, list) {
    const target = list[leg + 1];
    if (!target) return true;
    const pos = f.group.position;
    dir.subVectors(target, pos);
    const dist = dir.length();
    const step = speed * dt;
    const want = Math.atan2(dir.x, dir.z);
    f.group.rotation.y += wrapAngle(want - f.group.rotation.y) * Math.min(1, dt * 10);
    if (dist <= step) {
      pos.copy(target);
      leg++;
      return leg >= list.length - 1;
    }
    pos.addScaledVector(dir.normalize(), step);
    return false;
  }

  function sitIn(snap) {
    f.setPose(mood, { rate: 5, snap });
  }

  return {
    figure: f,
    get phase() {
      return phase;
    },
    // How the meeting is going: the pose changes, and so does what they do with their hands.
    setMood(m) {
      if (m === mood) return;
      mood = m;
      if (phase === 'seated' || phase === 'sitting') sitIn(false);
    },
    // Learning more mid-meeting: the new parts grow in (after the walk-in, if they haven't sat yet).
    setFace(next) {
      if (!next) return;
      if (phase === 'seated') f.setFace(next, { grow: true });
      else faceNext = next;
    },
    onSeated(cb) {
      onSeated = cb;
    },
    leave(cb) {
      if (phase === 'gone') return cb?.();
      phase = 'leaving';
      onGone = cb;
      leg = 0;
      t = 0;
      f.fidget('standUp');
      f.setPose('walking', { rate: 5 });
    },
    // Skip the walk-in (when a meeting resumes mid-way or the room is rebuilt).
    sitNow() {
      f.group.position.set(seat[0], 0, seat[1]);
      f.group.rotation.y = facing;
      phase = 'seated';
      sitIn(true);
      if (faceNext) f.setFace(faceNext);
      faceNext = null;
    },
    update(dt) {
      t += dt;
      if (phase === 'seated' && faceNext) {
        focusIn -= dt;
        if (focusIn <= 0) {
          f.setFace(faceNext, { grow: true });
          faceNext = null;
        }
      }
      if (phase === 'entering') {
        if (f.pose !== 'walking') f.setPose('walking', { snap: true });
        f.update(dt, { walk: true });
        if (walk(dt, pts)) {
          phase = 'sitting';
          t = 0;
          sitIn(false);
          f.fidget('sitDown');
        }
      } else if (phase === 'sitting') {
        f.group.rotation.y += wrapAngle(facing - f.group.rotation.y) * Math.min(1, dt * 8);
        f.update(dt);
        if (t > 0.5) {
          phase = 'seated';
          onSeated?.();
        }
      } else if (phase === 'seated') {
        f.update(dt);
      } else if (phase === 'leaving') {
        // A moment to get up before the first step.
        f.update(dt, { walk: t > 0.35 });
        if (t > 0.35 && walk(dt, [...pts].reverse())) {
          phase = 'gone';
          f.group.visible = false;
          const cb = onGone;
          onGone = null;
          cb?.();
        }
      } else f.update(dt);
    },
    dispose() {
      scene.remove(f.group);
      f.group.traverse((o) => o.geometry?.dispose());
      f.materials.forEach((m) => m.dispose());
    },
  };
}
