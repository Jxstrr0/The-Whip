// The 120 MPs in their seats, drawn from the shared figure kit as one instanced crowd, plus the selection
// outline. The crowd is alive on its own (breathing, glances, shifting in the seat); this is where the House
// reacts as a House: standing to be counted, turning to whoever is on their feet, thumping the desks.
import * as THREE from 'three';
import { createFigureCrowd, lookFor, wardrobe } from '../figures.js';
import { faceOf } from '../faces.js';

export function createMpFigures(records) {
  const n = records.length;
  const crowd = createFigureCrowd(n, { pose: 'seated' });
  const outline = new THREE.Mesh(crowd.parts.jacket.clone(), new THREE.MeshBasicMaterial({ color: '#f2c14e', side: THREE.BackSide }));
  outline.visible = false;
  outline.matrixAutoUpdate = false;
  const group = new THREE.Group();
  group.add(crowd.group, outline);

  const seatIndex = new Map(records.map((s, i) => [s.seatId, i]));
  let occupant = new Map();
  const grow = new THREE.Matrix4().makeScale(1.1, 1.05, 1.14);
  let selected = null;
  const standing = new Set();

  function seatOf(i, s, look) {
    crowd.place(i, { x: s.x, y: s.y, z: s.z, rotY: s.rotationY, scale: look.height, lean: look.lean, yaw: look.yaw });
  }
  // The indexes of the members present that `filter(seatRecord, mpId)` picks (everyone when it's null).
  function pick(filter) {
    const out = [];
    records.forEach((s, i) => {
      const mpId = occupant.get(s.seatId);
      if (mpId && crowd.isShown(i) && (!filter || filter(s, mpId))) out.push(i);
    });
    return out;
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
        crowd.dress(i, { ...look, ...wardrobe(mpId, colorOf(state.mps[mpId]), { bench: true }), face: faceOf(state, mpId) });
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
      selected = seatId != null && occupant.get(seatId) ? seatIndex.get(seatId) : null;
      outline.visible = selected != null;
    },
    // Where a seat is, at head height: what the rest of the House turns to.
    seatPoint(seatId) {
      const s = records[seatIndex.get(seatId)];
      return s ? [s.x, s.y + 1.4, s.z] : null;
    },
    // On their feet at their seat (to be counted, or to speak) and back down.
    rise(seatId, on) {
      const i = seatIndex.get(seatId);
      if (i == null || !occupant.get(seatId)) return;
      if (on) standing.add(i);
      else standing.delete(i);
      crowd.rise(i, on);
    },
    // Everyone standing sits again.
    sitAll() {
      for (const i of standing) crowd.rise(i, false);
      standing.clear();
    },
    // Making a point on their feet: one hand working, the head between the chair and the other side.
    speak(seatId, on) {
      const i = seatIndex.get(seatId);
      if (i == null) return;
      if (on) crowd.fidget(i, 'speaking', { delay: 0.5 });
      else crowd.calm(i);
    },
    // The House turns to a point (a member on their feet), or settles back (null). `filter` narrows who.
    attention(point, filter = null, opts = {}) {
      crowd.attention(point, { only: pick(filter), delay: 1.2, ...opts });
    },
    // A reaction across the benches: 'thump' (desks), 'settle', 'glance', 'nod', 'papers'…
    react(kind, filter = null, opts = {}) {
      crowd.react(kind, { only: pick(filter), ...opts });
    },
    // The bells: a stir along the benches, people looking round and shifting in their seats.
    stir() {
      crowd.react('glance', { chance: 0.45, delay: 2.5 });
      crowd.react('settle', { chance: 0.3, delay: 3 });
    },
    update(dt) {
      crowd.update(dt);
      if (selected != null) outline.matrix.copy(crowd.bodyMatrix(selected)).multiply(grow);
    },
  };
}
