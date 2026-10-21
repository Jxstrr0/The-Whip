// The constituency office: a storefront with a desk, a waiting area, a wall of local photos, and a front
// window onto the riding (a prairie town, a suburb, a downtown block, a northern settlement).
import * as THREE from 'three';
import { box, slab, panel, merge, vertexMaterial, disposeTree, addSoftLights, paintedTexture, texturedPanel } from '../kit3d.js';
import { createRidingCamera } from './ridingCamera.js';
import { createConstituent, createCrowd } from './constituents.js';
import { createFigure, poseFigure } from '../office/visitor.js';

const W = 3.5; // half of 7 m (x)
const D = 2.5; // half of 5 m (z)
const H = 3;
const DOOR = [2.6, 2.3];
const VISITOR_SEAT = [0, -0.15];
const PATH = [DOOR, [2.4, 1.4], [0.9, 0.6], [0, 0.45], VISITOR_SEAT];

function paintStreet(type) {
  return (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, type === 'northern' ? '#9fb6c9' : '#86aed6');
    sky.addColorStop(1, '#e6eef2');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = type === 'northern' ? '#e8eef0' : '#6f8a52';
    g.fillRect(0, h * 0.62, w, h);
    g.fillStyle = '#4b4b4f';
    g.fillRect(0, h * 0.74, w, h * 0.12);
    const house = (x, bw, bh, col, roof = true) => {
      g.fillStyle = col;
      g.fillRect(x, h * 0.62 - bh, bw, bh);
      if (roof) {
        g.fillStyle = '#5a3a2a';
        g.beginPath();
        g.moveTo(x - 6, h * 0.62 - bh);
        g.lineTo(x + bw / 2, h * 0.62 - bh - bw * 0.35);
        g.lineTo(x + bw + 6, h * 0.62 - bh);
        g.fill();
      }
      g.fillStyle = '#f3e9b5';
      for (let i = 0; i < Math.floor(bw / 30); i++) g.fillRect(x + 8 + i * 30, h * 0.62 - bh + 14, 12, 14);
    };
    if (type === 'urban') {
      for (let i = 0; i < 8; i++) house(i * (w / 8), w / 8 - 6, h * (0.25 + ((i * 37) % 30) / 100), ['#8a8f98', '#a39a8a', '#6b6f76', '#b9b0a0'][i % 4], false);
    } else if (type === 'suburban') {
      for (let i = 0; i < 6; i++) house(20 + i * (w / 6), w / 8, h * 0.12, ['#d9cfb8', '#c2b59a', '#e0d6c2'][i % 3]);
    } else if (type === 'rural') {
      house(w * 0.1, w * 0.12, h * 0.14, '#b23a2e');
      g.fillStyle = '#c7c2b5';
      g.fillRect(w * 0.7, h * 0.3, w * 0.06, h * 0.32);
      g.fillRect(w * 0.78, h * 0.36, w * 0.05, h * 0.26);
      house(w * 0.4, w * 0.1, h * 0.1, '#d9cfb8');
    } else {
      for (let i = 0; i < 5; i++) house(30 + i * (w / 5), w / 9, h * 0.09, ['#3d6a8a', '#a8322d', '#e0a526'][i % 3]);
      g.fillStyle = '#2f4a3a';
      for (let i = 0; i < 18; i++) {
        g.beginPath();
        g.moveTo(i * (w / 18), h * 0.62);
        g.lineTo(i * (w / 18) + 12, h * 0.42);
        g.lineTo(i * (w / 18) + 24, h * 0.62);
        g.fill();
      }
    }
  };
}

function paintPhotos(g, w, h) {
  g.fillStyle = '#c9c2b2';
  g.fillRect(0, 0, w, h);
  const cols = ['#7d8a6a', '#8fb3d6', '#b08a4e', '#6a4c93', '#a8322d', '#3d6a8a'];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      g.fillStyle = '#f4f2ec';
      g.fillRect(14 + c * 98, 12 + r * 82, 84, 70);
      g.fillStyle = cols[(r * 5 + c) % cols.length];
      g.fillRect(20 + c * 98, 18 + r * 82, 72, 50);
    }
  }
}

function buildRoom() {
  const parts = [];
  const walls = [];
  parts.push(slab(-W, -0.05, -D, W, 0, D, '#6b5a48'));
  walls.push(panel(2 * D, H, -W, H / 2, 0, '#d9d2c0', '+x'));
  walls.push(panel(2 * D, H, W, H / 2, 0, '#d9d2c0', '-x'));
  walls.push(panel(2 * W, H, 0, H / 2, -D, '#c9c2b2', '+z'));
  walls.push(panel(2 * W, 2 * D, 0, H, 0, '#ece8de', 'down'));
  // The storefront: glass from waist height, a door at one end.
  walls.push(panel(2 * W, 0.8, 0, 0.4, D, '#6e4a2b', '-z'));
  walls.push(panel(2 * W, 0.3, 0, H - 0.15, D - 0.01, '#6e4a2b', '-z'));
  parts.push(box(1.6, 0.74, 0.8, 0, 0.37, -1.0, '#6e4a2b'));
  parts.push(box(1.64, 0.04, 0.84, 0, 0.76, -1.0, '#3a6a48'));
  parts.push(box(0.3, 0.04, 0.22, 0.4, 0.79, -1.0, '#ece6d6'));
  // Player's chair behind the desk, visitor chair in front of it, four waiting chairs along the +x wall.
  const chair = (x, z, rot) => {
    parts.push(box(0.52, 0.1, 0.5, x, 0.44, z, '#2f4a6b', rot));
    const back = box(0.52, 0.6, 0.08, 0, 0.78, -0.22, '#2f4a6b');
    back.rotateY(rot);
    back.translate(x, 0, z);
    parts.push(back);
  };
  chair(0, -1.75, 0);
  chair(VISITOR_SEAT[0], VISITOR_SEAT[1], Math.PI);
  for (let i = 0; i < 4; i++) chair(W - 0.45, -1.6 + i * 0.7, -Math.PI / 2);
  parts.push(box(0.6, 1.0, 0.4, -W + 0.4, 0.5, -2.0, '#6b6f76'));
  return { parts, walls };
}

export function create(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fb6c9');
  addSoftLights(scene, { intensity: 1 });
  const { parts, walls } = buildRoom();
  scene.add(new THREE.Mesh(merge(parts), vertexMaterial()), new THREE.Mesh(merge(walls), vertexMaterial()));
  const street = paintedTexture(1024, 400, paintStreet(ctx.ridingType || 'suburban'));
  const window = texturedPanel(2 * W, H - 1.1, street, { x: 0, y: 0.8 + (H - 1.1) / 2, z: D - 0.02, rotY: Math.PI });
  scene.add(window);
  const photos = paintedTexture(512, 256, paintPhotos);
  scene.add(texturedPanel(3.2, 1.6, photos, { x: -W + 0.02, y: 1.7, z: -0.2, rotY: Math.PI / 2 }));

  // Outside, for the town hall: the street, a podium, and the crowd.
  const outside = new THREE.Group();
  outside.add(new THREE.Mesh(merge([slab(-8, -0.06, D, 8, -0.01, 12, '#5d6b4a'), slab(-1.2, 0, D + 0.3, 1.2, 0.2, D + 1.2, '#6e4a2b'), box(0.6, 1.1, 0.4, 0, 0.75, D + 0.8, '#3b2a1c')]), vertexMaterial()));
  const crowd = createCrowd(28, (i) => ['#3d4f6b', '#7a3b2e', '#4a6a3a', '#6b6f76', '#8a6a3a'][i % 5]);
  outside.add(crowd.group);
  outside.visible = false;
  scene.add(outside);

  const me = createFigure(ctx.playerColor || '#555', 'player');
  me.group.position.set(0, 0, -1.75);
  poseFigure(me, 'cooperative', 1);
  scene.add(me.group);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
  const cam = createRidingCamera(camera);
  cam.shot('desk', true);
  let visitor = null;
  let visitorKey = null;

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
      visitor = createConstituent(scene, { role: v.role, id: v.key, path: PATH, seat: VISITOR_SEAT, facing: Math.PI });
      visitor.setMood(v.mood || 'cooperative');
    },
    // Cut outside to face the crowd; the glass goes so the camera can stand in the street.
    setTownHall(on, crowdMood = 50) {
      outside.visible = on;
      window.visible = !on;
      me.group.visible = !on;
      if (visitor && on) {
        visitor.dispose();
        visitor = null;
        visitorKey = null;
      }
      crowd.setMood(crowdMood);
      cam.shot(on ? 'townHall' : 'desk', true);
    },
    update(dt) {
      visitor?.update(dt);
      cam.update(dt);
    },
    resize(w, h) {
      camera.aspect = w / h;
      cam.fitAspect(camera.aspect);
    },
    dispose() {
      visitor?.dispose();
      disposeTree(scene);
    },
  };
}
