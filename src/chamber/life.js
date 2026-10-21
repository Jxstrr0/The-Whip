// Life in the chamber on an ordinary day: now and then a member slips out up the aisle and another comes back,
// the Clerks stand for the count, and the Speaker's gavel falls on a result. All cosmetic: nothing here
// touches the sim.
import * as THREE from 'three';
import { createFigure, poseFigure, stride } from '../office/visitor.js';
import { createFigureCrowd, lookFor, wardrobe } from '../figures.js';
import { faceOf } from '../faces.js';
import { GEOMETRY as G, walkerPath } from './layout.js';
import { box, cylinder, merge, vertexMaterial } from '../kit3d.js';
import { tuning } from '../sim/config.js';

const WALK = 1.5; // m/s: a member leaving the chamber, not running for a train

export function createChamberLife({ scene, seats, figures, getState, colorOf }) {
  const L = G.floorLength / 2;
  const t = G.clerkTable;

  // Two Clerks at the Speaker's end of the table, facing the chair: seated, and standing for the count.
  const spots = [[-0.45, t.zFrom - 0.5], [0.45, t.zFrom - 0.5]];
  const seated = createFigureCrowd(2, { pose: 'seated' });
  const standing = createFigureCrowd(2, { pose: 'standing' });
  spots.forEach(([x, z], i) => {
    const look = lookFor(`clerk-${i}`);
    seated.place(i, { x, z, rotY: Math.PI, scale: look.height, yaw: look.yaw });
    seated.dress(i, { ...look, suit: '#15161a' });
    standing.place(i, { x, z: z - 0.15, rotY: Math.PI, scale: look.height });
    standing.dress(i, { ...look, suit: '#15161a' });
  });
  seated.commit();
  standing.commit();
  standing.group.visible = false;
  scene.add(seated.group, standing.group);

  // The gavel on the dais beside the Speaker: a pivot at the handle's end, so it lifts and falls.
  const gavel = new THREE.Group();
  gavel.position.set(0.62, G.dais.height + 0.02, G.dais.z + 0.7);
  gavel.add(new THREE.Mesh(merge([cylinder(0.012, 0.012, 0.22, -0.11, 0.02, 0, '#3f2a17', 8, 'x'), cylinder(0.035, 0.035, 0.09, -0.22, 0.03, 0, '#3f2a17', 10, 'z')]), vertexMaterial({ roughness: 0.6 })));
  scene.add(gavel);
  let gavelT = -1;

  let walker = null;
  let timer = tuning().look.walkerEvery * 0.6;
  const away = new Map(); // seatId -> mpId, for members who are out of the chamber
  let onFeet = null; // { seatId, f, t }: the member on their feet in Question Period

  function makeWalker(mpId, pts, onDone) {
    const state = getState();
    const f = createFigure(colorOf(state.mps[mpId]), mpId, wardrobe(mpId, colorOf(state.mps[mpId]), { bench: true }), faceOf(state, mpId));
    poseFigure(f, 'walking', 1);
    f.group.position.set(...pts[0]);
    scene.add(f.group);
    let leg = 0;
    let tt = 0;
    return {
      update(dt) {
        tt += dt;
        const target = pts[leg + 1];
        if (!target) return;
        const pos = f.group.position;
        const dir = new THREE.Vector3(target[0] - pos.x, target[1] - pos.y, target[2] - pos.z);
        const dist = dir.length();
        const step = WALK * dt;
        f.group.rotation.y = Math.atan2(dir.x, dir.z);
        stride(f, tt);
        if (dist <= step) {
          pos.set(...target);
          leg++;
          if (leg >= pts.length - 1) onDone();
        } else pos.addScaledVector(dir.normalize(), step);
      },
      dispose() {
        scene.remove(f.group);
        f.group.traverse((o) => o.geometry?.dispose());
        f.materials.forEach((m) => m.dispose());
      },
    };
  }

  function startLeave(homeSeatId) {
    const state = getState();
    if (!state) return;
    const candidates = seats.records.filter((s) => {
      const id = figures.mpAt(s.seatId);
      return id && id !== state.player.mpId && s.seatId !== homeSeatId && s.seatId !== onFeet?.seatId && !away.has(s.seatId) && walkerPath(s, true);
    });
    if (!candidates.length) return;
    const s = candidates[Math.floor(Math.random() * candidates.length)];
    const mpId = figures.mpAt(s.seatId);
    away.set(s.seatId, mpId);
    figures.setPresent(s.seatId, false);
    walker = makeWalker(mpId, walkerPath(s, true), () => {
      walker.dispose();
      walker = null;
    });
  }

  function startReturn() {
    const [seatId, mpId] = [...away.entries()][Math.floor(Math.random() * away.size)];
    const s = seats.byId.get(seatId);
    walker = makeWalker(mpId, walkerPath(s, false), () => {
      walker.dispose();
      walker = null;
      away.delete(seatId);
      figures.setPresent(seatId, true);
    });
  }

  // Stand a member up at their seat (the seated instance steps aside) and sit them down again.
  function sit() {
    if (!onFeet) return;
    scene.remove(onFeet.f.group);
    onFeet.f.group.traverse((o) => o.geometry?.dispose());
    onFeet.f.materials.forEach((m) => m.dispose());
    if (!away.has(onFeet.seatId)) figures.setPresent(onFeet.seatId, true);
    onFeet = null;
  }

  function stand(seatId, mpId) {
    if (onFeet?.seatId === seatId) return;
    sit();
    const state = getState();
    const s = seats.byId.get(seatId);
    const mp = state?.mps[mpId];
    if (!s || !mp) return;
    const color = colorOf(mp);
    const f = createFigure(color, mpId, wardrobe(mpId, color, { bench: true }), faceOf(state, mpId));
    poseFigure(f, 'standing', 1);
    f.group.position.set(s.x, s.y, s.z);
    f.group.rotation.y = s.rotationY;
    scene.add(f.group);
    figures.setPresent(seatId, false);
    onFeet = { seatId, f, t: 0 };
  }

  return {
    stand,
    sit,
    get standingSeat() {
      return onFeet?.seatId ?? null;
    },
    clerksStand(on) {
      seated.group.visible = !on;
      standing.group.visible = on;
    },
    gavel() {
      gavelT = 0;
    },
    // A new sitting: everyone back in their seats, nobody mid-aisle.
    reset() {
      walker?.dispose();
      walker = null;
      sit();
      for (const seatId of away.keys()) figures.setPresent(seatId, true);
      away.clear();
      timer = tuning().look.walkerEvery * 0.6;
    },
    update(dt, busy, homeSeatId) {
      walker?.update(dt);
      seated.update(dt);
      if (onFeet) {
        // On their feet and speaking: a little weight shift, the head turning to the chair and back, one hand
        // making the point.
        const st = (onFeet.t += dt);
        const f = onFeet.f;
        f.body.rotation.z = Math.sin(st * 0.9) * 0.025;
        f.head.rotation.y = Math.sin(st * 0.6) * 0.3 - 0.15;
        f.head.rotation.x = Math.sin(st * 1.7) * 0.04;
        f.arms[0].sh.rotation.x = -0.75 + Math.sin(st * 2.2) * 0.2;
        f.arms[0].el.rotation.x = -1.25 + Math.sin(st * 2.2 + 1) * 0.15;
      }
      if (gavelT >= 0) {
        gavelT += dt;
        // Lift over 0.25 s, drop fast, a small bounce, rest.
        const a = gavelT < 0.25 ? gavelT / 0.25 : gavelT < 0.35 ? 1 - (gavelT - 0.25) / 0.1 : gavelT < 0.5 ? 0.25 * Math.sin(((gavelT - 0.35) / 0.15) * Math.PI) : 0;
        gavel.rotation.z = a * 0.7;
        if (gavelT > 0.6) gavelT = -1;
      }
      if (busy) return;
      timer -= dt;
      if (walker || timer > 0) return;
      timer = tuning().look.walkerEvery * (0.7 + Math.random() * 0.6);
      if (away.size && (away.size >= 2 || Math.random() < 0.5)) startReturn();
      else startLeave(homeSeatId);
    },
    dispose() {
      walker?.dispose();
      walker = null;
      sit();
      seated.dispose();
      standing.dispose();
    },
  };
}
