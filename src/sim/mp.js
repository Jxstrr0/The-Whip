// The MP decision model (DESIGN section 6): line, ideology, riding, ledger, peers, clique, pressure, voter cost.
import { tuning } from './config.js';
import { ideoFit, lineFor, regionOfRiding } from './bills.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIGN = { yea: 1, nay: -1, abstain: 0 };

// What the bill does for the MP's riding and interests (the material side: money, projects, regional wins).
function ridingBenefit(state, mp, bill) {
  let r = bill.regionEffects?.[regionOfRiding(state, mp.riding.id)] || 0;
  if (bill.beneficiaryRidings.includes(mp.riding.id)) r += 0.8;
  if (mp.interests.includes(bill.category)) r += 0.2 * Math.sign(bill.ridingEffects[mp.riding.type] || 1);
  return clamp(r, -1.5, 1.5);
}

// What it costs with voters: unpopular at home and a marginal seat is a bad combination.
function voterCost(mp, bill) {
  const dislike = -(bill.ridingEffects[mp.riding.type] || 0);
  const marginality = 1 - clamp(mp.margin, 1, 40) / 40;
  return (bill.visibility / 100) * dislike * (0.4 + marginality);
}

// Promises and debts about this vote, plus how the MP feels about the whip and leader who set the line.
function ledgerTerm(state, mp, bill, lineSign) {
  const T = tuning().vote;
  let d = 0;
  for (const e of state.ledger) {
    if (e.settled || e.kind !== 'promise' || e.from !== mp.id) continue;
    const [k, billId, v] = String(e.what).split(':');
    if (k === 'vote' && billId === bill.id) d += SIGN[v] * T.promiseWeight;
  }
  const party = state.parties[mp.party];
  if (party && lineSign) {
    const rel = ((mp.relations[party.chiefWhip] || 0) + (mp.relations[party.leader] || 0)) / 200;
    d += lineSign * rel * T.whipRelationWeight;
  }
  return d;
}

// Everything except peer pressure: used for the first pass, then again with peers' leanings.
export function baseScore(state, mp, bill) {
  const T = tuning().vote;
  const { line, position } = lineFor(bill, mp.party);
  const lineSign = line === 'whipped' ? SIGN[position] ?? 0 : 0;
  const lineW = T.wLine * (bill.confidence ? T.confidenceLineBoost : 1);
  const x = bill.axis === 'economy' ? mp.ideology.economy : mp.ideology.social;
  const parts = {
    L: lineSign * (mp.loyalty / 100),
    I: ideoFit(x, bill),
    R: ridingBenefit(state, mp, bill),
    D: ledgerTerm(state, mp, bill, lineSign),
    Q: 0,
    X: state.leverage?.[mp.id]?.[bill.id] || 0,
    C: voterCost(mp, bill),
  };
  const q = mp.clique && state.cliques[mp.clique];
  if (q) {
    const qx = bill.axis === 'economy' ? q.ideology.economy : q.ideology.social;
    parts.Q = 0.5 * (q.lean / 100) * lineSign + 0.5 * ideoFit(qx, bill);
  }
  const score = lineW * parts.L + T.wIdeo * parts.I + T.wRiding * parts.R + T.wLedger * parts.D + T.wClique * parts.Q + T.wPressure * parts.X - T.wCost * parts.C;
  return { score, parts, abstainLine: line === 'whipped' && position === 'abstain' };
}

export function scoreToVote(score, abstainLine = false) {
  const T = tuning().vote;
  if (abstainLine) return Math.abs(score) < T.abstainBand ? 'abstain' : score > 0 ? 'yea' : 'nay';
  if (score > T.upper) return 'yea';
  if (score < T.lower) return 'nay';
  return 'abstain';
}

// Every MP's intended vote on a bill, and whether they're in the building. `overrides` fixes some MPs'
// votes (the player's choice). Attendance is rolled separately: a yes who isn't here is worth nothing.
export function intentions(state, bill, rng, overrides = {}) {
  const T = tuning().vote;
  const mps = Object.values(state.mps).filter((m) => m.caucusRole !== 'speaker');
  const first = new Map();
  for (const m of mps) first.set(m.id, baseScore(state, m, bill));
  const lean = (id) => Math.sign(first.get(id)?.score ?? 0);
  const out = {};
  for (const m of mps) {
    const b = first.get(m.id);
    let p = 0;
    let w = 0;
    for (const [oid, rel] of Object.entries(m.relations)) {
      if (rel <= 25 || !first.has(oid)) continue;
      p += lean(oid) * rel;
      w += rel;
    }
    const P = w ? p / w : 0;
    const score = b.score + T.wPeer * P + rng.normal(0, T.noise);
    const { line, position } = lineFor(bill, m.party);
    let attend = m.attendance;
    if (line === 'whipped') attend += T.attendanceWhippedBoost;
    if (bill.confidence) attend += T.attendanceConfidenceBoost;
    if (bill.scheduled) attend += T.attendanceScheduledBoost;
    let present = rng.next() * 100 < attend;
    let vote = scoreToVote(score, b.abstainLine);
    // Abstainers who have a choice usually find a reason to be elsewhere.
    if (vote === 'abstain') present = false;
    if (overrides[m.id]) {
      vote = overrides[m.id] === 'absent' ? 'abstain' : overrides[m.id];
      present = overrides[m.id] !== 'absent';
    }
    out[m.id] = { vote, present, score, parts: { ...b.parts, P }, line, position };
  }
  return out;
}
