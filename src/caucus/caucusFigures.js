// Seated MPs around the caucus table from the shared figure kit. In the whip's read, a seat you can read
// carries its mood as a coloured glow on the floor and a shaped mark above the head (circle, square, triangle,
// diamond), so the room still reads as your party and the moods read without colour.
import * as THREE from 'three';
import { createFigureCrowd, lookFor, wardrobe } from '../figures.js';
import { blobMaterial } from '../kit3d.js';

export const MOOD_TINT = { cooperative: '#2E9E5B', guarded: '#8A8F98', angry: '#C8423B', anxious: '#E0A526' };
const MOODS = ['cooperative', 'guarded', 'angry', 'anxious'];

// One small canvas icon per mood shape, white on transparent; the instance colour tints it.
function shapeTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  if (kind === 'cooperative') g.arc(32, 32, 20, 0, Math.PI * 2);
  else if (kind === 'guarded') g.rect(14, 14, 36, 36);
  else if (kind === 'angry') {
    g.moveTo(32, 10);
    g.lineTo(54, 52);
    g.lineTo(10, 52);
    g.closePath();
  } else {
    g.moveTo(32, 8);
    g.lineTo(56, 32);
    g.lineTo(32, 56);
    g.lineTo(8, 32);
    g.closePath();
  }
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCaucusFigures(seats) {
  const n = seats.length;
  const crowd = createFigureCrowd(n, { pose: 'seated' });
  const color = new THREE.Color();
  const base = seats.map((s) => {
    const look = lookFor(s.mpId || 'x');
    return { x: s.x, z: s.z, rotY: s.rotY, scale: look.height, lean: look.lean, yaw: look.yaw, look };
  });
  base.forEach((b, i) => {
    crowd.place(i, b);
    crowd.dress(i, { ...b.look, ...wardrobe(seats[i].mpId || 'x', '#555') });
  });
  crowd.commit();
  const group = new THREE.Group();
  group.add(crowd.group);

  // Mood marks: one instanced plane per shape, billboarded; a glow blob on the floor behind each read chair.
  const marks = {};
  for (const k of MOODS) {
    marks[k] = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ map: shapeTexture(k), transparent: true, depthWrite: false, toneMapped: false }), n);
    marks[k].count = 0;
    marks[k].frustumCulled = false;
    group.add(marks[k]);
  }
  const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), blobMaterial(0.9), n);
  glow.material = glow.material.clone();
  glow.material.blending = THREE.AdditiveBlending;
  glow.count = 0;
  glow.frustumCulled = false;
  group.add(glow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#c9a24a', transparent: true, opacity: 0.9, depthWrite: false }));
  ring.visible = false;
  group.add(ring);

  const reads = new Array(n).fill(null);
  const gone = new Set();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion();
  let leaning = null; // { pairs: [[i, j]], t }

  function layoutMarks(camera) {
    const counts = { cooperative: 0, guarded: 0, angry: 0, anxious: 0 };
    let g = 0;
    q.copy(camera.quaternion);
    for (let i = 0; i < n; i++) {
      const k = reads[i];
      if (!k) continue;
      const s = seats[i];
      pos.set(s.x, 1.78 + Math.sin(performance.now() / 500 + i) * 0.02, s.z);
      // Marks shrink as they come close to the camera, and the one over your own shoulder is skipped.
      const d = camera.position.distanceTo(pos);
      if (d < 1.2) continue;
      const sc = Math.min(1, 0.35 + d / 8);
      m.compose(pos, q, one.set(sc, sc, sc));
      marks[k].setMatrixAt(counts[k], m);
      marks[k].setColorAt(counts[k], color.set(MOOD_TINT[k]));
      counts[k]++;
      pos.set(s.x - Math.sin(s.rotY) * 0.15, 0.014, s.z - Math.cos(s.rotY) * 0.15);
      m.makeTranslation(pos.x, pos.y, pos.z);
      one.set(1, 1, 1);
      glow.setMatrixAt(g, m);
      glow.setColorAt(g, color.set(MOOD_TINT[k]));
      g++;
    }
    for (const k of MOODS) {
      marks[k].count = counts[k];
      marks[k].instanceMatrix.needsUpdate = true;
      if (marks[k].instanceColor) marks[k].instanceColor.needsUpdate = true;
    }
    glow.count = g;
    glow.instanceMatrix.needsUpdate = true;
    if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
  }

  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  return {
    group,
    torsos: crowd.torsos,
    // The party's colour in every tie and pin over real suits; mood marks where the player can read them;
    // a brass ring under the player.
    read(readFor) {
      seats.forEach((s, i) => {
        const r = readFor(s.mpId) || {};
        crowd.dress(i, { ...base[i].look, ...wardrobe(s.mpId || 'x', r.color || '#555'), face: r.face });
        reads[i] = !gone.has(i) && r.mood && MOODS.includes(r.mood) ? r.mood : null;
        if (r.me) {
          ring.visible = true;
          ring.position.set(s.x, 0.02, s.z);
        }
      });
      crowd.commit();
    },
    // Two people lean toward each other for a moment: what "keeps leaning over to" looks like.
    showPairs(pairs) {
      const idx = new Map(seats.map((s, i) => [s.mpId, i]));
      leaning = { pairs: pairs.map(([a, b]) => [idx.get(a), idx.get(b)]).filter(([a, b]) => a != null && b != null && !gone.has(a) && !gone.has(b)), t: 0 };
    },
    // Someone has been put out of caucus: their chair is empty for the rest of the meeting.
    empty(mpId) {
      const i = seats.findIndex((s) => s.mpId === mpId);
      if (i < 0) return;
      gone.add(i);
      reads[i] = null;
      crowd.show(i, false);
      crowd.commit();
    },
    update(dt, camera) {
      crowd.update(dt);
      if (leaning) {
        leaning.t += dt;
        const T = leaning.t;
        const k = T < 0.6 ? T / 0.6 : T < 2.4 ? 1 : T < 3.0 ? 1 - (T - 2.4) / 0.6 : 0;
        for (const [a, b] of leaning.pairs) {
          for (const [i, j] of [[a, b], [b, a]]) {
            const me = base[i];
            const other = base[j];
            const want = Math.max(-0.9, Math.min(0.9, wrap(Math.atan2(other.x - me.x, other.z - me.z) - me.rotY)));
            crowd.place(i, { ...me, yaw: me.yaw + (want - me.yaw) * k, lean: me.lean + 0.12 * k });
          }
        }
        crowd.commit();
        if (T >= 3.0) leaning = null;
      }
      if (camera) layoutMarks(camera);
    },
  };
}
