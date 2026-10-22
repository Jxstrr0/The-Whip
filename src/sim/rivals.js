// Rival whips: the other parties' chief whips as actors with a style and a weekly budget. Each Monday they
// work your caucus: poach a wobbly member with a pairing offer or a favour, leak to the press, dig for your
// skeleton, and test whether the pairs you made with them hold. Everything they do is in the feed and the ledger.
import { tuning, data } from './config.js';
import { hooks, log, isSittingWeek } from './pacing.js';
import { baseScore } from './mp.js';
import { lineFor } from './bills.js';
import { ledgerAdd, nextVote } from './tools.js';
import { headline } from './media.js';

const SIGN = { yea: 1, nay: -1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
const STYLE_WEIGHTS = { fixer: { poach: 3, leak: 1, dig: 1, pairTest: 1 }, enforcer: { poach: 1, leak: 1, dig: 2, pairTest: 3 }, operator: { poach: 1, leak: 3, dig: 2, pairTest: 1 } };

export function ensureWhipAI(state, rng, party) {
  if (party.whipAI) return party.whipAI;
  const R = tuning().rivals;
  party.whipAI = { style: rng.pick(R.styles || ['fixer', 'enforcer', 'operator']), weeklyBudget: { time: 0, favors: 0 }, targets: [], digging: 0, moves: [] };
  return party.whipAI;
}

function pick(rng, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let r = rng.next() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1]?.[0];
}

// The member of the player's caucus closest to breaking on the next whipped vote.
function wobbliest(state, bill, party) {
  const { line, position } = lineFor(bill, party);
  if (line !== 'whipped' || !SIGN[position]) return null;
  let best = null;
  for (const m of Object.values(state.mps)) {
    if (m.party !== party || m.id === state.player.mpId || m.caucusRole === 'speaker') continue;
    const d = SIGN[position] * baseScore(state, m, bill).score;
    if (best == null || d < best.d) best = { m, d };
  }
  return best;
}

function poach(state, rng, party, whip, bill) {
  const R = tuning().rivals;
  const mine = state.mps[state.player.mpId].party;
  const w = wobbliest(state, bill, mine);
  if (!w) return false;
  const { position } = lineFor(bill, mine);
  state.nudges ||= {};
  state.nudges[w.m.id] ||= {};
  state.nudges[w.m.id][bill.id] = (state.nudges[w.m.id][bill.id] || 0) - SIGN[position] * R.poachNudge;
  party.whipAI.targets = [...new Set([...party.whipAI.targets, w.m.id])].slice(-6);
  const note = `${fullName(w.m)} was seen leaving the ${party.short} whip's office before ${bill.title}.`;
  ledgerAdd(state, { from: whip, to: w.m.id, kind: 'rival', what: `poach:${bill.id}`, note });
  log(state, note, 'rival');
  return true;
}

// A leak spends something fresh about you: a whipped vote you broke, or a promise you didn't keep. Each one
// leaks once, and the papers run one leak a week. With nothing on you, the story is about your party instead.
function leak(state, rng, party, whip) {
  const R = tuning().rivals;
  const p = state.player;
  const me = state.mps[p.mpId];
  const week = state.date.absWeek;
  if (p.leakWeek === week || !rng.chance(R.leakOdds)) return false;
  const day = week * 5;
  const vote = p.whipFile.find((f) => !f.leaked && day - f.day <= R.leakFreshWeeks * 5);
  const promise = (p.record.promisesBroken || 0) > (p.promisesLeaked || 0);
  let line;
  if (vote) {
    vote.leaked = true;
    line = `"${me.name.last} can't be relied on," says a source close to the ${party.short} whip.`;
  } else if (promise) {
    p.promisesLeaked = p.record.promisesBroken;
    line = `"Ask ${me.name.last}'s colleagues what a promise from them is worth," a ${party.short} insider tells the paper.`;
  } else if (party.whipAI.targets.length) {
    line = `The paper reports "quiet talks" between ${party.name} and unhappy members of ${state.parties[me.party].name}.`;
  } else return false;
  p.leakWeek = week;
  if (vote || promise) p.ridingStanding = clamp(p.ridingStanding + R.leakStanding, 0, 100);
  const note = `${data().headlines.papers[0]}: ${line}`;
  ledgerAdd(state, { from: whip, to: p.mpId, kind: 'rival', what: 'leak', note });
  log(state, note, 'press');
  // Some leaks make the front page too.
  if (rng.chance(tuning().media.leakPress)) {
    const bill = Object.values(state.bills).filter((b) => b.status === 'active' && b.nextVote != null && b.kind !== 'oppositionMotion').sort((a, b) => a.nextVote - b.nextVote)[0];
    headline(state, rng, 'leak', { party: state.parties[me.party].name, bill: bill?.title || 'the bill', count: Math.max(2, party.whipAI.targets.length + 1) });
  }
  return true;
}

function dig(state, rng, party, whip) {
  const p = state.player;
  if (!p.skeleton || p.skeleton.foundBy || p.skeleton.dealtWith) return false;
  party.whipAI.digging = (party.whipAI.digging || 0) + 1;
  const need = 2 + (p.skeleton.severity || 1) * 2;
  if (party.whipAI.digging >= need) {
    p.skeleton.foundBy = party.id;
    const note = `Someone from ${party.name} has been asking around about your ${describeSkeleton(p.skeleton.kind)}. They've found it.`;
    ledgerAdd(state, { from: whip, to: p.mpId, kind: 'rival', what: 'skeleton', note });
    log(state, note, 'rival');
  } else if (party.whipAI.digging === 2) {
    log(state, `A ${party.short} staffer has been asking questions about your past.`, 'rival');
  }
  return true;
}

function describeSkeleton(kind) {
  return { businessDebt: 'old business debts', councilVote: 'record on council', payroll: 'family on the payroll' }[kind] || String(kind).replace(/([A-Z])/g, ' $1').toLowerCase();
}

// A pair the player made with this party: does the other side honour it when the bells go?
function pairTest(state, rng, party, whip) {
  const R = tuning().rivals;
  const p = state.player;
  const pr = state.pairs.find((x) => x.party === party.id && !x.tested && !x.broken && state.bills[x.bill]?.status === 'active');
  if (!pr) return false;
  pr.tested = true;
  const trust = p.whipTrust[party.id] || 0;
  const styleK = { enforcer: 1.25, fixer: 0.7, operator: 1 }[party.whipAI.style] || 1;
  const odds = clamp((R.pairRenegeBase - trust / 100) * styleK, 0.05, 0.9);
  const other = state.mps[pr.b];
  const bill = state.bills[pr.bill];
  if (rng.next() < odds) {
    pr.broken = true;
    p.whipTrust[party.id] = clamp(trust + R.trustReneged, -100, 100);
    const note = `${fullName(other)} will be in their seat for ${bill.title} after all. The ${party.short} whip's office says there was a misunderstanding.`;
    ledgerAdd(state, { from: whip, to: p.mpId, kind: 'rival', what: `pairBroken:${pr.bill}`, note, kept: false });
    log(state, note, 'rival');
  } else {
    p.whipTrust[party.id] = clamp(trust + R.trustHonoured, -100, 100);
    const note = `The ${party.short} whip's office confirms the pair on ${bill.title}: ${fullName(other)} stays away.`;
    ledgerAdd(state, { from: whip, to: p.mpId, kind: 'rival', what: `pairHonoured:${pr.bill}`, note, kept: true });
    log(state, note, 'rival');
  }
  return true;
}

// Monday morning: every other whip spends their week's budget on your caucus.
export function rivalsWeek(state, rng) {
  const R = tuning().rivals;
  const mine = state.mps[state.player.mpId].party;
  const bill = nextVote(state);
  const moves = [];
  for (const party of Object.values(state.parties)) {
    if (party.id === mine || !party.chiefWhip) continue;
    const ai = ensureWhipAI(state, rng, party);
    let time = Math.round(R.timePerWeek * (1 + R.sizeScale * party.seats));
    ai.weeklyBudget = { time, favors: R.favorsPerWeek };
    const cost = { poach: R.poachCost, leak: R.leakCost, dig: R.digCost, pairTest: R.pairTestCost };
    const weights = { ...STYLE_WEIGHTS[ai.style] };
    let guard = 0;
    while (time >= Math.min(...Object.values(cost)) && guard++ < 12) {
      const k = pick(rng, Object.fromEntries(Object.entries(weights).filter(([a]) => cost[a] <= time)));
      if (!k) break;
      const did = k === 'poach' ? bill && poach(state, rng, party, party.chiefWhip, bill) : k === 'leak' ? leak(state, rng, party, party.chiefWhip) : k === 'dig' ? dig(state, rng, party, party.chiefWhip) : pairTest(state, rng, party, party.chiefWhip);
      time -= cost[k];
      weights[k] = Math.max(0, weights[k] - 1);
      if (did) moves.push({ party: party.id, kind: k });
    }
    ai.moves = moves.filter((m) => m.party === party.id).map((m) => m.kind);
  }
  return moves;
}

hooks.morning.push((state, rng) => {
  if (state.date.dayOfWeek !== 1 || !isSittingWeek(state)) return;
  // The honeymoon of the first week: nobody works a rookie before they've found their seat.
  if (state.date.absWeek === 0) return;
  rivalsWeek(state, rng);
});
