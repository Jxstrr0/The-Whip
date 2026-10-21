// Caucus camera: seated eye height just behind your own chair, looking along the table. Drag pans the look
// along the table within limits; Speak turns it to the head of the table and back.
import * as THREE from 'three';

const DEG = Math.PI / 180;

export function createCaucusCamera(camera, el, from) {
  let pan = 0; // metres along the table, toward the foot (+z) or head (-z)
  let goal = 0;
  const limits = [-6, 6];
  const pointers = new Map();
  let aimDrop = 0;
  let head = false;
  const side = from.x < 0 ? -1 : 1;
  // Stand a step back from your chair, a little outside the row, so your neighbours' backs frame the shot.
  const home = new THREE.Vector3(from.x + side * 1.1, 1.95, Math.max(-6.5, Math.min(8.5, from.z + 1.3)));
  const headPos = new THREE.Vector3(from.x * 0.6, 1.9, Math.max(-6.0, Math.min(8.0, from.z + 0.4)));
  const pos = home.clone();
  const look = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  function down(e) {
    pointers.set(e.pointerId, e.clientY);
  }
  function move(e) {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, e.clientY);
    if (!head) goal = Math.max(limits[0], Math.min(limits[1], goal + ((e.clientY - prev) / (el.clientHeight || 800)) * 10));
  }
  function upEv(e) {
    pointers.delete(e.pointerId);
  }
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', upEv);
  el.addEventListener('pointercancel', upEv);
  look.set(0, 0.95, home.z - 4);
  return {
    focusHead(on) {
      head = on;
    },
    update(dt) {
      pan += (goal - pan) * (1 - Math.exp(-dt * 6));
      const k = 1 - Math.exp(-dt * 2.5);
      if (head) {
        pos.lerp(headPos, k);
        goalLook.set(0, 1.15, -7.4);
      } else {
        pos.lerp(home, k);
        goalLook.set(0, 0.95, Math.max(-8, Math.min(8, home.z - 4 + pan)));
      }
      look.lerp(goalLook, k);
      camera.position.copy(pos);
      camera.lookAt(look.x, look.y - aimDrop, look.z);
    },
    fitAspect(aspect) {
      aimDrop = aspect < 1 ? 1.0 : 0.15;
      camera.fov = Math.max(50, Math.min(78, (2 * Math.atan(Math.tan(25 * DEG) / Math.max(aspect, 0.3))) / DEG));
      camera.updateProjectionMatrix();
    },
    dispose() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', upEv);
      el.removeEventListener('pointercancel', upEv);
    },
  };
}
