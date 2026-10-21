// The articulated figure for the office and the riding: the crowds' silhouette with elbows, knees, hands and
// shoes on pivots, so it can walk in, sit, and hold a pose that says how the meeting is going.
import * as THREE from 'three';
import { blobMaterial, figureMaterial } from '../kit3d.js';
import { lookFor, shade, HEAD_R } from '../figures.js';

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
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat);
  m.position.y = -len / 2;
  return m;
}

export function createFigure(color, mpId = 'x') {
  const look = lookFor(mpId);
  const mats = {
    suit: figureMaterial({ color: shade(color, mpId), roughness: 0.82 }),
    skin: figureMaterial({ color: look.skin, roughness: 0.6 }),
    hair: figureMaterial({ color: look.hair, roughness: 0.95 }),
    shirt: figureMaterial({ color: '#e9e3d8', roughness: 0.7 }),
    dark: figureMaterial({ color: '#1d1a16', roughness: 0.8 }),
  };
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = HIP;

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mats.suit);
  torso.scale.set(0.2, 0.32, 0.14);
  torso.position.y = 0.28;
  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.38, 3, 10), mats.suit);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = SHOULDER_H;
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.02), mats.shirt);
  collar.position.set(0, SHOULDER_H - 0.05, 0.133);
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.1, 3, 8), mats.skin);
  neck.position.set(0, SHOULDER_H + 0.08, 0.01);
  // The head turns and nods about the neck.
  const head = new THREE.Group();
  head.position.set(0, HEAD_H - 0.12, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 14, 10), mats.skin);
  skull.scale.set(1, 1.12, 1.02);
  skull.position.y = 0.12;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R + 0.012, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.64), mats.hair);
  cap.scale.set(1, 1.1 * Math.max(look.hairStyle, 0.01), 1.02);
  cap.position.set(0, 0.125, -0.012);
  cap.visible = look.hairStyle > 0;
  head.add(skull, cap);
  body.add(torso, shoulders, collar, neck, head);

  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(0.22 * s, SHOULDER_H, 0);
    const el = new THREE.Group();
    el.position.y = -UPPER;
    // Fold first (x), then turn the folded forearm across the chest (y): needed for crossed arms.
    el.rotation.order = 'YXZ';
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mats.skin);
    hand.scale.set(1, 0.8, 1.2);
    hand.position.y = -FORE;
    el.add(hanging(0.05, FORE, mats.suit), hand);
    sh.add(hanging(0.058, UPPER, mats.suit), el);
    body.add(sh);
    return { sh, el };
  });
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(0.1 * s, HIP, 0);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.25), mats.dark);
    shoe.position.set(0, -SHIN - 0.04, 0.05);
    knee.add(hanging(0.065, SHIN, mats.suit), shoe);
    hip.add(hanging(0.08, THIGH, mats.suit), knee);
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
function stride(f, t) {
  const s = Math.sin(t * 9);
  f.legs[0].hip.rotation.x = s * 0.5;
  f.legs[1].hip.rotation.x = -s * 0.5;
  f.legs[0].knee.rotation.x = Math.max(0, -s) * 0.7;
  f.legs[1].knee.rotation.x = Math.max(0, s) * 0.7;
  f.arms[0].sh.rotation.x = -s * 0.35;
  f.arms[1].sh.rotation.x = s * 0.35;
}

// A visitor that follows waypoints from the door to a chair. update(dt) animates; `seated` tells the camera.
export function createVisitor(scene, { color, mpId, path, seat, facing }) {
  const f = createFigure(color, mpId);
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
