// Static game data (data/*.json) loaded once at boot. Read-only, so sim functions stay pure over game state.
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
