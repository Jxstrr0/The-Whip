// Riding office camera: fixed behind the desk looking at the visitor's chair; a cut to the town hall crowd.
import * as THREE from 'three';
import { sideAim, aimCamera } from '../framing.js';

const DEG = Math.PI / 180;
// The desk is at z = -1 and the player faces +z, so "behind the desk" is the -z side.
export const RIDING_SHOTS = {
  desk: { pos: [0.6, 1.5, -2.15], look: [0.05, 1.1, -0.1], drop: 0.78 },
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
  let drop = RIDING_SHOTS.desk.drop;
  let side = 0;
  let sway = 0;
  return {
    shot(name, snap = false) {
      drop = RIDING_SHOTS[name].drop;
      gp.set(...RIDING_SHOTS[name].pos);
      gl.set(...RIDING_SHOTS[name].look);
      if (snap) {
        pos.copy(gp);
        look.copy(gl);
      }
    },
    update(dt) {
      const k = 1 - Math.exp(-dt * 3);
      pos.lerp(gp, k);
      look.lerp(gl, k);
      sway += dt;
      camera.position.set(pos.x + Math.sin(sway * 0.5) * 0.008, pos.y + Math.sin(sway * 0.7) * 0.005, pos.z);
      aimCamera(camera, look, portrait ? drop : 0.08, side);
    },
    fitAspect(aspect, cssWidth = 0) {
      portrait = aspect < 1;
      camera.fov = Math.max(48, Math.min(76, (2 * Math.atan(Math.tan(23 * DEG) / Math.max(aspect, 0.3))) / DEG));
      side = sideAim(aspect, camera.fov, cssWidth);
      camera.updateProjectionMatrix();
    },
  };
}
