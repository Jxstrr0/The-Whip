// The articulated figure for the office and the riding: the crowds' silhouette with elbows, knees, hands and
// shoes on pivots, so it can walk in, sit, and hold a pose that says how the meeting is going.
import * as THREE from 'three';
import { blobMaterial, figureMaterial, merge } from '../kit3d.js';
import { lookFor, shade, trouserColour, tieParts, pinPart } from '../figures.js';
import { jacketGeometry, shirtFront, pelvis, hangingTaper, shoe } from '../body.js';
import { headGeometries, bodyGeometries, hairCap, partsFor, partColour, tieColour, growScale, HEAD_PARTS } from '../faces.js';

const HIP = 0.86;
const THIGH = 0.39;
const SHIN = 0.39;
const UPPER = 0.27;
const FORE = 0.26;
const SHOULDER_H = 0.54; // above the hips
const HEAD_H = 0.77;
const SEAT = 0.47;

// A limb segment hanging from its pivot along -y, with the round joint at the pivot.
function hanging(ra, rb, len, mat) {
  return new THREE.Mesh(hangingTaper(ra, rb, len), mat);
}

// `outfit` is a wardrobe() result: its suit replaces `color`, and its tie and pin are worn; without one the
// figure is a plain suit (the player seen from behind, a constituent). `face` is a faces.js result: how much
// of a face the player has earned on them (none for a stranger); setFace() changes it later, growing new parts.
export function createFigure(color, mpId = 'x', outfit = null, face = null) {
  const look = lookFor(mpId);
  const mats = {
    suit: figureMaterial({ color: outfit?.suit || shade(color, mpId), roughness: 0.82 }),
    trousers: figureMaterial({ color: trouserColour(outfit?.suit || shade(color, mpId)), roughness: 0.85 }),
    skin: figureMaterial({ color: look.skin, roughness: 0.6 }),
    hair: figureMaterial({ color: look.hair, roughness: 0.95 }),
    shirt: figureMaterial({ color: '#e9e3d8', roughness: 0.7 }),
    dark: figureMaterial({ color: '#1d1a16', roughness: 0.8 }),
  };
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = HIP;

  const torso = new THREE.Mesh(jacketGeometry(SHOULDER_H), mats.suit);
  const seat = new THREE.Mesh(pelvis(0), mats.trousers);
  const collar = new THREE.Mesh(shirtFront(SHOULDER_H), mats.shirt);
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.1, 3, 8), mats.skin);
  neck.position.set(0, SHOULDER_H + 0.08, 0.01);
  // The head turns and nods about the neck.
  const head = new THREE.Group();
  head.position.set(0, HEAD_H - 0.12, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), mats.skin);
  skull.scale.set(1, 1.12, 1.02);
  skull.position.y = 0.12;
  const cap = new THREE.Mesh(hairCap(), mats.hair);
  cap.scale.set(1, Math.max(look.hairStyle, 0.01), 1);
  cap.position.y = 0.12;
  cap.visible = look.hairStyle > 0;
  head.add(skull, cap);
  body.add(torso, seat, collar, neck, head);
  let tieMesh = null;
  if (outfit?.tie) {
    mats.tie = figureMaterial({ color: outfit.tie, roughness: 0.55 });
    tieMesh = new THREE.Mesh(merge(tieParts(SHOULDER_H)), mats.tie);
    body.add(tieMesh);
  }
  if (outfit?.pin) {
    mats.pin = figureMaterial({ color: outfit.pin, roughness: 0.3, metalness: 0.6 });
    body.add(new THREE.Mesh(pinPart(SHOULDER_H), mats.pin));
  }

  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(0.22 * s, SHOULDER_H, 0);
    const el = new THREE.Group();
    el.position.y = -UPPER;
    // Fold first (x), then turn the folded forearm across the chest (y): needed for crossed arms.
    el.rotation.order = 'YXZ';
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.047, 8, 6), mats.skin);
    hand.scale.set(1, 0.78, 1.2);
    hand.position.y = -FORE;
    el.add(hanging(0.052, 0.044, FORE, mats.suit), hand);
    sh.add(hanging(0.062, 0.052, UPPER, mats.suit), el);
    body.add(sh);
    return { sh, el };
  });
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(0.095 * s, HIP, 0);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    const foot = new THREE.Mesh(shoe(), mats.dark);
    foot.position.set(0, -SHIN - 0.04, 0.06);
    knee.add(hanging(0.07, 0.06, SHIN, mats.trousers), foot);
    hip.add(hanging(0.08, 0.07, THIGH, mats.trousers), knee);
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
    const bodies = bodyGeometries(SHOULDER_H);
    const lookC = { skin: look.skin, hair: look.hair, hairStyle: look.hairStyle };
    for (const [k] of full) {
      const fixed = k === 'eyes' ? '#1b1714' : k === 'earrings' ? '#d4b25a' : null;
      const mat = figureMaterial({ color: fixed || partColour(k, face, lookC), roughness: k === 'eyes' ? 0.35 : 0.7, metalness: k === 'earrings' ? 0.7 : ['round', 'square', 'halfMoons'].includes(k) ? 0.3 : 0, side: k === 'beard' ? THREE.DoubleSide : THREE.FrontSide });
      mats[`face_${k}`] = mat;
      const pivot = new THREE.Group();
      if (HEAD_PARTS.includes(k)) {
        pivot.position.y = 0.12;
        pivot.add(new THREE.Mesh(heads[k], mat));
        head.add(pivot);
      } else {
        pivot.position.set(...bodies.anchors[k]);
        pivot.add(new THREE.Mesh(bodies.geos[k], mat));
        body.add(pivot);
      }
      faceParts[k] = { pivot, level: 0 };
    }
    // The heavy brows replace the plain ones, so both are built for a brows person.
    if (face.feature === 'brows' && !faceParts.brows) {
      const mat = figureMaterial({ color: partColour('brows', face, lookC), roughness: 0.7 });
      mats.face_brows = mat;
      const pivot = new THREE.Group();
      pivot.position.y = 0.12;
      pivot.add(new THREE.Mesh(heads.brows, mat));
      head.add(pivot);
      faceParts.brows = { pivot, level: 0 };
    }
    for (const [k, g] of Object.entries(heads)) if (!faceParts[k]) g.dispose();
    for (const [k, g] of Object.entries(bodies.geos)) if (!faceParts[k]) g.dispose();
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
  return {
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
    // Advance any parts growing in.
    tick(dt) {
      if (growT >= 1) return;
      growT = Math.min(1, growT + dt / 0.7);
      showFace();
    },
  };
}

// Joint angles per pose. Shoulder x negative swings the arm forward; z moves it across the body (mirrored for
// the right arm); elbow x folds the forearm forward, elbow y turns it across the chest.
const SIT = { hips: -Math.PI / 2, knees: Math.PI / 2 };
const POSES = {
  standing: { bodyY: HIP, lean: 0, headX: 0, arms: [[0, 0, 0.06], [0, 0, -0.06]], elbows: [[-0.15, 0], [-0.15, 0]], hips: 0, knees: 0, scale: 1 },
  walking: { bodyY: HIP, lean: 0.05, headX: 0, arms: [[0, 0, 0.06], [0, 0, -0.06]], elbows: [[-0.3, 0], [-0.3, 0]], hips: 0, knees: 0, scale: 1 },
  // Upright, hands on the knees.
  cooperative: { bodyY: SEAT, lean: -0.03, headX: 0, arms: [[-0.55, 0, 0.05], [-0.55, 0, -0.05]], elbows: [[-0.95, 0], [-0.95, 0]], ...SIT, scale: 1 },
  // Arms folded across the chest, leaning back a touch.
  guarded: { bodyY: SEAT, lean: -0.1, headX: 0.05, arms: [[-0.9, 0, 0.3], [-0.9, 0, -0.3]], elbows: [[-1.5, 1.35], [-1.3, -1.35]], ...SIT, scale: 1 },
  // Leaning in, both hands flat on the desk edge.
  angry: { bodyY: SEAT, lean: 0.35, headX: -0.15, arms: [[-1.2, 0, 0.15], [-1.2, 0, -0.15]], elbows: [[-0.25, 0], [-0.25, 0]], ...SIT, scale: 1 },
  // Shoulders in, hands clasped in the lap, head down.
  anxious: { bodyY: SEAT - 0.01, lean: 0.15, headX: 0.3, arms: [[-0.75, 0, 0.3], [-0.75, 0, -0.3]], elbows: [[-1.45, 0.7], [-1.45, -0.7]], ...SIT, scale: 0.95 },
};

export function poseFigure(f, name, k = 1) {
  const p = POSES[name] || POSES.standing;
  const lerp = (a, b) => a + (b - a) * k;
  f.body.position.y = lerp(f.body.position.y, p.bodyY);
  f.body.rotation.x = lerp(f.body.rotation.x, p.lean);
  f.head.rotation.x = lerp(f.head.rotation.x, p.headX);
  f.arms.forEach((a, i) => {
    a.sh.rotation.x = lerp(a.sh.rotation.x, p.arms[i][0]);
    a.sh.rotation.y = lerp(a.sh.rotation.y, p.arms[i][1]);
    a.sh.rotation.z = lerp(a.sh.rotation.z, p.arms[i][2]);
    a.el.rotation.x = lerp(a.el.rotation.x, p.elbows[i][0]);
    a.el.rotation.y = lerp(a.el.rotation.y, p.elbows[i][1]);
  });
  for (const l of f.legs) {
    l.hip.position.y = p.bodyY;
    l.hip.rotation.x = lerp(l.hip.rotation.x, p.hips);
    l.knee.rotation.x = lerp(l.knee.rotation.x, p.knees);
  }
  f.group.scale.setScalar(lerp(f.group.scale.x, p.scale * f.baseScale));
}

// Legs from the hip, arms opposite, a knee bend on the swing-through.
export function stride(f, t) {
  const s = Math.sin(t * 9);
  f.legs[0].hip.rotation.x = s * 0.5;
  f.legs[1].hip.rotation.x = -s * 0.5;
  f.legs[0].knee.rotation.x = Math.max(0, -s) * 0.7;
  f.legs[1].knee.rotation.x = Math.max(0, s) * 0.7;
  f.arms[0].sh.rotation.x = -s * 0.35;
  f.arms[1].sh.rotation.x = s * 0.35;
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

  function walk(dt, list) {
    const target = list[leg + 1];
    if (!target) return true;
    const pos = f.group.position;
    const dir = target.clone().sub(pos);
    const dist = dir.length();
    const step = speed * dt;
    f.group.rotation.y = Math.atan2(dir.x, dir.z);
    if (dist <= step) {
      pos.copy(target);
      leg++;
      return leg >= list.length - 1;
    }
    pos.addScaledVector(dir.normalize(), step);
    return false;
  }

  return {
    figure: f,
    get phase() {
      return phase;
    },
    setMood(m) {
      mood = m;
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
    },
    // Skip the walk-in (when a meeting resumes mid-way or the room is rebuilt).
    sitNow() {
      f.group.position.set(seat[0], 0, seat[1]);
      f.group.rotation.y = facing;
      phase = 'seated';
      poseFigure(f, mood, 1);
      if (faceNext) f.setFace(faceNext);
      faceNext = null;
    },
    update(dt) {
      t += dt;
      f.tick(dt);
      if (phase === 'seated' && faceNext) {
        focusIn -= dt;
        if (focusIn <= 0) {
          f.setFace(faceNext, { grow: true });
          faceNext = null;
        }
      }
      if (phase === 'entering') {
        poseFigure(f, 'walking', 1);
        stride(f, t);
        if (walk(dt, pts)) {
          phase = 'sitting';
          t = 0;
        }
      } else if (phase === 'sitting') {
        f.group.rotation.y += (facing - f.group.rotation.y) * Math.min(1, dt * 8);
        poseFigure(f, mood, Math.min(1, dt * 6));
        if (t > 0.5) {
          phase = 'seated';
          onSeated?.();
        }
      } else if (phase === 'seated') {
        poseFigure(f, mood, Math.min(1, dt * 4));
        // Breathing, and the head drifting a little, so a seated person never freezes.
        f.body.position.y += Math.sin(t * 1.6) * 0.0012;
        f.head.rotation.y = Math.sin(t * 0.7) * 0.06;
      } else if (phase === 'leaving') {
        poseFigure(f, 'walking', Math.min(1, dt * 6));
        stride(f, t);
        if (walk(dt, [...pts].reverse())) {
          phase = 'gone';
          f.group.visible = false;
          const cb = onGone;
          onGone = null;
          cb?.();
        }
      }
    },
    dispose() {
      scene.remove(f.group);
      f.group.traverse((o) => o.geometry?.dispose());
      f.materials.forEach((m) => m.dispose());
    },
  };
}
