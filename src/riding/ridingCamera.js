// Riding office camera: fixed behind the desk looking at the visitor's chair; a cut to the town hall crowd.
// In portrait the visitor sits in the clear part of the screen above the sheet, whatever its height.
import * as THREE from 'three';
import { sideAim, aimCamera, dropFor } from '../framing.js';

const DEG = Math.PI / 180;
// In portrait the person sits a third of the way left of the middle, with their line beside them.
const ACROSS = 0.34;
// How far (metres) the camera backs off for a half-height sheet in portrait: the visitor's chair is close to
// the desk, so a low sheet needs the step back to frame them head to lap.
const BACK = 0.45;
// How much higher (metres) the camera looks for a visitor who stands rather than sits.
const LIFT = 0.38;
// The desk is at z = -1 and the player faces +z, so "behind the desk" is the -z side.
export const RIDING_SHOTS = {
  desk: { pos: [0.6, 1.5, -2.15], look: [0.05, 1.1, -0.1], subject: true },
  townHall: { pos: [0.3, 2.0, 3.0], look: [0, 1.35, 8.0], drop: 1.8 },
  // Election night: a step back into the doorway and a touch lower, so the bunting over the street is in.
  electionNight: { pos: [0.3, 1.7, 2.45], look: [0, 1.75, 8.0], drop: 1.6 },
};

export function createRidingCamera(camera) {
  const pos = new THREE.Vector3(...RIDING_SHOTS.desk.pos);
  const look = new THREE.Vector3(...RIDING_SHOTS.desk.look);
  const gp = pos.clone();
  const gl = look.clone();
  let portrait = false;
  let clear = 0.5;
  let drop = 0.78;
  let fixedDrop = null;
  let subject = true;
  let side = 0;
  let sideOn = 1;
  let sway = 0;
  let back = 0;
  let lift = 0;
  let goalLift = 0;
  const away = new THREE.Vector3();
  const at = new THREE.Vector3();
  const goalDrop = () => (fixedDrop ?? dropFor(clear, camera.fov, pos.distanceTo(look) + back, { at: 0.5, minTop: 0.13 }));
  const goalBack = () => (portrait && subject ? BACK * Math.max(0, Math.min(1, (0.75 - clear) / 0.3)) : 0);
  return {
    shot(name, snap = false) {
      const s = RIDING_SHOTS[name];
      subject = !!s.subject;
      fixedDrop = s.subject ? null : s.drop;
      gp.set(...s.pos);
      gl.set(...s.look);
      if (snap) {
        pos.copy(gp);
        look.copy(gl);
        drop = goalDrop();
        sideOn = subject ? 1 : 0;
        back = goalBack();
      }
    },
    setClear(f) {
      clear = f;
    },
    // A standing visitor's head is well above the chair's: look higher while they're in.
    standing(on) {
      goalLift = on ? LIFT : 0;
    },
    update(dt) {
      const k = 1 - Math.exp(-dt * 3);
      pos.lerp(gp, k);
      look.lerp(gl, k);
      drop += (goalDrop() - drop) * k;
      sideOn += ((subject ? 1 : 0) - sideOn) * k;
      back += (goalBack() - back) * k;
      lift += (goalLift - lift) * k;
      sway += dt;
      away.copy(pos).sub(look).normalize().multiplyScalar(back);
      camera.position.set(pos.x + away.x + Math.sin(sway * 0.5) * 0.008, pos.y + away.y + Math.sin(sway * 0.7) * 0.005, pos.z + away.z);
      at.set(look.x, look.y + lift, look.z);
      aimCamera(camera, at, portrait ? drop : 0.08, portrait ? side * sideOn : side);
    },
    fitAspect(aspect, cssWidth = 0) {
      portrait = aspect < 1;
      camera.fov = Math.max(48, Math.min(76, (2 * Math.atan(Math.tan(23 * DEG) / Math.max(aspect, 0.3))) / DEG));
      side = sideAim(aspect, camera.fov, cssWidth, ACROSS);
      camera.updateProjectionMatrix();
    },
  };
}
