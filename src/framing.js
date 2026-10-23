// How a room camera aims around the paper. In portrait the sheet covers the lower half, so the cameras
// aim down and the people sit in the clear upper third. In landscape the sheet takes the right-hand
// `--side-w` (min(500px, 52vw), set in css/style.css), so they aim right and the people sit in the clear
// left half. Both are small turns of the look direction; the shots themselves stay where the scenes put them.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();

// The sideways turn, in radians, that puts the shot's subject in the middle of the clear area.
// Negative turns right. Zero in portrait, where the sheet leaves the full width clear.
export function sideAim(aspect, fovDeg, cssWidth) {
  if (aspect < 1 || !cssWidth) return 0;
  const sheet = Math.min(500, cssWidth * 0.52) / cssWidth;
  const halfWidth = Math.tan((fovDeg * DEG) / 2) * aspect;
  return Math.atan(-sheet * halfWidth);
}

// Point the camera at `look`, lowered by `drop` metres, then turned sideways by `side` radians.
export function aimCamera(camera, look, drop, side) {
  dir.set(look.x, look.y - drop, look.z).sub(camera.position);
  if (side) dir.applyAxisAngle(UP, side);
  camera.lookAt(dir.add(camera.position));
}
