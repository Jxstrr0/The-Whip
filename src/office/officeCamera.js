// The office camera: fixed over the player's shoulder, with small eases (settle, push-in, the reversal).
// The person you're dealing with sits in the top third of a portrait screen, above the sheet.
import * as THREE from 'three';

const DEG = Math.PI / 180;
export const SHOTS = {
  host: { pos: [0.6, 1.5, 1.45], look: [-0.5, 1.15, -1.0] },
  hostDeal: { pos: [0.55, 1.45, 1.1], look: [-0.5, 1.1, -1.0] },
  // Act 1 reversal: you sit on the visitor's side and the whip is behind the desk.
  reversal: { pos: [1.05, 1.5, -1.7], look: [0, 1.15, 0.9] },
  reversalDeal: { pos: [0.95, 1.45, -1.3], look: [0, 1.1, 0.9] },
  empty: { pos: [0.9, 1.6, 1.9], look: [-0.3, 1.0, -1.1] },
};

export function createOfficeCamera(camera) {
  const pos = new THREE.Vector3(...SHOTS.empty.pos);
  const look = new THREE.Vector3(...SHOTS.empty.look);
  const goalPos = pos.clone();
  const goalLook = look.clone();
  let sway = 0;
  // In portrait the bottom sheet covers the lower half, so aim lower and the people sit in the upper third.
  let aimDrop = 0;
  camera.position.copy(pos);
  camera.lookAt(look);
  return {
    shot(name, snap = false) {
      const s = SHOTS[name];
      goalPos.set(...s.pos);
      goalLook.set(...s.look);
      if (snap) {
        pos.copy(goalPos);
        look.copy(goalLook);
      }
    },
    update(dt) {
      const k = 1 - Math.exp(-dt * 2.5);
      pos.lerp(goalPos, k);
      look.lerp(goalLook, k);
      sway += dt;
      camera.position.set(pos.x + Math.sin(sway * 0.5) * 0.01, pos.y + Math.sin(sway * 0.7) * 0.006, pos.z);
      camera.lookAt(look.x, look.y - aimDrop, look.z);
    },
    fitAspect(aspect) {
      aimDrop = aspect < 1 ? 1.15 : 0.1;
      camera.fov = Math.max(46, Math.min(74, (2 * Math.atan(Math.tan(22 * DEG) / Math.max(aspect, 0.3))) / DEG));
      camera.updateProjectionMatrix();
    },
  };
}
