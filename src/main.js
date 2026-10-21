// Boot: load data, start a game from the seed, build the chamber and UI, run the loop.
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { loadData } from './loadData.js';
import { setData } from './sim/config.js';
import { newGame, randomSeed } from './sim/modes.js';
import { parliamentHash } from './sim/generate.js';
import { getState, setState, dispatch, subscribe } from './state.js';
import * as chamber from './chamber/scene.js';
import { createHud } from './ui/hud.js';
import { createMpCard } from './ui/mpCard.js';
import { createBook } from './ui/book.js';
import { t, partyColor } from './ui/text.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

async function boot() {
  const data = await loadData();
  setData(data);
  document.title = t('title');

  const seed = params.get('seed') || randomSeed();
  setState(newGame({ seed, party: params.get('party') || undefined }));

  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  document.body.appendChild(labels.domElement);

  const ui = document.getElementById('ui');
  const colorOf = (mp) => partyColor(getState(), mp);
  const room = chamber.create({
    renderer,
    onSeatTap(seat, mpId) {
      if (mpId) card.show(mpId);
      else card.hide();
    },
  });
  room.sync(getState(), colorOf);

  const card = createMpCard(ui, { getState, onClose: () => room.select(null) });
  const book = createBook(ui, {
    getState,
    onPick(mpId) {
      const mp = getState().mps[mpId];
      if (mp.seatId) {
        room.select(mp.seatId);
        room.focusSeat(mp.seatId);
      }
      card.show(mpId);
    },
  });
  createHud(ui, {
    buttons: [
      { label: t('btn.book'), run: () => (book.isOpen ? book.close() : book.open()) },
      { label: t('btn.reset'), run: () => { room.controls.reset(); room.select(null); card.hide(); } },
    ],
    debugText: DEBUG ? () => `${getState().seed} · ${t('debug.hash', { hash: parliamentHash(getState()) })}` : null,
  });

  subscribe(() => {
    card.refresh();
    book.refresh();
  });

  let stats = null;
  if (DEBUG) {
    const { default: Stats } = await import('three/addons/libs/stats.module.js');
    stats = new Stats();
    stats.dom.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50;';
    document.body.appendChild(stats.dom);
    const sim = {
      generate: await import('./sim/generate.js'),
      knowledge: await import('./sim/knowledge.js'),
      relationships: await import('./sim/relationships.js'),
      rng: await import('./sim/rng.js'),
    };
    window.whip = { get state() { return getState(); }, dispatch, sim, room, renderer, THREE, card, book };
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
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('ui').innerHTML = `<div class="fatal">Something went wrong starting the game.<br><small>${String(err.message || err)}</small></div>`;
});
