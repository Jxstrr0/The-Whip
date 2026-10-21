// The chamber room: shell, Speaker's dais, Clerk's table and Mace, the bar and galleries, plus seats and camera.
import * as THREE from 'three';
import { GEOMETRY as G, seatX } from './layout.js';
import { box, slab, panel, cylinder, sphere, merge, vertexMaterial, glowMaterial, washMaterial, worldUVs, disposeTree, roomLights, lamp, bakeAO, contactShadows } from '../kit3d.js';
import { surface } from '../textures.js';
import { PALETTE } from '../look.js';
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
  stone: '#c6b79e',
  stoneDark: '#9a8c78',
  plaster: '#e6dcc6',
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

// Muted suits for the people in the galleries: staff, press, the public.
const GALLERY_SUITS = ['#4a4a4f', '#5c4a3a', '#3d4650', '#6b5a48', '#2f3a44', '#7a6a5a', '#444'];

function buildShell() {
  const L = G.floorLength / 2;
  const W = G.floorWidth / 2;
  const H = G.ceiling;
  // Parts grouped by surface, so each group gets its own grain: one mesh per group.
  const g = { carpet: [], oak: [], walnut: [], leather: [], stone: [], plaster: [], metal: [], glow: [], pane: [], wash: [] };

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
    for (let i = -3; i <= 3; i++) {
      g.pane.push(panel(1.6, 2.6, wx(0.02), 7.9, i * 3.4, PALETTE.paneWarm, facing));
      g.oak.push(panel(0.08, 2.6, wx(0.03), 7.9, i * 3.4, C.oakDark, facing));
      g.oak.push(panel(1.6, 0.08, wx(0.03), 7.9, i * 3.4, C.oakDark, facing));
      g.oak.push(panel(1.9, 0.12, wx(0.03), 6.55, i * 3.4, C.oakDark, facing));
      g.wash.push(panel(3.6, 4.2, wx(0.04), 5.2, i * 3.4, PALETTE.paneWarm, facing));
    }
  }
  // End walls, the doors at the bar end, and a plaster ceiling with oak beams.
  for (const [z, facing, wain] of [[-L, '+z', 2.4], [L, '-z', 2.2]]) {
    const in1 = facing === '+z' ? 1 : -1;
    g.stone.push(panel(G.floorWidth, H, 0, H / 2, z, C.stoneDark, facing, 2));
    for (let y = 3.2; y < H - 0.2; y += 1.1) g.stone.push(panel(G.floorWidth, 0.03, 0, y, z + in1 * 0.005, C.stoneDark, facing));
    g.oak.push(panel(G.floorWidth, wain, 0, wain / 2, z + in1 * 0.01, C.oak, facing, 2));
    for (let x = -7; x <= 7; x += 1.2) g.oak.push(panel(0.06, wain - 0.3, x, wain / 2 - 0.05, z + in1 * 0.02, C.oakDark, facing));
    g.oak.push(panel(G.floorWidth, 0.1, 0, wain, z + in1 * 0.02, C.oakDark, facing));
  }
  g.walnut.push(panel(1.8, 2.8, 0, 1.4, L - 0.03, C.oakLight, '-z'));
  g.plaster.push(panel(G.floorWidth, G.floorLength, 0, H, 0, C.plaster, 'down', 2.5));
  for (let i = -5; i <= 5; i++) g.oak.push(slab(-W, H - 0.35, i * 2.4 - 0.18, W, H, i * 2.4 + 0.18, C.oakDark));
  g.oak.push(slab(-0.18, H - 0.35, -L, 0.18, H, L, C.oakDark));
  // Three chandeliers down the centre: a lit dish on a stem with a brass ring.
  for (const z of [-7, 0, 7]) {
    g.glow.push(cylinder(0.72, 0.55, 0.1, 0, H - 2.72, z, PALETTE.paneWarm, 16));
    g.walnut.push(cylinder(0.04, 0.04, 1.6, 0, H - 1.8, z, C.oakDark, 8));
    g.metal.push(cylinder(0.85, 0.85, 0.07, 0, H - 2.64, z, C.brass, 16));
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

  // Brass and gold: the bar and its posts, the Mace.
  g.metal.push(cylinder(0.035, 0.035, G.aisleWidth, 0, 0.9, G.barZ, C.brass, 10, 'x'));
  for (const x of [-G.aisleWidth / 2, G.aisleWidth / 2]) g.metal.push(cylinder(0.05, 0.07, 0.95, x, 0.47, G.barZ, C.brass, 10));
  g.metal.push(cylinder(0.035, 0.03, 1.5, 0, t.height + 0.08, mz, C.gold, 10, 'z'));
  g.metal.push(sphere(0.11, 0, t.height + 0.11, mz - 0.8, C.gold, 12));
  g.metal.push(cylinder(0.06, 0.04, 0.1, 0, t.height + 0.08, mz + 0.78, C.gold, 10, 'z'));

  const bounds = { x0: -W, x1: W, z0: -L, z1: L };
  const group = new THREE.Group();
  const textured = { carpet: 'carpet', oak: 'oak', walnut: 'walnut', leather: 'leather', stone: 'stone', plaster: 'plaster' };
  for (const [kind, parts] of Object.entries(g)) {
    if (!parts.length) continue;
    let geo = merge(parts);
    let mat;
    if (textured[kind]) {
      geo = worldUVs(bakeAO(geo, { bounds, ceilY: kind === 'stone' ? H : null, reach: kind === 'stone' ? 1.8 : 0.9, strength: kind === 'plaster' ? 0.2 : null }));
      mat = surface(textured[kind]);
    } else if (kind === 'metal') mat = vertexMaterial({ metalness: 0.7, roughness: 0.35, envMapIntensity: 1 });
    else if (kind === 'glow' || kind === 'pane') mat = glowMaterial();
    else mat = washMaterial(0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = kind;
    if (kind === 'wash') mesh.renderOrder = 2;
    group.add(mesh);
  }
  return group;
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

// A few people in the galleries, seated on the front bench, in muted clothes.
function buildSpectators() {
  const W = G.floorWidth / 2;
  const n = 14;
  const crowd = createFigureCrowd(n, { pose: 'seated' });
  for (let i = 0; i < n; i++) {
    const sign = i % 2 ? 1 : -1;
    const look = lookFor(`gallery-${i}`);
    const x = sign * (W - G.gallery.depth + 0.6);
    const z = -8 + Math.floor(i / 2) * 2.6 + look.yaw * 4;
    crowd.place(i, { x, y: G.gallery.y - 0.12, z, rotY: sign < 0 ? Math.PI / 2 : -Math.PI / 2, scale: look.height, lean: look.lean, yaw: look.yaw });
    crowd.dress(i, { ...look, suit: GALLERY_SUITS[i % GALLERY_SUITS.length] });
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
    figures.setPresent(homeSeatId, controls.mode !== 'home' && life.standingSeat !== homeSeatId);
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
      if (on) takeDivisionShot();
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
        }
      } else if (phase === 'answer') {
        if (mSeat && ministerId) {
          life.stand(mSeat.seatId, ministerId);
          controls.shot(mSeat);
        } else life.sit();
      } else {
        life.sit();
        if (phase === 'gallery') {
          life.gavel();
          ctx.onGavel?.();
          controls.divisionShot(true);
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
      lights.play(result, seatOf, opts);
    },
    clearDivision() {
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
      controls.fitAspect(camera.aspect);
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
