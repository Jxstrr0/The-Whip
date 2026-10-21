// The office: an MP's small room (desk, two visitor chairs, the count board, a window on the lawn, the door),
// dressed darker as the whip's office for the Act 1 reversal. Furniture from the Kenney kit, retinted.
import * as THREE from 'three';
import { box, slab, panel, cylinder, merge, vertexMaterial, glowMaterial, worldUVs, disposeTree, roomLights, lamp, bakeAO, contactShadows, paintedTexture, texturedPanel } from '../kit3d.js';
import { surface } from '../textures.js';
import { PALETTE } from '../look.js';
import { placeModel } from '../models.js';
import { tuning } from '../sim/config.js';
import { createOfficeCamera } from './officeCamera.js';
import { createVisitor, createFigure, poseFigure } from './visitor.js';

const W = 3; // half of 6 m (x)
const D = 2.5; // half of 5 m (z)
const H = 3.2;
const C = { plaster: '#d6ccb8', plasterDark: '#b9ab93', floor: '#5e4b3a', oak: '#6e4a2b', oakDark: '#3f2a17', walnut: '#3b2616', paper: '#ece6d6', brass: '#c9a24a' };

// Visitors come in the door on the +x wall and walk round the desk to the left-hand visitor chair.
const DOOR = [2.75, 2.0];
const VISITOR_SEAT = [-0.5, -1.0];
const VISITOR_PATH = [DOOR, [1.7, 1.7], [1.6, -1.65], [-0.5, -1.65], VISITOR_SEAT];
const DESK_SEAT = [0, 0.9];
const WINDOW = { w: 2.0, h: 1.25, y: 1.7 };

// Dusk over the lawn: the office is where evenings happen.
function paintLawn(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#2f3d63');
  sky.addColorStop(0.55, '#8a6f8f');
  sky.addColorStop(1, '#e8a66a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // The Gothic tower across the lawn, dark against the dusk, a few windows lit.
  g.fillStyle = '#3a3a44';
  g.fillRect(w * 0.62, h * 0.16, w * 0.08, h * 0.47);
  g.beginPath();
  g.moveTo(w * 0.605, h * 0.17);
  g.lineTo(w * 0.66, h * 0.03);
  g.lineTo(w * 0.715, h * 0.17);
  g.fill();
  g.fillRect(w * 0.45, h * 0.4, w * 0.45, h * 0.23);
  g.fillStyle = '#f2d59a';
  for (let i = 0; i < 7; i++) g.fillRect(w * (0.47 + i * 0.06), h * 0.47, w * 0.015, h * 0.035);
  g.fillRect(w * 0.645, h * 0.3, w * 0.012, h * 0.04);
  // Trees in two dark layers.
  for (const [col, y0, r] of [['#3d4a3a', 0.6, 30], ['#2a3328', 0.64, 22]]) {
    g.fillStyle = col;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.arc((i / 13) * w, h * y0, r + (i % 3) * 8, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = '#2f4a2c';
  g.fillRect(0, h * 0.66, w, h * 0.34);
  g.fillStyle = '#3a5a34';
  for (let i = 0; i < 6; i++) g.fillRect(0, h * (0.7 + i * 0.05), w, h * 0.018);
}

// The count board is a corkboard with pinned cards: what's coming up and your line on each.
export function drawBoard(g, w, h, rows, title) {
  g.fillStyle = '#a97c4f';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = i % 2 ? 'rgba(80,50,25,0.18)' : 'rgba(255,220,170,0.12)';
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.strokeStyle = '#4a2e18';
  g.lineWidth = 12;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#f3ead8';
  g.fillRect(22, 18, 230, 40);
  g.fillStyle = '#1d1a16';
  g.font = '600 24px Fraunces, Georgia, serif';
  g.fillText(title.toUpperCase(), 34, 46);
  rows.slice(0, 5).forEach((r, i) => {
    const y = 74 + i * 36;
    const tilt = ((i * 7) % 5 - 2) * 0.01;
    g.save();
    g.translate(30, y);
    g.rotate(tilt);
    g.fillStyle = '#f3ead8';
    g.fillRect(0, 0, w - 70, 30);
    g.fillStyle = r.color || '#1d1a16';
    g.font = '18px Fraunces, Georgia, serif';
    g.fillText(r.text.slice(0, 44), 10, 21);
    g.fillStyle = '#a8322d';
    g.beginPath();
    g.arc(w - 82, 8, 5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

function buildShell() {
  const g = { plaster: [], oak: [], walnut: [], wool: [], glow: [] };
  g.wool.push(slab(-W, -0.05, -D, W, 0, D, C.floor, 1));
  g.plaster.push(panel(2 * D, H, -W, H / 2, 0, C.plaster, '+x', 1));
  g.plaster.push(panel(2 * D, H, W, H / 2, 0, C.plaster, '-x', 1));
  g.plaster.push(panel(2 * W, H, 0, H / 2, -D, C.plaster, '+z', 1));
  g.plaster.push(panel(2 * W, H, 0, H / 2, D, C.plasterDark, '-z', 1));
  g.plaster.push(panel(2 * W, 2 * D, 0, H, 0, '#e9e2d3', 'down', 1));
  // Oak wainscot to 1.0 m with panel strips, a top rail and a skirting, on every wall.
  const wain = 1.0;
  for (const [len, x, z, facing] of [[2 * D, -W + 0.01, 0, '+x'], [2 * D, W - 0.01, 0, '-x'], [2 * W, 0, -D + 0.01, '+z'], [2 * W, 0, D - 0.01, '-z']]) {
    g.oak.push(panel(len, wain, x, wain / 2, z, C.oak, facing, 1));
    g.oak.push(panel(len, 0.07, x, wain, z, C.oakDark, facing));
    g.oak.push(panel(len, 0.1, x, 0.05, z, C.oakDark, facing));
    const along = facing === '+x' || facing === '-x';
    for (let s = -len / 2 + 0.6; s < len / 2; s += 0.9) {
      if (along) g.oak.push(panel(0.05, wain - 0.25, x + (facing === '+x' ? 0.01 : -0.01), wain / 2 - 0.02, z + s, C.oakDark, facing));
      else g.oak.push(panel(0.05, wain - 0.25, x + s, wain / 2 - 0.02, z + (facing === '+z' ? 0.01 : -0.01), C.oakDark, facing));
    }
  }
  // The door on the +x wall near z = +2, with a frame and a brass knob.
  g.walnut.push(panel(0.95, 2.1, W - 0.015, 1.05, DOOR[1], C.walnut, '-x'));
  g.oak.push(panel(1.15, 0.08, W - 0.02, 2.14, DOOR[1], C.oakDark, '-x'));
  for (const dz of [-0.55, 0.55]) g.oak.push(panel(0.08, 2.2, W - 0.02, 1.1, DOOR[1] + dz, C.oakDark, '-x'));
  // The window on the -z wall: frame, sill and blinds. The view is a painted panel behind it.
  const wy = WINDOW.y;
  g.oak.push(box(WINDOW.w + 0.16, 0.08, 0.1, 0, wy + WINDOW.h / 2 + 0.04, -D + 0.05, C.oakDark));
  g.oak.push(box(WINDOW.w + 0.3, 0.06, 0.18, 0, wy - WINDOW.h / 2 - 0.03, -D + 0.09, C.oak));
  for (const dx of [-1, 1]) g.oak.push(box(0.08, WINDOW.h + 0.1, 0.1, dx * (WINDOW.w / 2 + 0.04), wy, -D + 0.05, C.oakDark));
  g.oak.push(box(0.04, WINDOW.h, 0.04, 0, wy, -D + 0.04, C.oakDark));
  return g;
}

function buildMeshes(g, bounds) {
  const out = new THREE.Group();
  const kinds = { plaster: 'plaster', oak: 'oak', walnut: 'walnut', wool: 'wool' };
  for (const [kind, parts] of Object.entries(g)) {
    if (!parts.length) continue;
    let geo = merge(parts);
    let mat;
    if (kinds[kind]) {
      geo = worldUVs(bakeAO(geo, { bounds, ceilY: kind === 'plaster' ? H : null, reach: 0.7 }));
      mat = surface(kinds[kind], kind === 'plaster' ? { roughness: 0.95 } : {});
    } else mat = glowMaterial();
    out.add(new THREE.Mesh(geo, mat));
  }
  return out;
}

export function create(ctx) {
  const tier = ctx.tier || 1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1a17');
  scene.environment = ctx.environment || null;
  // Dusk through the window behind the visitors, a cool fill, and the warm pool of the desk lamp.
  const rig = roomLights(scene, { hemi: 0.32, key: 0.7, fill: 0.25, warm: '#ffe6cf', keyPos: [-2, 3, -6], fillPos: [4, 3, 3] });
  const deskLamp = lamp(scene, { intensity: tuning().look.deskLamp, distance: 5, x: -0.6, y: 1.25, z: 0.1 });

  const bounds = { x0: -W, x1: W, z0: -D, z1: D };
  scene.add(buildMeshes(buildShell(), bounds));

  // Blinds: slats half open for your office, closed tight for the whip's.
  const slats = [];
  const closed = [];
  for (let i = 0; i < 13; i++) {
    const y = WINDOW.y + WINDOW.h / 2 - 0.05 - i * 0.095;
    slats.push(box(WINDOW.w, 0.035, 0.07, 0, y, -D + 0.1, C.paper));
    closed.push(box(WINDOW.w, 0.094, 0.03, 0, y, -D + 0.1, '#d9cfb8'));
  }
  const blindsOpen = new THREE.Mesh(merge(slats), vertexMaterial({ roughness: 0.8 }));
  const blindsClosed = new THREE.Mesh(merge(closed), vertexMaterial({ roughness: 0.8 }));
  blindsClosed.visible = false;
  scene.add(blindsOpen, blindsClosed);
  const lawn = paintedTexture(512, 320, paintLawn);
  scene.add(texturedPanel(WINDOW.w, WINDOW.h, lawn, { x: 0, y: WINDOW.y, z: -D + 0.02 }));

  // The corkboard on the -x wall.
  const boardW = tier > 1 ? 3.0 : 2.4;
  const boardTex = paintedTexture(512, 256, (g, w, h) => drawBoard(g, w, h, [], 'Coming up'));
  scene.add(texturedPanel(boardW, 1.2, boardTex, { x: -W + 0.03, y: 1.75, z: -0.2, rotY: Math.PI / 2 }));

  // Your office: the kit's desk and chairs, a bookcase, a lamp, a plant, a coat rack by the door.
  const mine = new THREE.Group();
  scene.add(mine);
  const desk = placeModel(mine, 'desk', { x: 0, z: 0, rotY: Math.PI });
  desk.scale.set(1.25, 1, 1.15);
  placeModel(mine, 'chairDesk', { x: DESK_SEAT[0], z: DESK_SEAT[1] + 0.05, rotY: Math.PI });
  placeModel(mine, 'chairCushion', { x: -0.5, z: -1.0, rotY: 0 });
  placeModel(mine, 'chairCushion', { x: 0.5, z: -1.0, rotY: 0 });
  placeModel(mine, 'bookcaseClosedWide', { x: W - 0.26, z: -1.3, rotY: -Math.PI / 2 });
  placeModel(mine, 'bookcaseOpen', { x: -W + 0.26, z: 1.7, rotY: Math.PI / 2 });
  placeModel(mine, 'books', { x: -0.5, y: 0.72, z: -0.12, rotY: 0.3 });
  placeModel(mine, 'lampRoundTable', { x: -0.62, y: 0.72, z: 0.12 });
  placeModel(mine, 'laptop', { x: 0.25, y: 0.72, z: 0.12, rotY: Math.PI });
  placeModel(mine, 'pottedPlant', { x: -W + 0.5, z: -D + 0.5 });
  placeModel(mine, 'coatRackStanding', { x: W - 0.5, z: D - 0.45 });
  placeModel(mine, 'trashcan', { x: 1.0, z: 0.7 });
  mine.add(contactShadows([
    { x: 0, z: 0, sx: 2.4, sz: 1.4 },
    { x: DESK_SEAT[0], z: DESK_SEAT[1], sx: 0.9, sz: 0.9 },
    { x: -0.5, z: -1.0, sx: 0.9, sz: 0.9 },
    { x: 0.5, z: -1.0, sx: 0.9, sz: 0.9 },
    { x: W - 0.3, z: -1.3, sx: 0.8, sz: 2.0 },
    { x: -W + 0.3, z: 1.7, sx: 0.7, sz: 1.2 },
    { x: -W + 0.5, z: -D + 0.5, sx: 0.7, sz: 0.7 },
  ], { radius: 0.55 }));

  // The whip's office, for the reversal: a bigger walnut desk, a flag in the party colour, the blinds shut.
  const whip = new THREE.Group();
  whip.visible = false;
  scene.add(whip);
  const wd = [];
  wd.push(box(2.2, 0.08, 1.0, 0, 0.72, 0, C.walnut));
  wd.push(box(0.7, 0.68, 0.9, -0.7, 0.34, 0, C.walnut));
  wd.push(box(0.7, 0.68, 0.9, 0.7, 0.34, 0, C.walnut));
  wd.push(box(0.8, 0.5, 0.06, 0, 0.5, -0.4, C.walnut));
  const whipDesk = new THREE.Mesh(worldUVs(bakeAO(merge(wd), { bounds })), surface('walnut', { roughness: 0.45 }));
  whip.add(whipDesk);
  placeModel(whip, 'chairDesk', { x: DESK_SEAT[0], z: DESK_SEAT[1] + 0.05, rotY: Math.PI });
  placeModel(whip, 'chairCushion', { x: -0.5, z: -1.0, rotY: 0 });
  placeModel(whip, 'chairCushion', { x: 0.5, z: -1.0, rotY: 0 });
  placeModel(whip, 'bookcaseClosedWide', { x: W - 0.26, z: -1.3, rotY: -Math.PI / 2 });
  placeModel(whip, 'bookcaseClosedWide', { x: W - 0.26, z: 0.3, rotY: -Math.PI / 2 });
  placeModel(whip, 'lampRoundTable', { x: -0.85, y: 0.76, z: 0.2 });
  const pole = new THREE.Mesh(merge([cylinder(0.025, 0.025, 2.4, -1.4, 1.2, 1.9, C.brass, 10), cylinder(0.3, 0.3, 0.05, -1.4, 0.025, 1.9, C.brass, 16)]), vertexMaterial({ metalness: 0.7, roughness: 0.35, envMapIntensity: 1 }));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshStandardMaterial({ color: ctx.playerColor || '#555', side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.position.set(-1.4 + 0.26, 1.95, 1.9);
  cloth.rotation.y = -0.4;
  whip.add(pole, cloth);
  whip.add(contactShadows([{ x: 0, z: 0, sx: 2.8, sz: 1.5 }, { x: -0.5, z: -1.0, sx: 0.9, sz: 0.9 }, { x: 0.5, z: -1.0, sx: 0.9, sz: 0.9 }, { x: W - 0.3, z: -0.5, sx: 0.8, sz: 3.4 }], { radius: 0.55 }));

  function dress(asWhip) {
    mine.visible = !asWhip;
    whip.visible = asWhip;
    blindsOpen.visible = !asWhip;
    blindsClosed.visible = asWhip;
    rig.key.intensity = asWhip ? 0.3 : 0.7;
    rig.hemi.intensity = asWhip ? 0.26 : 0.32;
    deskLamp.intensity = tuning().look.deskLamp * (asWhip ? 1.4 : 1);
  }

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 40);
  const cam = createOfficeCamera(camera);

  // The player sits behind the desk (or, in the reversal, in the other visitor chair).
  const player = createFigure(ctx.playerColor || '#555', 'player');
  player.setHeadVisible(false);
  scene.add(player.group);
  let deskFigure = null;
  let visitor = null;
  let reversal = false;

  function seatPlayer(rev) {
    reversal = rev;
    if (rev) {
      player.group.position.set(0.5, 0, -1.0);
      player.group.rotation.y = 0;
    } else {
      player.group.position.set(DESK_SEAT[0], 0, DESK_SEAT[1]);
      player.group.rotation.y = Math.PI;
    }
    poseFigure(player, 'cooperative', 1);
    dress(rev);
  }
  seatPlayer(false);

  const room = {
    name: 'office',
    scene,
    camera,
    // Show who's here. In the reversal the whip takes the desk chair and the player sits opposite.
    setVisitor(v) {
      if (!v) {
        visitor?.leave(() => {
          visitor?.dispose();
          visitor = null;
        });
        deskFigure && scene.remove(deskFigure.group);
        deskFigure = null;
        seatPlayer(false);
        cam.shot('empty');
        return;
      }
      if (visitor?.mpId === v.mpId || deskFigure?.mpId === v.mpId) {
        room.setMood(v.mood);
        return;
      }
      visitor?.dispose();
      visitor = null;
      if (deskFigure) scene.remove(deskFigure.group);
      deskFigure = null;
      if (v.reversal) {
        seatPlayer(true);
        const f = createFigure(v.color, v.mpId);
        f.group.position.set(DESK_SEAT[0], 0, DESK_SEAT[1]);
        f.group.rotation.y = Math.PI;
        poseFigure(f, v.mood, 1);
        f.mpId = v.mpId;
        scene.add(f.group);
        deskFigure = f;
        cam.shot('reversal', v.snap);
        return;
      }
      seatPlayer(false);
      visitor = createVisitor(scene, { color: v.color, mpId: v.mpId, path: VISITOR_PATH, seat: VISITOR_SEAT, facing: 0 });
      visitor.mpId = v.mpId;
      visitor.setMood(v.mood);
      if (v.snap) visitor.sitNow();
      cam.shot('host', v.snap);
    },
    setMood(m) {
      visitor?.setMood(m);
      if (deskFigure) poseFigure(deskFigure, m, 1);
    },
    // The slow push-in when the deal table opens.
    pushIn(on) {
      cam.shot(reversal ? (on ? 'reversalDeal' : 'reversal') : on ? 'hostDeal' : 'host');
    },
    setBoard(rows, title = 'Coming up') {
      const c = boardTex.userData.canvas;
      drawBoard(c.getContext('2d'), c.width, c.height, rows, title);
      boardTex.needsUpdate = true;
    },
    get visitorPhase() {
      return visitor?.phase || (deskFigure ? 'seated' : null);
    },
    update(dt) {
      visitor?.update(dt);
      cam.update(dt);
    },
    resize(w, h) {
      camera.aspect = w / h;
      cam.fitAspect(camera.aspect);
      camera.updateProjectionMatrix();
    },
    dispose() {
      visitor?.dispose();
      scene.traverse((o) => o.userData.cancel?.());
      disposeTree(scene);
    },
  };
  return room;
}
