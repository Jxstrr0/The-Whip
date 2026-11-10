// The chamber room: shell, Speaker's dais, Clerk's table and Mace, the bar and galleries, plus seats and camera.
import * as THREE from 'three';
import { GEOMETRY as G, seatX } from './layout.js';
import { paint, box, slab, panel, cylinder, sphere, merge, vertexMaterial, glowMaterial, washMaterial, worldUVs, disposeTree, roomLights, lamp, bakeAO, contactShadows, paintedTexture, texturedPanel } from '../kit3d.js';
import { surface, brass } from '../textures.js';
import { PALETTE, DETAIL } from '../look.js';
import { instancedModel } from '../models.js';
import { tuning } from '../sim/config.js';
import { GREY_SKIES, mix } from '../weatherFx.js';
import { createSeats } from './seats.js';
import { createChamberCamera } from './camera.js';
import { createPicker } from './picking.js';
import { createMpFigures } from './mps3d.js';
import { createVoteLights } from './voteLights.js';
import { createFigureCrowd, lookFor } from '../figures.js';
import { createChamberLife } from './life.js';

const C = {
  carpet: '#2f5a3c',
  aisle: '#284d33',
  oak: '#6e4a2b',
  oakLight: '#8a5f38',
  oakDark: '#3f2a17',
  stone: '#d9cdb7',
  stoneDark: '#bfb097',
  plaster: '#efe3cb',
  drape: '#2b5438',
  paper: '#f1ead8',
  brass: '#c9a24a',
  gold: '#d8b04c',
  speakerChair: '#3c2a1a',
  leather: '#2f5a3c',
};

// Window light by season: the pane colour and how strong the daylight key is.
const PANE_BY_SEASON = { autumn: ['#f1dfb0', 1], winter: ['#cfdbea', 0.7], spring: ['#e6e9ee', 0.95], summer: ['#fff1c4', 1.25] };
// The sun through the high windows on a clear day: its colour and how much of it hangs in the air. None on
// a grey day; a faint glow in fog.
const SHAFTS_BY_SEASON = { autumn: ['#ffd49a', 0.32], winter: ['#d3e0f4', 0.22], spring: ['#f6f1e2', 0.26], summer: ['#fff0c4', 0.4] };

// Muted suits for the people in the galleries: staff, press, the public; a few in colour when the room is
// built rich, so the galleries read as a crowd rather than a row of grey.
const GALLERY_SUITS = ['#4a4a4f', '#5c4a3a', '#3d4650', '#6b5a48', '#2f3a44', '#7a6a5a', '#444'];
const GALLERY_COLOUR = ['#7a2a2a', '#2c4a7a', '#cbbfa6', '#4f6a3e', '#6a3a5a', '#8a6a2a'];
// Where the windows sit along the long walls and how tall they are.
const WINDOW_Z = [-3, -2, -1, 0, 1, 2, 3].map((i) => i * 3.4);
const WINDOW = { y: 7.9, w: 1.6, h: 2.6 };

function buildShell() {
  const L = G.floorLength / 2;
  const W = G.floorWidth / 2;
  const H = G.ceiling;
  // Parts grouped by surface, so each group gets its own grain: one mesh per group.
  const g = { carpet: [], oak: [], walnut: [], leather: [], stone: [], plaster: [], drape: [], paper: [], metal: [], glow: [], pane: [], wash: [] };

  // Floor, aisle runner and the tiered platforms that lift each row; oak riser faces read as steps.
  g.carpet.push(slab(-W, -0.05, -L, W, 0, L, C.carpet, 1.5));
  g.carpet.push(slab(-G.aisleWidth / 2, 0, -L, G.aisleWidth / 2, 0.01, L, C.aisle, 1.5));
  for (const sign of [-1, 1]) {
    for (let row = 2; row <= G.rows; row++) {
      const inner = Math.abs(seatX('gov', row)) - 0.85;
      const outer = row === G.rows ? W : Math.abs(seatX('gov', row + 1)) - 0.85;
      const h = (row - 1) * G.rowRise;
      const x0 = sign < 0 ? -outer : inner;
      const x1 = sign < 0 ? -inner : outer;
      g.carpet.push(slab(x0, 0, -9, x1, h, 9, C.carpet, 1.5));
      const fx = sign < 0 ? -inner : inner;
      g.oak.push(slab(fx - 0.03, 0, -9, fx + 0.03, h, 9, C.oak));
    }
  }

  // Long walls: stone in courses above an oak wainscot with panel strips; tall windows with mullions and a
  // light wash on the wall beneath each. Walls are one-sided so the overview camera can sit outside the room.
  for (const sign of [-1, 1]) {
    const facing = sign < 0 ? '+x' : '-x';
    const wx = (d) => sign * (W - d);
    g.stone.push(panel(G.floorLength, H, wx(0), H / 2, 0, C.stone, facing, 2));
    for (let y = 3.2; y < H - 0.2; y += 1.1) g.stone.push(panel(G.floorLength, 0.03, wx(0.005), y, 0, C.stoneDark, facing));
    g.oak.push(panel(G.floorLength, 2.2, wx(0.01), 1.1, 0, C.oak, facing, 2));
    for (let z = -12; z <= 12; z += 1.2) g.oak.push(panel(0.06, 1.9, wx(0.02), 1.05, z, C.oakDark, facing));
    g.oak.push(panel(G.floorLength, 0.1, wx(0.02), 2.2, 0, C.oakDark, facing));
    g.oak.push(panel(G.floorLength, 0.06, wx(0.02), 0.2, 0, C.oakDark, facing));
    // Each window: the pane, oak glazing bars, a stone surround (jambs, a sill and a header that stand
    // proud of the wall) and the wash of light it throws on the wall below.
    for (const z of WINDOW_Z) {
      const { y, w, h } = WINDOW;
      g.pane.push(panel(w, h, wx(0.02), y, z, PALETTE.paneWarm, facing));
      for (const dx of [-0.4, 0, 0.4]) g.oak.push(panel(0.07, h, wx(0.03), y, z + dx, C.oakDark, facing));
      for (const dy of [-0.65, 0, 0.65]) g.oak.push(panel(w, 0.07, wx(0.03), y + dy, z, C.oakDark, facing));
      g.oak.push(panel(w + 0.3, 0.1, wx(0.03), y - h / 2 - 0.05, z, C.oakDark, facing));
      for (const dz of [-1, 1]) g.stone.push(box(0.12, h + 0.5, 0.16, wx(0.06), y + 0.05, z + dz * (w / 2 + 0.1), C.stone));
      g.stone.push(box(0.2, 0.14, w + 0.6, wx(0.1), y - h / 2 - 0.18, z, C.stone));
      g.stone.push(box(0.14, 0.22, w + 0.6, wx(0.07), y + h / 2 + 0.25, z, C.stoneDark));
      g.wash.push(panel(3.6, 4.2, wx(0.04), 5.2, z, PALETTE.paneWarm, facing));
    }
    // A cornice where the wall meets the ceiling, and a string course at the gallery floor.
    g.stone.push(slab(Math.min(wx(0), wx(0.3)), H - 0.45, -L, Math.max(wx(0), wx(0.3)), H, L, C.stone));
    g.stone.push(slab(Math.min(wx(0.3), wx(0.42)), H - 0.3, -L, Math.max(wx(0.3), wx(0.42)), H - 0.12, L, C.stoneDark));
  }
  // End walls, the doors at the bar end, and a plaster ceiling with oak beams.
  for (const [z, facing, wain] of [[-L, '+z', 2.4], [L, '-z', 2.2]]) {
    const in1 = facing === '+z' ? 1 : -1;
    g.stone.push(panel(G.floorWidth, H, 0, H / 2, z, C.stoneDark, facing, 2));
    for (let y = 3.2; y < H - 0.2; y += 1.1) g.stone.push(panel(G.floorWidth, 0.03, 0, y, z + in1 * 0.005, C.stoneDark, facing));
    g.oak.push(panel(G.floorWidth, wain, 0, wain / 2, z + in1 * 0.01, C.oak, facing, 2));
    for (let x = -7; x <= 7; x += 1.2) g.oak.push(panel(0.06, wain - 0.3, x, wain / 2 - 0.05, z + in1 * 0.02, C.oakDark, facing));
    g.oak.push(panel(G.floorWidth, 0.1, 0, wain, z + in1 * 0.02, C.oakDark, facing));
    g.stone.push(slab(-W, H - 0.45, Math.min(z, z + in1 * 0.3), W, H, Math.max(z, z + in1 * 0.3), C.stone));
  }
  g.walnut.push(panel(1.8, 2.8, 0, 1.4, L - 0.03, C.oakLight, '-z'));
  // A coffered ceiling: plaster panels in a grid of oak beams, each coffer with an inner moulding, a
  // gilded boss where the beams cross.
  g.plaster.push(panel(G.floorWidth, G.floorLength, 0, H, 0, C.plaster, 'down', 2.5));
  const BEAM_Z = [];
  for (let i = -5; i <= 5; i++) BEAM_Z.push(i * 2.4);
  const BEAM_X = [-5, -2.5, 0, 2.5, 5];
  for (const z of BEAM_Z) g.oak.push(slab(-W, H - 0.35, z - 0.18, W, H, z + 0.18, C.oakDark));
  for (const x of BEAM_X) g.oak.push(slab(x - 0.18, H - 0.35, -L, x + 0.18, H, L, C.oakDark));
  for (const x of BEAM_X) for (const z of BEAM_Z) g.metal.push(sphere(0.12, x, H - 0.36, z, C.gold, 8));
  const XS = [-W, ...BEAM_X, W];
  const ZS = [-L, ...BEAM_Z, L];
  for (let i = 0; i + 1 < XS.length; i++) {
    for (let j = 0; j + 1 < ZS.length; j++) {
      const x0 = XS[i] + 0.4;
      const x1 = XS[i + 1] - 0.4;
      const z0 = ZS[j] + 0.4;
      const z1 = ZS[j + 1] - 0.4;
      if (x1 - x0 < 0.6 || z1 - z0 < 0.6) continue;
      g.oak.push(slab(x0, H - 0.1, z0, x1, H, z0 + 0.06, C.oak));
      g.oak.push(slab(x0, H - 0.1, z1 - 0.06, x1, H, z1, C.oak));
      g.oak.push(slab(x0, H - 0.1, z0, x0 + 0.06, H, z1, C.oak));
      g.oak.push(slab(x1 - 0.06, H - 0.1, z0, x1, H, z1, C.oak));
    }
  }
  // Three chandeliers down the centre: a lit dish on a stem with a brass ring and six candle arms.
  for (const z of [-7, 0, 7]) {
    g.glow.push(cylinder(0.72, 0.55, 0.1, 0, H - 2.72, z, PALETTE.paneWarm, 16));
    g.walnut.push(cylinder(0.04, 0.04, 1.6, 0, H - 1.8, z, C.oakDark, 8));
    g.metal.push(cylinder(0.85, 0.85, 0.07, 0, H - 2.64, z, C.brass, 16));
    g.metal.push(sphere(0.16, 0, H - 2.85, z, C.brass, 10));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const ax = Math.cos(a) * 0.95;
      const az = Math.sin(a) * 0.95;
      const arm = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6);
      arm.rotateZ(Math.PI / 2);
      arm.rotateY(-a);
      arm.translate(Math.cos(a) * 0.5, H - 2.6, z + Math.sin(a) * 0.5);
      g.metal.push(paint(arm, C.brass));
      g.metal.push(cylinder(0.05, 0.04, 0.08, ax, H - 2.56, z + az, C.brass, 8));
      g.glow.push(sphere(0.06, ax, H - 2.46, z + az, PALETTE.paneWarm, 8));
    }
  }

  // Galleries along both long walls: an oak floor, a railed front with posts and a brass top rail, leather benches.
  for (const sign of [-1, 1]) {
    const x0 = sign * (W - G.gallery.depth);
    const x1 = sign * W;
    const gy = G.gallery.y;
    g.oak.push(slab(Math.min(x0, x1), gy - 0.3, -L + 1, Math.max(x0, x1), gy, L - 1, C.oak));
    g.oak.push(slab(x0 - 0.05, gy, -L + 1, x0 + 0.05, gy + 0.9, L - 1, C.oakLight));
    for (let z = -L + 1.5; z <= L - 1.5; z += 2) g.walnut.push(cylinder(0.035, 0.035, 0.95, x0, gy + 0.47, z, C.oakDark, 8));
    g.metal.push(cylinder(0.025, 0.025, G.floorLength - 2, x0, gy + 0.96, 0, C.brass, 8, 'z'));
    // A green cloth hangs on the gallery front under a brass fringe rail; oak corbels carry the floor.
    const inward = sign < 0 ? '+x' : '-x';
    g.drape.push(panel(G.floorLength - 2.2, 0.8, x0 - sign * 0.06, gy + 0.46, 0, C.drape, inward, 1.5));
    g.metal.push(cylinder(0.02, 0.02, G.floorLength - 2.2, x0 - sign * 0.07, gy + 0.86, 0, C.brass, 6, 'z'));
    for (let z = -L + 1.5; z <= L - 1.5; z += 2) g.oak.push(box(0.5, 0.5, 0.18, x0 + sign * 0.2, gy - 0.55, z, C.oakDark));
    for (let s = 0; s < 3; s++) {
      const bx = x0 + sign * (0.6 + s * 0.8);
      g.leather.push(slab(bx - 0.3, gy, -L + 1.5, bx + 0.3, gy + 0.35 + s * 0.3, L - 1.5, C.leather));
    }
  }

  // Speaker's dais and chair: a tall carved back under a canopy with a crest, side pillars, a leather seat.
  const dz = G.dais.z;
  const dh = G.dais.height;
  g.oak.push(slab(-G.dais.width / 2, 0, dz - 1.2, G.dais.width / 2, dh, dz + 1, C.oak));
  g.oak.push(slab(-G.dais.width / 2 - 0.3, 0, dz + 1, G.dais.width / 2 + 0.3, dh / 2, dz + 1.4, C.oak));
  g.leather.push(box(1.1, 0.5, 0.9, 0, dh + 0.25, dz, C.leather));
  g.walnut.push(box(1.3, 3.2, 0.25, 0, dh + 1.6, dz - 0.5, C.speakerChair));
  g.walnut.push(box(1.9, 0.4, 1.5, 0, dh + 3.4, dz - 0.1, C.speakerChair));
  g.walnut.push(cylinder(0.02, 0.95, 0.8, 0, dh + 4.0, dz - 0.1, C.speakerChair, 4));
  for (const x of [-0.85, 0.85]) {
    g.walnut.push(box(0.14, 3.2, 0.14, x, dh + 1.6, dz + 0.5, C.speakerChair));
    g.walnut.push(box(0.12, 1, 0.8, x * 0.65, dh + 0.75, dz, C.speakerChair));
  }
  g.metal.push(sphere(0.09, 0, dh + 4.45, dz - 0.1, C.gold, 10));

  // Clerk's table on the aisle: oak, a green cloth top, brass brackets for the Mace, two clerks' chairs.
  const t = G.clerkTable;
  g.oak.push(slab(-t.width / 2, 0, t.zFrom, t.width / 2, t.height - 0.05, t.zTo, C.oak));
  g.leather.push(slab(-t.width / 2 - 0.03, t.height - 0.05, t.zFrom - 0.03, t.width / 2 + 0.03, t.height, t.zTo + 0.03, C.leather));
  const mz = (t.zFrom + t.zTo) / 2;
  for (const z of [mz - 0.5, mz + 0.5]) g.metal.push(box(0.16, 0.08, 0.06, 0, t.height + 0.02, z, C.brass));
  for (const x of [-0.45, 0.45]) {
    g.leather.push(box(0.5, 0.1, 0.5, x, 0.45, t.zFrom - 0.5, C.leather));
    g.leather.push(box(0.5, 0.6, 0.08, x, 0.78, t.zFrom - 0.26, C.leather));
    g.oak.push(box(0.46, 0.4, 0.46, x, 0.2, t.zFrom - 0.5, C.oak));
  }

  // The two dispatch boxes at the Speaker's end of the Table, walnut with brass rails, and the papers of the
  // day: bundles along the Table and at each clerk's place.
  for (const x of [-0.42, 0.42]) {
    const bz = t.zFrom + 0.55;
    g.walnut.push(box(0.46, 0.2, 0.32, x, t.height + 0.1, bz, C.speakerChair));
    g.metal.push(box(0.5, 0.012, 0.04, x, t.height + 0.205, bz - 0.14, C.brass));
    g.metal.push(box(0.5, 0.012, 0.04, x, t.height + 0.205, bz + 0.14, C.brass));
    g.metal.push(box(0.04, 0.012, 0.32, x - 0.23, t.height + 0.205, bz, C.brass));
    g.metal.push(box(0.04, 0.012, 0.32, x + 0.23, t.height + 0.205, bz, C.brass));
    g.metal.push(box(0.1, 0.06, 0.01, x, t.height + 0.1, bz + 0.165, C.gold));
  }
  const sheets = [
    [-0.45, t.zFrom + 1.3, 0.03, 0.12], [0.5, t.zFrom + 1.1, 0.02, -0.2], [-0.5, t.zFrom + 2.2, 0.05, -0.08],
    [0.45, t.zFrom + 2.6, 0.015, 0.3], [-0.4, t.zFrom + 3.3, 0.025, 0.05], [0.55, t.zFrom + 3.6, 0.04, -0.14],
    [-0.45, t.zFrom - 0.5, 0.02, 0.1], [0.45, t.zFrom - 0.5, 0.03, -0.06],
  ];
  for (const [x, z, h, a] of sheets) g.paper.push(box(0.3, h, 0.42, x, t.height + h / 2 + 0.002, z, C.paper, a));
  for (const [x, z] of [[0.05, t.zFrom + 1.9], [-0.08, t.zFrom + 3.0]]) g.leather.push(box(0.32, 0.05, 0.44, x, t.height + 0.027, z, '#5a1e1e', 0.08));

  // Brass and gold: the bar and its posts, the Mace.
  g.metal.push(cylinder(0.035, 0.035, G.aisleWidth, 0, 0.9, G.barZ, C.brass, 10, 'x'));
  for (const x of [-G.aisleWidth / 2, G.aisleWidth / 2]) g.metal.push(cylinder(0.05, 0.07, 0.95, x, 0.47, G.barZ, C.brass, 10));
  g.metal.push(cylinder(0.035, 0.03, 1.5, 0, t.height + 0.08, mz, C.gold, 10, 'z'));
  g.metal.push(sphere(0.11, 0, t.height + 0.11, mz - 0.8, C.gold, 12));
  g.metal.push(cylinder(0.06, 0.04, 0.1, 0, t.height + 0.08, mz + 0.78, C.gold, 10, 'z'));

  const bounds = { x0: -W, x1: W, z0: -L, z1: L };
  const group = new THREE.Group();
  const textured = { carpet: 'carpet', oak: 'oak', walnut: 'walnut', leather: 'leather', stone: 'marble', plaster: 'plaster', drape: 'drape', paper: 'paper' };
  for (const [kind, parts] of Object.entries(g)) {
    if (!parts.length) continue;
    let geo = merge(parts);
    let mat;
    if (textured[kind]) {
      geo = worldUVs(bakeAO(geo, { bounds, ceilY: kind === 'stone' ? H : null, reach: kind === 'stone' ? 1.8 : 0.9, strength: kind === 'plaster' || kind === 'paper' ? 0.2 : null }));
      mat = surface(textured[kind]);
    } else if (kind === 'metal') mat = brass();
    else if (kind === 'glow' || kind === 'pane') mat = glowMaterial();
    else mat = washMaterial(0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = kind;
    if (kind === 'wash') mesh.renderOrder = 2;
    group.add(mesh);
  }
  // The press gallery's mark on the cloth of the bay nearest the Speaker, on the opposition side.
  const plaque = texturedPanel(1.4, 0.36, pressPlaque(), { x: W - G.gallery.depth - 0.07, y: G.gallery.y + 0.46, z: -7.5, rotY: -Math.PI / 2 });
  plaque.name = 'plaque';
  group.add(plaque);
  // Brass sconces on the gallery walls between the windows, when the room is built rich: two draw calls.
  if (DETAIL.rich) {
    const placements = [];
    for (const sign of [-1, 1]) {
      for (let i = 0; i + 1 < WINDOW_Z.length; i++) {
        placements.push({ x: sign * (W - 0.04), y: 6.9, z: (WINDOW_Z[i] + WINDOW_Z[i + 1]) / 2, rotY: sign < 0 ? Math.PI / 2 : -Math.PI / 2, scale: 0.8 });
      }
    }
    instancedModel(group, 'lampWall', placements);
  }
  return group;
}

// A small painted sign: gold capitals on the gallery green.
function pressPlaque() {
  return paintedTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#244a30';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c9a24a';
    c.lineWidth = 6;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#e2c46a';
    c.font = 'bold 64px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('PRESS GALLERY', w / 2, h / 2 + 4);
  });
}

// Sunlight falling from the windows on the sunward wall down across the government benches: for each window,
// two crossed ribbons that fade from the glass to the floor. Additive, so they only ever brighten.
function buildSunShafts() {
  const W = G.floorWidth / 2;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g2 = c.getContext('2d');
  const img = g2.createImageData(32, 128);
  for (let y = 0; y < 128; y++) {
    const v = y / 127; // 0 at the glass, 1 at the floor
    const along = Math.min(1, v * 14) * Math.pow(1 - v, 1.4);
    for (let x = 0; x < 32; x++) {
      const a = Math.round(255 * along * Math.pow(Math.sin((Math.PI * (x + 0.5)) / 32), 1.5));
      img.data.set([a, a, a, 255], (y * 32 + x) * 4);
    }
  }
  g2.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  const dir = new THREE.Vector3(-5.2, -7, 1).normalize();
  const pos = [];
  const uv = [];
  const index = [];
  const quad = (a, b, cc, d) => {
    const n = pos.length / 3;
    for (const p of [a, b, cc, d]) pos.push(p.x, p.y, p.z);
    uv.push(0, 1, 1, 1, 0, 0, 1, 0);
    index.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (let i = -3; i <= 3; i++) {
    const top = V(W - 0.06, 7.9, i * 3.4);
    const end = top.clone().addScaledVector(dir, (7.9 - 0.4) / -dir.y);
    // A ribbon as wide as the window, and one as tall as it, widening a little as the light spreads.
    quad(top.clone().add(V(0, 0, -0.8)), top.clone().add(V(0, 0, 0.8)), end.clone().add(V(0, 0, -1.05)), end.clone().add(V(0, 0, 1.05)));
    quad(top.clone().add(V(0, 1.3, 0)), top.clone().add(V(0, -1.3, 0)), end.clone().add(V(0.6, 1.6, 0)), end.clone().add(V(-0.6, -1.6, 0)));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffd49a', alphaMap: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'shafts';
  mesh.renderOrder = 3;
  mesh.visible = false;
  return mesh;
}

// People in the galleries: fourteen on the front bench in muted clothes, and when the room is built rich
// six more behind them on the second bench, a few in colour, and two doorkeepers standing at the bar in
// black, facing the Chair. One crowd for all of them: eleven draw calls however many people.
function buildSpectators() {
  const W = G.floorWidth / 2;
  const n = DETAIL.rich ? 22 : 14;
  const crowd = createFigureCrowd(n, { pose: 'seated' });
  for (let i = 0; i < n; i++) {
    const sign = i % 2 ? 1 : -1;
    const look = lookFor(`gallery-${i}`);
    if (i >= 20) {
      crowd.place(i, { x: sign * (G.aisleWidth / 2 + 0.55), y: 0, z: G.barZ + 0.5, rotY: Math.PI, scale: look.height });
      crowd.dress(i, { ...look, suit: '#15161a' });
      crowd.setPose(i, 'standing', { rate: 1000 });
      continue;
    }
    const back = i >= 14;
    const x = sign * (W - G.gallery.depth + (back ? 1.4 : 0.6));
    const z = back ? -6.5 + Math.floor((i - 14) / 2) * 5.2 + look.yaw * 4 : -8 + Math.floor(i / 2) * 2.6 + look.yaw * 4;
    crowd.place(i, { x, y: G.gallery.y + (back ? 0.18 : -0.12), z, rotY: sign < 0 ? Math.PI / 2 : -Math.PI / 2, scale: look.height, lean: look.lean, yaw: look.yaw });
    const colour = i % 5 === 3 || back;
    crowd.dress(i, { ...look, suit: colour ? GALLERY_COLOUR[i % GALLERY_COLOUR.length] : GALLERY_SUITS[i % GALLERY_SUITS.length] });
  }
  crowd.commit();
  return crowd;
}

export function create(ctx) {
  const { renderer } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1a17');
  scene.fog = new THREE.Fog('#1b1a17', 40, 70);
  scene.environment = ctx.environment || null;
  // Daylight from the high windows, a cool fill, and three warm chandeliers down the centre.
  const lightsRig = roomLights(scene, { hemi: 0.4, key: 1.0, fill: 0.2, ground: '#5a4a38', keyPos: [9, 14, -4] });
  const hemiBase = lightsRig.hemi.intensity;
  let hemiGoal = hemiBase;
  const keyBase = lightsRig.key.intensity;
  let weatherKey = null;
  for (const z of [-7, 0, 7]) lamp(scene, { intensity: tuning().look.chandelier, distance: 18, y: G.ceiling - 2.8, z });
  // Rich rooms: a warm pool over the Table and another at the bar, so the two ends of the room read.
  if (DETAIL.rich) {
    lamp(scene, { intensity: tuning().look.tableLamp, distance: 12, x: 0, y: 5.5, z: -5.5 });
    lamp(scene, { intensity: tuning().look.tableLamp, distance: 12, x: 0, y: 5.5, z: 9.5 });
  }

  const shell = buildShell();
  scene.add(shell);
  const shafts = buildSunShafts();
  scene.add(shafts);
  const spectators = buildSpectators();
  scene.add(spectators.group);
  const seats = createSeats();
  scene.add(seats.group);
  // A soft shadow under every desk-and-chair pair.
  scene.add(contactShadows(seats.records.map((s) => ({ x: s.x + (s.side === 'gov' ? 0.25 : -0.25), y: s.y, z: s.z, sx: 1.3, sz: 1.4 })), { radius: 0.6 }));
  const figures = createMpFigures(seats.records);
  scene.add(figures.group);
  const lights = createVoteLights(seats.records);
  scene.add(lights.group);
  let hidden = [];
  // The Speaker in the chair, in a black robe, facing down the chamber.
  const speaker = createFigureCrowd(1, { pose: 'seated' });
  speaker.place(0, { x: 0, y: G.dais.height, z: G.dais.z - 0.1, rotY: 0, scale: 1.04 });
  speaker.dress(0, { ...lookFor('speaker'), suit: '#15161a' });
  speaker.commit();
  scene.add(speaker.group);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  const controls = createChamberCamera(camera, renderer.domElement);
  const picker = createPicker(camera, seats.pickMesh, seats.records);
  let state = null;
  let colorOfMp = () => '#555';
  let homeSeatId = null;
  let returnHome = false;
  let bells = false;
  const life = createChamberLife({ scene, seats, figures, getState: () => state, colorOf: (mp) => colorOfMp(mp) });

  // The three-quarter shot for a division, remembering to come back to your seat afterwards.
  function takeDivisionShot() {
    if (controls.mode === 'home') {
      returnHome = true;
      controls.setMode('overview');
    }
    controls.divisionShot(true);
  }

  // From your own seat you can't see yourself, so your figure leaves the chair while the camera is in it.
  function applyHomeHiding() {
    if (!homeSeatId) return;
    figures.setPresent(homeSeatId, controls.mode !== 'home' && controls.mode !== 'walk');
  }
  controls.onModeChange(applyHomeHiding);

  const room = {
    name: 'chamber',
    scene,
    camera,
    seats,
    figures,
    lights,
    controls,
    // Play a division: absent members leave their chairs, then the standing count lights up seat by seat.
    // The bells: the room dims a touch, every seat lamp pulses amber, and the camera goes to the three-quarter
    // shot where the count reads (coming back to your seat when the result is dismissed).
    setBells(on) {
      bells = on;
      lights.bells(on);
      ctx.onBells?.(on);
      hemiGoal = on ? hemiBase * 0.8 : hemiBase;
      if (on) {
        takeDivisionShot();
        figures.stir();
      }
    },
    gavel() {
      life.gavel();
      ctx.onGavel?.();
    },
    // Question Period, from across the aisle. 'stand': you rise at your seat and the camera finds you.
    // 'answer': you sit, the minister rises at their place and the camera holds on them. 'gallery': the
    // minister sits, the gavel falls, the wide shot of the House takes in the reaction. null: back to your seat.
    questionPeriod(phase, { seatId, mpId, ministerId } = {}) {
      const mSeat = ministerId ? seats.byId.get(state?.mps[ministerId]?.seatId) : null;
      const mySeat = seatId ? seats.byId.get(seatId) : null;
      if (phase === 'stand') {
        if (controls.mode === 'home') {
          returnHome = true;
          controls.setMode('overview');
        }
        if (mySeat) {
          life.stand(seatId, mpId);
          controls.shot(mySeat);
          figures.attention(figures.seatPoint(seatId), (s) => s.seatId !== seatId);
        }
      } else if (phase === 'answer') {
        if (mSeat && ministerId) {
          life.stand(mSeat.seatId, ministerId);
          controls.shot(mSeat);
          figures.attention(figures.seatPoint(mSeat.seatId), (s) => s.seatId !== mSeat.seatId);
        } else life.sit();
      } else {
        life.sit();
        figures.attention(null);
        if (phase === 'gallery') {
          life.gavel();
          ctx.onGavel?.();
          controls.divisionShot(true);
          // The minister's side thumps the desks for the answer.
          const party = state?.mps[ministerId]?.party;
          if (party) figures.react('thump', (s, id) => state.mps[id]?.party === party, { chance: 0.7, delay: 1.2 });
        } else {
          controls.divisionShot(false);
          if (returnHome) {
            returnHome = false;
            controls.setMode('home');
          }
        }
      }
      applyHomeHiding();
    },
    nudge: () => controls.nudge(),
    // The daylight in the high windows by season: gold in September, thin and blue in January, grey when
    // the week is wet, bright in June. Tints the panes and the wash they throw, and the key light with them.
    setWeather(wx) {
      const key = `${wx.season}:${wx.kind}`;
      if (key === weatherKey) return;
      weatherKey = key;
      let [tint, k] = PANE_BY_SEASON[wx.season] || PANE_BY_SEASON.autumn;
      if (GREY_SKIES.has(wx.kind)) {
        tint = mix(tint, '#cfd3d9', 0.75);
        k *= wx.kind === 'storm' ? 0.5 : 0.75;
      }
      shell.getObjectByName('pane').material.color.set(tint);
      shell.getObjectByName('wash').material.color.set(mix('#ffffff', tint, 0.7));
      lightsRig.key.intensity = keyBase * k;
      lightsRig.key.color.set(mix('#fff6e8', '#dfe8f8', wx.season === 'winter' ? 0.8 : GREY_SKIES.has(wx.kind) ? 0.5 : 0));
      const [sun, haze] = SHAFTS_BY_SEASON[wx.season] || SHAFTS_BY_SEASON.autumn;
      const strength = wx.kind === 'clear' ? haze : wx.kind === 'fog' ? 0.06 : 0;
      shafts.visible = strength > 0;
      shafts.material.opacity = strength;
      shafts.material.color.set(wx.kind === 'fog' ? '#d8dce2' : sun);
    },
    autoOrbit: (on) => controls.autoOrbit(on),
    get view() {
      return controls.mode;
    },
    setView(m) {
      controls.setMode(m);
      if (m === 'home') returnHome = false;
    },
    // Opening day: walk in from the bar to your own seat (see camera.walkIn). onDone when you've sat.
    walkIn(seatId, seconds, onDone) {
      const s = seats.byId.get(seatId);
      if (!s) return onDone?.();
      homeSeatId = seatId;
      returnHome = false;
      controls.walkIn(s, seconds, onDone);
    },
    finishWalk: () => controls.finishWalk(),
    get walking() {
      return controls.walking;
    },
    setHomeSeat(seatId) {
      const s = seats.byId.get(seatId);
      if (!s) return;
      homeSeatId = seatId;
      controls.setHome(s);
      applyHomeHiding();
    },
    playDivision(result, opts = {}) {
      for (const sid of hidden) figures.setPresent(sid, true);
      hidden = [];
      lights.reset();
      takeDivisionShot();
      life.clerksStand(true);
      const seatOf = (id) => state.mps[id]?.seatId;
      hidden = result.absent.map(seatOf).filter(Boolean);
      for (const sid of hidden) figures.setPresent(sid, false);
      figures.sitAll();
      // Members stand at their places as the Clerk counts them, and the winning side thumps the desks.
      const winners = new Set(result.yeas.length > result.nays.length ? result.yeas : result.nays);
      lights.play(result, seatOf, {
        ...opts,
        tick(c, mpId, kind) {
          const sid = seatOf(mpId);
          if (sid) figures.rise(sid, true);
          opts.tick?.(c, mpId, kind);
        },
        done() {
          figures.react('thump', (s, id) => winners.has(id), { chance: 0.6, delay: 1.5 });
          opts.done?.();
        },
      });
    },
    clearDivision() {
      figures.sitAll();
      for (const sid of hidden) figures.setPresent(sid, true);
      hidden = [];
      lights.reset();
      lights.bells(false);
      bells = false;
      life.clerksStand(false);
      hemiGoal = hemiBase;
      controls.divisionShot(false);
      if (returnHome) {
        returnHome = false;
        controls.setMode('home');
      }
      applyHomeHiding();
    },
    // Redraw who sits where and in what colour; call after a new game, load or reseating.
    sync(next, colorOf) {
      state = next;
      colorOfMp = colorOf;
      figures.sync(state, colorOf);
      life.reset();
      applyHomeHiding();
    },
    select(seatId) {
      seats.select(seatId);
      figures.select(seatId);
    },
    focusSeat(seatId) {
      const s = seats.byId.get(seatId);
      if (s) controls.frame(blockFor(s));
    },
    frameBlock(seatId) {
      const s = seats.byId.get(seatId);
      if (s) controls.frame(blockFor(s));
    },
    update(dt) {
      controls.update(dt);
      lightsRig.hemi.intensity += (hemiGoal - lightsRig.hemi.intensity) * Math.min(1, dt * 3);
      seats.update(dt, camera);
      lights.update(dt, camera);
      figures.update(dt);
      speaker.update(dt);
      spectators.update(dt);
      life.update(dt, bells || lights.playing, homeSeatId);
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      controls.fitAspect(camera.aspect, w);
    },
    dispose() {
      controls.dispose();
      life.dispose();
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
