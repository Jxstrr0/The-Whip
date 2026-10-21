// Raycast a tap against the per-seat pick boxes: tap -> instanceId -> seat record (and later, MP id).
import * as THREE from 'three';

// From the default camera the rays graze the rows, so a tap often passes through several pick boxes.
// Of the instances hit, take the one whose seated head sits closest to the ray, which is what the thumb meant.
export function createPicker(camera, pickMesh, records) {
  const ray = new THREE.Raycaster();
  const head = new THREE.Vector3();
  return {
    pick(ndc) {
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(pickMesh, false);
      let best = null;
      let bestD = Infinity;
      for (const h of hits) {
        if (h.instanceId == null) continue;
        const s = records[h.instanceId];
        head.set(s.x, s.y + 1.1, s.z);
        const d = ray.ray.distanceSqToPoint(head);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    },
  };
}
