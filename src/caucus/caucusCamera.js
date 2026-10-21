// Caucus camera: from the player's seat, looking along the table toward the head. Drag pans along the table.
import * as THREE from 'three';

const DEG = Math.PI / 180;

export function createCaucusCamera(camera, el, from) {
  let pan = 0; // metres along the table, toward the foot (+z) or head (-z)
  let goal = 0;
  const limits = [-6, 6];
  const pointers = new Map();
  let aimDrop = 0;
  function down(e) {
    pointers.set(e.pointerId, e.clientY);
  }
  function move(e) {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, e.clientY);
    goal = Math.max(limits[0], Math.min(limits[1], goal + ((e.clientY - prev) / (el.clientHeight || 800)) * 10));
  }
  function upEv(e) {
    pointers.delete(e.pointerId);
  }
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', upEv);
  el.addEventListener('pointercancel', upEv);
  const look = new THREE.Vector3();
  return {
    update(dt) {
      pan += (goal - pan) * (1 - Math.exp(-dt * 6));
      // Stand up behind your own chair and look down the table toward the head; drag to look along it.
      const z = Math.max(-6.5, Math.min(8.5, from.z + 1.2));
      camera.position.set(from.x * 0.5, 3.1, z);
      look.set(0, 0.8 - aimDrop, Math.max(-8, Math.min(8, z - 5 + pan)));
      camera.lookAt(look);
    },
    fitAspect(aspect) {
      aimDrop = aspect < 1 ? 2.4 : 0.4;
      camera.fov = Math.max(55, Math.min(80, (2 * Math.atan(Math.tan(26 * DEG) / Math.max(aspect, 0.3))) / DEG));
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
