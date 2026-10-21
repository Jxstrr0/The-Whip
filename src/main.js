// Boot: load data, start a game from the seed, build the rooms and UI, run the loop.
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { loadData } from './loadData.js';
import { setData, tuning } from './sim/config.js';
import { newGame, randomSeed } from './sim/modes.js';
import { parliamentHash } from './sim/generate.js';
import { getState, setState, dispatch, subscribe } from './state.js';
import './sim/pacing.js';
import './sim/meetings.js';
import { createRooms } from './rooms.js';
import * as chamber from './chamber/scene.js';
import * as office from './office/officeScene.js';
import { createHud, createTuningPanel, createToast } from './ui/hud.js';
import { createMpCard } from './ui/mpCard.js';
import { createBook } from './ui/book.js';
import { createAgenda } from './ui/agenda.js';
import { createCountBoard } from './ui/countBoard.js';
import { createOfficeUI } from './ui/talk.js';
import { t, partyColor } from './ui/text.js';
import { stageLabel } from './sim/vote.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

// "At risk" in the book: how likely an MP is to stray on the next whipped vote, from what you can see.
// Riding effects are public; loyalty only counts once you've learned it.
function nextBills(state, n = 1) {
  return Object.values(state.bills)
    .filter((b) => b.status === 'active' && b.nextVote != null)
    .sort((a, b) => a.nextVote - b.nextVote)
    .slice(0, n);
}

function riskOf(state, id, asLabel = false) {
  const [b] = nextBills(state);
  const m = state.mps[id];
  if (!b || m.party === 'ind') return asLabel ? '' : -1;
  const sign = { yea: 1, nay: -1 }[b.positions[m.party]] || 0;
  const loyaltyKnown = state.player.knowledge[id]?.loyalty?.known;
  const risk = -(b.ridingEffects[m.riding.type] || 0) * sign * 50 + (loyaltyKnown ? (100 - m.loyalty) / 2 : 15);
  if (!asLabel) return risk;
  return risk > 40 ? '⚠ at risk' : risk > 20 ? 'leaning?' : '';
}

// Which room the current stop belongs in.
function roomFor(state) {
  const k = state.flow.pending?.kind;
  if (k === 'office' || k === 'meeting') return 'office';
  return 'chamber';
}

async function boot() {
  setData(await loadData());
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

  let card;
  const rooms = createRooms({
    factories: { chamber, office },
    ctx: {
      renderer,
      onSeatTap(seat, mpId) {
        if (mpId) card.show(mpId);
        else card.hide();
      },
    },
    onChange(name, room) {
      if (name === 'chamber') room.sync(getState(), colorOf);
      card?.hide();
    },
  });
  const chamberRoom = () => (rooms.name === 'chamber' ? rooms.room : null);

  let picking = null;
  const book = createBook(ui, {
    getState,
    riskOf,
    onClose: () => (picking = null),
    onPick(mpId) {
      if (picking) {
        const cb = picking;
        picking = null;
        return cb(mpId);
      }
      const mp = getState().mps[mpId];
      const room = chamberRoom();
      if (room && mp.seatId) {
        room.select(mp.seatId);
        room.focusSeat(mp.seatId);
      }
      card.show(mpId);
    },
  });
  const pickMp = (title, cb) => {
    picking = cb;
    book.open({ title });
  };

  card = createMpCard(ui, {
    getState,
    onClose: () => chamberRoom()?.select(null),
    actions(mpId) {
      const state = getState();
      const e = state.evening;
      if (state.flow.pending?.kind !== 'office' || !e || mpId === state.player.mpId) return [];
      const left = e.slots - e.used;
      const out = [];
      if (left >= 1) out.push({ label: t('card.invite'), primary: true, run: () => (card.hide(), dispatch({ type: 'invite', mpId })) });
      if (left >= 0.5) out.push({ label: t('card.call'), run: () => (card.hide(), dispatch({ type: 'call', mpId })) });
      return out;
    },
  });

  const toast = createToast(ui);
  createHud(ui, {
    buttons: [
      { label: t('btn.book'), run: () => (book.isOpen ? book.close() : book.open()) },
      {
        label: t('btn.reset'),
        run: () => {
          chamberRoom()?.controls.reset();
          chamberRoom()?.select(null);
          card.hide();
        },
      },
    ],
    debugText: DEBUG ? () => `${getState().seed} · ${t('debug.hash', { hash: parliamentHash(getState()) })}` : null,
  });

  const agenda = createAgenda(ui, {
    getState,
    onContinue: () => dispatch({ type: 'advance' }),
    onSkip: () => dispatch({ type: 'skip' }),
    onNewGame: () => {
      const url = new URL(location.href);
      url.searchParams.delete('seed');
      location.href = url.toString();
    },
  });
  const countBoard = createCountBoard(ui, {
    getState,
    getRoom: chamberRoom,
    onChoose: (choice) => dispatch({ type: 'resolve', choice }),
    onContinue: () => dispatch({ type: 'advance' }),
  });
  const officeUI = createOfficeUI(ui, { getState, dispatch, pickMp });

  // Keep the office room in step with the meeting: who's in the chair, their mood, the board.
  function syncOffice(state) {
    const room = rooms.room;
    const me = state.mps[state.player.mpId];
    room.setBoard(
      nextBills(state, 5).map((b) => ({ text: `${b.title} · ${stageLabel(b.stage)} · ${(b.positions[me.party] || '').toUpperCase()}`, color: b.positions[me.party] === 'yea' ? '#1f6f40' : '#8a2a25' })),
      'Coming up'
    );
    const mt = state.meeting && state.meetings[state.meeting];
    if (mt) {
      room.setVisitor({ mpId: mt.mpId, mood: mt.mood, color: colorOf(state.mps[mt.mpId]), reversal: mt.reversal });
      room.pushIn(mt.phase === 'deal');
    } else room.setVisitor(null);
  }

  let lastLog = getState().log.length;
  function renderAll(state = getState()) {
    const roomName = roomFor(state);
    rooms.show(roomName, { playerColor: colorOf(state.mps[state.player.mpId]), tier: state.player.act >= 4 ? 2 : 1 });
    if (roomName === 'office') syncOffice(state);
    agenda.render(state);
    countBoard.render(state);
    officeUI.render(state);
    card.refresh();
    book.refresh();
    // Meeting outcomes and calls show briefly as a toast.
    const fresh = state.log.slice(lastLog).filter((l) => l.kind === 'meeting' || l.kind === 'career');
    lastLog = state.log.length;
    if (fresh.length) toast.show(fresh.map((l) => l.text).join(' '));
  }
  subscribe(() => renderAll());

  let stats = null;
  if (DEBUG) {
    const { default: Stats } = await import('three/addons/libs/stats.module.js');
    stats = new Stats();
    stats.dom.style.cssText = 'position:fixed;right:8px;top:120px;z-index:50;pointer-events:none;opacity:.8;';
    document.body.appendChild(stats.dom);
    createTuningPanel(ui, tuning());
    const sim = {
      generate: await import('./sim/generate.js'),
      knowledge: await import('./sim/knowledge.js'),
      relationships: await import('./sim/relationships.js'),
      rng: await import('./sim/rng.js'),
      bills: await import('./sim/bills.js'),
      mp: await import('./sim/mp.js'),
      vote: await import('./sim/vote.js'),
      pacing: await import('./sim/pacing.js'),
      meetings: await import('./sim/meetings.js'),
    };
    window.whip = {
      get state() {
        return getState();
      },
      dispatch,
      sim,
      rooms,
      get room() {
        return rooms.room;
      },
      renderer,
      THREE,
      card,
      book,
    };
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    rooms.resize(w, h);
  }
  window.addEventListener('resize', resize);
  renderAll();
  resize();

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const room = rooms.room;
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
