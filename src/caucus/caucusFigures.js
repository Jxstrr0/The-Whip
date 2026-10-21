// Instanced seated MPs around the caucus table, tinted by mood in the whip's read (when you know it).
import * as THREE from 'three';
import { figureMaterial } from '../kit3d.js';

export const MOOD_TINT = { cooperative: '#2E9E5B', guarded: '#8A8F98', angry: '#C8423B', anxious: '#E0A526' };
const SKIN = ['#f1c8a5', '#e0ac85', '#c68d63', '#a26b45', '#7c4f31', '#5b3a24', '#efd2b8', '#d6a07a'];

function hashIndex(id, n) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

export function createCaucusFigures(seats) {
  const n = seats.length;
  const torsos = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.18, 0.34, 4, 10), figureMaterial({ roughness: 0.75 }), n);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 14, 10), figureMaterial({ roughness: 0.6 }), n);
  const group = new THREE.Group();
  group.add(torsos, heads);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  seats.forEach((s, i) => {
    q.setFromAxisAngle(up, s.rotY);
    const lean = new THREE.Vector3(0, 0, 0.08).applyQuaternion(q);
    p.set(s.x + lean.x, 0.85, s.z + lean.z);
    m.compose(p, q, one);
    torsos.setMatrixAt(i, m);
    p.set(s.x + lean.x * 1.6, 1.3, s.z + lean.z * 1.6);
    m.compose(p, q, one);
    heads.setMatrixAt(i, m);
    heads.setColorAt(i, color.set(SKIN[hashIndex(s.mpId || 'x', SKIN.length)]));
    torsos.setColorAt(i, color.set('#555'));
  });
  for (const im of [torsos, heads]) {
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }
  return {
    group,
    torsos,
    // Party colour, or the mood colour where the player can read it.
    tint(colorFor) {
      seats.forEach((s, i) => torsos.setColorAt(i, color.set(colorFor(s.mpId))));
      torsos.instanceColor.needsUpdate = true;
    },
  };
}
