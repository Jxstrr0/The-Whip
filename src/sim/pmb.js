// The private members' lottery and the player's own bill: a draw in Act 2, a bill to choose, votes to find
// across the aisle, and the whip wanting to know why you're talking to the other side.
import { data, tuning } from './config.js';
import { fill } from './fill.js';
import { hooks, log, resolvers, isSittingWeek, queueStop } from './pacing.js';
import { makeBill, scheduleVote, billName } from './bills.js';
import { capFirst } from './fill.js';
import { baseScore, scoreToVote } from './mp.js';
import { adjustRapport } from './relationships.js';
import { reveal } from './knowledge.js';
import { ledgerAdd, budget } from './tools.js';
import { remember, rememberPmb } from './memoir.js';

const fullName = (m) => `${m.name.first} ${m.name.last}`;
const me = (state) => state.mps[state.player.mpId];
const whipOf = (state) => state.parties[me(state).party]?.chiefWhip;

// Three bills that suit you: your interests and your riding first.
export function lotteryOptions(state, rng) {
  const m = me(state);
  const all = data().billTemplates.templates.filter((t) => t.kind === 'privateMember');
  const score = (t) => (m.interests.includes(t.category) ? 2 : 0) + ((t.ridingEffects?.[m.riding.type] || 0) > 0 ? 1 : 0) + rng.next() * 0.5;
  return all
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => ({ title: x.t.title, summary: x.t.summary || '', category: x.t.category }));
}

export function drawLottery(state, rng) {
  const p = state.player;
  p.lottery = { drawn: true, week: state.date.absWeek };
  const options = lotteryOptions(state, rng);
  log(state, 'Your name came up in the private members’ lottery.', 'career');
  return { kind: 'career', event: 'lottery', important: true, needsChoice: true, text: data().career.lottery.intro, options: options.map((o) => ({ id: o.title, label: o.title, note: o.summary, enabled: true })) };
}

export function chooseBill(state, rng, title) {
  const C = tuning().career;
  const t = data().billTemplates.templates.find((x) => x.title === title && x.kind === 'privateMember') || data().billTemplates.templates.find((x) => x.kind === 'privateMember');
  const bill = makeBill(state, rng, t, { sponsor: state.player.mpId });
  // Your own side lets it through on a free vote; the rest decide for themselves.
  bill.lines[me(state).party] = 'free';
  scheduleVote(state, bill, rng, 'second', C.pmbVoteWeeks * 5);
  bill.scheduled = true;
  state.player.pmb = { billId: bill.id, asked: [], whipAsked: false, crossAisleDone: false };
  log(state, `You introduced ${billName(bill)}. It comes to a vote in ${C.pmbVoteWeeks} weeks.`, 'career');
  remember(state, 'pmb', { sub: 'introduced', ctx: { bill: billName(bill) } });
  return bill;
}

// Opposition members closest to voting for your bill, for the cross-aisle set piece.
export function crossAisleCandidates(state) {
  const bill = state.bills[state.player.pmb?.billId];
  if (!bill) return [];
  const mine = me(state).party;
  return Object.values(state.mps)
    .filter((m) => m.party !== mine && m.party !== 'ind' && m.caucusRole !== 'speaker' && !state.player.pmb.asked.includes(m.id))
    .map((m) => ({ m, s: baseScore(state, m, bill).score }))
    .filter((x) => scoreToVote(x.s) !== 'yea')
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.m);
}

function crossAisleStop(state) {
  const C = tuning().career;
  const bill = state.bills[state.player.pmb.billId];
  const list = crossAisleCandidates(state);
  const CA = data().career.crossAisle;
  return { kind: 'career', event: 'crossAisle', important: true, needsChoice: true, billId: bill.id, asksLeft: C.crossAisleAsks - state.player.pmb.asked.length, text: fill(CA.intro, { bill: billName(bill), n: C.crossAisleAsks }), options: [...list.map((m) => ({ id: m.id, label: fill(CA.ask, { name: fullName(m) }), note: `${state.parties[m.party]?.short || ''} · ${m.riding.name}`, enabled: true })), { id: 'done', label: CA.done, note: '', enabled: true }] };
}

function askAcross(state, mpId) {
  const C = tuning().career;
  const p = state.player;
  const bill = state.bills[p.pmb.billId];
  const m = state.mps[mpId];
  if (!m || p.pmb.asked.includes(mpId)) return;
  p.pmb.asked.push(mpId);
  state.nudges ||= {};
  state.nudges[mpId] ||= {};
  state.nudges[mpId][bill.id] = (state.nudges[mpId][bill.id] || 0) + C.crossAisleNudge;
  reveal(state, mpId, 'interests', 'meeting');
  adjustRapport(state, mpId, 4);
  budget(state);
  p.toolTime = Math.max(0, p.toolTime - C.crossAisleTime);
  ledgerAdd(state, { from: p.mpId, to: mpId, kind: 'favor', what: `crossAisle:${bill.id}`, note: `You asked ${fullName(m)} for their vote on ${billName(bill)}.`, settled: false, dueWeek: null });
  log(state, `You asked ${fullName(m)} (${state.parties[m.party]?.short}) to vote for ${billName(bill)}.`, 'career');
}

function whipQuestionStop(state) {
  const W = data().career.whipQuestion;
  const whip = whipOf(state);
  return { kind: 'career', event: 'whipQuestion', important: true, needsChoice: true, text: fill(W.intro, { whip: whip ? fullName(state.mps[whip]) : 'The whip' }), options: [{ id: 'explain', label: W.explain, note: W.explainNote, enabled: true }, { id: 'dropIt', label: W.dropIt, note: W.dropItNote, enabled: true }] };
}

function answerWhip(state, choice) {
  const C = tuning().career;
  const p = state.player;
  const whip = whipOf(state);
  const bill = state.bills[p.pmb.billId];
  p.pmb.whipAsked = true;
  if (choice === 'dropIt') {
    for (const id of p.pmb.asked) if (state.nudges?.[id]) state.nudges[id][bill.id] = 0;
    for (const e of state.ledger) if (e.what === `crossAisle:${bill.id}` && !e.settled) { e.settled = true; e.kept = false; e.processed = true; }
    if (whip) adjustRapport(state, whip, C.dropItRapport);
    log(state, `You dropped the asks. ${capFirst(billName(bill))} will probably die at second reading.`, 'career');
  } else {
    if (whip) adjustRapport(state, whip, C.whipQuestionRapport);
    log(state, `You told the whip it's your bill and it needs the votes. They didn't like it. They understood it.`, 'career');
  }
}

// Weekends: the draw in Act 2; the week before the vote, the asks; then the whip's question.
hooks.weekend.push((state, rng) => {
  const C = tuning().career;
  const p = state.player;
  if (p.act >= 2 && !p.lottery?.drawn && rng.chance(C.lotteryOdds)) return drawLottery(state, rng);
  return null;
});

hooks.morning.push((state) => {
  const p = state.player;
  if (!p.pmb || !isSittingWeek(state) || state.date.dayOfWeek !== 1) return null;
  const bill = state.bills[p.pmb.billId];
  if (!bill || bill.status !== 'active' || bill.nextVote == null) return null;
  const daysToVote = bill.nextVote - (state.date.absWeek * 5 + state.date.dayOfWeek - 1);
  if (!p.pmb.crossAisleDone && daysToVote <= 10 && daysToVote > 0) {
    p.pmb.crossAisleDone = true;
    return crossAisleStop(state);
  }
  return null;
});

// After the player's bill has its vote, it either made their name or taught them something.
hooks.fallout.push((state) => {
  const p = state.player;
  if (!p.pmb || p.pmb.settled) return;
  const bill = state.bills[p.pmb.billId];
  const r = bill?.results?.length ? bill.results[bill.results.length - 1] : null;
  if (!r) return;
  const res = state.divisions[r] || r;
  if (!res || res.carried == null) return;
  p.pmb.settled = true;
  const C = tuning().career;
  if (res.carried) {
    p.actProgress.noticed += C.pmbPassedNoticed;
    p.ridingStanding = Math.min(100, p.ridingStanding + C.pmbPassedStanding);
    log(state, `${capFirst(billName(bill))} passed second reading. Your name is on something now.`, 'career');
  } else {
    p.actProgress.noticed += C.pmbFailedNoticed;
    log(state, `${capFirst(billName(bill))} was defeated. You know who voted for it, and so does the whip.`, 'career');
  }
  for (const e of state.ledger) if (e.what === `crossAisle:${bill.id}` && !e.settled) { e.settled = true; e.kept = res.yeas?.includes(e.to) ?? null; e.processed = true; }
  rememberPmb(state, bill, res);
});

// The career resolver hands these events here.
const prevExtra = resolvers.careerExtra;
resolvers.careerExtra = (state, p, choice) => {
  if (p.event === 'lottery') {
    withRngState(state, (rng) => chooseBill(state, rng, choice || p.options[0].id));
    return;
  }
  if (p.event === 'crossAisle') {
    if (choice && choice !== 'done') askAcross(state, choice);
    const C = tuning().career;
    if (choice && choice !== 'done' && state.player.pmb.asked.length < C.crossAisleAsks && crossAisleCandidates(state).length) queueStop(state, crossAisleStop(state));
    else if (state.player.pmb.asked.length && !state.player.pmb.whipAsked) queueStop(state, whipQuestionStop(state));
    return;
  }
  if (p.event === 'whipQuestion') {
    answerWhip(state, choice || 'explain');
    return;
  }
  prevExtra?.(state, p, choice);
};

import { withRng as withRngState } from './rng.js';
