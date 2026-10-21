// Boot: load data, show the start menu (or start straight from ?seed=), build the rooms and UI, run the loop.
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { setupRenderer, sharedEnvironment } from './look.js';
import { loadData } from './loadData.js';
import { setData, tuning } from './sim/config.js';
import { newGame, scenarioGame, dailyGame, sharedGame, scenarioList } from './sim/modes.js';
import { parliamentHash } from './sim/generate.js';
import { getState, setState, dispatch, subscribe } from './state.js';
import './sim/pacing.js';
import './sim/meetings.js';
import './sim/questionPeriod.js';
import { caucusSeating } from './sim/caucus.js';
import { townHallPlacards } from './sim/riding.js';
import { weatherOf } from './sim/calendar.js';
import { saveGame, loadGame, deleteSave, exportSave, importSave, allSaves, latestSave } from './save.js';
import { createRooms } from './rooms.js';
import * as chamber from './chamber/scene.js';
import * as office from './office/officeScene.js';
import * as caucus from './caucus/caucusScene.js';
import * as riding from './riding/ridingScene.js';
import { createHud, createTuningPanel, createToast } from './ui/hud.js';
import { createMpCard } from './ui/mpCard.js';
import { createBook } from './ui/book.js';
import { createAgenda } from './ui/agenda.js';
import { pressPhoto } from './pressPhoto.js';
import { createCountBoard } from './ui/countBoard.js';
import { createOfficeUI } from './ui/talk.js';
import { createCaucusUI } from './ui/caucusUI.js';
import { createRidingUI } from './ui/ridingUI.js';
import { createQpUI } from './ui/qpUI.js';
import { createColdOpenUI } from './ui/coldOpen.js';
import { createStartMenu, createGameMenu, createSettingsSheet } from './ui/menus.js';
import { createAudio } from './audio.js';
import { getSettings, setSetting, onSettings, applySettings } from './settings.js';
import { createLedger } from './ui/ledger.js';
import { createCareerUI } from './ui/careerUI.js';
import { createRecordUI } from './ui/recordUI.js';
import { createMemoir } from './ui/memoirUI.js';
import { createElectionUI } from './ui/electionUI.js';
import { canUse, nextVote } from './sim/tools.js';
import { t, partyColor } from './ui/text.js';
import { stageLabel } from './sim/vote.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';

// Sound and settings exist before any game does: the title page has a room tone and a settings sheet too.
applySettings();
const audio = createAudio(getSettings());
let settingsSheet = null;
function openSettings() {
  settingsSheet ||= createSettingsSheet(document.getElementById('ui'), { get: getSettings, set: setSetting });
  settingsSheet.open();
}
onSettings((s, key) => {
  if (key === 'sound' || key === 'volume') audio.configure(s);
  // New party colours mean every room redraws; the menu's preview Parliament too.
  if (key === 'colourBlind') world?.recolor();
});

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
  if (k === 'coldOpen') return state.flow.pending.phase === 'count' ? 'riding' : 'chamber';
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
      onBells: (on) => audio.bells(on),
      onGavel: () => audio.gavel(),
    },
    onChange(name, room) {
      audio.room(name);
      // Cut through black: cover the swap at once, then fade back in once the new room has drawn a frame.
      const fade = document.getElementById('fade');
      if (fade) {
        fade.classList.add('on');
        requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.remove('on')));
      }
      const state = getState();
      if (name === 'chamber' && state) {
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

  let ledger;
  let toast;
  card = createMpCard(ui, {
    getState,
    onClose: () => chamberRoom()?.select(null),
    actions(mpId) {
      const state = getState();
      if (mpId === state.player.mpId) return [];
      const out = [];
      const kind = state.flow.pending?.kind;
      const e = state.evening;
      if (kind === 'office' && e) {
        const left = e.slots - e.used;
        if (left >= 1) out.push({ label: t('card.invite'), primary: true, run: () => (card.hide(), dispatch({ type: 'invite', mpId })) });
        if (left >= 0.5) out.push({ label: t('card.call'), run: () => (card.hide(), dispatch({ type: 'call', mpId })) });
      }
      // The whip's tools, where the act allows and there's a vote to work on.
      const m = state.mps[mpId];
      const own = m.party === state.mps[state.player.mpId].party;
      const bill = nextVote(state);
      const tool = (id, label, extra = {}) => {
        if (!canUse(state, id, mpId).ok) return;
        out.push({
          label,
          run: () => {
            card.hide();
            const r = dispatch({ type: 'useTool', tool: id, mpId, billId: bill?.id, ...extra });
            if (r?.note) toast.show(r.note);
          },
        });
      };
      if (own && bill && kind !== 'meeting') tool('persuade', t('tool.persuade'));
      if (own && bill && kind === 'office') {
        tool('leverage', t('tool.leverage'));
        tool('threatenNomination', t('tool.threatenNomination'));
        tool('qpSlot', t('tool.qpSlot'), { give: true });
        const c = Object.values(state.committees).find((x) => x.interests.some((i) => m.interests.includes(i)));
        if (c) tool('committeeSeat', t('tool.committeeSeat'), { give: true, committeeId: c.id });
        tool('ridingProject', t('tool.ridingProject'));
      }
      out.push({ label: t('tool.ledger'), run: () => (card.hide(), ledger.open(mpId)) });
      return out;
    },
  });

  toast = createToast(ui);
  ledger = createLedger(ui, { getState });
  const memoir = createMemoir(ui, { getState, onPerson: (mpId) => card.show(mpId) });
  const gameMenu = createGameMenu(ui, {
    getState,
    onQuit: () => {
      saveGame(getState());
      location.href = location.pathname;
    },
    onLedger: () => ledger.open(),
    onMemoir: () => memoir.open(),
    onRetire: () => dispatch({ type: 'retire' }),
    onCross: (party) => dispatch({ type: 'crossFloor', party }),
    onSettings: openSettings,
  });
  // A soft paper tick on every button, once sound is open.
  ui.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .switch, .pip')) audio.tap();
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
    debugText: DEBUG ? () => (getState() ? `${getState().seed} · ${t('debug.hash', { hash: parliamentHash(getState()) })}` : '') : null,
  });

  const agenda = createAgenda(ui, {
    getState,
    onContinue: () => dispatch({ type: 'advance' }),
    onSkip: () => dispatch({ type: 'skip' }),
    photo: (mp) => pressPhoto(renderer, environment, mp, colorOf(mp)),
  });
  const countBoard = createCountBoard(ui, {
    getState,
    dispatch,
    getRoom: chamberRoom,
    onChoose: (choice) => dispatch({ type: 'resolve', choice }),
    onContinue: () => dispatch({ type: 'advance' }),
  });
  const officeUI = createOfficeUI(ui, { getState, dispatch, pickMp, onLedger: () => ledger.open() });
  const careerUI = createCareerUI(ui, { getState, dispatch });
  const recordUI = createRecordUI(ui, { getState, onNewGame: () => (location.href = location.pathname), onPerson: (mpId) => card.show(mpId) });
  const electionUI = createElectionUI(ui, { getState, dispatch });
  const caucusUI = createCaucusUI(ui, { getState, dispatch, getRoom: () => (rooms.name === 'caucus' ? rooms.room : null) });
  const ridingUI = createRidingUI(ui, { getState, dispatch });
  const qpUI = createQpUI(ui, { getState, dispatch, getRoom: chamberRoom, onBenches: (kind) => audio.benches(kind) });
  const coldOpenUI = createColdOpenUI(ui, { getState, dispatch, getRoom: (name) => (rooms.name === name ? rooms.room : null), audio, colorOf: (party) => partyColor(getState(), { party }) });

  // Who shares the Act 1 room: the first of your cohort in your party, so it's the same face every evening.
  function deskmate(state, me) {
    return Object.values(state.mps)
      .filter((m) => m.party === me.party && m.id !== me.id && m.cohort === me.cohort)
      .sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null;
  }

  // Keep each room in step with the sim: who's in the chair, moods, the board, the crowd.
  function syncRoom(name, state) {
    const room = rooms.room;
    room.setWeather?.(weatherOf(state));
    if (name === 'chamber') room.nudge?.();
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
      // Election night is staged by the cold open's own sheet as the count comes in; any other visit puts it away.
      const p = state.flow.pending;
      if (!(p?.kind === 'coldOpen' && p.phase === 'count')) room.setElectionNight?.(false);
      const v = state.ridingVisit;
      if (!v) return;
      room.setTownHall(v.phase === 'townHall', v.townHall?.crowd ?? 50, townHallPlacards(state));
      const item = v.phase === 'visitors' ? v.queue[v.at] : null;
      room.setVisitor(item ? { key: `${v.week}:${v.at}`, role: item.role } : null);
    }
  }

  // The world can exist before a game does (the menu's preview), so state may still be null here.
  let lastLog = getState()?.log.length ?? 0;
  function renderAll(state = getState()) {
    const name = roomFor(state);
    const me = state.mps[state.player.mpId];
    const colleague = name === 'office' && state.player.act < 2 ? deskmate(state, me) : null;
    rooms.show(name, {
      playerColor: colorOf(me),
      act: state.player.act,
      variant: state.player.act,
      playerName: `${me.name.first} ${me.name.last}`,
      colleague: colleague && { id: colleague.id, color: colorOf(colleague) },
      ridingType: me.riding.type,
      ridingName: me.riding.name,
      partyShort: state.parties[me.party]?.short || '',
      seating: name === 'caucus' ? caucusSeating(state, me.party) : null,
      playerId: me.id,
    });
    syncRoom(name, state);
    agenda.render(state);
    countBoard.render(state);
    officeUI.render(state);
    careerUI.render(state);
    recordUI.render(state);
    electionUI.render(state);
    caucusUI.render(state);
    ridingUI.render(state);
    qpUI.render(state);
    coldOpenUI.render(state);
    card.refresh();
    book.refresh();
    ledger.refresh();
    // Meeting outcomes, calls and deliveries show briefly as a toast.
    const fresh = state.log.slice(lastLog).filter((l) => l.kind === 'meeting' || l.kind === 'career');
    lastLog = state.log.length;
    // The cold open tells its own story; its log line is for the record, not a toast over the walk in.
    if (fresh.length && state.flow.pending?.kind !== 'coldOpen') toast.show(fresh.map((l) => l.text).join(' '));
  }

  // Autosave a moment after things settle, to the game's own slot.
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
  let onRecolor = null;
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
    // Rebuild the current room so new party colours land everywhere (seats, chips, caucus table).
    recolor() {
      const state = getState();
      rooms.reset();
      if (state) renderAll(state);
      else onRecolor?.();
    },
    set onRecolor(fn) {
      onRecolor = fn;
    },
  };
}

async function startGame(state, slot = state.slot || 1) {
  // The menu's preview room, if any, goes; the game builds its own.
  world?.rooms.reset();
  state.slot = slot;
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
  const names = ['generate', 'knowledge', 'relationships', 'rng', 'bills', 'mp', 'vote', 'pacing', 'meetings', 'caucus', 'riding', 'career', 'tools', 'ranks', 'record', 'election', 'confidence', 'media', 'calendar'];
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
    audio,
    settings: { get: getSettings, set: setSetting },
  };
}

async function boot() {
  setData(await loadData());
  document.title = t('title');
  const seed = params.get('seed');
  // Debug starts skip the menu: ?scenario=<id>, ?daily=1, or a seed (with ?guided=1 for the first-week walkthrough).
  if (params.get('scenario')) return startGame(scenarioGame(params.get('scenario'), { seed: seed || undefined }));
  if (params.get('daily') === '1') return startGame(dailyGame({}));
  if (seed) {
    // Debug and shared-seed starts skip the menu; ?guided=1 adds the first-week walkthrough.
    return startGame(newGame({ seed, party: params.get('party') || undefined, guided: params.get('guided') === '1', act: params.get('act'), coldOpen: params.get('coldopen') === '1' }));
  }
  const menu = createStartMenu(document.getElementById('ui'), {
    saves: allSaves(),
    latest: latestSave(),
    scenarios: scenarioList(),
    onContinue: (slot) => startGame(loadGame(slot), slot),
    onNew: (opts, slot) => startGame(newGame({ ...opts, guided: true, coldOpen: true }), slot),
    onScenario: (id, person, slot) => startGame(scenarioGame(id, person), slot),
    onDaily: (person, slot) => startGame(dailyGame(person), slot),
    onShared: (opts, slot) => startGame(sharedGame(opts), slot),
    onImport: (text, slot) => {
      try {
        startGame(importSave(text), slot);
        return true;
      } catch {
        return false;
      }
    },
    onDelete: (slot) => deleteSave(slot),
    onExport: (slot) => {
      const s = loadGame(slot);
      return s ? exportSave(s) : null;
    },
    onSeed: (seed) => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => showPreview(seed), 600);
    },
    onSettings: openSettings,
  });
  // The seed's own Parliament sits in the chamber behind the title page, the camera drifting slowly.
  let previewTimer = null;
  world = buildWorld();
  if (DEBUG) await debugTools(world);
  function showPreview(seed) {
    if (!menu.isConnected) return;
    try {
      const st = newGame({ seed: seed || 'CALEDOR-1', party: 'p1' });
      world.rooms.reset();
      const room = world.rooms.show('chamber', { playerColor: '#555', ridingType: 'rural', ridingName: '', seating: null, playerId: null });
      room.sync(st, (mp) => partyColor(st, mp));
      room.autoOrbit(true);
      world.resize();
    } catch (e) {
      console.warn('menu preview', e);
    }
  }
  world.onRecolor = () => showPreview(menu.querySelector('[name="seed"]')?.value.trim());
  showPreview(menu.querySelector('[name="seed"]').value.trim());
}

// The loading screen is plain HTML so it shows before any script runs; it fades once there is something behind it.
function ready() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('off');
  setTimeout(() => el.remove(), 500);
}

boot()
  .then(ready)
  .catch((err) => {
    console.error(err);
    ready();
    document.getElementById('ui').innerHTML = `<div class="fatal">Something went wrong starting the game.<br><small>${String(err.message || err)}</small></div>`;
  });
