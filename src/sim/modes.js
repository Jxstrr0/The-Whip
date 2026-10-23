// How a game starts: a career from a seed, a friend's seed, the daily seed, or one of the scenarios in
// data/scenarios.json. Scenarios drop the player into a moment: a built Parliament, a rank, a bill on the
// Order Paper and a brief; the week plays out and the weekend gives a verdict.
import { generateParliament } from './generate.js';
import { createRng, withRng } from './rng.js';
import { createPlayer, setupFirstWeek } from './career.js';
import { assignSeats } from '../chamber/layout.js';
import { initFlow, hooks, log } from './pacing.js';
import { data, tuning, say } from './config.js';
import { fill } from './fill.js';
import { makeBill, billName } from './bills.js';
import { prediction } from './count.js';
import { assignRank, shareFiles } from './ranks.js';
import { signAgreement, breakAgreement } from './confidence.js';
// Stage 5 modules register their actions and hooks on import.
import './tools.js';
import './count.js';
import './rivals.js';
import './lifeEvents.js';
import './pmb.js';
import './record.js';
import './media.js';
import './election.js';
import './calendar.js';
import { coldOpenStop } from './coldOpen.js';
import { remember, person } from './memoir.js';

export const SAVE_VERSION = 2;

export function reseat(state) {
  const seats = assignSeats(state);
  state.seats = {};
  for (const m of Object.values(state.mps)) m.seatId = null;
  for (const [seatId, mpId] of Object.entries(seats)) {
    state.seats[seatId] = { mpId };
    state.mps[mpId].seatId = seatId;
  }
}

export function newGame({ seed, party, first, last, age, background, ridingType, province, mode = 'career', modeId = null, guided = false, coldOpen = false, act = null, minority = false, startWeek = 0, startDay = 1 } = {}) {
  const parl = generateParliament(seed, { minority });
  const C = tuning().calendar;
  const state = {
    version: SAVE_VERSION,
    seed,
    mode: { kind: mode, id: modeId },
    date: { parliament: parl.house.parliament, year: Math.floor(startWeek / C.weeksPerYear) + 1, week: (startWeek % C.weeksPerYear) + 1, dayOfWeek: startDay, phase: 'morning', constituencyWeek: false, absWeek: startWeek },
    room: 'chamber',
    rng: createRng('game:' + seed).getState(),
    player: null,
    ...parl,
    seats: {},
    bills: {},
    orderPaper: [],
    countBoard: {},
    pairs: [],
    ledger: [],
    meetings: {},
    ridingCases: [],
    pressure: 20,
    log: [],
  };
  reseat(state);
  createPlayer(state, { party, first, last, age, background, ridingType, province });
  // Debug and scenario starts can begin in a later act (?act=4), which unlocks that act's tools.
  if (act) state.player.act = Math.max(1, Math.min(5, Number(act) || 1));
  state.divisions = {};
  initFlow(state);
  // A career started from the menu gets the guided first week.
  if (guided) setupFirstWeek(state);
  // A career from the menu opens on its own election night, before the first Monday. Without one, the memoir
  // opens on the oath (a scenario writes its own first page).
  state.memoir = [];
  if (coldOpen) state.flow.pending = coldOpenStop(state);
  else if (mode !== 'scenario') remember(state, 'sworn', { people: [person(state, state.player.mentor, data().memoir.notes.mentor)] });
  return state;
}

// ---------- shared and daily seeds ----------

// A seed typed in by hand, or arriving in a link: the same Parliament as whoever sent it.
export function sharedGame(opts) {
  return newGame({ ...opts, mode: 'shared', modeId: opts.seed });
}

// One Parliament a day, the same for everyone: the seed is the date, and the seat you take is decided by it too.
export function dailySeed(date = new Date()) {
  return 'DAILY-' + date.toISOString().slice(0, 10);
}

export function dailyGame({ date = new Date(), first, last, age } = {}) {
  const seed = dailySeed(date);
  const rng = createRng(seed + ':player');
  const D = data();
  return newGame({
    seed,
    first,
    last,
    age,
    party: rng.pick(D.parties.core).id,
    background: rng.pick(D.backgrounds.backgrounds).id,
    ridingType: rng.pick(['urban', 'suburban', 'rural', 'northern']),
    mode: 'daily',
    modeId: seed.slice('DAILY-'.length),
  });
}

// ---------- scenarios ----------

const fullName = (m) => `${m.name.first} ${m.name.last}`;
const listNames = (ids, state) => {
  const names = ids.map((id) => fullName(state.mps[id]));
  return names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
};

export function scenarioList() {
  return data().scenarios.scenarios;
}

export function scenarioById(id) {
  return scenarioList().find((s) => s.id === id) || null;
}

// A bill for the week's vote: made from a template, already read a second time, down for a given day.
function tableBill(state, rng, template, day) {
  const b = makeBill(state, rng, template);
  b.stage = 'second';
  b.nextVote = day;
  b.scheduled = true;
  b.visibility = Math.max(b.visibility, 80);
  return b;
}

const thursdayOf = (state) => state.date.absWeek * 5 + 3;
const ownBenches = (state) => {
  const me = state.mps[state.player.mpId];
  return Object.values(state.mps).filter((m) => m.party === me.party && m.id !== me.id && m.caucusRole !== 'speaker');
};

const SETUPS = {
  // Deputy whip, minority, supply vote Thursday, every other bench against, the count exactly N short.
  minorityBudget(state, rng, sc) {
    const p = state.player;
    const me = state.mps[p.mpId];
    const gov = state.house.government;
    assignRank(state, sc.act, sc.role);
    shareFiles(state);
    Object.assign(p, { standing: 60, caucusSupport: 50, leaderTrust: 55 });
    state.pressure = 45;
    // Every smaller party is polling ahead of its seats: nobody will be bought this week, by the government or by you.
    const T = tuning().bills;
    const appetite = Math.max(T.confidenceAppetiteMargin, tuning().confidence.breakAppetite) + 3;
    for (const q of Object.values(state.parties)) if (q.id !== gov && q.id !== 'ind') state.polling[q.id] = Math.round(((q.seats / 120) * 100 + appetite) * 10) / 10;
    state.polling[gov] = Math.max(5, Math.round((100 - Object.entries(state.polling).filter(([k]) => k !== gov).reduce((s, [, v]) => s + v, 0)) * 10) / 10);
    // The deal that was holding the House together ended on Friday.
    const deal = signAgreement(state, rng, Object.values(state.parties).filter((q) => q.id !== gov && q.id !== 'ind' && q.role !== 'opposition').sort((a, b) => b.seats - a.seats)[0]?.id);
    if (deal) breakAgreement(state, deal, 'partner');
    const template = data().billTemplates.templates.find((t) => t.id === 't095') || data().billTemplates.templates.find((t) => t.kind === 'supply');
    const bill = tableBill(state, rng, template, thursdayOf(state));
    for (const q of Object.values(state.parties)) {
      bill.positions[q.id] = q.id === gov ? 'yea' : 'nay';
      bill.lines[q.id] = q.role === 'minor' ? 'free' : 'whipped';
    }
    // Two of ours are away already (the chase, the leave book and the pair are the point of the week), then
    // members away on both sides are the lever: trim attendance until the count reads N short.
    const away = ownBenches(state).filter((m) => !['leader', 'chiefWhip', 'cabinet'].includes(m.caucusRole)).sort((a, b) => a.attendance - b.attendance).slice(0, 2).map((m) => m.id);
    for (const id of away) state.mps[id].attendance = 12;
    for (let i = 0; i < 80; i++) {
      const short = prediction(state, bill.id).short;
      if (short === sc.short) break;
      const theirs = short > sc.short;
      const pool = Object.values(state.mps).filter((m) => m.caucusRole !== 'speaker' && m.id !== me.id && m.attendance > 30 && (theirs ? m.party !== gov && m.party !== 'ind' : m.party === gov && !['leader', 'chiefWhip', 'cabinet'].includes(m.caucusRole)));
      const m = pool.sort((a, b) => b.attendance - a.attendance)[0];
      if (!m) break;
      m.attendance = theirs ? 8 : 12;
      if (!theirs) away.push(m.id);
    }
    const count = prediction(state, bill.id);
    state.mode.billId = bill.id;
    state.mode.brief = fill(sc.brief, { bill: billName(bill), partner: deal ? state.parties[deal.with].name : say('who.thirdParty'), ours: count.ours, theirs: count.side === 'yea' ? count.nays : count.yeas, short: count.short, away: away.length ? say(away.length === 1 ? 'scenario.awayOne' : 'scenario.awayMany', { names: listNames(away, state) }) : say('scenario.awayNone') });
    log(state, say('log.scenario.threeShort', { bill: billName(bill), short: count.short }), 'career');
  },

  // Chief whip, Wednesday, a bill the benches hate, and a caucus that has had enough of you.
  revolt(state, rng, sc) {
    const p = state.player;
    const me = state.mps[p.mpId];
    const party = state.parties[me.party];
    assignRank(state, sc.act, sc.role);
    shareFiles(state);
    Object.assign(p, { standing: 55, caucusSupport: 30, leaderTrust: 45 });
    state.pressure = 60;
    party.morale = 35;
    // The riding type most of the caucus sits for, and the government bill that hurts it most.
    const types = {};
    for (const m of ownBenches(state)) types[m.riding.type] = (types[m.riding.type] || 0) + 1;
    const type = Object.entries(types).sort((a, b) => b[1] - a[1])[0][0];
    const templates = data().billTemplates.templates.filter((t) => t.kind === 'government' && !t.confidence && (t.ridingEffects[type] || 0) < 0).sort((a, b) => a.ridingEffects[type] - b.ridingEffects[type]);
    const bill = tableBill(state, rng, templates[0], thursdayOf(state));
    bill.positions[me.party] = 'yea';
    bill.lines[me.party] = 'whipped';
    // The names on the list: the members who like you least, angrier still.
    const sore = ownBenches(state).filter((m) => m.id !== party.leader).sort((a, b) => a.rapport - b.rapport).slice(0, 8);
    for (const m of sore) {
      m.rapport = rng.int(-30, -12);
      m.mood = 'angry';
    }
    state.forceRevolt = true;
    state.mode.billId = bill.id;
    state.mode.brief = fill(sc.brief, { bill: billName(bill), ringleader: fullName(sore[0]) });
    log(state, say('log.scenario.roomTurns', { bill: billName(bill) }), 'career');
  },

  // A rookie, the first-week dilemma without the first-week script, and a riding already on the phone.
  ridingDilemma(state, rng, sc) {
    const p = state.player;
    const me = state.mps[p.mpId];
    setupFirstWeek(state, { week: state.date.absWeek, guided: false });
    p.ridingStanding = 36;
    p.ridingBase = 48;
    p.nominationThreat = 35;
    state.flow.week.start.ridingStanding = p.ridingStanding;
    const bill = state.bills[p.forceDilemma];
    state.mode.billId = bill?.id || null;
    state.mode.brief = fill(sc.brief, { bill: billName(bill), position: (bill?.positions[me.party] || 'yea').toUpperCase() });
    if (bill) log(state, say('log.scenario.homeTruths', { bill: billName(bill) }), 'career');
  },
};

export function scenarioGame(id, { seed = null, first, last, age } = {}) {
  const sc = scenarioById(id);
  if (!sc) throw new Error('Unknown scenario ' + id);
  const state = newGame({
    seed: seed || `${sc.seed}-1`,
    party: 'government',
    first,
    last,
    age,
    background: sc.background,
    ridingType: sc.ridingType,
    act: sc.act,
    mode: 'scenario',
    modeId: sc.id,
    minority: !!sc.minority,
    startWeek: sc.week ?? 2,
    startDay: sc.day ?? 1,
  });
  state.mode.title = sc.title;
  state.mode.startWeek = state.date.absWeek;
  state.mode.startDay = state.date.dayOfWeek;
  withRng(state, (rng) => SETUPS[sc.setup](state, rng, sc));
  remember(state, 'scenario', { ctx: { title: sc.title, blurb: sc.blurb } });
  // A scenario is one week, watched day by day: the brief on the first morning, the verdict at the weekend.
  state.flow.forceWatch = true;
  return state;
}

// The weekend after a scenario's week: what happened, in a line.
const VERDICTS = {
  threeShort(state) {
    const d = Object.values(state.divisions).find((x) => x.billId === state.mode.billId && x.recorded);
    if (!d) return ['noVote', {}];
    if (state.house.fallen) return ['fell', {}];
    return [d.carried ? 'won' : 'lost', { margin: Math.abs(d.yeas.length - d.nays.length) }];
  },
  roomTurns(state) {
    const r = state.player.lastRevolt;
    if (!r || r.week !== state.mode.startWeek) return ['noRevolt', {}];
    return [r.won ? 'ousted' : 'held', {}];
  },
  homeTruths(state) {
    const d = Object.values(state.divisions).find((x) => x.billId === state.mode.billId && x.recorded);
    if (!d) return ['noVote', {}];
    const s = state.player.ridingStanding;
    const start = state.flow.week?.start?.ridingStanding ?? s;
    const standing = s > start ? `up ${s - start}` : s < start ? `down ${start - s}` : 'unchanged';
    return [state.player.actProgress.rebellions > 0 ? 'riding' : 'party', { standing }];
  },
};

function settleScenario(state) {
  const m = state.mode;
  if (m?.kind !== 'scenario' || m.verdict || state.date.absWeek !== m.startWeek) return null;
  const sc = scenarioById(m.id);
  const [key, ctx] = VERDICTS[m.id]?.(state) || [null, {}];
  if (!sc || !key) return null;
  m.verdict = { key, text: fill(sc.outcomes[key] || '', ctx) };
  return null;
}

hooks.weekend.push(settleScenario);
// A government that falls never reaches the weekend: the verdict is written the evening it falls.
hooks.fallout.push((state) => (state.house.fallen ? settleScenario(state) : null));
