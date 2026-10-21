// Instanced MP figures (a capsule torso and a sphere head for all 120: two draw calls) and the selection outline.
import * as THREE from 'three';
import { figureMaterial } from '../kit3d.js';

const SKIN = ['#f1c8a5', '#e0ac85', '#c68d63', '#a26b45', '#7c4f31', '#5b3a24', '#efd2b8', '#d6a07a'];
const TORSO_Y = 0.85;
const HEAD_Y = 1.33;
const LEAN = 0.08; // seated MPs lean a little toward their desk

// Cosmetic only, so a cheap string hash is fine here (sim randomness never comes from this).
function hashIndex(id, n) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

export function createMpFigures(records) {
  const n = records.length;
  const torsoGeo = new THREE.CapsuleGeometry(0.19, 0.36, 4, 10);
  const headGeo = new THREE.SphereGeometry(0.125, 14, 10);
  const torsos = new THREE.InstancedMesh(torsoGeo, figureMaterial({ roughness: 0.75 }), n);
  const heads = new THREE.InstancedMesh(headGeo, figureMaterial({ roughness: 0.6 }), n);
  const outline = new THREE.Mesh(torsoGeo.clone().scale(1.18, 1.1, 1.18), new THREE.MeshBasicMaterial({ color: '#f2c14e', side: THREE.BackSide }));
  outline.visible = false;
  const group = new THREE.Group();
  group.add(torsos, heads, outline);

  const m = new THREE.Matrix4();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const color = new THREE.Color();
  const seatIndex = new Map(records.map((s, i) => [s.seatId, i]));
  let occupant = new Map();

  function place(i, s, present) {
    if (!present) {
      torsos.setMatrixAt(i, zero);
      heads.setMatrixAt(i, zero);
      return;
    }
    const f = s.side === 'gov' ? LEAN : -LEAN;
    m.makeTranslation(s.x + f, s.y + TORSO_Y, s.z);
    torsos.setMatrixAt(i, m);
    m.makeTranslation(s.x + f * 1.6, s.y + HEAD_Y, s.z);
    heads.setMatrixAt(i, m);
  }

  return {
    group,
    // Re-dress every seat from game state: who sits where, in their party's colour.
    sync(state, colorOf) {
      occupant = new Map();
      records.forEach((s, i) => {
        const mpId = state.seats[s.seatId]?.mpId;
        occupant.set(s.seatId, mpId || null);
        place(i, s, !!mpId);
        if (mpId) {
          torsos.setColorAt(i, color.set(colorOf(state.mps[mpId])));
          heads.setColorAt(i, color.set(SKIN[hashIndex(mpId, SKIN.length)]));
        } else {
          torsos.setColorAt(i, color.set('#000000'));
          heads.setColorAt(i, color.set('#000000'));
        }
      });
      for (const im of [torsos, heads]) {
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
      }
    },
    mpAt(seatId) {
      return occupant.get(seatId) || null;
    },
    // Hide or show one MP (absent members leave an empty chair during a division).
    setPresent(seatId, present) {
      const i = seatIndex.get(seatId);
      if (i == null || !occupant.get(seatId)) return;
      place(i, records[i], present);
      torsos.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
    select(seatId) {
      const i = seatId != null ? seatIndex.get(seatId) : null;
      outline.visible = i != null && !!occupant.get(seatId);
      if (outline.visible) {
        const s = records[i];
        outline.position.set(s.x + (s.side === 'gov' ? LEAN : -LEAN), s.y + TORSO_Y, s.z);
      }
    },
  };
}
