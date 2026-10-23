// The week's big vote. On Monday the House leader takes the whipped vote that will decide the week (the
// closest, the most watched, a confidence vote above all) and puts it down for Thursday. All week the rooms
// point at it; on Thursday it goes to a recorded division with the player in the chamber, and the members
// they turned since Monday are theirs on the record. What winning it is worth depends on the job.
import { data, tuning } from './config.js';
import { hooks, log, isSittingWeek } from './pacing.js';
import { dayIndex, lineFor, billName } from './bills.js';
import { baseScore, intentions } from './mp.js';
import { voteOf } from './vote.js';
import { dilemmaFor } from './career.js';
import { isGuidedWeek } from './goals.js';
import { adjustRapport } from './relationships.js';
import { headline } from './media.js';
import { remember, person } from './memoir.js';
import { fill } from './fill.js';

const SIGN = { yea: 1, nay: -1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
const listNames = (names) => (names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
// Everyone in their seat, nobody wavering: the House as it would vote if the question were put this minute.
const STILL = { normal: () => 0, next: () => 0, chance: () => false, pick: (a) => a[0], shuffle: (a) => a, int: () => 0 };

const thursdayOf = (week) => week * 5 + 3;

// The House as it stands: each member's vote, and how the player's side and the other side add up.
function standing(state, bill, side) {
  const votes = {};
  let ours = 0;
  let theirs = 0;
  for (const [id, it] of Object.entries(intentions(state, bill, STILL))) {
    const v = it.present ? it.vote : 'absent';
    votes[id] = v;
    if (v === side) ours++;
    else if (v === 'yea' || v === 'nay') theirs++;
  }
  return { votes, ours, theirs };
}

function whippedFor(state, bill) {
  const { line, position } = lineFor(bill, state.mps[state.player.mpId].party);
  return line === 'whipped' && SIGN[position] ? position : null;
}

// The week's vote, while it's still to come: the bill, if the big vote is this week and not yet put.
export function bigVoteBill(state) {
  const bv = state.bigVote;
  if (!bv?.billId || bv.week !== state.date.absWeek || bv.result) return null;
  const bill = state.bills[bv.billId];
  return bill?.status === 'active' && bill.nextVote === bv.day ? bill : null;
}

export function isBigVote(state, billId) {
  return !!billId && bigVoteBill(state)?.id === billId;
}

// Monday: choose the vote and put it down for Thursday. A scenario's own vote is the week's vote.
export function pickBigVote(state) {
  const B = tuning().bigVote;
  const week = state.date.absWeek;
  state.bigVote = { week, billId: null };
  const scenario = state.mode?.kind === 'scenario';
  if (!isSittingWeek(state) || isGuidedWeek(state) || (week < B.fromWeek && !scenario)) return null;
  const thursday = thursdayOf(week);
  if (dayIndex(state.date) > thursday) return null;
  const live = Object.values(state.bills).filter((b) => b.status === 'active' && b.nextVote != null && b.nextVote <= thursday && whippedFor(state, b));
  const own = scenario && live.find((b) => b.id === state.mode.billId);
  const scored = live.map((b) => {
    const side = whippedFor(state, b);
    const s = standing(state, b, side);
    const margin = s.ours - s.theirs;
    const dilemma = dilemmaFor(state, b, baseScore, tuning().pacing);
    const score = B.weights.visibility * b.visibility - B.weights.margin * Math.abs(margin) + (b.confidence ? B.weights.confidence : 0) + (dilemma ? B.weights.dilemma : 0);
    return { b, side, s, margin, score };
  });
  scored.sort((x, y) => y.score - x.score || x.b.id.localeCompare(y.b.id));
  const top = own ? scored.find((x) => x.b === own) : scored[0];
  if (!top) return null;
  const { b: bill, side } = top;
  bill.nextVote = thursday;
  bill.scheduled = true;
  bill.visibility = Math.max(bill.visibility, B.visibility);
  // The House as it stood when the vote was set, re-read after the papers made it the week's story.
  const s = standing(state, bill, side);
  const margin = s.ours - s.theirs;
  Object.assign(state.bigVote, {
    billId: bill.id,
    stage: bill.stage,
    day: thursday,
    side,
    // close: either way on Monday's count; safe: comfortably the line's; long: the line is well behind.
    outlook: Math.abs(margin) <= B.closeMargin ? 'close' : margin > 0 ? 'safe' : 'long',
    start: { ours: s.ours, theirs: s.theirs },
    // Who wasn't with us on Monday: anyone of these who votes our way on Thursday, after the player got to
    // them, is the player's.
    against: Object.keys(s.votes).filter((id) => id !== state.player.mpId && s.votes[id] !== side),
  });
  return bill;
}

// Monday's line in the log, and the paper's.
function announce(state, rng, bill) {
  const L = data().career.bigVote;
  const bv = state.bigVote;
  const ctx = { bill: billName(bill), side: bv.side.toUpperCase(), ours: bv.start.ours, theirs: bv.start.theirs, short: Math.max(0, bv.start.theirs - bv.start.ours + 1) };
  const pool = bv.outlook === 'close' ? (bv.start.ours > bv.start.theirs ? L.setClose : L.setShort) : bv.outlook === 'safe' ? L.setSafe : L.setLong;
  log(state, fill(rng.pick(pool), ctx), 'bill');
  headline(state, rng, { close: 'bigVoteAhead', safe: 'bigVoteSafe', long: 'bigVoteLong' }[bv.outlook], { bill: billName(bill), ours: state.parties[state.mps[state.player.mpId].party]?.name || 'the party' });
}

// Runs before every other morning hook, so the week's other business (the row's set piece, the deputy's
// count, the pair) is about the same vote.
hooks.morning.unshift((state, rng) => {
  const d = state.date;
  if (state.bigVote?.week !== d.absWeek && d.dayOfWeek <= 3) {
    const bill = pickBigVote(state);
    if (bill) announce(state, rng, bill);
  }
  const bv = state.bigVote;
  if (!bv?.billId || bv.week !== d.absWeek || bv.result) return null;
  const flow = state.flow;
  const today = dayIndex(d);
  const i = flow.queue.findIndex((it) => it.billId === bv.billId);
  if (i < 0) return null;
  const [item] = flow.queue.splice(i, 1);
  // Before Thursday it comes off today's paper; on Thursday it goes last, the vote the day builds to.
  if (today === bv.day) {
    item.big = true;
    if (item.stop?.reason !== 'ownBill') item.stop = { reason: 'bigVote', dilemma: item.stop?.dilemma || dilemmaFor(state, state.bills[bv.billId], baseScore, tuning().pacing) };
    flow.queue.push(item);
  }
  state.orderPaper = flow.queue.map((it) => it.billId);
  flow.day.matters = flow.queue.some((it) => it.stop) || !!flow.forceWatch;
  return null;
});

// What the vote was worth, by the job: noticed on the backbench, the whip's regard on a row, the leader's
// trust with the count, and the pressure on the office once it's yours. Winning a close vote, or one the line
// was losing on Monday, is worth the most; a safe one a little. Losing a close one costs, losing a safe one
// costs more, and losing a vote that was never there costs nothing. Each name turned adds a little, up to a cap.
export function payout(state, bill, won, names) {
  const B = tuning().bigVote;
  const p = state.player;
  const bv = state.bigVote;
  const act = clamp(p.act, 1, 5);
  const P = B.payoutByAct[act - 1];
  const n = Math.min(names.length, B.namesCap);
  const safe = bv.outlook === 'safe';
  let base = won ? (safe ? P.winSafe : P.win) : safe ? P.loseSafe : bv.outlook === 'close' ? P.lose : 0;
  // A confidence vote already pays (and costs) the leader's trust and the office's pressure on its own.
  if (bill.confidence && (P.stat === 'leaderTrust' || P.stat === 'pressure')) base = 0;
  const amount = base + (won ? n * P.perName : 0);
  const me = state.mps[p.mpId];
  const whip = state.parties[me.party]?.chiefWhip;
  let delta = 0;
  if (P.stat === 'noticed') {
    p.actProgress.noticed += amount;
    delta = amount;
  } else if (P.stat === 'whipRapport') {
    if (whip && whip !== p.mpId) delta = adjustRapport(state, whip, amount);
  } else if (P.stat === 'leaderTrust') {
    const before = p.leaderTrust;
    p.leaderTrust = clamp(p.leaderTrust + amount, 0, 100);
    delta = p.leaderTrust - before;
  } else if (P.stat === 'pressure') {
    const before = state.pressure || 0;
    state.pressure = clamp(before + amount, 0, 100);
    delta = state.pressure - before;
  }
  return { stat: P.stat, delta };
}

// The names that were the player's on the night. Turned: not with us on Monday, talked to since, with us
// in the lobby. Chased: fetched in on the bells and voting our way.
export function bigVoteNames(state, d) {
  const bv = state.bigVote;
  if (!bv?.billId || !d?.recorded || d.billId !== bv.billId || d.day !== bv.day || d.compact) return { turned: [], chased: [] };
  const contact = state.player.contact || {};
  const turned = bv.against.filter((m) => contact[m] === bv.week && voteOf(d, m) === bv.side);
  const chased = Object.keys(state.chased?.[d.billId] || {}).filter((m) => m !== state.player.mpId && voteOf(d, m) === bv.side && !turned.includes(m));
  return { turned, chased };
}

// Thursday's result, once it's in: whose names they were, what it was worth, what the record says.
hooks.fallout.unshift((state, rng) => {
  const bv = state.bigVote;
  if (!bv?.billId || bv.result || bv.week !== state.date.absWeek) return null;
  const id = (state.flow.day?.results || []).find((r) => state.divisions[r]?.billId === bv.billId && state.divisions[r].day === bv.day);
  const d = id && state.divisions[id];
  if (!d) return null;
  const p = state.player;
  const bill = state.bills[d.billId];
  const L = data().career.bigVote;
  const side = bv.side;
  const won = (side === 'yea') === d.carried;
  const margin = Math.abs(d.yeas.length - d.nays.length);
  const mine = voteOf(d, p.mpId);
  const freed = d.lines?.[state.mps[p.mpId].party] !== 'whipped';
  // A member who voted against the line doesn't get to count the names that voted for it.
  const { turned, chased } = mine === side ? bigVoteNames(state, d) : { turned: [], chased: [] };
  const yours = [...turned, ...chased];
  const ctx = { bill: billName(bill), yeas: d.yeas.length, nays: d.nays.length, margin, n: yours.length, names: listNames([...yours.slice(0, 4).map((m) => fullName(state.mps[m])), ...(yours.length > 4 ? [`${yours.length - 4} more`] : [])]) };
  let pay = null;
  // A rebel gets nothing from the line's win; a vote the leader freed is nobody's to win.
  if (!freed && (mine === side || !won)) pay = payout(state, bill, won, yours);
  bv.result = { divisionId: d.id, won, margin, turned, chased, mine, freed, pay };
  p.record.bigVotes ||= { won: 0, lost: 0, names: 0 };
  if (!freed) p.record.bigVotes[won ? 'won' : 'lost']++;
  p.record.bigVotes.names += yours.length;
  const pick = (pool) => fill(rng.pick(pool), ctx);
  if (freed) log(state, pick(L.freed), 'career');
  else log(state, pick(L[(won ? 'won' : 'lost') + { close: '', safe: 'Safe', long: 'Long' }[bv.outlook]]), 'career');
  if (yours.length) log(state, pick(yours.length === 1 ? L.yoursOne : L.yours), 'career');
  else if (!freed && bv.outlook === 'close') log(state, pick(L.yoursNone), 'career');
  // The memoir keeps the nights the player's own names made the difference, and the close ones lost.
  const N = data().memoir.notes;
  if (!freed && won && yours.length && yours.length >= margin) {
    remember(state, 'bigVote', { sub: 'turned', ctx, people: yours.map((m) => person(state, m, turned.includes(m) ? N.turned : N.chased)) });
  } else if (!freed && !won && bv.outlook === 'close' && margin <= tuning().bigVote.closeMargin) {
    remember(state, 'bigVote', { sub: 'lost', ctx, people: yours.map((m) => person(state, m, turned.includes(m) ? N.turned : N.chased)) });
  }
  return null;
});
