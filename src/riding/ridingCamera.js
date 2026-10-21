// Riding office camera: fixed behind the desk looking at the visitor's chair; a cut to the town hall crowd.
import * as THREE from 'three';

const DEG = Math.PI / 180;
// The handoff puts the camera "behind the desk at (0.4, 1.6, 0.4)", but the desk is at z = -1 and the
// player faces +z, so behind the desk is the -z side. These keep the same height and offset.
export const RIDING_SHOTS = {
  desk: { pos: [0.4, 1.6, -2.3], look: [0, 1.0, -0.15], drop: 1.0 },
  townHall: { pos: [0, 2.1, 1.2], look: [0, 1.3, 7.5], drop: 3.2 },
};

export function createRidingCamera(camera) {
  const pos = new THREE.Vector3(...RIDING_SHOTS.desk.pos);
  const look = new THREE.Vector3(...RIDING_SHOTS.desk.look);
  const gp = pos.clone();
  const gl = look.clone();
  let portrait = false;
  let drop = RIDING_SHOTS.desk.drop;
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
      camera.position.copy(pos);
      camera.lookAt(look.x, look.y - (portrait ? drop : 0), look.z);
    },
    fitAspect(aspect) {
      portrait = aspect < 1;
      camera.fov = Math.max(52, Math.min(78, (2 * Math.atan(Math.tan(25 * DEG) / Math.max(aspect, 0.3))) / DEG));
      camera.updateProjectionMatrix();
    },
  };
}
