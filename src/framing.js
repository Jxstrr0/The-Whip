// How a room camera aims around the paper. In portrait the sheet covers the lower part of the screen, so the
// cameras aim down and the person sits in the clear area above it; the sheet's real height sets how far
// (`dropFor`), so a half-height talking sheet shows them head to lap and a full one still keeps their face.
// In landscape the sheet takes the right-hand `--side-w` (min(500px, 52vw), set in css/style.css), so they
// aim right and the people sit in the clear left half. Both are small turns of the look direction; the shots
// themselves stay where the scenes put them.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();

// The sideways turn, in radians, that puts the shot's subject in the middle of the clear area.
// Negative turns right. In portrait the sheet leaves the full width clear, so there is no turn unless the
// room asks for one with `across`: how far left of the middle its subject sits (0 the middle, 1 the edge),
// for a room that puts a person's line beside them.
export function sideAim(aspect, fovDeg, cssWidth, across = 0) {
  if (!cssWidth) return 0;
  const halfWidth = Math.tan((fovDeg * DEG) / 2) * aspect;
  if (aspect < 1) return across ? -Math.atan(across * halfWidth) : 0;
  const sheet = Math.min(500, cssWidth * 0.52) / cssWidth;
  return Math.atan(-sheet * halfWidth);
}

// How far below the look point to aim, in metres, so the subject sits `at` of the way down the clear part
// of a portrait screen. `clear` is the fraction of the screen's height above the sheet (1 with no sheet),
// `dist` the camera's distance to the look point. The subject never goes higher than `minTop` of the screen,
// so a full sheet still leaves their face under the top bar rather than behind it.
export function dropFor(clear, fovDeg, dist, { at = 0.46, minTop = 0.17 } = {}) {
  const top = Math.max(minTop, Math.min(1, clear) * at);
  return dist * (1 - 2 * top) * Math.tan((fovDeg * DEG) / 2);
}

// Point the camera at `look`, lowered by `drop` metres, then turned sideways by `side` radians.
export function aimCamera(camera, look, drop, side) {
  dir.set(look.x, look.y - drop, look.z).sub(camera.position);
  if (side) dir.applyAxisAngle(UP, side);
  camera.lookAt(dir.add(camera.position));
}
