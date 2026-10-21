// The caucus room: a long table under a green baize runner, the leader at the head with the whip and House
// Leader beside them, MPs seated by clique so the room's politics show in where people sit. Chairs and
// carafes from the kits; a party banner and two portraits behind the head of the table.
import * as THREE from 'three';
import { box, slab, panel, cylinder, merge, vertexMaterial, glowMaterial, worldUVs, disposeTree, roomLights, lamp, bakeAO, contactShadows } from '../kit3d.js';
import { surface } from '../textures.js';
import { PALETTE } from '../look.js';
import { placeModel, instancedModel } from '../models.js';
import { tuning } from '../sim/config.js';
import { createCaucusCamera } from './caucusCamera.js';
import { createCaucusFigures } from './caucusFigures.js';

const W = 5; // half of 10 m (x)
const L = 10; // half of 20 m (z)
const H = 4;
const PITCH = 0.46;
const C = { plaster: '#d8cfbb', oak: '#6e4a2b', oakDark: '#3f2a17', walnut: '#3b2616', floor: '#4a3b2c', baize: '#2e5e3e', paper: '#ece6d6', brass: '#c9a24a' };
const HEAD_Z = -7.6;

// Table seats run head to foot down one side, then the other; overflow goes to rows along the walls.
export function caucusSeatPositions(seating) {
  const out = [];
  const [leader, whip, house] = seating.head;
  if (leader) out.push({ mpId: leader, x: 0, z: HEAD_Z, rotY: 0 });
  // The leader faces down the table (+z), so their right hand is -x.
  if (whip) out.push({ mpId: whip, x: -0.75, z: HEAD_Z + 0.15, rotY: 0.3 });
  if (house) out.push({ mpId: house, x: 0.75, z: HEAD_Z + 0.15, rotY: -0.3 });
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

function buildShell(partyColor) {
  const g = { plaster: [], oak: [], walnut: [], wool: [], baize: [], paper: [], metal: [], glow: [], cloth: [] };
  g.wool.push(slab(-W, -0.05, -L, W, 0, L, C.floor, 1.5));
  g.wool.push(slab(-2.8, 0, -9, 2.8, 0.012, 8.6, '#2c3e5a', 1.5));
  // The table: a walnut top on oak pedestals, with a green baize runner down the middle.
  g.walnut.push(box(2.1, 0.06, 14.2, 0, 0.75, 0, C.walnut));
  g.oak.push(box(1.9, 0.72, 14, 0, 0.36, 0, C.oak));
  g.baize.push(box(1.2, 0.012, 13.6, 0, 0.785, 0, C.baize));
  for (let i = 0; i < 30; i++) for (const s of [-1, 1]) g.paper.push(box(0.22, 0.008, 0.3, s * 0.72, 0.785, -6.7 + i * PITCH, C.paper));
  // Walls: oak wainscot to 1.2 m with strips and rails, plaster above, a plaster ceiling.
  const wain = 1.2;
  for (const [len, x, z, facing] of [[2 * L, -W + 0.01, 0, '+x'], [2 * L, W - 0.01, 0, '-x'], [2 * W, 0, -L + 0.01, '+z'], [2 * W, 0, L - 0.01, '-z']]) {
    const full = facing === '+x' || facing === '-x' ? panel(2 * L, H, x < 0 ? -W : W, H / 2, 0, C.plaster, facing, 2) : panel(2 * W, H, 0, H / 2, z < 0 ? -L : L, C.plaster, facing, 2);
    g.plaster.push(full);
    g.oak.push(panel(len, wain, x, wain / 2, z, C.oak, facing, 2));
    g.oak.push(panel(len, 0.08, x, wain, z, C.oakDark, facing));
    g.oak.push(panel(len, 0.1, x, 0.05, z, C.oakDark, facing));
    const along = facing === '+x' || facing === '-x';
    const nudge = facing === '+x' || facing === '+z' ? 0.01 : -0.01;
    for (let s = -len / 2 + 0.6; s < len / 2; s += 1.0) {
      if (along) g.oak.push(panel(0.06, wain - 0.3, x + nudge, wain / 2 - 0.02, z + s, C.oakDark, facing));
      else g.oak.push(panel(0.06, wain - 0.3, x + s, wain / 2 - 0.02, z + nudge, C.oakDark, facing));
    }
  }
  g.plaster.push(panel(2 * W, 2 * L, 0, H, 0, '#e4dccb', 'down', 2));
  for (let i = -3; i <= 3; i++) g.oak.push(slab(-W, H - 0.3, i * 2.8 - 0.15, W, H, i * 2.8 + 0.15, C.oakDark));
  // Behind the head of the table: the party banner on a brass rod, two portraits in gilt frames.
  g.metal.push(cylinder(0.025, 0.025, 2.0, 0, 3.3, -L + 0.08, C.brass, 8, 'x'));
  g.cloth.push(box(1.7, 1.3, 0.02, 0, 2.6, -L + 0.08, partyColor));
  g.cloth.push(box(1.7, 0.06, 0.03, 0, 3.26, -L + 0.08, PALETTE.gold));
  for (const x of [-2.6, 2.6]) {
    g.metal.push(box(1.1, 1.4, 0.04, x, 2.5, -L + 0.04, C.brass));
    g.walnut.push(box(0.96, 1.26, 0.05, x, 2.5, -L + 0.045, '#2b2320'));
  }
  // Three pendants over the table: a lit shade under a brass ring on a dark stem.
  for (const z of [-5, 0, 5]) {
    g.glow.push(cylinder(0.5, 0.3, 0.14, 0, 3.32, z, PALETTE.paneWarm, 16));
    g.metal.push(cylinder(0.52, 0.52, 0.05, 0, 3.4, z, C.brass, 16));
    g.walnut.push(cylinder(0.025, 0.025, 0.6, 0, 3.72, z, C.oakDark, 8));
  }
  return g;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1a17');
  scene.environment = ctx.environment || null;
  // A closed room: low daylight, three warm pendants over the table.
  roomLights(scene, { hemi: 0.32, key: 0.6, fill: 0.2 });
  for (const z of [-5, 0, 5]) lamp(scene, { color: '#ffe2b0', intensity: tuning().look.pendant, distance: 11, y: 3.1, z });
  const bounds = { x0: -W, x1: W, z0: -L, z1: L };
  const g = buildShell(ctx.playerColor || '#555');
  const textured = { plaster: 'plaster', oak: 'oak', walnut: 'walnut', wool: 'wool', baize: 'carpet' };
  for (const [kind, parts] of Object.entries(g)) {
    if (!parts.length) continue;
    let geo = merge(parts);
    let mat;
    if (textured[kind]) {
      geo = worldUVs(bakeAO(geo, { bounds, ceilY: kind === 'plaster' ? H : null, reach: kind === 'plaster' ? 1.6 : 0.8 }));
      mat = surface(textured[kind], kind === 'plaster' ? { roughness: 0.95 } : kind === 'baize' ? { roughness: 1 } : {});
    } else if (kind === 'metal') mat = vertexMaterial({ metalness: 0.7, roughness: 0.35, envMapIntensity: 1 });
    else if (kind === 'glow') mat = glowMaterial();
    else mat = vertexMaterial({ roughness: 0.92 });
    scene.add(new THREE.Mesh(geo, mat));
  }

  const seats = caucusSeatPositions(ctx.seating);
  // Chairs from the kit, one instanced mesh for all of them; the leader gets the tall desk chair.
  const [leaderSeat, ...others] = seats;
  instancedModel(scene, 'chairCushion', others.map((s) => ({ x: s.x, z: s.z, rotY: s.rotY })));
  if (leaderSeat) placeModel(scene, 'chairDesk', { x: leaderSeat.x, z: leaderSeat.z, rotY: leaderSeat.rotY });
  // Carafes and glasses every third place, on the runner's edge.
  const carafes = [];
  const glasses = [];
  for (let i = 0; i < 30; i += 3) for (const s of [-1, 1]) {
    const z = -6.7 + i * PITCH + 0.2;
    carafes.push({ x: s * 0.45, y: 0.79, z, rotY: s * 0.4 });
    glasses.push({ x: s * 0.32, y: 0.79, z: z + 0.16 });
    glasses.push({ x: s * 0.58, y: 0.79, z: z - 0.18 });
  }
  instancedModel(scene, 'bottle-oil', carafes, { pack: 'food' });
  instancedModel(scene, 'glass', glasses, { pack: 'food' });
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
    read: (fn) => figures.read(fn),
    showPairs: (pairs) => figures.showPairs(pairs),
    focusHead: (on) => cam.focusHead(on),
    update(dt) {
      cam.update(dt);
      figures.update(dt, camera);
    },
    resize(w, h) {
      camera.aspect = w / h;
      cam.fitAspect(camera.aspect, w);
    },
    dispose() {
      cam.dispose();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      scene.traverse((o) => o.userData.cancel?.());
      disposeTree(scene);
    },
  };
}
