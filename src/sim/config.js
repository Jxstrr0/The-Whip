// Static game data (data/*.json) loaded once at boot. Read-only, so sim functions stay pure over game state.
import { fill } from './fill.js';

let DATA = null;

export function setData(d) {
  DATA = d;
}

export function data() {
  if (!DATA) throw new Error('Game data not loaded: call setData() first');
  return DATA;
}

export function tuning() {
  return data().tuning;
}

// A line from data/strings.en.json with its {slots} filled: the sim's copy of the UI's t(), so text stays in data.
export function say(key, vars = {}) {
  return fill(data().strings[key] ?? key, vars);
}
