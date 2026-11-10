// The office camera: fixed over the player's shoulder, with small eases (settle, push-in, the reversal).
// In portrait the person you're dealing with sits in the clear part of the screen above the sheet, however
// tall the sheet is: a talking sheet at half height frames them head to lap, a full one keeps their face.
import * as THREE from 'three';
import { sideAim, aimCamera, dropFor } from '../framing.js';

const DEG = Math.PI / 180;
// In portrait the person sits a third of the way left of the middle, with their line beside them.
const ACROSS = 0.34;
// How far (metres) the camera backs off for a half-height sheet in portrait.
const BACK = 0.4;
export const SHOTS = {
  host: { pos: [0.6, 1.5, 1.45], look: [-0.5, 1.15, -1.0], subject: true },
  hostDeal: { pos: [0.55, 1.45, 1.1], look: [-0.5, 1.1, -1.0], subject: true },
  // Act 1 reversal: you sit on the visitor's side and the whip is behind the desk.
  reversal: { pos: [1.05, 1.5, -1.7], look: [0, 1.15, 0.9], subject: true },
  reversalDeal: { pos: [0.95, 1.45, -1.3], look: [0, 1.1, 0.9], subject: true },
  empty: { pos: [0.9, 1.6, 1.9], look: [-0.3, 1.0, -1.1], drop: 1.15 },
};

// `empty` overrides the empty-room shot: each office set frames itself from its own door.
export function createOfficeCamera(camera, { empty = SHOTS.empty } = {}) {
  const pos = new THREE.Vector3(...SHOTS.empty.pos);
  const look = new THREE.Vector3(...SHOTS.empty.look);
  const goalPos = pos.clone();
  const goalLook = look.clone();
  let sway = 0;
  let portrait = false;
  // How much of a portrait screen is clear above the paper (set by the sheet as it changes height), and the
  // drop that follows from it, eased so a sheet growing or shrinking tilts the view rather than cutting it.
  let clear = 0.5;
  let drop = 1.15;
  let fixedDrop = null;
  let subject = false;
  let aimSide = 0;
  let sideOn = 0;
  // A low sheet frames the person head to lap: the camera eases back along its own line of sight (the rooms
  // are small, so only a little) so more of them fits in the clear part of the screen.
  let back = 0;
  const away = new THREE.Vector3();
  // A dolly: a timed move from where the camera is to the shot, eased both ends, for a visitor walking in
  // (the exponential settle below is for the small moves; a cut-and-settle on an arrival read as a cut).
  const dolly = { on: false, t: 0, len: 0, pos: new THREE.Vector3(), look: new THREE.Vector3() };
  camera.position.copy(pos);
  camera.lookAt(look);
  const goalDrop = () => (fixedDrop ?? dropFor(clear, camera.fov, pos.distanceTo(look) + back, { at: 0.38, minTop: 0.13 }));
  const goalBack = () => (portrait && subject ? BACK * Math.max(0, Math.min(1, (0.75 - clear) / 0.3)) : 0);
  return {
    shot(name, snap = false) {
      const s = name === 'empty' ? empty : SHOTS[name];
      goalPos.set(...s.pos);
      goalLook.set(...s.look);
      // A shot with a subject frames them from the sheet's height; an empty room aims where its set says.
      subject = !!s.subject;
      fixedDrop = s.subject ? null : s.drop ?? 1.15;
      dolly.on = false;
      if (snap) {
        pos.copy(goalPos);
        look.copy(goalLook);
        drop = goalDrop();
        sideOn = subject ? 1 : 0;
        back = goalBack();
      }
    },
    // Move to a shot over `seconds`, starting from wherever the camera is now.
    dolly(name, seconds) {
      this.shot(name);
      if (!(seconds > 0)) return;
      dolly.on = true;
      dolly.t = 0;
      dolly.len = seconds;
      dolly.pos.copy(pos);
      dolly.look.copy(look);
    },
    setClear(f) {
      clear = f;
    },
    update(dt) {
      const k = 1 - Math.exp(-dt * 2.5);
      if (dolly.on) {
        dolly.t += dt;
        const x = Math.min(1, dolly.t / dolly.len);
        const u = x * x * (3 - 2 * x);
        pos.lerpVectors(dolly.pos, goalPos, u);
        look.lerpVectors(dolly.look, goalLook, u);
        if (x >= 1) dolly.on = false;
      } else {
        pos.lerp(goalPos, k);
        look.lerp(goalLook, k);
      }
      drop += (goalDrop() - drop) * k;
      sideOn += ((subject ? 1 : 0) - sideOn) * k;
      back += (goalBack() - back) * k;
      sway += dt;
      away.copy(pos).sub(look).normalize().multiplyScalar(back);
      camera.position.set(pos.x + away.x + Math.sin(sway * 0.5) * 0.01, pos.y + away.y + Math.sin(sway * 0.7) * 0.006, pos.z + away.z);
      // Landscape keeps its side turn for every shot; portrait only turns to leave room beside a person.
      aimCamera(camera, look, portrait ? drop : 0.1, portrait ? aimSide * sideOn : aimSide);
    },
    fitAspect(aspect, cssWidth = 0) {
      portrait = aspect < 1;
      camera.fov = Math.max(46, Math.min(74, (2 * Math.atan(Math.tan(22 * DEG) / Math.max(aspect, 0.3))) / DEG));
      aimSide = sideAim(aspect, camera.fov, cssWidth, ACROSS);
      camera.updateProjectionMatrix();
    },
  };
}
