// The whip's tools (DESIGN section 8), gated by act: persuade, chase attendance during the bells, pair,
// grant or block leave, give or strip a committee seat, give or deny a Question Period slot, a riding
// project, threaten a nomination, use leverage, release a free vote, expel. Each costs House time or a
// favour from a weekly budget, pushes on the MP's decision through state.nudges / state.leverage /
// state.chased / state.leaves, and lands in the ledger from both sides.
import { tuning, data } from './config.js';
import { registerActions } from './actions.js';
import { hooks, log, isSittingWeek } from './pacing.js';
import { withRng } from './rng.js';
import { baseScore, scoreToVote } from './mp.js';
import { adjustRapport, addStyle } from './relationships.js';
import { isKnown, reveal, touch } from './knowledge.js';
import { lineFor } from './bills.js';
import { reseat } from './modes.js';

const SIGN = { yea: 1, nay: -1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const me = (state) => state.mps[state.player.mpId];
const fullName = (m) => `${m.name.first} ${m.name.last}`;

// What each tool needs: the act it arrives in, where it's used, and any extra condition.
export const TOOLS = {
  persuade: { act: 1, where: 'chamber' },
  chase: { act: 3, where: 'bells' },
  pair: { act: 4, where: 'office' },
  leave: { act: 4, where: 'office' },
  committeeSeat: { act: 5, where: 'office' },
  qpSlot: { act: 5, where: 'office' },
  ridingProject: { act: 5, where: 'office', government: true },
  threatenNomination: { act: 5, where: 'office' },
  leverage: { act: 1, where: 'office', needsSecret: true },
  freeVote: { act: 5, where: 'caucus' },
  expel: { act: 5, where: 'caucus', needsLeader: true },
};

// The weekly budget: minutes of House time and favours to call in. Reset every weekend.
export function budget(state) {
  const T = tuning().tools;
  const p = state.player;
  if (p.toolTime == null) p.toolTime = T.timePerWeek;
  if (p.toolFavors == null) p.toolFavors = T.favorsPerWeek;
  return { time: p.toolTime, favors: p.toolFavors };
}

export function canUse(state, tool, mpId = null) {
  const def = TOOLS[tool];
  if (!def) return { ok: false, reason: 'unknown' };
  const p = state.player;
  if (p.act < def.act) return { ok: false, reason: 'act', act: def.act };
  if (def.government && state.house.government !== me(state).party) return { ok: false, reason: 'government' };
  if (def.needsLeader && p.leaderTrust < tuning().tools.expelLeaderTrust) return { ok: false, reason: 'leader' };
  if (def.needsSecret && mpId) {
    const m = state.mps[mpId];
    if (!m?.secrets?.length || !isKnown(state, mpId, 'secrets')) return { ok: false, reason: 'secret' };
  }
  if (budget(state).time < (tuning().tools.cost[tool] || 0)) return { ok: false, reason: 'time' };
  return { ok: true };
}

// Everything the player can reach right now, for the UI.
export function availableTools(state, where) {
  return Object.keys(TOOLS).filter((k) => TOOLS[k].where === where && canUse(state, k).ok);
}

function spend(state, tool) {
  budget(state);
  state.player.toolTime = Math.max(0, state.player.toolTime - (tuning().tools.cost[tool] || 0));
}

// A ledger entry. Shared with rivals.js so everything that happens between whips and members is on the record.
export function ledgerAdd(state, { from, to, kind, what, note = '', dueWeek = null, settled = true, kept = null }) {
  state.ledgerSeq = (state.ledgerSeq || 0) + 1;
  const e = { id: 'g' + String(state.ledgerSeq).padStart(3, '0'), from, to, kind, what, note, created: state.date.absWeek, dueWeek, settled, kept, processed: settled };
  state.ledger.push(e);
  return e;
}

function nudge(state, mpId, billId, delta) {
  state.nudges ||= {};
  state.nudges[mpId] ||= {};
  state.nudges[mpId][billId] = (state.nudges[mpId][billId] || 0) + delta;
}

// The side the player wants an MP on: the party line while there is one, otherwise the player's own side.
export function wantedSide(state, bill, side = null) {
  if (side) return side;
  const { line, position } = lineFor(bill, me(state).party);
  if (line === 'whipped' && SIGN[position]) return position;
  return baseScore(state, me(state), bill).score >= 0 ? 'yea' : 'nay';
}

// The next whipped vote the player's party faces, which is what most tools are about.
export function nextVote(state) {
  return Object.values(state.bills)
    .filter((b) => b.status === 'active' && b.nextVote != null)
    .sort((a, b) => a.nextVote - b.nextVote)[0] || null;
}

// ---------- the tools ----------

function persuade(state, rng, { mpId, billId, side }) {
  const T = tuning().tools;
  const bill = state.bills[billId];
  const m = state.mps[mpId];
  const want = wantedSide(state, bill, side);
  const s = SIGN[want];
  const before = baseScore(state, m, bill);
  const beforeVote = scoreToVote(before.score, before.abstainLine);
  // Persuasion moves people who already half agree with you; the rest just take your time.
  const open = s * before.score > -T.persuadeBand;
  nudge(state, mpId, billId, s * (open ? T.persuadeNudge : T.persuadeWasted));
  const after = baseScore(state, m, bill);
  const afterVote = scoreToVote(after.score, after.abstainLine);
  touch(state, mpId);
  reveal(state, mpId, 'ideology', 'tools');
  addStyle(state, 'fixer');
  const moved = afterVote !== beforeVote && afterVote === want;
  const note = open ? (moved ? `${fullName(m)} will vote ${want} on ${bill.title}. You made the case.` : `${fullName(m)} heard you out on ${bill.title}; they're closer.`) : `${fullName(m)} wasn't going to be moved on ${bill.title}. You lost a quarter hour.`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'tool', what: `persuade:${billId}:${want}`, note });
  log(state, note, 'tool');
  return { ok: true, moved, open, note };
}

function chase(state, rng, { mpId, billId }) {
  const T = tuning().tools;
  const m = state.mps[mpId];
  const bill = state.bills[billId];
  const where = weightedPick(rng, T.chaseWhere);
  const found = rng.next() < T.chaseOdds[where];
  if (found) {
    state.chased ||= {};
    state.chased[billId] ||= {};
    state.chased[billId][mpId] = true;
  }
  reveal(state, mpId, 'attendance', 'tools');
  const PLACE = { lobby: 'in the lobby', office: 'in their office', airport: 'on the way to the airport' };
  const note = found ? `You found ${fullName(m)} ${PLACE[where]} and got them into the chamber for ${bill.title}.` : `${fullName(m)} was ${PLACE[where]}. You ran out of bells.`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'tool', what: `chase:${billId}`, note, kept: found });
  log(state, note, 'tool');
  return { ok: true, found, where, note };
}

function weightedPick(rng, table) {
  const entries = Object.entries(table);
  let r = rng.next() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

// Who on our side is likely to be away for a vote: leave granted, or a poor attender.
export function likelyAbsentees(state, billId) {
  const T = tuning().tools;
  const party = me(state).party;
  return Object.values(state.mps).filter((m) => m.party === party && m.id !== state.player.mpId && m.caucusRole !== 'speaker' && (state.leaves?.[billId]?.[m.id] === 'granted' || m.attendance < T.absenteeAttendance));
}

// The other side's likely absentee to pair with, through their whip. Trust with that whip's office, or a favour.
function pair(state, rng, { mpId, billId, withParty }) {
  const T = tuning().tools;
  const p = state.player;
  const bill = state.bills[billId];
  const taken = new Set(state.pairs.filter((x) => !x.broken && (!x.bill || x.bill === billId)).flatMap((x) => [x.a, x.b]));
  if (taken.has(mpId)) return { ok: false, reason: 'paired' };
  const theirs = Object.values(state.mps)
    .filter((m) => m.party === withParty && m.caucusRole !== 'speaker' && !taken.has(m.id))
    .sort((a, b) => a.attendance - b.attendance);
  if (!theirs.length) return { ok: false, reason: 'nobody' };
  const trust = p.whipTrust[withParty] || 0;
  if (trust < T.pairTrustNeeded) {
    if (budget(state).favors < 1) return { ok: false, reason: 'favor' };
    p.toolFavors--;
  }
  const other = theirs[0];
  const entry = { bill: billId, a: mpId, b: other.id, by: 'player', party: withParty, week: state.date.absWeek, tested: false, broken: false };
  state.pairs.push(entry);
  p.whipTrust[withParty] = clamp(trust + T.pairTrustGain, -100, 100);
  const whip = state.parties[withParty].chiefWhip;
  const note = `Paired ${fullName(state.mps[mpId])} with ${fullName(other)} (${state.parties[withParty].short}) on ${bill.title}.`;
  ledgerAdd(state, { from: p.mpId, to: whip || other.id, kind: 'pair', what: `pair:${billId}:${mpId}:${other.id}`, note, settled: false });
  log(state, note, 'tool');
  addStyle(state, 'fixer');
  return { ok: true, pair: entry, note };
}

function leave(state, rng, { mpId, billId, grant }) {
  const T = tuning().tools;
  const m = state.mps[mpId];
  const bill = state.bills[billId];
  state.leaves ||= {};
  state.leaves[billId] ||= {};
  state.leaves[billId][mpId] = grant ? 'granted' : 'blocked';
  state.leaveRequests = (state.leaveRequests || []).filter((r) => !(r.mpId === mpId && r.billId === billId));
  adjustRapport(state, mpId, grant ? T.leaveRapport : T.blockedRapport);
  if (!grant) m.mood = 'angry';
  addStyle(state, grant ? 'fixer' : 'enforcer');
  const note = grant ? `You let ${fullName(m)} go home for ${bill.title}. Pair them, or that's a vote short.` : `You refused ${fullName(m)} leave for ${bill.title}. They weren't pleased.`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'tool', what: `leave:${billId}:${grant ? 'granted' : 'blocked'}`, note });
  log(state, note, 'tool');
  return { ok: true, note };
}

function committeeSeat(state, rng, { mpId, committeeId, give }) {
  const T = tuning().tools;
  const m = state.mps[mpId];
  const next = nextVote(state);
  if (give) {
    const c = state.committees[committeeId] || Object.values(state.committees)[0];
    m.committee = c.id;
    adjustRapport(state, mpId, T.committeeRapport);
    if (next) nudge(state, mpId, next.id, SIGN[wantedSide(state, next)] * T.committeeNudge);
    state.player.record.promoted++;
    addStyle(state, 'fixer');
  } else {
    m.committee = null;
    adjustRapport(state, mpId, T.stripRapport);
    m.mood = 'angry';
    addStyle(state, 'enforcer');
  }
  const note = give ? `${fullName(m)} gets a seat on ${state.committees[m.committee]?.name}. They'll remember who gave it.` : `You took ${fullName(m)} off their committee. They'll remember that too.`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: give ? 'favor' : 'threat', what: `committeeSeat:${give ? 'given' : 'stripped'}`, note });
  log(state, note, 'tool');
  return { ok: true, note };
}

function qpSlot(state, rng, { mpId, give }) {
  const T = tuning().tools;
  const m = state.mps[mpId];
  const next = nextVote(state);
  let leaked = false;
  if (give) {
    adjustRapport(state, mpId, T.qpRapport);
    if (next) nudge(state, mpId, next.id, SIGN[wantedSide(state, next)] * T.qpNudge);
    addStyle(state, 'fixer');
  } else {
    adjustRapport(state, mpId, T.qpDenyRapport);
    leaked = rng.next() < T.qpLeakOdds;
    if (leaked) {
      state.player.ridingStanding = clamp(state.player.ridingStanding + T.leakStanding, 0, 100);
      log(state, `${data().headlines.papers[0]}: "Backbenchers muzzled by the whip's office," says a member who wasn't given a question.`, 'press');
    }
    addStyle(state, 'enforcer');
  }
  const note = give ? `${fullName(m)} gets a question in Question Period this week.` : `You passed ${fullName(m)} over for Question Period.${leaked ? ' It made the papers.' : ''}`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: give ? 'favor' : 'threat', what: `qpSlot:${give ? 'given' : 'denied'}`, note });
  log(state, note, 'tool');
  return { ok: true, leaked, note };
}

function ridingProject(state, rng, { mpId }) {
  const T = tuning().tools;
  const m = state.mps[mpId];
  const next = nextVote(state);
  adjustRapport(state, mpId, T.projectRapport);
  if (next) nudge(state, mpId, next.id, SIGN[wantedSide(state, next)] * T.projectNudge);
  state.pressure = clamp((state.pressure || 0) + 1, 0, 100);
  addStyle(state, 'fixer');
  const note = `A funding announcement is coming to ${m.riding.name}. The press will notice who got one.`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'promise', what: 'ridingProject', note, dueWeek: state.date.absWeek + T.projectDueWeeks, settled: false });
  log(state, note, 'tool');
  return { ok: true, note };
}

function threatenNomination(state, rng, { mpId, billId }) {
  const T = tuning().tools;
  const m = state.mps[mpId];
  const bill = state.bills[billId];
  nudge(state, mpId, billId, SIGN[wantedSide(state, bill)] * T.nominationNudge);
  adjustRapport(state, mpId, T.nominationRapport);
  m.floorCrossRisk = clamp((m.floorCrossRisk || 0) + T.nominationCrossRisk, 0, 100);
  m.mood = 'anxious';
  addStyle(state, 'enforcer');
  const note = `You let ${fullName(m)} know their next nomination isn't guaranteed. They'll vote with you on ${bill.title}, and they'll hate you for it.`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'threat', what: `nomination:${billId}`, note });
  log(state, note, 'tool');
  return { ok: true, note };
}

function leverage(state, rng, { mpId, billId }) {
  const T = tuning().tools;
  const m = state.mps[mpId];
  const bill = state.bills[billId];
  state.leverage ||= {};
  state.leverage[mpId] ||= {};
  state.leverage[mpId][billId] = SIGN[wantedSide(state, bill)] * T.leverageWeight;
  adjustRapport(state, mpId, T.leverageRapport);
  const leaked = rng.next() < T.leverageLeakOdds;
  if (leaked) {
    state.player.standing = clamp((state.player.standing || 50) + T.leverageScandal, 0, 100);
    state.pressure = clamp((state.pressure || 0) + 5, 0, 100);
    m.scandal = clamp((m.scandal || 0) + tuning().media.scandalLeak, 0, 100);
    state.mps[state.player.mpId].scandal = clamp((state.mps[state.player.mpId].scandal || 0) + tuning().media.scandalLeak, 0, 100);
    log(state, `${data().headlines.papers[0]}: "Whip's office accused of using a member's private life as a lever."`, 'press');
  }
  addStyle(state, 'operator');
  const note = `You used what you know about ${fullName(m)}. They'll vote your way on ${bill.title}. That's not forgiven.${leaked ? ' And it got out.' : ''}`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'threat', what: `leverage:${billId}`, note });
  log(state, note, 'tool');
  return { ok: true, leaked, note };
}

function freeVote(state, rng, { billId }) {
  const T = tuning().tools;
  const bill = state.bills[billId];
  const party = me(state).party;
  bill.lines[party] = 'free';
  for (const m of Object.values(state.mps)) if (m.party === party) m.loyalty = clamp(m.loyalty + T.freeVoteLoyalty, 0, 100);
  addStyle(state, 'loyalist');
  const note = `You released the caucus on ${bill.title}. A free vote; the result is theirs now.`;
  ledgerAdd(state, { from: state.player.mpId, to: party, kind: 'tool', what: `freeVote:${billId}`, note });
  log(state, note, 'tool');
  return { ok: true, note };
}

function expel(state, rng, { mpId }) {
  const T = tuning().tools;
  const m = state.mps[mpId];
  const party = state.parties[m.party];
  if (!party) return { ok: false, reason: 'independent' };
  party.seats = Math.max(0, party.seats - 1);
  party.morale = clamp((party.morale ?? 60) + T.expelMorale, 0, 100);
  m.party = 'ind';
  m.caucusRole = 'backbencher';
  m.clique = null;
  m.mood = 'angry';
  adjustRapport(state, mpId, -60);
  state.player.record.expelled++;
  addStyle(state, 'enforcer');
  reseat(state);
  const note = `${fullName(m)} has been expelled from caucus and sits as an independent.`;
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'threat', what: 'expelled', note });
  log(state, note, 'tool');
  return { ok: true, note };
}

const HANDLERS = { persuade, chase, pair, leave, committeeSeat, qpSlot, ridingProject, threatenNomination, leverage, freeVote, expel };

export function useTool(state, rng, args) {
  const check = canUse(state, args.tool, args.mpId);
  if (!check.ok) return check;
  const out = HANDLERS[args.tool](state, rng, args);
  if (out.ok) spend(state, args.tool);
  return out;
}

// ---------- the week ----------

// Monday: from act 4, a couple of members ask for leave for the week's biggest vote.
hooks.morning.push((state, rng) => {
  if (state.date.dayOfWeek !== 1 || !isSittingWeek(state)) return;
  const T = tuning().tools;
  state.leaveRequests = [];
  if (state.player.act < TOOLS.leave.act) return;
  const bill = nextVote(state);
  if (!bill) return;
  const party = me(state).party;
  const pool = Object.values(state.mps).filter((m) => m.party === party && m.id !== state.player.mpId && m.caucusRole === 'backbencher');
  const REASONS = ['a hospital appointment', 'a funeral in the riding', 'a trade mission', 'their daughter’s graduation', 'a riding association dinner', 'a long-booked holiday'];
  for (const m of rng.shuffle(pool).slice(0, T.leaveRequestsPerWeek)) {
    if (state.leaves?.[bill.id]?.[m.id]) continue;
    state.leaveRequests.push({ mpId: m.id, billId: bill.id, reason: rng.pick(REASONS) });
  }
});

hooks.weekend.push((state) => {
  const T = tuning().tools;
  state.player.toolTime = T.timePerWeek;
  state.player.toolFavors = T.favorsPerWeek;
  state.leaveRequests = [];
  // Pairs on votes that have been held are done with.
  state.pairs = state.pairs.filter((p) => !p.bill || state.bills[p.bill]?.status === 'active');
});

registerActions({
  useTool(state, a) {
    return withRng(state, (rng) => useTool(state, rng, a));
  },
});
