// The office: desk, two visitor chairs, the count board, a window on the lawn, the door. Two tiers by rank.
import * as THREE from 'three';
import { box, slab, panel, merge, vertexMaterial, glowMaterial, disposeTree, roomLights, lamp, bakeAO, contactShadows, paintedTexture, texturedPanel } from '../kit3d.js';
import { PALETTE } from '../look.js';
import { tuning } from '../sim/config.js';
import { createOfficeCamera } from './officeCamera.js';
import { createVisitor, createFigure, poseFigure } from './visitor.js';

const W = 3; // half of 6 m (x)
const D = 2.5; // half of 5 m (z)
const H = 3.2;
const C = { wall: '#c9c2b2', wallDark: '#a79f8d', floor: '#5a4330', oak: '#6e4a2b', oakLight: '#8a5f38', leather: '#2f5a3c', rug: '#5b2a2a', metal: '#3a3d44', paper: '#ece6d6' };

// Visitors come in the door on the +x wall and walk round the desk to the left-hand visitor chair.
const DOOR = [2.75, 2.0];
const VISITOR_SEAT = [-0.5, -1.0];
const VISITOR_PATH = [DOOR, [1.7, 1.7], [1.6, -1.65], [-0.5, -1.65], VISITOR_SEAT];
const DESK_SEAT = [0, 0.9];

function paintLawn(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#8fb3d6');
  sky.addColorStop(1, '#dfe8ee');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#7d8a6a';
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    g.arc((i / 11) * w, h * 0.58, 26 + (i % 3) * 10, 0, Math.PI * 2);
    g.fill();
  }
  // A Gothic tower across the lawn.
  g.fillStyle = '#b7ae9c';
  g.fillRect(w * 0.62, h * 0.18, w * 0.08, h * 0.45);
  g.beginPath();
  g.moveTo(w * 0.61, h * 0.19);
  g.lineTo(w * 0.66, h * 0.05);
  g.lineTo(w * 0.71, h * 0.19);
  g.fill();
  g.fillRect(w * 0.45, h * 0.38, w * 0.45, h * 0.25);
  g.fillStyle = '#4f7a3a';
  g.fillRect(0, h * 0.62, w, h * 0.38);
  g.fillStyle = '#5d8a45';
  for (let i = 0; i < 6; i++) g.fillRect(0, h * (0.66 + i * 0.06), w, h * 0.02);
}

// The count board: tomorrow's votes by name. As a rookie it's just the order paper and your line.
export function drawBoard(g, w, h, rows, title) {
  g.fillStyle = '#f4f2ec';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8a8f98';
  g.lineWidth = 10;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#1d3f8a';
  g.font = 'bold 34px system-ui, sans-serif';
  g.fillText(title, 24, 50);
  g.font = '24px system-ui, sans-serif';
  rows.slice(0, 6).forEach((r, i) => {
    g.fillStyle = r.color || '#222';
    g.fillText(r.text.slice(0, 42), 24, 96 + i * 36);
  });
}

function buildRoom(tier) {
  const parts = [];
  const walls = [];
  parts.push(slab(-W, -0.05, -D, W, 0, D, C.floor, 1));
  parts.push(slab(-1.6, 0, -2.0, 1.6, 0.01, 1.6, tier > 1 ? '#3d4f6b' : C.rug));
  walls.push(panel(2 * D, H, -W, H / 2, 0, C.wall, '+x', 1));
  walls.push(panel(2 * D, H, W, H / 2, 0, C.wall, '-x', 1));
  walls.push(panel(2 * W, H, 0, H / 2, -D, C.wall, '+z', 1));
  walls.push(panel(2 * W, H, 0, H / 2, D, C.wallDark, '-z', 1));
  walls.push(panel(2 * W, 2 * D, 0, H, 0, '#e8e4da', 'down', 1));
  if (tier > 1) {
    for (const [x, f] of [[-W + 0.01, '+x'], [W - 0.01, '-x']]) walls.push(panel(2 * D, 1.1, x, 0.55, 0, C.oak, f));
    walls.push(panel(2 * W, 1.1, 0, 0.55, -D + 0.01, C.oak, '+z'));
  }
  // Door on the +x wall near z = +2.
  walls.push(panel(0.95, 2.1, W - 0.01, 1.05, 2.0, C.oakLight, '-x'));
  walls.push(panel(0.08, 0.08, W - 0.02, 1.05, 1.65, '#c9a24a', '-x'));
  // Desk with a leather top, the player's chair behind it, two visitor chairs in front.
  parts.push(box(1.8, 0.72, 0.9, 0, 0.36, 0, C.oak));
  parts.push(box(1.84, 0.04, 0.94, 0, 0.74, 0, C.leather));
  parts.push(box(0.36, 0.05, 0.28, 0.45, 0.78, 0.1, C.paper));
  parts.push(box(0.12, 0.3, 0.12, -0.6, 0.91, 0.15, C.metal));
  const chair = (x, z, rot, color) => {
    parts.push(box(0.56, 0.1, 0.52, x, 0.44, z, color, rot));
    const back = new THREE.BoxGeometry(0.56, 0.62, 0.08);
    back.translate(0, 0.78, -0.24);
    back.rotateY(rot);
    back.translate(x, 0, z);
    parts.push(paintGeo(back, color));
    parts.push(box(0.5, 0.4, 0.46, x, 0.2, z, '#3b2a1c', rot));
  };
  chair(DESK_SEAT[0], DESK_SEAT[1], Math.PI, C.leather);
  chair(-0.5, -1.0, 0, '#7a3b2e');
  chair(0.5, -1.0, 0, '#7a3b2e');
  // Bookshelf on the +x wall, beyond the door.
  parts.push(box(0.35, 2.0, 1.4, W - 0.2, 1.0, -1.2, C.oak));
  for (let i = 0; i < 4; i++) parts.push(box(0.3, 0.32, 1.25, W - 0.22, 0.35 + i * 0.45, -1.2, ['#7a2e2e', '#2e4a7a', '#4a6a3a', '#7a6a2e'][i]));
  if (tier > 1) {
    // The corner office: a second meeting table with chairs.
    parts.push(box(1.2, 0.72, 1.2, 1.6, 0.36, 1.2, C.oakLight));
    chair(1.0, 1.2, Math.PI / 2, C.leather);
    chair(2.2, 1.2, -Math.PI / 2, C.leather);
  }
  return { parts, walls };
}

function paintGeo(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

export function create(ctx) {
  const tier = ctx.tier || 1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1a17');
  scene.environment = ctx.environment || null;
  // Daylight from the window behind the visitors, and the warm pool of the desk lamp.
  roomLights(scene, { hemi: 0.35, key: 0.8, fill: 0.25, keyPos: [-2, 4, -6], fillPos: [4, 3, 3] });
  lamp(scene, { intensity: tuning().look.deskLamp, distance: 5, x: -0.6, y: 1.3, z: 0.15 });

  const { parts, walls } = buildRoom(tier);
  const bounds = { x0: -W, x1: W, z0: -D, z1: D };
  scene.add(new THREE.Mesh(bakeAO(merge(parts), { bounds, reach: 0.6 }), vertexMaterial()));
  scene.add(new THREE.Mesh(bakeAO(merge(walls), { bounds, ceilY: H, reach: 1.0 }), vertexMaterial()));
  // The desk lamp's shade, lit from inside.
  scene.add(new THREE.Mesh(merge([box(0.24, 0.12, 0.24, -0.6, 1.1, 0.15, PALETTE.paneWarm)]), glowMaterial()));
  scene.add(contactShadows([
    { x: 0, z: 0, sx: 2.4, sz: 1.4 },
    { x: DESK_SEAT[0], z: DESK_SEAT[1], sx: 0.9, sz: 0.9 },
    { x: -0.5, z: -1.0, sx: 0.9, sz: 0.9 },
    { x: 0.5, z: -1.0, sx: 0.9, sz: 0.9 },
    { x: W - 0.2, z: -1.2, sx: 0.7, sz: 1.9 },
  ], { radius: 0.55 }));

  const lawn = paintedTexture(512, 320, paintLawn);
  scene.add(texturedPanel(2.0, 1.25, lawn, { x: 0, y: 1.7, z: -D + 0.02 }));
  const boardW = tier > 1 ? 3.0 : 2.4;
  const boardTex = paintedTexture(512, 256, (g, w, h) => drawBoard(g, w, h, [], 'Tomorrow'));
  const board = texturedPanel(boardW, 1.2, boardTex, { x: -W + 0.02, y: 1.6, z: -0.2, rotY: Math.PI / 2 });
  scene.add(board);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 40);
  const cam = createOfficeCamera(camera);

  // The player sits behind the desk (or, in the reversal, in the other visitor chair).
  const player = createFigure(ctx.playerColor || '#555', 'player');
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
      player.group.position.set(...[DESK_SEAT[0], 0, DESK_SEAT[1]]);
      player.group.rotation.y = Math.PI;
    }
    poseFigure(player, 'cooperative', 1);
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
    setBoard(rows, title = 'Tomorrow') {
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
      disposeTree(scene);
    },
  };
  return room;
}
