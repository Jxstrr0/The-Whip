// Saves in the browser: three slots under whip:save:<slot>, plus settings. Never throws: if storage is
// unavailable (private browsing, full), the game simply runs without saving.
import { SAVE_VERSION } from './sim/modes.js';

const KEY = (slot) => `whip:save:${slot}`;

// Older saves are upgraded step by step here; a save is never discarded.
const MIGRATIONS = {};

function migrate(state) {
  while (state.version < SAVE_VERSION && MIGRATIONS[state.version]) state = MIGRATIONS[state.version](state);
  return state;
}

export function saveGame(state, slot = 1) {
  try {
    localStorage.setItem(KEY(slot), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot = 1) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    return raw ? migrate(JSON.parse(raw)) : null;
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

// A one-line description of a save for the menu, without loading the whole thing into the game.
export function saveInfo(slot = 1) {
  const s = loadGame(slot);
  if (!s?.player) return null;
  const m = s.mps[s.player.mpId];
  return { name: `${m.name.first} ${m.name.last}`, week: s.date.week ?? 1, year: s.date.year ?? 1, seed: s.seed };
}

export function exportSave(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text) {
  return migrate(JSON.parse(decodeURIComponent(escape(atob(text.trim())))));
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
