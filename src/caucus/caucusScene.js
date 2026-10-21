// The caucus room: a long table, the leader at the head with the whip and House Leader beside them,
// MPs seated by clique so the room's politics show in where people sit.
import * as THREE from 'three';
import { box, slab, panel, cylinder, merge, vertexMaterial, glowMaterial, disposeTree, roomLights, lamp, bakeAO, contactShadows } from '../kit3d.js';
import { PALETTE } from '../look.js';
import { tuning } from '../sim/config.js';
import { createCaucusCamera } from './caucusCamera.js';
import { createCaucusFigures } from './caucusFigures.js';

const W = 5; // half of 10 m (x)
const L = 10; // half of 20 m (z)
const H = 4;
const PITCH = 0.46;

// Table seats run head to foot down one side, then the other; overflow goes to rows along the walls.
export function caucusSeatPositions(seating) {
  const out = [];
  const [leader, whip, house] = seating.head;
  if (leader) out.push({ mpId: leader, x: 0, z: -7.6, rotY: 0 });
  // The leader faces down the table (+z), so their right hand is -x.
  if (whip) out.push({ mpId: whip, x: -0.75, z: -7.45, rotY: 0.3 });
  if (house) out.push({ mpId: house, x: 0.75, z: -7.45, rotY: -0.3 });
  seating.rest.forEach((mpId, i) => {
    if (i < 60) {
      const side = i < 30 ? -1 : 1;
      const k = i % 30;
      out.push({ mpId, x: side * 1.35, z: -6.7 + k * PITCH, rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
    } else {
      const k = i - 60;
      const side = k % 2 ? 1 : -1;
      out.push({ mpId, x: side * (W - 0.6), z: -8 + Math.floor(k / 2) * 0.6, rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  });
  return out;
}

function buildRoom() {
  const parts = [];
  const walls = [];
  parts.push(slab(-W, -0.05, -L, W, 0, L, '#4a3b2c', 1.5));
  parts.push(slab(-2.6, 0, -9, 2.6, 0.01, 8.5, '#2c3e5a'));
  parts.push(box(2, 0.74, 14, 0, 0.37, 0, '#6e4a2b'));
  parts.push(box(2.06, 0.04, 14.06, 0, 0.76, 0, '#7d5532'));
  for (let i = 0; i < 12; i++) parts.push(box(0.22, 0.02, 0.3, (i % 2 ? 0.6 : -0.6), 0.79, -6 + i * 1.1, '#ece6d6'));
  walls.push(panel(2 * L, H, -W, H / 2, 0, '#b9b0a0', '+x', 2));
  walls.push(panel(2 * L, H, W, H / 2, 0, '#b9b0a0', '-x', 2));
  walls.push(panel(2 * W, H, 0, H / 2, -L, '#a39a8a', '+z', 2));
  walls.push(panel(2 * W, H, 0, H / 2, L, '#a39a8a', '-z', 2));
  walls.push(panel(2 * W, 2 * L, 0, H, 0, '#d8d2c4', 'down', 2));
  for (const [x, f] of [[-W + 0.01, '+x'], [W - 0.01, '-x']]) walls.push(panel(2 * L, 1.2, x, 0.6, 0, '#6e4a2b', f));
  // A flag and a portrait behind the head of the table.
  walls.push(panel(1.6, 1.0, 0, 2.6, -L + 0.02, '#2f4a6b', '+z'));
  walls.push(panel(1.0, 1.3, 2.4, 2.4, -L + 0.02, '#5a4632', '+z'));
  walls.push(panel(1.0, 1.3, -2.4, 2.4, -L + 0.02, '#5a4632', '+z'));
  return { parts, walls };
}

export function create(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1a17');
  scene.environment = ctx.environment || null;
  // A closed room: low daylight, three warm pendants over the table.
  roomLights(scene, { hemi: 0.35, key: 0.7, fill: 0.2 });
  for (const z of [-5, 0, 5]) lamp(scene, { color: '#ffe2b0', intensity: tuning().look.pendant, distance: 11, y: 3.2, z });
  const { parts, walls } = buildRoom();
  const seats = caucusSeatPositions(ctx.seating);
  // One instanced chair per seat.
  const chairGeo = merge([box(0.48, 0.1, 0.46, 0, 0.44, 0, '#2f5a3c'), box(0.48, 0.6, 0.08, 0, 0.78, -0.22, '#2f5a3c'), box(0.44, 0.4, 0.42, 0, 0.2, 0, '#3b2a1c')]);
  const chairs = new THREE.InstancedMesh(chairGeo, vertexMaterial(), seats.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  seats.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rotY);
    m.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(1, 1, 1));
    chairs.setMatrixAt(i, m);
  });
  chairs.instanceMatrix.needsUpdate = true;
  const bounds = { x0: -W, x1: W, z0: -L, z1: L };
  scene.add(new THREE.Mesh(bakeAO(merge(parts), { bounds }), vertexMaterial()), new THREE.Mesh(bakeAO(merge(walls), { bounds, ceilY: H, reach: 1.4 }), vertexMaterial()), chairs);
  // The pendant shades, lit from inside.
  scene.add(new THREE.Mesh(merge([-5, 0, 5].map((z) => cylinder(0.5, 0.3, 0.14, 0, 3.32, z, PALETTE.paneWarm, 16))), glowMaterial()));
  scene.add(contactShadows([{ x: 0, z: 0, sx: 3, sz: 15 }, ...seats.map((s) => ({ x: s.x, z: s.z, rotY: s.rotY, sx: 0.9, sz: 0.9 }))], { radius: 0.55 }));
  const figures = createCaucusFigures(seats);
  scene.add(figures.group);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);
  const me = seats.find((s) => s.mpId === ctx.playerId) || seats[seats.length - 1];
  const cam = createCaucusCamera(camera, ctx.renderer.domElement, me);
  const ray = new THREE.Raycaster();
  let downAt = null;
  const el = ctx.renderer.domElement;
  const onDown = (e) => (downAt = { x: e.clientX, y: e.clientY, t: performance.now() });
  const onUp = (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10 || performance.now() - downAt.t > 300) return;
    const r = el.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(figures.torsos, false)[0];
    if (hit?.instanceId != null) ctx.onMpTap?.(seats[hit.instanceId].mpId);
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);

  return {
    name: 'caucus',
    scene,
    camera,
    seats,
    tint: (fn) => figures.tint(fn),
    update(dt) {
      cam.update(dt);
      figures.update(dt);
    },
    resize(w, h) {
      camera.aspect = w / h;
      cam.fitAspect(camera.aspect);
    },
    dispose() {
      cam.dispose();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      disposeTree(scene);
    },
  };
}
