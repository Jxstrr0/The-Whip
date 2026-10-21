// Instanced desks and chairs for all 120 seats, an invisible pick box per seat, and the selection ring.
import * as THREE from 'three';
import { buildSeats, deskPairOffset } from './layout.js';
import { box, merge, worldUVs } from '../kit3d.js';
import { surface } from '../textures.js';

const DESK_AHEAD = 0.55; // how far the desk sits in front of the chair, toward the aisle

// Modelled facing +z; instances turn them to face the aisle.
function chairGeometry() {
  return merge([
    box(0.62, 0.12, 0.55, 0, 0.42, 0, '#2f5a3c'),
    box(0.62, 0.7, 0.1, 0, 0.8, -0.26, '#2f5a3c'),
    box(0.66, 0.36, 0.6, 0, 0.18, 0, '#4a3220'),
    box(0.68, 0.06, 0.14, 0, 1.17, -0.26, '#6e4a2b'),
  ]);
}

function deskGeometry() {
  return merge([
    box(1.0, 0.72, 0.46, 0, 0.36, 0, '#6e4a2b'),
    box(1.02, 0.04, 0.5, 0, 0.74, 0, '#3a6a48'),
    box(0.03, 0.22, 0.03, 0.2, 0.86, 0.12, '#222222'),
    box(0.03, 0.22, 0.03, -0.2, 0.86, 0.12, '#222222'),
  ]);
}

export function createSeats() {
  const records = buildSeats();
  const group = new THREE.Group();
  const n = records.length;

  const chairs = new THREE.InstancedMesh(worldUVs(chairGeometry()), surface('leather', { roughness: 0.6 }), n);
  const desks = new THREE.InstancedMesh(worldUVs(deskGeometry()), surface('oak', { roughness: 0.55 }), n);
  const pickMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.5, 1.4), new THREE.MeshBasicMaterial(), n);
  pickMesh.visible = false;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  records.forEach((s, i) => {
    q.setFromAxisAngle(up, s.rotationY);
    pos.set(s.x, s.y, s.z);
    m.compose(pos, q, one);
    chairs.setMatrixAt(i, m);
    const facing = s.side === 'gov' ? 1 : -1;
    pos.set(s.x + facing * DESK_AHEAD, s.y, s.z + deskPairOffset(s.index));
    m.compose(pos, q, one);
    desks.setMatrixAt(i, m);
    pos.set(s.x + facing * 0.25, s.y + 0.75, s.z);
    m.compose(pos, q, one);
    pickMesh.setMatrixAt(i, m);
  });
  for (const im of [chairs, desks, pickMesh]) {
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }
  group.add(chairs, desks, pickMesh);

  // A gold ring on the floor marks the selected seat.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#f2c14e', transparent: true, opacity: 0.95, depthWrite: false })
  );
  ring.visible = false;
  group.add(ring);

  const byId = new Map(records.map((s, i) => [s.seatId, { ...s, i }]));
  let selected = null;
  let t = 0;

  return {
    group,
    records,
    byId,
    chairs,
    desks,
    pickMesh,
    get selected() {
      return selected;
    },
    select(seatId) {
      selected = seatId;
      const s = seatId && byId.get(seatId);
      ring.visible = !!s;
      if (s) ring.position.set(s.x, s.y + 0.03, s.z);
    },
    update(dt) {
      t += dt;
      if (ring.visible) ring.material.opacity = 0.7 + 0.3 * Math.sin(t * 4);
    },
  };
}
