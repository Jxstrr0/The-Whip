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

// ---- Checking the ids in a save ----
// A save can come from anywhere: pasted in as text, or loaded from a backup file somebody sent. The ids in it
// (members like "m012", parties like "p3", bills like "b0007") are used all over the game to look things up, so a save is only
// taken when they are plain ids: letters, digits and _ : . - and nothing else. Three names are refused
// outright because JavaScript gives them a special meaning on every object. This is a light check, not a check
// of the whole save; the screens also escape whatever they print (esc and safeColour in ui/text.js).
const PLAIN_ID = /^[\w:.-]+$/;
const RESERVED = ['__proto__', 'constructor', 'prototype'];
const plainId = (id) => typeof id === 'string' && PLAIN_ID.test(id) && !RESERVED.includes(id);

function idsArePlain(state) {
  for (const table of [state.mps, state.parties || {}, state.bills || {}]) {
    for (const [key, entry] of Object.entries(table)) {
      // Both the name an entry is filed under and the id written inside it (the same thing in a real save).
      if (!plainId(key) || !plainId(entry?.id)) return false;
    }
  }
  // The player has to be one of the members.
  return plainId(state.player.mpId) && Object.keys(state.mps).includes(state.player.mpId);
}

// Every way a save gets into the game (Continue, "Paste a save" and "Load backup file") comes through here.
export function migrate(state) {
  if (!state || typeof state !== 'object') throw new Error('Not a save');
  state.version ||= 1;
  while (state.version < SAVE_VERSION && MIGRATIONS[state.version]) state = MIGRATIONS[state.version](state);
  if (state.version !== SAVE_VERSION || !state.player || !state.mps) throw new Error('Save from an unknown version');
  if (!idsArePlain(state)) throw new Error('Not a save');
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

// ---- Save codes ----
// A save as text, to copy between phones or keep in a backup file. Since 1.1.5.1 a code is
//   "WHIP2:" + the save as JSON, squeezed (LZW, written in the letters A-Z a-z 0-9 - _) + a 6-letter checksum.
// A played Parliament comes out under a quarter of the size of the old code, so it pastes, copies and loads
// much faster on a phone. Older codes (plain Base64 of the JSON, no prefix) still load.
// The squeezing is adapted from Scrapline src/app/savecode.js (2026-11-19), the same as PEW's codes.
const CODE_PREFIX = 'WHIP2:';
const CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
// The dictionary stops growing here (20-bit numbers at most). Scrapline stops at 16 bits; a Whip save is several
// times bigger, and the extra room makes its code about a third shorter again.
const MAX_CODES = 1 << 20;
const bitsFor = (n) => (n < 2 ? 1 : 32 - Math.clz32(n)); // how many bits it takes to write n

// The most text a save may be, pasted in or read from a backup file: tuning's backup.maxFileKb, many times the
// size of a real save. Anything longer is refused before any work is done on it, so a huge paste can't hold
// the phone up. The same limit caps what a squeezed code may open up to.
export const maxSaveChars = () => tuning().backup.maxFileKb * 1024;

// Bytes in, letters out. Each step writes the longest run of bytes already in the dictionary as one number, then
// adds that run plus the next byte to the dictionary. A number's width is the bit length of the largest number
// the reader could see next, so both sides always agree on it.
function squeeze(bytes) {
  const out = [];
  let acc = 0;
  let nacc = 0;
  const put = (v, w) => {
    for (let i = w - 1; i >= 0; i--) {
      acc = (acc << 1) | ((v >>> i) & 1);
      if (++nacc === 6) {
        out.push(CODE_LETTERS[acc]);
        acc = 0;
        nacc = 0;
      }
    }
  };
  if (!bytes.length) return '';
  const dict = new Map();
  let next = 256;
  let cur = bytes[0];
  for (let i = 1; i < bytes.length; i++) {
    const hit = dict.get(cur * 256 + bytes[i]);
    if (hit !== undefined) {
      cur = hit;
      continue;
    }
    put(cur, bitsFor(next - 1));
    if (next < MAX_CODES) dict.set(cur * 256 + bytes[i], next++);
    cur = bytes[i];
  }
  put(cur, bitsFor(next - 1));
  if (nacc) out.push(CODE_LETTERS[acc << (6 - nacc)]);
  return out.join('');
}

// Letters back to bytes. Throws on a letter that isn't one of ours, a number that can't be there, or a code
// that opens up past maxSaveChars() (a few thousand letters can be made to open up to gigabytes).
function unsqueeze(str) {
  const max = maxSaveChars();
  const value = new Int8Array(128).fill(-1);
  for (let i = 0; i < 64; i++) value[CODE_LETTERS.charCodeAt(i)] = i;
  const total = str.length * 6;
  let pos = 0;
  const read = (w) => {
    let v = 0;
    for (let i = 0; i < w; i++, pos++) {
      const d = value[str.charCodeAt((pos / 6) | 0)] ?? -1;
      if (d < 0) throw new Error('Not a save');
      v = v * 2 + ((d >> (5 - (pos % 6))) & 1);
    }
    return v;
  };
  // Each dictionary entry is "an earlier entry plus one byte": prefix, last byte, first byte, length.
  const prefix = new Int32Array(MAX_CODES);
  const last = new Uint8Array(MAX_CODES);
  const first = new Uint8Array(MAX_CODES);
  const len = new Int32Array(MAX_CODES);
  for (let i = 0; i < 256; i++) {
    prefix[i] = -1;
    last[i] = first[i] = i;
    len[i] = 1;
  }
  let out = new Uint8Array(Math.min(max, Math.max(1024, str.length * 8)));
  let n = 0;
  const emit = (code) => {
    const need = n + len[code];
    if (need > max) throw new Error('Too big to be a save');
    if (need > out.length) {
      const bigger = new Uint8Array(Math.min(max, Math.max(need, out.length * 2)));
      bigger.set(out.subarray(0, n));
      out = bigger;
    }
    // An entry's bytes are found back to front, so they're written from the end of its slot.
    for (let k = need - 1, c = code; k >= n; k--, c = prefix[c]) out[k] = last[c];
    n = need;
  };
  if (total < 8) return out.subarray(0, 0);
  let size = 256;
  let prev = read(8);
  emit(prev);
  for (;;) {
    const w = bitsFor(Math.min(size, MAX_CODES - 1));
    if (total - pos < w) break; // what's left is padding
    const code = read(w);
    let fb;
    if (code < size) fb = first[code];
    else if (code === size) fb = first[prev]; // the entry being defined right now (the classic LZW case)
    else throw new Error('Not a save');
    if (size < MAX_CODES) {
      prefix[size] = prev;
      last[size] = fb;
      first[size] = first[prev];
      len[size] = len[prev] + 1;
      size++;
    }
    emit(code);
    prev = code;
  }
  return out.subarray(0, n);
}

// FNV-1a of the squeezed text, as 6 letters: a missing, extra or changed letter almost surely won't match.
function checksum(body) {
  let h = 2166136261;
  for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 16777619) >>> 0;
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += CODE_LETTERS[h & 63];
    h = Math.floor(h / 64);
  }
  return s;
}

export function exportSave(state) {
  const body = squeeze(new TextEncoder().encode(JSON.stringify(state)));
  return CODE_PREFIX + body + checksum(body);
}

export function importSave(text) {
  const raw = String(text || '');
  if (raw.length > maxSaveChars()) throw new Error('Too big to be a save');
  const clean = raw.replace(/\s+/g, '');
  if (!clean) throw new Error('Nothing to import');
  if (clean.startsWith(CODE_PREFIX)) {
    const body = clean.slice(CODE_PREFIX.length, -6);
    if (clean.length < CODE_PREFIX.length + 6 || checksum(body) !== clean.slice(-6)) throw new Error('Not a save');
    return migrate(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(unsqueeze(body))));
  }
  // An older code: Base64 of the JSON.
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
  if (!file || file.size > maxSaveChars()) throw new Error('Not a backup file');
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
