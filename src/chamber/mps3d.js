// The 120 MPs in their seats, drawn from the shared figure kit as one instanced crowd, plus the selection outline.
import * as THREE from 'three';
import { createFigureCrowd, lookFor, wardrobe } from '../figures.js';

export function createMpFigures(records) {
  const n = records.length;
  const crowd = createFigureCrowd(n, { pose: 'seated' });
  const outline = new THREE.Mesh(crowd.parts.suit.clone(), new THREE.MeshBasicMaterial({ color: '#f2c14e', side: THREE.BackSide }));
  outline.visible = false;
  outline.matrixAutoUpdate = false;
  const group = new THREE.Group();
  group.add(crowd.group, outline);

  const seatIndex = new Map(records.map((s, i) => [s.seatId, i]));
  let occupant = new Map();
  const grow = new THREE.Matrix4().makeScale(1.1, 1.05, 1.14);

  function seatOf(i, s, look) {
    crowd.place(i, { x: s.x, y: s.y, z: s.z, rotY: s.rotationY, scale: look.height, lean: look.lean, yaw: look.yaw });
  }

  return {
    group,
    // Re-dress every seat from game state: who sits where, in their party's colour.
    sync(state, colorOf) {
      occupant = new Map();
      records.forEach((s, i) => {
        const mpId = state.seats[s.seatId]?.mpId;
        occupant.set(s.seatId, mpId || null);
        if (!mpId) {
          crowd.show(i, false);
          return;
        }
        const look = lookFor(mpId);
        seatOf(i, s, look);
        crowd.dress(i, { ...look, ...wardrobe(mpId, colorOf(state.mps[mpId]), { bench: true }) });
      });
      crowd.commit();
    },
    mpAt(seatId) {
      return occupant.get(seatId) || null;
    },
    // Hide or show one MP (absent members leave an empty chair during a division).
    setPresent(seatId, present) {
      const i = seatIndex.get(seatId);
      if (i == null || !occupant.get(seatId)) return;
      crowd.show(i, present);
      crowd.commit();
    },
    select(seatId) {
      const i = seatId != null ? seatIndex.get(seatId) : null;
      outline.visible = i != null && !!occupant.get(seatId);
      if (outline.visible) outline.matrix.copy(crowd.baseMatrix(i)).multiply(grow);
    },
    update(dt) {
      crowd.update(dt);
    },
  };
}
