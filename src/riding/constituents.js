// Constituent figures with a colour for their role, and the instanced town hall crowd.
import * as THREE from 'three';
import { createVisitor } from '../office/visitor.js';

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

// 20-30 figures standing in the street for a town hall, two draw calls.
export function createCrowd(count, colorFor) {
  const torsos = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.19, 0.5, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), count);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.6, color: '#d6a07a' }), count);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 7);
    const col = i % 7;
    const x = (col - 3) * 0.75 + (row % 2) * 0.35;
    const z = 4.2 + row * 0.9;
    m.makeTranslation(x, 0.95, z);
    torsos.setMatrixAt(i, m);
    m.makeTranslation(x, 1.55, z);
    heads.setMatrixAt(i, m);
    torsos.setColorAt(i, c.set(colorFor(i)));
  }
  const g = new THREE.Group();
  g.add(torsos, heads);
  return {
    group: g,
    // The crowd's mood shows in how close they stand: pressing in when they're with you, hanging back when not.
    setMood(v) {
      g.position.z = v < 40 ? 0.6 : v > 60 ? -0.4 : 0;
    },
  };
}
