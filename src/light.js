// The light the paper sits in. The room and the hour set it: the chamber by day, the office under a lamp in
// the evening (a strip light while you still share a room), the caucus room under its pendants, the
// division pale and hard. The calendar tints it: a grey or winter morning cools the page. The CSS carries one
// set of paper and ink tokens per light (css/style.css, "Light"), switched by data-light on <html>.
import { tuning } from './sim/config.js';
import { weatherOf } from './sim/calendar.js';
import { GREY_SKIES } from './weatherFx.js';

export const LIGHTS = ['day', 'grey', 'bells', 'lamp', 'pendant', 'strip'];

// The hour a stop happens at. The House sits in the morning, Question Period and the divisions run into the
// afternoon, the riding is an afternoon away, and the office is where the day ends.
export function hourOf(state) {
  const k = state.flow.pending?.kind;
  if (k === 'office' || k === 'meeting') return 'evening';
  if (k === 'division' || k === 'result' || k === 'questionPeriod' || k === 'riding') return 'afternoon';
  if (k) return 'morning';
  const step = state.flow.step;
  return step === 'office' || step === 'fallout' ? 'evening' : step === 'riding' ? 'afternoon' : 'morning';
}

// Which light the paper takes, given the room the stop is in (see roomFor in main.js).
export function lightFor(state, room) {
  const L = tuning().look.light;
  const wx = weatherOf(state);
  const p = state.flow.pending;
  const grey = GREY_SKIES.has(wx.kind) || wx.season === 'winter';
  if (p?.kind === 'division') return 'bells';
  if (room === 'office') return state.player.act < L.lampFromAct ? 'strip' : 'lamp';
  if (room === 'caucus') return 'pendant';
  if (room === 'riding') {
    // Election night, and the riding office once the evenings draw in, are lit from inside.
    const night = (p?.kind === 'coldOpen' && p.phase === 'count') || wx.dark >= L.nightFrom;
    if (night) return 'lamp';
  }
  return grey ? 'grey' : 'day';
}
