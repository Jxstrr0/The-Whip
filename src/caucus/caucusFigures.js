// Seated MPs around the caucus table from the shared figure kit, tinted by mood in the whip's read (when you know it).
import * as THREE from 'three';
import { createFigureCrowd, lookFor, shade } from '../figures.js';

export const MOOD_TINT = { cooperative: '#2E9E5B', guarded: '#8A8F98', angry: '#C8423B', anxious: '#E0A526' };

export function createCaucusFigures(seats) {
  const crowd = createFigureCrowd(seats.length, { pose: 'seated' });
  const color = new THREE.Color();
  seats.forEach((s, i) => {
    const look = lookFor(s.mpId || 'x');
    crowd.place(i, { x: s.x, z: s.z, rotY: s.rotY, scale: look.height, lean: look.lean, yaw: look.yaw });
    crowd.dress(i, { ...look, suit: '#555' });
  });
  crowd.commit();
  return {
    group: crowd.group,
    torsos: crowd.torsos,
    // Party colour, or the mood colour where the player can read it.
    tint(colorFor) {
      seats.forEach((s, i) => crowd.meshes.suit.setColorAt(i, color.set(shade(colorFor(s.mpId), s.mpId))));
      crowd.meshes.suit.instanceColor.needsUpdate = true;
    },
    update(dt) {
      crowd.update(dt);
    },
  };
}
