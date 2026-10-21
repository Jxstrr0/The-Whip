// Boot: set up the renderer and label layer, build the chamber, run the loop.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as chamber from './chamber/scene.js';

const TITLE = 'The Whip';
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const labels = new CSS2DRenderer();
labels.domElement.className = 'labels';
document.body.appendChild(labels.domElement);

const ui = document.getElementById('ui');
ui.innerHTML = `
  <header class="topbar"><span class="brand">${TITLE}</span><button class="btn" data-act="reset">Reset view</button></header>
`;

const seatLabel = document.createElement('div');
seatLabel.className = 'seat-label';
const seatLabelObj = new CSS2DObject(seatLabel);
seatLabelObj.visible = false;

const SIDE_NAME = { gov: 'Government side', opp: 'Opposition side' };
const room = chamber.create({
  renderer,
  onSeatTap(seat) {
    if (!seat) {
      seatLabelObj.visible = false;
      return;
    }
    seatLabel.textContent = `${seat.seatId} · ${SIDE_NAME[seat.side]} · row ${seat.row} · seat ${seat.index}`;
    seatLabelObj.position.set(seat.x, seat.y + 1.7, seat.z);
    seatLabelObj.visible = true;
  },
});
room.scene.add(seatLabelObj);

ui.querySelector('[data-act="reset"]').addEventListener('click', () => {
  room.controls.reset();
  room.seats.select(null);
  seatLabelObj.visible = false;
});

let stats = null;
if (DEBUG) {
  const { default: Stats } = await import('three/addons/libs/stats.module.js');
  stats = new Stats();
  stats.dom.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50;';
  document.body.appendChild(stats.dom);
  window.whip = { renderer, room, THREE };
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  labels.setSize(w, h);
  room.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  room.update(dt);
  renderer.render(room.scene, room.camera);
  labels.render(room.scene, room.camera);
  stats?.update();
});
