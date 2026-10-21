// The chamber room: shell, Speaker's dais, Clerk's table and Mace, the bar and galleries, plus seats and camera.
import * as THREE from 'three';
import { GEOMETRY as G, seatX } from './layout.js';
import { box, slab, panel, cylinder, sphere, merge, vertexMaterial, disposeTree, addSoftLights } from '../kit3d.js';
import { createSeats } from './seats.js';
import { createChamberCamera } from './camera.js';
import { createPicker } from './picking.js';
import { createMpFigures } from './mps3d.js';
import { createVoteLights } from './voteLights.js';

const C = {
  carpet: '#2f5a3c',
  aisle: '#284d33',
  oak: '#6e4a2b',
  oakLight: '#8a5f38',
  stone: '#b9b0a0',
  stoneDark: '#8f877a',
  ceiling: '#a68d66',
  glass: '#c9b98a',
  brass: '#c9a24a',
  gold: '#d8b04c',
  speakerChair: '#3c2a1a',
  leather: '#2f5a3c',
};

function buildShell() {
  const L = G.floorLength / 2;
  const W = G.floorWidth / 2;
  const parts = [];

  // Floor, aisle runner and the tiered platforms that lift each row.
  parts.push(slab(-W, -0.05, -L, W, 0, L, C.carpet));
  parts.push(slab(-G.aisleWidth / 2, 0, -L, G.aisleWidth / 2, 0.01, L, C.aisle));
  for (const sign of [-1, 1]) {
    for (let row = 2; row <= G.rows; row++) {
      const inner = Math.abs(seatX('gov', row)) - 0.85;
      const outer = row === G.rows ? W : Math.abs(seatX('gov', row + 1)) - 0.85;
      const h = (row - 1) * G.rowRise;
      const x0 = sign < 0 ? -outer : inner;
      const x1 = sign < 0 ? -inner : outer;
      parts.push(slab(x0, 0, -9, x1, h, 9, C.carpet));
      // An oak riser face toward the aisle reads as a step.
      const fx = sign < 0 ? -inner : inner;
      parts.push(slab(fx - 0.03, 0, -9, fx + 0.03, h, 9, C.oak));
    }
  }

  // Walls and ceiling are one-sided inward panels, so the default camera above the bar can see through the end wall.
  const H = G.ceiling;
  const walls = [];
  for (const sign of [-1, 1]) {
    const facing = sign < 0 ? '+x' : '-x';
    walls.push(panel(G.floorLength, H, sign * W, H / 2, 0, C.stone, facing));
    walls.push(panel(G.floorLength, 2.2, sign * (W - 0.01), 1.1, 0, C.oak, facing));
    // Tall windows above the gallery.
    for (let i = -3; i <= 3; i++) walls.push(panel(1.6, 2.6, sign * (W - 0.02), 7.9, i * 3.4, C.glass, facing));
  }
  walls.push(panel(G.floorWidth, H, 0, H / 2, -L, C.stoneDark, '+z'));
  walls.push(panel(G.floorWidth, 2.4, 0, 1.2, -L + 0.01, C.oak, '+z'));
  walls.push(panel(G.floorWidth, H, 0, H / 2, L, C.stoneDark, '-z'));
  walls.push(panel(G.floorWidth, 2.2, 0, 1.1, L - 0.01, C.oak, '-z'));
  // Doors at the bar end.
  walls.push(panel(1.8, 2.8, 0, 1.4, L - 0.02, C.oakLight, '-z'));
  walls.push(panel(G.floorWidth, G.floorLength, 0, H, 0, C.ceiling, 'down'));
  for (let i = -5; i <= 5; i++) walls.push(panel(G.floorWidth, 0.3, 0, H - 0.01, i * 2.4, C.oak, 'down'));

  // Galleries along both long walls: a floor slab, a front rail and stepped benches.
  for (const sign of [-1, 1]) {
    const x0 = sign * (W - G.gallery.depth);
    const x1 = sign * W;
    parts.push(slab(Math.min(x0, x1), G.gallery.y - 0.3, -L + 1, Math.max(x0, x1), G.gallery.y, L - 1, C.oak));
    parts.push(slab(x0 - 0.05, G.gallery.y, -L + 1, x0 + 0.05, G.gallery.y + 0.95, L - 1, C.oakLight));
    for (let s = 0; s < 3; s++) {
      const bx = x0 + sign * (0.6 + s * 0.8);
      parts.push(slab(bx - 0.3, G.gallery.y, -L + 1.5, bx + 0.3, G.gallery.y + 0.35 + s * 0.3, L - 1.5, C.leather));
    }
  }

  // Speaker's dais and chair with a carved canopy.
  const dz = G.dais.z;
  parts.push(slab(-G.dais.width / 2, 0, dz - 1.2, G.dais.width / 2, G.dais.height, dz + 1, C.oak));
  parts.push(box(1.1, 0.5, 0.9, 0, G.dais.height + 0.25, dz, C.leather));
  parts.push(box(1.3, 3.2, 0.25, 0, G.dais.height + 1.6, dz - 0.5, C.speakerChair));
  parts.push(box(1.7, 0.4, 1.4, 0, G.dais.height + 3.4, dz - 0.1, C.oak));
  parts.push(box(0.12, 1, 0.8, -0.55, G.dais.height + 0.75, dz, C.speakerChair));
  parts.push(box(0.12, 1, 0.8, 0.55, G.dais.height + 0.75, dz, C.speakerChair));

  // Clerk's table on the aisle.
  const t = G.clerkTable;
  parts.push(slab(-t.width / 2, 0, t.zFrom, t.width / 2, t.height - 0.05, t.zTo, C.oak));
  parts.push(slab(-t.width / 2 - 0.03, t.height - 0.05, t.zFrom - 0.03, t.width / 2 + 0.03, t.height, t.zTo + 0.03, C.leather));
  // Clerks' chairs at the Speaker's end of the table.
  for (const x of [-0.45, 0.45]) parts.push(box(0.5, 0.9, 0.5, x, 0.45, t.zFrom - 0.5, C.leather));

  const shellGeo = merge(parts);
  const wallGeo = merge(walls);

  // Brass and gold share a metallic material: the bar and its posts, the Mace.
  const metal = [];
  metal.push(cylinder(0.035, 0.035, G.aisleWidth, 0, 0.9, G.barZ, C.brass, 10, 'x'));
  for (const x of [-G.aisleWidth / 2, G.aisleWidth / 2]) metal.push(cylinder(0.05, 0.07, 0.95, x, 0.47, G.barZ, C.brass, 10));
  const mz = (t.zFrom + t.zTo) / 2;
  metal.push(cylinder(0.035, 0.03, 1.5, 0, t.height + 0.05, mz, C.gold, 10, 'z'));
  metal.push(sphere(0.11, 0, t.height + 0.08, mz - 0.8, C.gold, 12));
  metal.push(cylinder(0.06, 0.04, 0.1, 0, t.height + 0.05, mz + 0.78, C.gold, 10, 'z'));
  const metalGeo = merge(metal);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(shellGeo, vertexMaterial()));
  group.add(new THREE.Mesh(wallGeo, vertexMaterial()));
  group.add(new THREE.Mesh(metalGeo, vertexMaterial({ metalness: 0.7, roughness: 0.35 })));
  return group;
}

export function create(ctx) {
  const { renderer } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1a17');
  scene.fog = new THREE.Fog('#1b1a17', 40, 70);
  addSoftLights(scene);
  // A warm overhead wash, like chandeliers, so the floor isn't flat.
  const chandelier = new THREE.PointLight('#ffd9a0', 30, 30, 1.6);
  chandelier.position.set(0, 8.5, 0);
  scene.add(chandelier);

  scene.add(buildShell());
  const seats = createSeats();
  scene.add(seats.group);
  const figures = createMpFigures(seats.records);
  scene.add(figures.group);
  const lights = createVoteLights(seats.records);
  scene.add(lights.group);
  let hidden = [];
  // The Speaker in the chair, in a black robe.
  const speaker = new THREE.Group();
  speaker.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.4, 4, 10), new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.8 })));
  const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshStandardMaterial({ color: '#e0ac85', roughness: 0.6 }));
  sHead.position.y = 0.5;
  speaker.add(sHead);
  speaker.position.set(0, G.dais.height + 0.9, G.dais.z + 0.05);
  scene.add(speaker);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  const controls = createChamberCamera(camera, renderer.domElement);
  const picker = createPicker(camera, seats.pickMesh, seats.records);
  let state = null;

  const room = {
    name: 'chamber',
    scene,
    camera,
    seats,
    figures,
    lights,
    controls,
    // Play a division: absent members leave their chairs, then the standing count lights up seat by seat.
    playDivision(result, opts = {}) {
      room.clearDivision();
      const seatOf = (id) => state.mps[id]?.seatId;
      hidden = result.absent.map(seatOf).filter(Boolean);
      for (const sid of hidden) figures.setPresent(sid, false);
      lights.play(result, seatOf, opts);
    },
    clearDivision() {
      for (const sid of hidden) figures.setPresent(sid, true);
      hidden = [];
      lights.reset();
    },
    // Redraw who sits where and in what colour; call after a new game, load or reseating.
    sync(next, colorOf) {
      state = next;
      figures.sync(state, colorOf);
    },
    select(seatId) {
      seats.select(seatId);
      figures.select(seatId);
    },
    focusSeat(seatId) {
      const s = seats.byId.get(seatId);
      if (s) controls.frame(blockFor(s));
    },
    update(dt) {
      controls.update(dt);
      seats.update(dt, camera);
      lights.update(dt, camera);
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      controls.fitAspect(camera.aspect);
    },
    dispose() {
      controls.dispose();
      disposeTree(scene);
    },
  };

  // A party block is everyone of the tapped MP's party on that side of the aisle.
  function blockFor(seat) {
    const mpId = figures.mpAt(seat.seatId);
    const party = mpId && state?.mps[mpId].party;
    if (!party) return seats.records.filter((s) => s.side === seat.side && Math.abs(s.index - seat.index) <= 2);
    return seats.records.filter((s) => s.side === seat.side && state.mps[figures.mpAt(s.seatId)]?.party === party);
  }

  controls.onTap((ndc) => {
    const seat = picker.pick(ndc);
    room.select(seat ? seat.seatId : null);
    ctx.onSeatTap?.(seat, seat ? figures.mpAt(seat.seatId) : null);
  });
  controls.onDoubleTap((ndc) => {
    const seat = picker.pick(ndc);
    if (seat) controls.frame(blockFor(seat));
  });

  return room;
}
