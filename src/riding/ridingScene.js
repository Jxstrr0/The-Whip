// The constituency office: a storefront with a desk, a waiting area, a wall of local photos, and glass onto
// the street (a prairie town, a suburb, a downtown block, a northern settlement). Props from the kits.
import * as THREE from 'three';
import { box, slab, panel, merge, vertexMaterial, worldUVs, disposeTree, roomLights, lamp, bakeAO, contactShadows, paintedTexture, texturedPanel } from '../kit3d.js';
import { surface } from '../textures.js';
import { placeModel } from '../models.js';
import { t } from '../ui/text.js';
import { createRidingCamera } from './ridingCamera.js';
import { createConstituent, createCrowd } from './constituents.js';
import { createFigure, poseFigure } from '../office/visitor.js';
import { drawBoard } from '../office/officeScene.js';

const W = 3.5; // half of 7 m (x)
const D = 2.5; // half of 5 m (z)
const H = 3;
const C = { plaster: '#ded6c4', floor: '#7a6a58', oak: '#6e4a2b', oakDark: '#3f2a17', paper: '#ece6d6', pavement: '#9a948a', road: '#3e3d40', kerb: '#b8b2a6' };
const DOOR = [2.6, 2.3];
// The visitor's chair sits at an open three-quarter angle, so the person reads, not the chair back.
const VISITOR_SEAT = [0.15, -0.1];
const VISITOR_FACING = Math.PI - 0.55;
const PATH = [DOOR, [2.4, 1.4], [1.0, 0.7], [0.3, 0.35], VISITOR_SEAT];

// The far layer of the street: sky and skyline by riding type. The near layer is real props outside the glass.
function paintStreet(type) {
  return (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, type === 'northern' ? '#8fa7bd' : '#7fa6d4');
    sky.addColorStop(1, '#e8eef2');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const ground = type === 'northern' ? '#e4eaec' : type === 'rural' ? '#b8a860' : '#7f9a66';
    g.fillStyle = ground;
    g.fillRect(0, h * 0.6, w, h * 0.4);
    const bld = (x, bw, bh, col, roof) => {
      g.fillStyle = col;
      g.fillRect(x, h * 0.6 - bh, bw, bh);
      if (roof) {
        g.fillStyle = '#4e3a2c';
        g.beginPath();
        g.moveTo(x - 5, h * 0.6 - bh);
        g.lineTo(x + bw / 2, h * 0.6 - bh - bw * 0.4);
        g.lineTo(x + bw + 5, h * 0.6 - bh);
        g.fill();
      }
      g.fillStyle = '#f5ecc0';
      for (let r = 0; r < Math.floor(bh / 26); r++) for (let i = 0; i < Math.floor(bw / 22); i++) g.fillRect(x + 6 + i * 22, h * 0.6 - bh + 8 + r * 26, 9, 12);
    };
    if (type === 'urban') {
      for (let i = 0; i < 9; i++) bld(i * (w / 9), w / 9 - 8, h * (0.22 + ((i * 37) % 30) / 100), ['#8a8f98', '#a39a8a', '#6b6f76', '#b9b0a0', '#7a6f66'][i % 5], false);
    } else if (type === 'suburban') {
      for (let i = 0; i < 6; i++) bld(16 + i * (w / 6), w / 8, h * 0.1, ['#d9cfb8', '#c2b59a', '#e0d6c2'][i % 3], true);
      g.fillStyle = '#4f6a3a';
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.arc(40 + i * (w / 8), h * 0.56, 22, 0, Math.PI * 2);
        g.fill();
      }
    } else if (type === 'rural') {
      bld(w * 0.08, w * 0.14, h * 0.13, '#b23a2e', true);
      g.fillStyle = '#c7c2b5';
      g.fillRect(w * 0.72, h * 0.26, w * 0.06, h * 0.34);
      g.fillRect(w * 0.8, h * 0.32, w * 0.05, h * 0.28);
      bld(w * 0.42, w * 0.1, h * 0.09, '#d9cfb8', true);
      g.fillStyle = '#a89650';
      for (let i = 0; i < 5; i++) g.fillRect(0, h * (0.66 + i * 0.06), w, h * 0.012);
    } else {
      for (let i = 0; i < 5; i++) bld(30 + i * (w / 5), w / 9, h * 0.08, ['#3d6a8a', '#a8322d', '#e0a526'][i % 3], true);
      g.fillStyle = '#2f4a3a';
      for (let i = 0; i < 20; i++) {
        g.beginPath();
        g.moveTo(i * (w / 20), h * 0.6);
        g.lineTo(i * (w / 20) + 12, h * 0.4);
        g.lineTo(i * (w / 20) + 24, h * 0.6);
        g.fill();
      }
    }
  };
}

// Six local photos: a ribbon cutting, the rink, a field, a parade, the plant gate, the school.
function paintPhotos(g, w, h) {
  g.fillStyle = '#c9c2b2';
  g.fillRect(0, 0, w, h);
  const frames = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) frames.push([16 + c * 166, 14 + r * 118, 150, 104]);
  const scenes = [
    (x, y, fw, fh) => {
      g.fillStyle = '#9fb3c8';
      g.fillRect(x, y, fw, fh * 0.55);
      g.fillStyle = '#6b8a4a';
      g.fillRect(x, y + fh * 0.55, fw, fh * 0.45);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = ['#2f3a44', '#7a3b2e', '#4a6a3a', '#3d4f6b', '#8a6a3a'][i];
        g.fillRect(x + 20 + i * 24, y + fh * 0.4, 14, 34);
        g.fillStyle = '#d6a07a';
        g.beginPath();
        g.arc(x + 27 + i * 24, y + fh * 0.36, 6, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#c8423b';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + 10, y + fh * 0.6);
      g.lineTo(x + fw - 10, y + fh * 0.6);
      g.stroke();
    },
    (x, y, fw, fh) => {
      g.fillStyle = '#4b5663';
      g.fillRect(x, y, fw, fh);
      g.fillStyle = '#eef3f6';
      g.beginPath();
      g.ellipse(x + fw / 2, y + fh / 2, fw * 0.42, fh * 0.34, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#c8423b';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + fw / 2, y + fh * 0.18);
      g.lineTo(x + fw / 2, y + fh * 0.82);
      g.stroke();
    },
    (x, y, fw, fh) => {
      g.fillStyle = '#86aed6';
      g.fillRect(x, y, fw, fh * 0.5);
      g.fillStyle = '#c9b45a';
      g.fillRect(x, y + fh * 0.5, fw, fh * 0.5);
      g.fillStyle = '#a89650';
      for (let i = 0; i < 6; i++) g.fillRect(x, y + fh * (0.55 + i * 0.07), fw, 2);
      g.fillStyle = '#b23a2e';
      g.fillRect(x + fw * 0.7, y + fh * 0.36, fw * 0.14, fh * 0.16);
    },
    (x, y, fw, fh) => {
      g.fillStyle = '#9fb3c8';
      g.fillRect(x, y, fw, fh * 0.6);
      g.fillStyle = '#6b6f76';
      g.fillRect(x, y + fh * 0.6, fw, fh * 0.4);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = ['#c8423b', '#2f6db5', '#e0a526'][i % 3];
        g.fillRect(x + 12 + i * 20, y + fh * 0.2, 12, 10);
        g.fillStyle = '#3f2a17';
        g.fillRect(x + 12 + i * 20, y + fh * 0.2, 2, fh * 0.5);
      }
    },
    (x, y, fw, fh) => {
      g.fillStyle = '#b9c4cf';
      g.fillRect(x, y, fw, fh * 0.5);
      g.fillStyle = '#7d8086';
      g.fillRect(x + 10, y + fh * 0.3, fw - 20, fh * 0.7);
      g.fillStyle = '#5b5e63';
      g.fillRect(x + fw * 0.7, y + fh * 0.08, fw * 0.08, fh * 0.3);
      g.fillStyle = '#3a3d44';
      g.fillRect(x + fw * 0.4, y + fh * 0.6, fw * 0.2, fh * 0.4);
    },
    (x, y, fw, fh) => {
      g.fillStyle = '#9fb3c8';
      g.fillRect(x, y, fw, fh * 0.45);
      g.fillStyle = '#a8553a';
      g.fillRect(x + 8, y + fh * 0.35, fw - 16, fh * 0.65);
      g.fillStyle = '#f5ecc0';
      for (let i = 0; i < 5; i++) g.fillRect(x + 18 + i * 26, y + fh * 0.5, 14, 16);
      g.fillStyle = '#3f2a17';
      g.fillRect(x + fw * 0.85, y + fh * 0.1, 2, fh * 0.3);
      g.fillStyle = '#c8423b';
      g.fillRect(x + fw * 0.85, y + fh * 0.1, 12, 8);
    },
  ];
  frames.forEach(([x, y, fw, fh], i) => {
    g.fillStyle = '#f4f2ec';
    g.fillRect(x - 6, y - 6, fw + 12, fh + 12);
    scenes[i](x, y, fw, fh);
  });
}

// The riding's name on the glass, read from outside (so mirrored from where you sit).
function paintGlassName(name) {
  return (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.save();
    g.translate(w, 0);
    g.scale(-1, 1);
    g.fillStyle = 'rgba(243,234,216,0.92)';
    g.textAlign = 'center';
    // Long names drop to a smaller face rather than running off the pane.
    g.font = `600 ${name.length > 16 ? 56 : 68}px Fraunces, Georgia, serif`;
    g.fillText(name.toUpperCase(), w / 2, 112, w - 40);
    g.font = '34px Fraunces, Georgia, serif';
    g.fillText(t('riding.glass'), w / 2, 176, w - 40);
    g.restore();
  };
}

function buildShell() {
  const g = { plaster: [], oak: [], wool: [], plain: [] };
  g.wool.push(slab(-W, -0.05, -D, W, 0, D, C.floor, 1));
  g.plaster.push(panel(2 * D, H, -W, H / 2, 0, C.plaster, '+x', 1));
  g.plaster.push(panel(2 * D, H, W, H / 2, 0, C.plaster, '-x', 1));
  g.plaster.push(panel(2 * W, H, 0, H / 2, -D, C.plaster, '+z', 1));
  g.plaster.push(panel(2 * W, 2 * D, 0, H, 0, '#ece8de', 'down', 1));
  for (const [len, x, z, facing] of [[2 * D, -W + 0.01, 0, '+x'], [2 * D, W - 0.01, 0, '-x'], [2 * W, 0, -D + 0.01, '+z']]) {
    g.oak.push(panel(len, 0.1, x, 0.05, z, C.oakDark, facing));
  }
  // The storefront: a low oak stall riser, a top fascia, mullions, and the glass door at the +x end.
  g.oak.push(box(2 * W, 0.8, 0.12, 0, 0.4, D - 0.06, C.oak));
  g.oak.push(box(2 * W, 0.32, 0.12, 0, H - 0.16, D - 0.06, C.oakDark));
  for (const x of [-W + 0.05, -1.75, 0, 1.75, W - 0.05]) g.oak.push(box(0.1, H - 1.12, 0.12, x, 0.8 + (H - 1.12) / 2, D - 0.06, C.oakDark));
  g.oak.push(box(2 * W, 0.08, 0.12, 0, 2.0, D - 0.06, C.oakDark));
  g.oak.push(box(0.08, 2.1, 0.1, DOOR[0] - 0.5, 1.05, D - 0.05, C.oakDark));
  g.oak.push(box(0.08, 2.1, 0.1, DOOR[0] + 0.5, 1.05, D - 0.05, C.oakDark));
  g.oak.push(box(1.08, 0.08, 0.1, DOOR[0], 2.12, D - 0.05, C.oakDark));
  g.plain.push(box(0.03, 0.3, 0.03, DOOR[0] - 0.35, 1.05, D - 0.12, '#c9a24a'));
  return g;
}

export function create(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fb6c9');
  scene.environment = ctx.environment || null;
  // Daylight pours in through the storefront on the +z side.
  roomLights(scene, { hemi: 0.6, key: 1.2, fill: 0.25, warm: '#eaf2f8', ground: '#6b5a48', keyPos: [2, 5, 8], fillPos: [-4, 3, -4] });
  lamp(scene, { color: '#eaf2f8', intensity: 8, distance: 7, x: 0, y: 2.2, z: D - 0.4 });
  const bounds = { x0: -W, x1: W, z0: -D, z1: D };
  const kinds = { plaster: 'plaster', oak: 'oak', wool: 'wool' };
  for (const [kind, parts] of Object.entries(buildShell())) {
    if (!parts.length) continue;
    let geo = merge(parts);
    let mat;
    if (kinds[kind]) {
      geo = worldUVs(bakeAO(geo, { bounds, ceilY: kind === 'plaster' ? H : null, reach: 0.7 }));
      mat = surface(kinds[kind], kind === 'plaster' ? { roughness: 0.95 } : {});
    } else mat = vertexMaterial({ metalness: 0.7, roughness: 0.35, envMapIntensity: 1 });
    scene.add(new THREE.Mesh(geo, mat));
  }
  // The glass: a faint tinted pane with the riding's name, and the street beyond it.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, H - 1.12), new THREE.MeshPhysicalMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.set(0, 0.8 + (H - 1.12) / 2, D - 0.02);
  scene.add(glass);
  // The name sits beside the visitor's head (screen right, since you face +z), low enough to clear the masthead.
  const nameTex = paintedTexture(1024, 256, paintGlassName(ctx.ridingName || ''));
  const nameSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  nameSign.position.set(-1.3, 1.2, D - 0.03);
  scene.add(nameSign);
  const photos = paintedTexture(512, 256, paintPhotos);
  scene.add(texturedPanel(3.2, 1.6, photos, { x: -W + 0.02, y: 1.7, z: -0.2, rotY: Math.PI / 2 }));
  const notices = paintedTexture(512, 256, (g, w, h) => drawBoard(g, w, h, (t('riding.notices') || '').split('|').map((text) => ({ text })), t('riding.board')));
  scene.add(texturedPanel(1.6, 0.8, notices, { x: W - 0.02, y: 1.7, z: -1.0, rotY: -Math.PI / 2 }));

  // Furniture from the kit: the desk and your chair, the visitor's chair, four waiting chairs, a coffee corner.
  placeModel(scene, 'desk', { x: 0, z: -1.0, rotY: 0 }).scale.set(1.15, 1, 1.05);
  placeModel(scene, 'chairDesk', { x: 0, z: -1.8, rotY: 0 });
  placeModel(scene, 'chairCushion', { x: VISITOR_SEAT[0], z: VISITOR_SEAT[1], rotY: VISITOR_FACING });
  for (let i = 0; i < 4; i++) placeModel(scene, 'chairCushion', { x: W - 0.5, z: -1.7 + i * 0.75, rotY: -Math.PI / 2 });
  placeModel(scene, 'bookcaseOpen', { x: -W + 0.26, z: -1.9, rotY: Math.PI / 2 });
  placeModel(scene, 'kitchenCoffeeMachine', { x: -W + 0.3, y: 0.86, z: -1.9 });
  placeModel(scene, 'pottedPlant', { x: -W + 0.5, z: 1.9 });
  placeModel(scene, 'laptop', { x: 0.3, y: 0.72, z: -1.05, rotY: 0 });
  placeModel(scene, 'books', { x: -0.45, y: 0.72, z: -0.95, rotY: -0.2 });
  placeModel(scene, 'trashcan', { x: 0.9, z: -1.9 });
  scene.add(contactShadows([
    { x: 0, z: -1.0, sx: 2.2, sz: 1.3 },
    { x: 0, z: -1.8, sx: 0.9, sz: 0.9 },
    { x: VISITOR_SEAT[0], z: VISITOR_SEAT[1], sx: 0.9, sz: 0.9 },
    ...[0, 1, 2, 3].map((i) => ({ x: W - 0.5, z: -1.7 + i * 0.75, sx: 0.8, sz: 0.8 })),
    { x: -W + 0.3, z: -1.9, sx: 0.7, sz: 1.2 },
    { x: -W + 0.5, z: 1.9, sx: 0.7, sz: 0.7 },
  ], { radius: 0.55 }));

  // Outside: the pavement, the kerb and road, the street props, and far off the painted skyline.
  const outside = new THREE.Group();
  outside.add(new THREE.Mesh(worldUVs(merge([
    slab(-14, -0.06, D, 14, -0.01, D + 3.2, C.pavement, 2),
    slab(-14, -0.06, D + 3.2, 14, 0.0, D + 3.35, C.kerb),
    slab(-14, -0.1, D + 3.35, 14, -0.05, D + 12, C.road, 2),
  ])), vertexMaterial({ roughness: 0.95 })));
  placeModel(outside, 'streetlight', { pack: 'street', x: 3.2, z: D + 2.6, rotY: Math.PI });
  placeModel(outside, 'streetlight', { pack: 'street', x: -3.8, z: D + 2.6, rotY: Math.PI });
  placeModel(outside, 'bench', { pack: 'street', x: -2.2, z: D + 2.4, rotY: 0 });
  placeModel(outside, 'firehydrant', { pack: 'street', x: 1.4, z: D + 2.7 });
  placeModel(outside, 'trash_A', { pack: 'street', x: 4.4, z: D + 2.5 });
  placeModel(outside, 'bush', { pack: 'street', x: -5.2, z: D + 1.6 });
  placeModel(outside, 'bush', { pack: 'street', x: 5.6, z: D + 1.4 });
  placeModel(outside, 'car_sedan', { pack: 'street', x: 1.8, z: D + 4.6, rotY: Math.PI / 2 });
  const street = paintedTexture(1024, 400, paintStreet(ctx.ridingType || 'suburban'));
  // Its horizon sits at road level, so the painted ground hides below the real road.
  const backdrop = texturedPanel(36, 14, street, { x: 0, y: 1.4, z: D + 14, rotY: Math.PI });
  outside.add(backdrop);
  // The town hall: a lamp over the podium, the podium itself, and the crowd on the pavement.
  const hall = new THREE.Group();
  hall.add(new THREE.Mesh(merge([slab(-1.2, 0, D + 0.3, 1.2, 0.2, D + 1.2, '#6e4a2b'), box(0.6, 1.1, 0.4, 0, 0.75, D + 0.8, '#3b2a1c')]), vertexMaterial()));
  const crowd = createCrowd(28, (i) => ['#3d4f6b', '#7a3b2e', '#4a6a3a', '#6b6f76', '#8a6a3a', '#2f3a44', '#a89650'][i % 7]);
  hall.add(crowd.group);
  hall.visible = false;
  outside.add(hall);
  scene.add(outside);
  const streetLamp = lamp(scene, { color: '#ffd9a0', intensity: 14, distance: 9, x: 3.2, y: 4.6, z: D + 2.6 });

  const me = createFigure(ctx.playerColor || '#555', 'player');
  me.setHeadVisible(false);
  me.group.position.set(0, 0, -1.8);
  poseFigure(me, 'cooperative', 1);
  scene.add(me.group);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
  const cam = createRidingCamera(camera);
  cam.shot('desk', true);
  let visitor = null;
  let visitorKey = null;
  let townHall = false;

  return {
    name: 'riding',
    scene,
    camera,
    setVisitor(v) {
      if (v?.key === visitorKey) return;
      visitorKey = v?.key || null;
      const old = visitor;
      visitor = null;
      if (old) old.leave(() => old.dispose());
      if (!v) return;
      visitor = createConstituent(scene, { role: v.role, id: v.key, path: PATH, seat: VISITOR_SEAT, facing: VISITOR_FACING });
      visitor.setMood(v.mood || 'cooperative');
    },
    // Cut outside to face the crowd on the pavement; the glass goes so the camera can stand in the street.
    setTownHall(on, crowdMood = 50, placards = []) {
      townHall = on;
      hall.visible = on;
      glass.visible = !on;
      nameSign.visible = !on;
      me.group.visible = !on;
      if (visitor && on) {
        visitor.dispose();
        visitor = null;
        visitorKey = null;
      }
      if (on) crowd.setPlacards(placards);
      crowd.setMood(crowdMood);
      streetLamp.intensity = on ? 22 : 14;
      cam.shot(on ? 'townHall' : 'desk', true);
    },
    update(dt) {
      visitor?.update(dt);
      if (townHall) crowd.update(dt);
      cam.update(dt);
    },
    resize(w, h) {
      camera.aspect = w / h;
      cam.fitAspect(camera.aspect, w);
    },
    dispose() {
      visitor?.dispose();
      scene.traverse((o) => o.userData.cancel?.());
      disposeTree(scene);
    },
  };
}
