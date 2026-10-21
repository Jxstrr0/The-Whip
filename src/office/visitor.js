// The articulated figure for the office and the riding: the crowds' silhouette with elbows, knees, hands and
// shoes on pivots, so it can walk in, sit, and hold a pose that says how the meeting is going.
import * as THREE from 'three';
import { blobMaterial, merge, worldUVs } from '../kit3d.js';
import { lookFor, shade, HEAD_R, CAP_TOP, tieParts, pinPart, partMaterial, capsule, egg, hairCap, jacket, shirtFront } from '../figures.js';
import { faceTexture } from '../figureTextures.js';

const HIP = 0.86;
const THIGH = 0.39;
const SHIN = 0.39;
const UPPER = 0.27;
const FORE = 0.26;
const SHOULDER_H = 0.54; // above the hips
const HEAD_H = 0.77;
const SEAT = 0.47;

// A limb hanging from its pivot along -y.
function hanging(r, len, mat) {
  const m = new THREE.Mesh(capsule(r, len), mat);
  m.position.y = -len / 2;
  return m;
}
// A box with its UVs in metres, like the crowd's.
function box(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(worldUVs(new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y, z);
  return m;
}

// `outfit` is a wardrobe() result: its suit replaces `color`, and its tie and pin are worn; without one the
// figure is a plain suit (the player seen from behind, a constituent).
export function createFigure(color, mpId = 'x', outfit = null) {
  const look = lookFor(mpId);
  const mats = {
    suit: partMaterial('suit', { color: outfit?.suit || shade(color, mpId), weave: outfit?.weave }),
    skin: partMaterial('skin', { color: look.skin }),
    head: partMaterial('head', { color: look.skin }),
    hair: partMaterial('hair', { color: look.hair }),
    shirt: partMaterial('shirt'),
    dark: partMaterial('dark'),
  };
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = HIP;

  const torso = new THREE.Mesh(jacket(0, SHOULDER_H), mats.suit);
  const collar = new THREE.Mesh(shirtFront(SHOULDER_H), mats.shirt);
  const neck = new THREE.Mesh(capsule(0.052, 0.1), mats.skin);
  neck.position.set(0, SHOULDER_H + 0.08, 0.01);
  // The head turns and nods about the neck.
  const head = new THREE.Group();
  head.position.set(0, HEAD_H - 0.12, 0);
  const skull = new THREE.Mesh(egg(HEAD_R, 0, 0.12, 0, 1, 1.12, 1.02, 14), mats.head);
  // The cap hangs from its crown, so its style squashes it toward the crown as the crowd's does.
  const cap = new THREE.Mesh(hairCap(-CAP_TOP), mats.hair);
  cap.scale.y = Math.max(look.hairStyle, 0.01);
  cap.position.y = 0.12 + CAP_TOP;
  cap.visible = look.hairStyle > 0;
  head.add(skull, cap);
  body.add(torso, collar, neck, head);
  if (outfit?.tie) {
    mats.tie = partMaterial('tie', { color: outfit.tie, tieStyle: outfit.tieStyle });
    body.add(new THREE.Mesh(merge(tieParts(SHOULDER_H)), mats.tie));
  }
  if (outfit?.pin) {
    mats.pin = partMaterial('pin', { color: outfit.pin });
    body.add(new THREE.Mesh(pinPart(SHOULDER_H), mats.pin));
  }

  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(0.21 * s, SHOULDER_H - 0.04, 0);
    const el = new THREE.Group();
    el.position.y = -UPPER;
    // Fold first (x), then turn the folded forearm across the chest (y): needed for crossed arms.
    el.rotation.order = 'YXZ';
    const hand = new THREE.Mesh(egg(0.05, 0, 0, 0, 0.75, 1.3, 1, 8), mats.skin);
    hand.position.y = -FORE;
    el.add(hanging(0.056, FORE, mats.suit), hand);
    sh.add(hanging(0.064, UPPER, mats.suit), el);
    body.add(sh);
    return { sh, el };
  });
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(0.1 * s, HIP, 0);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    const shoe = box(0.11, 0.07, 0.25, 0, -SHIN - 0.04, 0.05, mats.dark);
    knee.add(hanging(0.07, SHIN, mats.suit), shoe);
    hip.add(hanging(0.085, THIGH, mats.suit), knee);
    g.add(hip);
    return { hip, knee };
  });

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
    // The face follows the mood: brows and mouth from figureTextures' faces.
    setFace(mood) {
      mats.head.map = faceTexture(mood);
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
  f.setFace?.(name);
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
export function createVisitor(scene, { color, mpId, path, seat, facing, outfit = null }) {
  const f = createFigure(color, mpId, outfit);
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
    },
    update(dt) {
      t += dt;
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
