// Constituent figures with a colour for their role, and the town hall crowd from the shared figure kit.
import { createVisitor } from '../office/visitor.js';
import { contactShadows } from '../kit3d.js';
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

export function createConstituent(scene, { role, id, path, seat, facing }) {
  return createVisitor(scene, { color: ROLE_COLORS[role] || '#777', mpId: id, path, seat, facing });
}

// 20-30 people standing in the street for a town hall, facing the podium: six draw calls plus their shadows.
export function createCrowd(count, colorFor) {
  const crowd = createFigureCrowd(count, { pose: 'standing' });
  const feet = [];
  for (let i = 0; i < count; i++) {
    const id = `crowd-${i}`;
    const look = lookFor(id);
    const row = Math.floor(i / 7);
    const col = i % 7;
    const x = (col - 3) * 0.75 + (row % 2) * 0.35 + look.yaw;
    const z = 4.2 + row * 0.9 + look.lean * 2;
    crowd.place(i, { x, z, rotY: Math.PI, scale: look.height, yaw: look.yaw * 2 });
    crowd.dress(i, { ...look, suit: shade(colorFor(i), id, 0.1) });
    feet.push({ x, z, sx: 0.9, sz: 0.9 });
  }
  crowd.commit();
  crowd.group.add(contactShadows(feet, { radius: 0.5 }));
  const g = crowd.group;
  return {
    group: g,
    // The crowd's mood shows in how close they stand: pressing in when they're with you, hanging back when not.
    setMood(v) {
      g.position.z = v < 40 ? 0.6 : v > 60 ? -0.4 : 0;
    },
    update(dt) {
      crowd.update(dt);
    },
  };
}
