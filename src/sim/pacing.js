// The day loop: morning, caucus, House, office, fallout. Routine days auto-resolve to a summary line;
// the game only stops (state.flow.pending) for days that matter.
import { tuning } from './config.js';
import { withRng } from './rng.js';
import { registerActions } from './actions.js';
import { weeklyBusiness, committeeTick, todaysItems, reportStageAmendments, shoreUpConfidence, dayIndex } from './bills.js';
import { baseScore, intentions } from './mp.js';
import { putQuestion, runDivision, voiceResult, recordResult, voteOf, stageLabel, tally } from './vote.js';
import { dilemmaFor, applyPlayerVote } from './career.js';
import { decayKnowledge, reveal } from './knowledge.js';
import { rememberDivision } from './memoir.js';
import { isGuidedWeek } from './goals.js';

// Rooms and phases that later stages hook into (office, caucus, riding). Each returns a pending stop or null.
// bells(state, item, bill, secs) runs when a division waits on the player; doorsClose(state, item) just before it's decided.
export const hooks = { morning: [], caucus: [], questionPeriod: [], house: [], office: [], riding: [], fallout: [], weekend: [], bells: [], doorsClose: [] };
// Stage 8 hangs the early-Parliament handover here: a fallen government may be replaced without an election.
// Registered by election.js: `canHandOver(state)` says whether a fallen government hands over to the opposition
// instead of forcing an election; `beforeDissolve(state, rng)` performs it.
export const dissolution = { canHandOver: null, beforeDissolve: null };

const MOODS = ['cooperative', 'guarded', 'angry', 'anxious'];

export function initFlow(state) {
  state.flow = { step: 'morning', pending: null, queue: [], queued: [], day: null, week: { log: [], stops: 0, start: snapshot(state) }, choices: {} };
  state.divisions ||= {};
  return state.flow;
}

function snapshot(state) {
  const p = state.player;
  const me = state.mps[p.mpId];
  const whip = state.parties[me.party]?.chiefWhip;
  return { ridingStanding: p.ridingStanding, whipRapport: whip ? state.mps[whip].rapport : 0, rebellions: p.actProgress.rebellions, noticed: p.actProgress.noticed, votes: 0 };
}

// A stop raised by a hook or a resolver (a career moment, a life event): it's shown before the day goes on.
export function queueStop(state, p) {
  if (!p) return;
  (state.flow.queued ||= []).push(p);
}

// extra: flags for the screen, e.g. { quiet: true } when a sheet already shows it and it needs no toast.
export function log(state, text, kind = 'info', extra) {
  state.log.push({ day: dayIndex(state.date), week: state.date.absWeek, text, kind, ...extra });
  if (state.log.length > 300) state.log.splice(0, state.log.length - 300);
  state.flow?.week.log.push(text);
}

export function isSittingWeek(state) {
  const pattern = tuning().calendar.weekPattern;
  return pattern[state.date.absWeek % pattern.length] === 'S';
}

export function dayName(state) {
  return tuning().calendar.days[state.date.dayOfWeek - 1];
}

function parliamentOver(state) {
  const C = tuning().calendar;
  return state.house.fallen || state.date.absWeek >= C.years * C.weeksPerYear;
}

// Does this vote need the player? (Their own dilemma, or a confidence vote that could go either way.)
export function stopForItem(state, item) {
  const bill = state.bills[item.billId];
  const stopFor = state.player.pacing.stopFor;
  const dilemma = dilemmaFor(state, bill, baseScore, tuning().pacing);
  if (bill.sponsor === state.player.mpId) return { reason: 'ownBill', dilemma: null };
  if (dilemma && stopFor.includes('ownVote')) return { reason: 'ownVote', dilemma };
  if (bill.confidence && stopFor.includes('ownVote') && (!state.player.seenConfidence || confidenceInDoubt(state, bill))) return { reason: 'confidence', dilemma: null };
  return null;
}

// The House as it stands this morning, everyone in their seat: is the government's margin thin enough to fall?
// The first confidence vote always stops you, so you know what one is; a safe one after that goes through on the line.
const STILL = { normal: () => 0, next: () => 0, chance: () => false, pick: (a) => a[0], shuffle: (a) => a, int: () => 0 };
function confidenceInDoubt(state, bill) {
  let yeas = 0;
  let nays = 0;
  for (const it of Object.values(intentions(state, bill, STILL))) {
    if (it.vote === 'yea') yeas++;
    else if (it.vote === 'nay') nays++;
  }
  return Math.abs(yeas - nays) <= tuning().pacing.confidenceStopMargin;
}

function startDay(state, rng) {
  const d = state.date;
  const sitting = isSittingWeek(state);
  d.constituencyWeek = !sitting;
  if (d.dayOfWeek === 1) {
    if (sitting) {
      const bills = weeklyBusiness(state, rng);
      for (const b of bills) log(state, `First reading: ${b.title}.`, 'bill');
      committeeTick(state, rng);
    }
  }
  // Moods drift a little every day.
  for (const m of Object.values(state.mps)) if (rng.chance(tuning().pacing.moodChangeOdds / 5)) m.mood = rng.pick(MOODS);
  const items = sitting && d.dayOfWeek <= 4 ? todaysItems(state) : [];
  const stops = items.map((it) => stopForItem(state, it));
  state.flow.queue = items.map((it, i) => ({ ...it, stop: stops[i] }));
  state.flow.day = { matters: stops.some(Boolean) || !!state.flow.forceWatch, results: [] };
  for (const fn of hooks.morning) queueStop(state, fn(state, rng));
  state.orderPaper = items.map((it) => it.billId);
  const note = isGuidedWeek(state) ? `tutorial.d${d.dayOfWeek}` : null;
  if (state.flow.day.matters) return { kind: 'morning', note, items: state.flow.queue.map(({ billId, stage, stop }) => ({ billId, stage, stop: stop?.reason || null })) };
  return null;
}

// The player's vote when nothing stops them: with the line, or their own way on a free vote.
function autoChoice(state, bill) {
  const me = state.mps[state.player.mpId];
  return bill.lines[me.party] === 'whipped' && bill.positions[me.party] !== 'abstain' ? 'line' : 'free';
}

function playerOverride(state, bill, choice) {
  const me = state.mps[state.player.mpId];
  const pos = bill.positions[me.party];
  if (choice === 'absent') return 'absent';
  if (choice === 'line') return pos === 'abstain' ? 'absent' : pos;
  if (choice === 'rebel') return pos === 'yea' ? 'nay' : 'yea';
  if (choice === 'yea' || choice === 'nay') return choice;
  return null; // free: decide like any MP
}

// Put one item to the House, with the player's choice already made.
function decide(state, rng, item, choice, dilemma) {
  const bill = state.bills[item.billId];
  if (item.stage === 'report') {
    const a = reportStageAmendments(state, bill, rng);
    if (a) log(state, `Report stage amendment on ${bill.title} ${a.adopted ? 'carried' : 'defeated'}: ${a.text}.`, 'bill');
  }
  const me = state.player.mpId;
  const ov = playerOverride(state, bill, choice);
  for (const note of shoreUpConfidence(state, bill, (r) => intentions(state, bill, r, ov ? { [me]: ov } : {}))) log(state, note, 'confidence');
  const q = putQuestion(state, item, rng, ov ? { [me]: ov } : {});
  const result = q.division ? runDivision(state, q) : voiceResult(state, q);
  recordResult(state, result, rng);
  if (choice !== 'free') applyPlayerVote(state, bill, choice === 'yea' || choice === 'nay' ? 'line' : choice, dilemma, tuning().player);
  if (state.player.forceDilemma === bill.id) state.player.forceDilemma = null;
  if (bill.confidence) state.player.seenConfidence = true;
  afterResult(state, result);
  state.flow.day.results.push(result.id);
  return result;
}

function afterResult(state, result) {
  const p = state.player;
  const bill = state.bills[result.billId];
  const me = state.mps[p.mpId];
  const verb = result.carried ? 'carried' : 'defeated';
  const label = result.stage === 'motion' ? '' : ` at ${stageLabel(result.stage)}`;
  log(state, `${bill.title}${label}: ${verb}, ${tally(result)}.`, result.recorded ? 'division' : 'voice');
  if (!result.recorded) return;
  state.flow.week.start.votes++;
  // Party line side won or lost (the whip's record counts these).
  const pos = result.positions[me.party];
  if (pos === 'yea' || pos === 'nay') {
    if ((pos === 'yea') === result.carried) p.record.votesWon++;
    else p.record.votesLost++;
  }
  if (bill.confidence && result.carried && state.house.government === me.party) p.record.confidenceSurvived++;
  // Watching votes teaches you who's loyal and where they stand.
  const K = tuning().knowledge;
  p.observed ||= {};
  for (const id of [...result.yeas, ...result.nays]) {
    p.observed[id] = (p.observed[id] || 0) + 1;
    if (p.observed[id] === K.votesForLoyalty) reveal(state, id, 'loyalty', 'votes');
    if (p.observed[id] === K.votesForIdeology) reveal(state, id, 'ideology', 'votes');
  }
  if (!result.carried && bill.kind === 'government') {
    const gov = state.house.government;
    state.polling[gov] = Math.max(1, Math.round((state.polling[gov] - tuning().pacing.defeatPollHit) * 10) / 10);
  }
  if (state.house.fallen) log(state, `The government has lost the confidence of the House.`, 'confidence');
  rememberDivision(state, result);
}

function houseStep(state, rng) {
  const flow = state.flow;
  if (!flow.queue.length) {
    flow.step = 'office';
    return null;
  }
  const item = flow.queue[0];
  const bill = state.bills[item.billId];
  if (bill.status !== 'active') {
    flow.queue.shift();
    return null;
  }
  if (item.stop && !flow.choices[keyOf(item)]) {
    const me = state.mps[state.player.mpId];
    const T = tuning().vote;
    const bells = bill.scheduled ? T.bellsScheduled : T.bellsUnscheduled;
    for (const fn of hooks.bells) fn(state, item, bill, bells);
    return {
      kind: 'division',
      needsChoice: true,
      important: true,
      billId: bill.id,
      stage: item.stage,
      reason: item.stop.reason,
      dilemma: item.stop.dilemma,
      line: bill.lines[me.party],
      position: bill.positions[me.party],
      bells,
    };
  }
  flow.queue.shift();
  const choice = flow.choices[keyOf(item)] || autoChoice(state, bill);
  for (const fn of hooks.doorsClose) fn(state, item);
  const result = decide(state, rng, item, choice, item.stop?.dilemma || null);
  // The bells' list of who was away stood for our attendance on this one division only.
  state.bells = null;
  delete flow.choices[keyOf(item)];
  if (flow.day.matters && result.recorded) return { kind: 'result', divisionId: result.id, playerVote: voteOf(result, state.player.mpId) };
  return null;
}

const keyOf = (item) => `${item.billId}:${item.stage}`;

function endDay(state, rng) {
  for (const fn of hooks.fallout) queueStop(state, fn(state, rng));
  const d = state.date;
  if (d.dayOfWeek >= 5) {
    state.flow.step = 'weekend';
    return null;
  }
  d.dayOfWeek++;
  state.flow.step = 'morning';
  return null;
}

function weekend(state, rng) {
  const P = tuning().pacing;
  decayKnowledge(state);
  // Riding standing drifts back toward its usual level: voters forget, slowly.
  const p = state.player;
  p.ridingStanding = Math.round(p.ridingStanding + ((p.ridingBase ?? 55) - p.ridingStanding) * P.ridingRegression);
  // Polls drift; nobody knows why.
  for (const id of Object.keys(state.polling)) state.polling[id] = Math.max(0.5, Math.round((state.polling[id] + rng.normal(0, P.pollDriftSd)) * 10) / 10);
  for (const fn of hooks.weekend) queueStop(state, fn(state, rng));
  const w = state.flow.week;
  const summary = weekSummary(state);
  const pending = w.stops > 0 ? { kind: 'weekSummary', important: false, summary } : null;
  state.date.absWeek++;
  state.date.dayOfWeek = 1;
  const C = tuning().calendar;
  state.date.year = Math.floor(state.date.absWeek / C.weeksPerYear) + 1;
  state.date.week = (state.date.absWeek % C.weeksPerYear) + 1;
  state.flow.week = { log: [], stops: 0, start: snapshot(state) };
  state.flow.step = 'morning';
  // The guided first week is over; from here only days that matter stop you.
  state.flow.forceWatch = false;
  state.player.script = null;
  if (pending) pending.firstWeek = state.date.absWeek === 1 && (state.player.record?.parliaments ?? 1) === 1 && state.mode?.kind !== 'scenario';
  return pending;
}

export function weekSummary(state) {
  const w = state.flow.week;
  const now = snapshot(state);
  return {
    week: state.date.week,
    year: state.date.year,
    lines: w.log.slice(-40),
    ridingStanding: [w.start.ridingStanding, now.ridingStanding],
    whipRapport: [w.start.whipRapport, now.whipRapport],
    rebellions: now.rebellions - w.start.rebellions,
    divisions: w.start.votes,
    press: w.press || [],
    polling: { ...state.polling },
  };
}

// One step of the day. Returns the new pending stop, if any.
export function next(state) {
  const flow = state.flow;
  if (flow.pending) return flow.pending;
  if (state.ending) {
    flow.pending = { kind: 'ending', important: true, needsChoice: true, ...state.ending };
    return flow.pending;
  }
  if (flow.queued?.length) {
    flow.pending = flow.queued.shift();
    flow.week.stops++;
    return flow.pending;
  }
  if (flow.step === 'dissolved') return flow.pending;
  if (parliamentOver(state) && flow.step === 'morning') {
    if (state.house.fallen && dissolution.beforeDissolve) {
      const handover = withRng(state, (rng) => dissolution.beforeDissolve(state, rng));
      if (handover) {
        flow.pending = handover;
        flow.week.stops++;
        return handover;
      }
    }
    flow.step = 'dissolved';
    const why = state.house.fallen ? 'The government fell on a confidence vote.' : 'Parliament reached its fixed election date.';
    log(state, `Parliament is dissolved. ${why}`, 'confidence');
    flow.pending = { kind: 'dissolved', important: true, needsChoice: true, reason: state.house.fallen ? 'fallen' : 'fixedDate' };
    return flow.pending;
  }
  const pending = withRng(state, (rng) => {
    switch (flow.step) {
      case 'morning': {
        const p = startDay(state, rng);
        flow.step = state.date.dayOfWeek === tuning().calendar.caucusDay && isSittingWeek(state) ? 'caucus' : state.date.dayOfWeek === tuning().calendar.ridingDay || !isSittingWeek(state) ? 'riding' : 'house';
        return p;
      }
      case 'caucus':
        flow.step = 'house';
        return runHooks(hooks.caucus, state, rng);
      case 'house': {
        // Question Period comes before the day's votes, once; a stop here stands the player up.
        if (!flow.day.qpDone) {
          flow.day.qpDone = true;
          const q = runHooks(hooks.questionPeriod, state, rng);
          if (q) return q;
        }
        const p = houseStep(state, rng);
        if (!p && flow.step === 'office') return runHooks(hooks.house, state, rng);
        return p;
      }
      case 'riding':
        flow.step = 'office';
        return runHooks(hooks.riding, state, rng);
      case 'office':
        flow.step = 'fallout';
        return runHooks(hooks.office, state, rng);
      case 'fallout':
        return endDay(state, rng);
      case 'weekend':
        return weekend(state, rng);
      default:
        throw new Error('Unknown step ' + flow.step);
    }
  });
  if (pending) {
    flow.pending = pending;
    flow.week.stops++;
  }
  return flow.pending;
}

function runHooks(list, state, rng) {
  for (const fn of list) {
    const p = fn(state, rng);
    if (p) return p;
  }
  return null;
}

// Resolve the current stop with the player's choice and carry on.
export function resolve(state, choice = null) {
  const p = state.flow.pending;
  if (!p) return null;
  if (p.kind === 'ending') return p;
  if (p.kind === 'dissolved' && !resolvers.dissolved) return p;
  if (p.kind === 'division') {
    state.flow.choices[`${p.billId}:${p.stage}`] = choice || 'line';
  }
  if (resolvers[p.kind]) resolvers[p.kind](state, p, choice);
  state.flow.pending = null;
  return null;
}

// Later stages register how their own stops resolve (meetings, riding, caucus).
export const resolvers = {};

// "Skip to the next thing that matters": pass informational stops until one needs the player.
export function skip(state, limit = 5000) {
  for (let i = 0; i < limit; i++) {
    const p = state.flow.pending;
    if (p && (p.needsChoice || p.important) && i > 0) return p;
    if (p && (p.kind === 'dissolved' || p.kind === 'ending')) return p;
    if (p) {
      if (p.needsChoice) return p;
      resolve(state);
    }
    next(state);
  }
  return state.flow.pending;
}

// "Continue": finish the current informational stop and run to the next stop of any kind.
export function advance(state, limit = 5000) {
  if (state.flow.pending && !state.flow.pending.needsChoice) resolve(state);
  for (let i = 0; i < limit && !state.flow.pending; i++) next(state);
  return state.flow.pending;
}

registerActions({
  advance: (state) => advance(state),
  skip: (state) => skip(state),
  resolve: (state, a) => {
    resolve(state, a.choice);
    return advance(state);
  },
});
