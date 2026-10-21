// The visiting figure: walks in from the door, sits, takes a pose for their mood, and leaves.
import * as THREE from 'three';
import { blobMaterial, figureMaterial } from '../kit3d.js';

const SKIN = ['#f1c8a5', '#e0ac85', '#c68d63', '#a26b45', '#7c4f31', '#5b3a24', '#efd2b8', '#d6a07a'];

function hashIndex(id, n) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

// A simple jointed figure: torso, head, arms and legs, built to sit or stand.
export function createFigure(color, mpId = 'x') {
  const g = new THREE.Group();
  const suit = figureMaterial({ color, roughness: 0.7 });
  const dark = figureMaterial({ color: '#23252b', roughness: 0.8 });
  const skin = figureMaterial({ color: SKIN[hashIndex(mpId, SKIN.length)], roughness: 0.6 });
  const body = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.38, 4, 10), suit);
  torso.position.y = 0.33;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 10), skin);
  head.position.y = 0.78;
  body.add(torso, head);
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.24 * s, 0.58, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 3, 8), suit);
    arm.position.y = -0.24;
    pivot.add(arm);
    body.add(pivot);
    return pivot;
  });
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.1 * s, 0, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 3, 8), dark);
    leg.position.y = -0.28;
    pivot.add(leg);
    g.add(pivot);
    return pivot;
  });
  g.add(body);
  // A soft shadow that travels with the figure.
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), blobMaterial());
  shadow.position.y = 0.012;
  g.add(shadow);
  return { group: g, body, head, arms, legs, materials: [suit, dark, skin, shadow.material] };
}

const POSES = {
  standing: { bodyY: 0.6, lean: 0, head: 0, arms: [[0, 0, 0.05], [0, 0, -0.05]], legs: 0, scale: 1 },
  walking: { bodyY: 0.6, lean: 0.04, head: 0, arms: [[0, 0, 0.05], [0, 0, -0.05]], legs: 0, scale: 1 },
  cooperative: { bodyY: 0.48, lean: -0.05, head: 0, arms: [[-0.9, 0, 0.1], [-0.9, 0, -0.1]], legs: -1.45, scale: 1 },
  guarded: { bodyY: 0.48, lean: -0.1, head: 0.05, arms: [[-1.5, 0.9, 0], [-1.5, -0.9, 0]], legs: -1.45, scale: 1 },
  angry: { bodyY: 0.48, lean: 0.32, head: -0.2, arms: [[-1.1, 0.2, 0.2], [-1.1, -0.2, -0.2]], legs: -1.45, scale: 1 },
  anxious: { bodyY: 0.46, lean: 0.12, head: 0.35, arms: [[-0.6, 0.3, 0.05], [-0.6, -0.3, -0.05]], legs: -1.45, scale: 0.92 },
};

export function poseFigure(f, name, k = 1) {
  const p = POSES[name] || POSES.standing;
  const lerp = (a, b) => a + (b - a) * k;
  f.body.position.y = lerp(f.body.position.y, p.bodyY);
  f.body.rotation.x = lerp(f.body.rotation.x, p.lean);
  f.head.rotation.x = lerp(f.head.rotation.x, p.head);
  f.arms.forEach((a, i) => {
    a.rotation.x = lerp(a.rotation.x, p.arms[i][0]);
    a.rotation.y = lerp(a.rotation.y, p.arms[i][1]);
    a.rotation.z = lerp(a.rotation.z, p.arms[i][2]);
  });
  for (const l of f.legs) {
    l.position.y = p.bodyY - 0.02;
    l.rotation.x = lerp(l.rotation.x, p.legs);
  }
  f.group.scale.setScalar(lerp(f.group.scale.x, p.scale));
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
  const speed = 2.6;
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
        f.legs[0].rotation.x = Math.sin(t * 9) * 0.5;
        f.legs[1].rotation.x = -Math.sin(t * 9) * 0.5;
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
        f.body.position.y += Math.sin(t * 1.6) * 0.0015;
      } else if (phase === 'leaving') {
        poseFigure(f, 'walking', Math.min(1, dt * 6));
        f.legs[0].rotation.x = Math.sin(t * 9) * 0.5;
        f.legs[1].rotation.x = -Math.sin(t * 9) * 0.5;
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
