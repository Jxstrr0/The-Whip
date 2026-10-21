// Constituent figures with a colour for their role, and the town hall crowd from the shared figure kit.
import * as THREE from 'three';
import { createVisitor } from '../office/visitor.js';
import { contactShadows, vertexMaterial, box, merge } from '../kit3d.js';
import { createFigureCrowd, lookFor, shade } from '../figures.js';

export const ROLE_COLORS = {
  mayor: '#1f3a5f',
  farmer: '#6b8e3a',
  plantManager: '#6b6f76',
  unionSteward: '#a8322d',
  schoolBoard: '#6a4c93',
  reporter: '#b08a4e',
  associationPresident: '#c9a24a',
};
// The reporter stays on their feet; everyone else takes the chair.
const STANDS = new Set(['reporter']);

export function createConstituent(scene, { role, id, path, seat, facing }) {
  const v = createVisitor(scene, { color: ROLE_COLORS[role] || '#777', mpId: id, path, seat, facing });
  if (STANDS.has(role)) {
    const setMood = v.setMood;
    v.setMood = () => setMood('standing');
    v.setMood();
  }
  return v;
}

// 20-30 people standing in the street for a town hall, facing the podium: six draw calls plus their shadows.
// Their mood shows in how they stand: leaning in with you, arms back and placards up against you.
export function createCrowd(count, colorFor) {
  const crowd = createFigureCrowd(count, { pose: 'standing' });
  const feet = [];
  const spots = [];
  for (let i = 0; i < count; i++) {
    const id = `crowd-${i}`;
    const look = lookFor(id);
    const row = Math.floor(i / 7);
    const col = i % 7;
    const x = (col - 3) * 0.78 + (row % 2) * 0.38 + look.yaw;
    const z = 4.6 + row * 0.95 + look.lean * 2;
    spots.push({ x, z, look });
    crowd.dress(i, { ...look, suit: shade(colorFor(i), id, 0.1) });
    feet.push({ x, z, sx: 0.9, sz: 0.9 });
  }
  const g = crowd.group;
  g.add(contactShadows(feet, { radius: 0.5 }));
  // Four placards for when the room has turned: blank boards on sticks, held up by the back rows.
  const signs = new THREE.Mesh(
    merge([4, 9, 13, 20].map((i) => {
      const s = spots[i];
      return merge([box(0.55, 0.4, 0.03, s.x + 0.25, 2.05, s.z + 0.05, '#ece6d6'), box(0.04, 0.9, 0.04, s.x + 0.25, 1.5, s.z + 0.05, '#6e4a2b')]);
    })),
    vertexMaterial({ roughness: 0.9 })
  );
  signs.visible = false;
  g.add(signs);

  function place(mood) {
    const lean = mood > 60 ? 0.08 : mood < 40 ? -0.07 : 0.01;
    spots.forEach((s, i) => crowd.place(i, { x: s.x, z: s.z, rotY: Math.PI, scale: s.look.height, yaw: s.look.yaw * 2, lean: lean + s.look.lean * 0.3 }));
    crowd.commit();
  }
  place(50);

  return {
    group: g,
    // The crowd's mood: pressing in when they're with you, hanging back with placards when not.
    setMood(v) {
      g.position.z = v < 40 ? 0.5 : v > 60 ? -0.35 : 0;
      signs.visible = v < 35;
      place(v);
    },
    update(dt) {
      crowd.update(dt);
    },
  };
}
