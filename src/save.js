// Saves in the browser: three slots under whip:save:<slot>, plus settings under whip:settings. Never throws:
// if storage is unavailable (private browsing, full), the game simply runs without saving.
import { SAVE_VERSION } from './sim/modes.js';

export const SLOTS = [1, 2, 3];
const KEY = (slot) => `whip:save:${slot}`;

// Older saves are upgraded step by step here; a save is never discarded.
const MIGRATIONS = {
  // 1 → 2: games gained a mode (career, scenario, shared, daily) and the player a record of the last revolt.
  1(state) {
    state.mode ||= { kind: 'career', id: null };
    if (state.player && state.player.lastRevolt === undefined) state.player.lastRevolt = null;
    state.version = 2;
    return state;
  },
};

export function migrate(state) {
  if (!state || typeof state !== 'object') throw new Error('Not a save');
  state.version ||= 1;
  while (state.version < SAVE_VERSION && MIGRATIONS[state.version]) state = MIGRATIONS[state.version](state);
  if (state.version !== SAVE_VERSION || !state.player || !state.mps) throw new Error('Save from an unknown version');
  return state;
}

export function saveGame(state, slot = state?.slot || 1) {
  if (!state) return false;
  try {
    state.slot = slot;
    state.savedAt = Date.now();
    localStorage.setItem(KEY(slot), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot = 1) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    const state = raw ? migrate(JSON.parse(raw)) : null;
    if (state) state.slot = slot;
    return state;
  } catch {
    return null;
  }
}

export function deleteSave(slot = 1) {
  try {
    localStorage.removeItem(KEY(slot));
  } catch {
    // Nothing to do: there was no storage to clear.
  }
}

// A one-line description of a save for the menu, without putting the whole thing into the game.
export function saveInfo(slot = 1) {
  const s = loadGame(slot);
  if (!s?.player) return null;
  const m = s.mps[s.player.mpId];
  return {
    slot,
    name: `${m.name.first} ${m.name.last}`,
    party: s.parties[m.party]?.short || '',
    role: m.caucusRole,
    act: s.player.act,
    week: s.date.week ?? 1,
    year: s.date.year ?? 1,
    seed: s.seed,
    mode: s.mode?.kind || 'career',
    title: s.mode?.title || '',
    ended: !!s.ending,
    savedAt: s.savedAt || 0,
  };
}

export function allSaves() {
  return SLOTS.map(saveInfo);
}

// The most recent save, for the Continue button.
export function latestSave() {
  return allSaves().filter(Boolean).sort((a, b) => b.savedAt - a.savedAt)[0] || null;
}

// A save as text, to copy between phones. Base64 of the JSON, UTF-8 safe.
export function exportSave(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text) {
  const clean = String(text || '').replace(/\s+/g, '');
  if (!clean) throw new Error('Nothing to import');
  return migrate(JSON.parse(decodeURIComponent(escape(atob(clean)))));
}

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('whip:settings') || '{}');
  } catch {
    return {};
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem('whip:settings', JSON.stringify(s));
  } catch {
    // Settings just won't persist.
  }
}
