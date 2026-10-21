// The parliamentary year: forty weeks from September to June. Which month and day a date falls on, which
// season, and the week's weather. The weather comes from a hash of the seed and the week, never from the
// game's RNG, so what's outside the window can't change a vote; and it changes nothing in the sim, by design.
import { data, tuning } from './config.js';
import { hooks, log } from './pacing.js';

// A cheap string hash (FNV-1a), for picks that have to be stable but mustn't touch the seeded RNG.
function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// How dark the evening is by month, for the office window: dusk in September, night by five in January.
const DARK = [0.35, 0.55, 0.8, 1, 1, 0.9, 0.7, 0.45, 0.25, 0.1];
const TEMP_SHIFT = { clear: 2, overcast: -1, rain: -1, fog: 0, snow: -2, storm: -6 };

// Month, day of the month and season for a date. `week` is 1-based within the year; the weekend paper
// passes dayOfWeek 6 for its Saturday.
export function calendarOf(date) {
  const C = tuning().calendar;
  const week = date.week ?? ((date.absWeek || 0) % C.weeksPerYear) + 1;
  const monthIndex = clamp(Math.floor((week - 1) / C.weeksPerMonth), 0, C.months.length - 1);
  const dayOfMonth = ((week - 1) % C.weeksPerMonth) * 7 + (date.dayOfWeek || 1);
  let season = 'autumn';
  for (const [name, from] of Object.entries(C.seasons)) if (week >= from) season = name;
  return { week, year: date.year ?? Math.floor((date.absWeek || 0) / C.weeksPerYear) + 1, month: C.months[monthIndex], monthIndex, dayOfMonth, season };
}

// Snow on the ground, 0–1: first falls in late autumn, deep all winter, gone over the thaw weeks of spring.
function snowCover(week, kind) {
  const C = tuning().calendar;
  const S = C.seasons;
  if (week >= S.winter && week < S.spring) return 1;
  if (week >= S.spring && week < S.spring + C.thawWeeks) return 1 - (week - S.spring + 1) / (C.thawWeeks + 1);
  if (week >= C.firstSnowWeek && week < S.winter) return Math.max(kind === 'snow' ? 0.5 : 0, ((week - C.firstSnowWeek + 1) / (S.winter - C.firstSnowWeek)) * 0.6);
  return 0;
}

// The week's weather for a seed: its kind, snow cover, how wet the ground is, how dark the evening and a
// daytime high. The same seed and week always give the same answer.
export function weatherOf(state, absWeek = state.date.absWeek) {
  const C = tuning().calendar;
  const cal = calendarOf({ absWeek, dayOfWeek: 1 });
  const h = hashOf(`${state.seed || ''}:wx:${absWeek}`);
  const list = cal.season === 'autumn' && cal.week >= C.firstSnowWeek ? C.weather.lateAutumn : C.weather[cal.season];
  const kind = list[h % list.length];
  const snow = snowCover(cal.week, kind);
  const thaw = cal.season === 'spring' && snow > 0 && snow < 1;
  const wet = kind === 'rain' ? 1 : thaw ? 0.6 : kind === 'fog' ? 0.3 : kind === 'snow' && snow < 0.5 ? 0.4 : 0;
  const temp = C.highs[cal.monthIndex] + (((h >>> 8) % 7) - 3) + (TEMP_SHIFT[kind] || 0);
  return { ...cal, kind, snow: Math.round(snow * 100) / 100, wet, dark: DARK[cal.monthIndex], temp, falling: kind === 'storm' ? 'storm' : kind === 'snow' ? 'snow' : kind === 'rain' ? 'rain' : null };
}

// Monday mornings: the first of a season gets a line, and so does a blizzard or the year's first snow.
hooks.morning.push((state) => {
  const d = state.date;
  if (d.dayOfWeek !== 1 || d.absWeek === 0) return null;
  const S = data().seasons;
  const wx = weatherOf(state);
  const turn = Object.entries(tuning().calendar.seasons).find(([, from]) => from === wx.week);
  if (turn) {
    const lines = S.turns[turn[0]];
    log(state, lines[(wx.year - 1) % lines.length], 'info');
  }
  const prev = weatherOf(state, d.absWeek - 1);
  const h = hashOf(`${state.seed || ''}:wxline:${d.absWeek}`);
  if (wx.kind === 'storm') log(state, S.weather.storm[h % S.weather.storm.length], 'info');
  else if (wx.kind === 'snow' && prev.snow === 0 && wx.season === 'autumn') log(state, S.weather.firstSnow[h % S.weather.firstSnow.length], 'info');
  return null;
});
