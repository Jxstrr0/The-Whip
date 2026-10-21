// Player settings: sound, volume, colour-blind party colours and large text. Stored under whip:settings.
// The CSS side is two classes on <html> (cb, large); the party palette is read by partyColor in ui/text.js.
import { loadSettings, saveSettings } from './save.js';

const DEFAULTS = { sound: true, volume: 0.7, colourBlind: false, largeText: false };

// Only known keys of the right type survive a load, so a stale or hand-edited entry can't break the UI.
function clean(raw) {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (raw && typeof raw[k] === typeof DEFAULTS[k]) out[k] = raw[k];
  }
  if (out.volume != null) out.volume = Math.max(0, Math.min(1, out.volume));
  return out;
}

let current = { ...DEFAULTS, ...clean(loadSettings()) };
const listeners = new Set();

export function getSettings() {
  return current;
}

export function setSetting(key, value) {
  if (!(key in DEFAULTS) || current[key] === value) return;
  current = { ...current, ...clean({ [key]: value }) };
  saveSettings(current);
  applySettings();
  for (const fn of listeners) fn(current, key);
}

// fn(settings, changedKey) after every change.
export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applySettings() {
  if (typeof document === 'undefined') return;
  const c = document.documentElement.classList;
  c.toggle('cb', current.colourBlind);
  c.toggle('large', current.largeText);
}
