// Boot: load data, show the start menu (or start straight from ?seed=), build the rooms and UI, run the loop.
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { setupRenderer, sharedEnvironment } from './look.js';
import { loadData } from './loadData.js';
import { setData, tuning } from './sim/config.js';
import { newGame } from './sim/modes.js';
import { parliamentHash } from './sim/generate.js';
import { getState, setState, dispatch, subscribe } from './state.js';
import './sim/pacing.js';
import './sim/meetings.js';
import { caucusSeating } from './sim/caucus.js';
import './sim/riding.js';
import { saveGame, loadGame, saveInfo } from './save.js';
import { createRooms } from './rooms.js';
import * as chamber from './chamber/scene.js';
import * as office from './office/officeScene.js';
import * as caucus from './caucus/caucusScene.js';
import * as riding from './riding/ridingScene.js';
import { createHud, createTuningPanel, createToast } from './ui/hud.js';
import { createMpCard } from './ui/mpCard.js';
import { createBook } from './ui/book.js';
import { createAgenda } from './ui/agenda.js';
import { createCountBoard } from './ui/countBoard.js';
import { createOfficeUI } from './ui/talk.js';
import { createCaucusUI } from './ui/caucusUI.js';
import { createRidingUI } from './ui/ridingUI.js';
import { createStartMenu, createGameMenu } from './ui/menus.js';
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
  if (k === 'caucus') return 'caucus';
  if (k === 'riding') return 'riding';
  return 'chamber';
}

let world = null;

// Everything that exists once a game is running: renderer, rooms, UI.
function buildWorld() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  setupRenderer(renderer, tuning().look);
  const environment = sharedEnvironment(renderer);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  document.body.appendChild(labels.domElement);
  const ui = document.getElementById('ui');
  const colorOf = (mp) => partyColor(getState(), mp);

  let card;
  let hud = null;
  const rooms = createRooms({
    factories: { chamber, office, caucus, riding },
    ctx: {
      renderer,
      environment,
      onSeatTap(seat, mpId) {
        if (mpId) card.show(mpId);
        else card.hide();
      },
      onMpTap: (mpId) => card.show(mpId),
    },
    onChange(name, room) {
      // Cut through black: cover the swap at once, then fade back in once the new room has drawn a frame.
      const fade = document.getElementById('fade');
      if (fade) {
        fade.classList.add('on');
        requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.remove('on')));
      }
      if (name === 'chamber') {
        const state = getState();
        room.sync(state, colorOf);
        // Acts 1 and 2 open from your own seat: the backbench is a seat, not a map.
        const me = state.mps[state.player.mpId];
        if (me.seatId) room.setHomeSeat(me.seatId);
        room.setView(me.seatId && state.player.act <= 2 ? 'home' : 'overview');
      }
      card?.hide();
      hud?.render();
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
  const gameMenu = createGameMenu(ui, {
    getState,
    onQuit: () => {
      saveGame(getState());
      location.href = location.pathname;
    },
  });
  hud = createHud(ui, {
    buttons: [
      { label: t('btn.book'), run: () => (book.isOpen ? book.close() : book.open()) },
      {
        // Overview from above the bar, or back to your own seat. Tapping it also tidies the view.
        get label() {
          return chamberRoom()?.view === 'home' ? t('btn.overview') : t('btn.myseat');
        },
        run() {
          const room = chamberRoom();
          if (!room) return;
          room.setView(room.view === 'home' ? 'overview' : 'home');
          room.controls.reset();
          room.select(null);
          card.hide();
          hud.render();
        },
      },
      { label: '☰', run: () => gameMenu.open() },
    ],
    debugText: DEBUG ? () => `${getState().seed} · ${t('debug.hash', { hash: parliamentHash(getState()) })}` : null,
  });

  const agenda = createAgenda(ui, {
    getState,
    onContinue: () => dispatch({ type: 'advance' }),
    onSkip: () => dispatch({ type: 'skip' }),
    onNewGame: () => (location.href = location.pathname),
  });
  const countBoard = createCountBoard(ui, {
    getState,
    getRoom: chamberRoom,
    onChoose: (choice) => dispatch({ type: 'resolve', choice }),
    onContinue: () => dispatch({ type: 'advance' }),
  });
  const officeUI = createOfficeUI(ui, { getState, dispatch, pickMp });
  const caucusUI = createCaucusUI(ui, { getState, dispatch, getRoom: () => (rooms.name === 'caucus' ? rooms.room : null) });
  const ridingUI = createRidingUI(ui, { getState, dispatch });

  // Keep each room in step with the sim: who's in the chair, moods, the board, the crowd.
  function syncRoom(name, state) {
    const room = rooms.room;
    if (name === 'office') {
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
    } else if (name === 'caucus') {
      // The whip's read: everyone in party colours; the seats you can read carry their mood as a mark.
      room.read((id) => {
        const k = state.player.knowledge[id]?.mood;
        return { color: colorOf(state.mps[id]), mood: k?.known && !k.stale ? state.mps[id].mood : null, me: id === state.player.mpId };
      });
    } else if (name === 'riding') {
      const v = state.ridingVisit;
      if (!v) return;
      room.setTownHall(v.phase === 'townHall', v.townHall?.crowd ?? 50);
      const item = v.phase === 'visitors' ? v.queue[v.at] : null;
      room.setVisitor(item ? { key: `${v.week}:${v.at}`, role: item.role } : null);
    }
  }

  let lastLog = getState().log.length;
  function renderAll(state = getState()) {
    const name = roomFor(state);
    const me = state.mps[state.player.mpId];
    rooms.show(name, {
      playerColor: colorOf(me),
      tier: state.player.act >= 4 ? 2 : 1,
      ridingType: me.riding.type,
      ridingName: me.riding.name,
      seating: name === 'caucus' ? caucusSeating(state, me.party) : null,
      playerId: me.id,
    });
    syncRoom(name, state);
    agenda.render(state);
    countBoard.render(state);
    officeUI.render(state);
    caucusUI.render(state);
    ridingUI.render(state);
    card.refresh();
    book.refresh();
    // Meeting outcomes, calls and deliveries show briefly as a toast.
    const fresh = state.log.slice(lastLog).filter((l) => l.kind === 'meeting' || l.kind === 'career');
    lastLog = state.log.length;
    if (fresh.length) toast.show(fresh.map((l) => l.text).join(' '));
  }

  // Autosave a moment after things settle, to slot 1.
  let saveTimer = null;
  subscribe(() => {
    renderAll();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveGame(getState()), 800);
  });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    rooms.resize(w, h);
  }
  window.addEventListener('resize', resize);

  let stats = null;
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const room = rooms.room;
    if (!room) return;
    room.update(dt);
    renderer.render(room.scene, room.camera);
    labels.render(room.scene, room.camera);
    stats?.update();
  });

  return {
    renderer,
    rooms,
    card,
    book,
    ui,
    renderAll,
    resize,
    setStats(s) {
      stats = s;
    },
  };
}

async function startGame(state) {
  setState(state);
  if (!world) {
    world = buildWorld();
    if (DEBUG) await debugTools(world);
  }
  world.renderAll();
  world.resize();
  // A fresh game opens on its first stop (Monday morning of a guided first week).
  if (!state.flow.pending && state.flow.forceWatch) dispatch({ type: 'advance' });
  saveGame(getState());
}

async function debugTools(w) {
  const { default: Stats } = await import('three/addons/libs/stats.module.js');
  const stats = new Stats();
  stats.dom.style.cssText = 'position:fixed;right:8px;top:120px;z-index:50;pointer-events:none;opacity:.8;';
  document.body.appendChild(stats.dom);
  w.setStats(stats);
  createTuningPanel(w.ui, tuning());
  const names = ['generate', 'knowledge', 'relationships', 'rng', 'bills', 'mp', 'vote', 'pacing', 'meetings', 'caucus', 'riding', 'career'];
  const sim = {};
  for (const n of names) sim[n] = await import(`./sim/${n}.js`);
  window.whip = {
    get state() {
      return getState();
    },
    dispatch,
    sim,
    rooms: w.rooms,
    get room() {
      return w.rooms.room;
    },
    renderer: w.renderer,
    THREE,
    card: w.card,
    book: w.book,
  };
}

async function boot() {
  setData(await loadData());
  document.title = t('title');
  const seed = params.get('seed');
  if (seed) {
    // Debug and shared-seed starts skip the menu; ?guided=1 adds the first-week walkthrough.
    return startGame(newGame({ seed, party: params.get('party') || undefined, guided: params.get('guided') === '1' }));
  }
  createStartMenu(document.getElementById('ui'), {
    info: saveInfo(1),
    onContinue: () => startGame(loadGame(1)),
    onNew: (opts) => startGame(newGame({ ...opts, guided: true })),
  });
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('ui').innerHTML = `<div class="fatal">Something went wrong starting the game.<br><small>${String(err.message || err)}</small></div>`;
});
