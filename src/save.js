// Saves in the browser: three slots under whip:save:<slot>, plus settings under whip:settings. Never throws:
// if storage is unavailable (private browsing, full), the game simply runs without saving.
// Also here: asking the browser to keep that storage, backup files, and when to suggest making one.
import { SAVE_VERSION } from './sim/modes.js';
import { tuning } from './sim/config.js';

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
    keepStorage();
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
    absWeek: s.date.absWeek ?? 0,
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

// ---- Keeping the storage ----
// Every Longlight game lives on the same web address, so they share one browser storage. If the phone runs low
// on space the browser may clear all of it at once. persist() asks it not to. We ask once per visit, and only
// after a real save has been written (Firefox shows the player a question; then it makes sense). Chrome and
// Safari decide quietly. Nothing here ever throws or holds the game up.
let askedToKeep = false;

export function keepStorage() {
  if (askedToKeep) return;
  askedToKeep = true;
  try {
    const st = navigator.storage;
    if (!st?.persist || !st?.persisted) return;
    st.persisted()
      .then((kept) => (kept ? true : st.persist()))
      .catch(() => {});
  } catch {
    // No storage manager here: the save codes and backup files are the safety net.
  }
}

// true when the browser has promised to keep this site's storage, false when it may clear it, null when the
// browser can't say (the line about it is hidden then).
export async function storageKept() {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

// ---- Backup files ----
// A backup file holds the same text as "Copy save", so either one restores through the same import.
export function backupFileName(date = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `the-whip-backup-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.txt`;
}

// Hands the file to the phone: the share sheet where it can take files (on an iPhone that offers Save to
// Files, and it works from the home screen), otherwise a plain download. Resolves 'saved', 'cancelled' or
// 'failed'.
export async function saveBackupFile(text) {
  const name = backupFileName();
  try {
    const file = new File([text], name, { type: 'text/plain' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        keepStorage();
        return 'saved';
      } catch (e) {
        if (e?.name === 'AbortError') return 'cancelled';
        // The share sheet refused (some desktop browsers): fall through to a download.
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    keepStorage();
    return 'saved';
  } catch {
    return 'failed';
  }
}

// Reads a picked backup file back to text, trimmed. Rejects anything too big to be a save.
export async function readBackupFile(file) {
  if (!file || file.size > tuning().backup.maxFileKb * 1024) throw new Error('Not a backup file');
  return String(await file.text()).trim();
}

// ---- When to suggest a backup ----
// Due when some save holds real progress (past its first week, not a one-week scenario) that has been played
// since the last backup, and there has never been one or it is older than tuning's remindAfterDays.
export function backupDue(saves, lastBackup = 0, now = Date.now()) {
  const B = tuning().backup;
  const worth = (s) => s && s.mode !== 'scenario' && (s.act > 1 || s.absWeek >= B.progressWeeks) && s.savedAt > lastBackup;
  if (!saves.some(worth)) return false;
  return !lastBackup || now - lastBackup >= B.remindAfterDays * 86400000;
}

export function daysSince(when, now = Date.now()) {
  return Math.max(0, Math.floor((now - when) / 86400000));
}

// The reminder shows at most once a visit. A visit outlives a trip back to the title page (which reloads), so
// the mark goes in sessionStorage, which the browser clears when the tab closes.
export function remindedThisVisit() {
  try {
    return sessionStorage.getItem('whip:backup-reminded') === '1';
  } catch {
    return false;
  }
}

export function markReminded() {
  try {
    sessionStorage.setItem('whip:backup-reminded', '1');
  } catch {
    // Without sessionStorage the reminder may show again after a reload; it stays dismissible.
  }
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
