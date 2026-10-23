// The whip's tools (DESIGN section 8), gated by act: persuade, chase attendance during the bells, pair,
// grant or block leave, give or strip a committee seat, give or deny a Question Period slot, a riding
// project, threaten a nomination, use leverage, release a free vote, expel. Each costs House time or a
// favour from a weekly budget, pushes on the MP's decision through state.nudges / state.leverage /
// state.chased / state.leaves, and lands in the ledger from both sides.
import { tuning, data, say } from './config.js';
import { fill } from './fill.js';
import { registerActions } from './actions.js';
import { hooks, log, isSittingWeek } from './pacing.js';
import { withRng, createRng } from './rng.js';
import { baseScore, scoreToVote } from './mp.js';
import { adjustRapport, addStyle } from './relationships.js';
import { isKnown, reveal, touch } from './knowledge.js';
import { lineFor, billName } from './bills.js';
import { reseat } from './modes.js';
import { headline } from './media.js';
import { bigVoteBill } from './bigVote.js';

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
  // Every tool is spent on someone else; House time is never spent on yourself.
  if (mpId && mpId === p.mpId) return { ok: false, reason: 'self' };
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

// The next whipped vote the player's party faces, which is what most tools are about: the week's big vote
// while it's still to come.
export function nextVote(state) {
  const big = bigVoteBill(state);
  if (big) return big;
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
  const note = say(open ? (moved ? 'log.tool.persuaded' : 'log.tool.closer') : 'log.tool.unmoved', { name: fullName(m), want, bill: billName(bill) });
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'tool', what: `persuade:${billId}:${want}`, note });
  log(state, note, 'tool');
  return { ok: true, moved, open, note };
}

// ---------- the bells ----------
// When the bells ring on a whipped vote of ours (from act 3), the whip's office knows who isn't in the
// building and roughly where they are. That list comes from a hash of the seed, the bill and the stage, never
// the game's RNG, and it *is* the attendance for our side on this division: everyone else of ours is here.
// Staff runners fetch members against the bells clock; a trip that can't beat the doors can't be started.

const PLACES = ['lobby', 'office', 'airport'];

function pickWeighted(r, table) {
  const entries = Object.entries(table);
  let x = r * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) {
    x -= w;
    if (x <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

// How many staff the player can send at once, by rank.
export function runners(state) {
  const list = tuning().tools.chase.runnersByAct;
  return list[Math.min(state.player.act, list.length - 1)] || 0;
}

// Who of ours is away for this division, and where. Members past the map's limit are away but unaccounted for.
export function bellsAway(state, bill, stage) {
  const T = tuning().tools.chase;
  const V = tuning().vote;
  const party = me(state).party;
  const paired = new Set(state.pairs.filter((p) => !p.broken && (!p.bill || p.bill === bill.id)).flatMap((p) => [p.a, p.b]));
  const h = createRng(`${state.seed}:${bill.id}:${stage}:bells`);
  const spots = data().hill.places;
  const away = {};
  let shown = 0;
  const caucus = Object.values(state.mps)
    .filter((m) => m.party === party && m.id !== state.player.mpId && m.caucusRole !== 'speaker')
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const m of caucus) {
    // Draw every number for every member, so one member's leave can't shift where the next one is.
    const [rAway, rBlocked, rWhere, rLeave, rTrip, rSpot] = [h.next(), h.next(), h.next(), h.next(), h.next(), h.next()];
    if (paired.has(m.id)) continue;
    const leave = state.leaves?.[bill.id]?.[m.id];
    let attend = m.attendance;
    if (bill.lines[party] === 'whipped') attend += V.attendanceWhippedBoost;
    if (bill.confidence) attend += V.attendanceConfidenceBoost;
    if (bill.scheduled) attend += V.attendanceScheduledBoost;
    const isAway = leave === 'granted' || rAway * 100 >= attend || (leave === 'blocked' && rBlocked < tuning().tools.blockedNoShow);
    if (!isAway) continue;
    if (shown >= T.shown) {
      away[m.id] = { where: null };
      continue;
    }
    shown++;
    const where = leave === 'granted' && rLeave < T.leaveAirport ? 'airport' : pickWeighted(rWhere, Object.fromEntries(PLACES.map((k) => [k, T.places[k].weight])));
    const P = T.places[where];
    const trip = Math.max(1, P.trip + Math.round((rTrip * 2 - 1) * P.spread));
    const spot = Math.floor(rSpot * spots[where].spots.length);
    away[m.id] = { where, trip, spot };
  }
  return away;
}

// The bells open on a division the player will vote in. Chases are per division, so last stage's are cleared.
export function openBells(state, bill, stage, secs) {
  const key = `${bill.id}:${stage}`;
  if (state.bells?.key === key) return state.bells;
  state.bells = null;
  if (state.player.act < TOOLS.chase.act || bill.lines[me(state).party] !== 'whipped') return null;
  state.chased ||= {};
  state.chased[bill.id] = {};
  state.bells = { key, billId: bill.id, stage, party: me(state).party, secs, away: bellsAway(state, bill, stage), runs: [] };
  return state.bells;
}

// A staffer goes for a member. `secsLeft` is the bells clock when they leave; the trip there and back has to
// fit in it. Whether the member is where the office thought is settled now; the player sees it when the
// staffer gets back.
function chase(state, rng, { mpId, billId, secsLeft = null }) {
  const T = tuning().tools.chase;
  const bells = state.bells;
  if (!bells || bells.billId !== billId) return { ok: false, reason: 'bells' };
  const a = bells.away[mpId];
  if (!a) return { ok: false, reason: 'here' };
  if (!a.where) return { ok: false, reason: 'unknown' };
  if (bells.runs.some((r) => r.mpId === mpId)) return { ok: false, reason: 'sent' };
  const s = clamp(secsLeft ?? bells.secs, 0, bells.secs);
  if (a.trip > s + 0.05) return { ok: false, reason: 'far' };
  const out = bells.runs.filter((r) => r.back < s - 0.05).length;
  if (out >= runners(state)) return { ok: false, reason: 'runners' };
  const found = rng.next() < T.places[a.where].odds;
  const line = chaseLine(state, mpId, found, rng);
  bells.runs.push({ mpId, at: s, back: s - a.trip, found, line });
  if (found) state.chased[billId][mpId] = true;
  reveal(state, mpId, 'attendance', 'tools');
  return { ok: true, found, where: a.where, trip: a.trip, back: s - a.trip, line };
}

function chaseLine(state, mpId, found, rng) {
  const a = state.bells.away[mpId];
  const H = data().hill;
  const list = found ? H.found : H.missed[a.where];
  return rng.pick(list).replace('{name}', fullName(state.mps[mpId])).replace('{spot}', H.places[a.where].spots[a.spot].text);
}

// The doors close: every run goes in the ledger, and the bells get one line in the log.
function closeBells(state) {
  const bells = state.bells;
  if (!bells?.runs.length) return;
  const bill = state.bills[bells.billId];
  for (const r of bells.runs) ledgerAdd(state, { from: state.player.mpId, to: r.mpId, kind: 'tool', what: `chase:${bells.billId}`, note: r.line, kept: r.found });
  const L = data().hill.log;
  const n = bells.runs.length;
  const k = bells.runs.filter((r) => r.found).length;
  const name = fullName(state.mps[bells.runs[0].mpId]);
  const tpl = n === 1 ? (k ? L.oneIn : L.oneOut) : k === n ? L.allIn : k ? L.someIn : L.noneIn;
  log(state, fill(tpl, { name, bill: billName(bill), n: NUMBER[n] || n, k: NUMBER[k] || k }), 'tool');
}
const NUMBER = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

hooks.bells.push((state, item, bill, secs) => openBells(state, bill, item.stage, secs));
hooks.doorsClose.push((state) => closeBells(state));

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
  const note = say('log.tool.paired', { name: fullName(state.mps[mpId]), other: fullName(other), party: state.parties[withParty].short, bill: billName(bill) });
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
  const note = say(grant ? 'log.tool.leaveGranted' : 'log.tool.leaveRefused', { name: fullName(m), bill: billName(bill) });
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
  const note = say(give ? 'log.tool.seatGiven' : 'log.tool.seatStripped', { name: fullName(m), committee: state.committees[m.committee]?.name });
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
      log(state, say('log.press', { paper: data().headlines.papers[0], text: say('log.tool.qpLeak') }), 'press');
    }
    addStyle(state, 'enforcer');
  }
  const note = say(give ? 'log.tool.qpGiven' : leaked ? 'log.tool.qpDeniedLeaked' : 'log.tool.qpDenied', { name: fullName(m) });
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
  const note = say('log.tool.project', { riding: m.riding.name });
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
  const note = say('log.tool.nomination', { name: fullName(m), bill: billName(bill) });
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
    log(state, say('log.press', { paper: data().headlines.papers[0], text: say('log.tool.leverageLeak') }), 'press');
  }
  addStyle(state, 'operator');
  const note = say(leaked ? 'log.tool.leverageLeaked' : 'log.tool.leverage', { name: fullName(m), bill: billName(bill) });
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'threat', what: `leverage:${billId}`, note });
  log(state, note, 'tool');
  return { ok: true, leaked, note };
}

// Releasing the room in caucus goes back on a whipped line: only an active, whipped bill that isn't a
// matter of confidence, and the leader takes it by temper, as when the line is set free on Monday.
export function canRelease(state, billId) {
  const bill = state.bills[billId];
  const party = me(state).party;
  return !!bill && bill.status === 'active' && bill.lines[party] === 'whipped' && !bill.confidence;
}

function freeVote(state, rng, { billId }) {
  const T = tuning().tools;
  if (!canRelease(state, billId)) return { ok: false, reason: 'line' };
  const bill = state.bills[billId];
  const party = me(state).party;
  const temper = state.parties[party].leaderPersonality;
  bill.lines[party] = 'free';
  for (const m of Object.values(state.mps)) if (m.party === party) m.loyalty = clamp(m.loyalty + T.freeVoteLoyalty, 0, 100);
  state.player.leaderTrust = clamp(state.player.leaderTrust + (tuning().ranks.freeVoteTrust[temper] ?? -3), 0, 100);
  if (state.caucus?.billId === billId) state.caucus.line = { line: 'free', position: bill.positions[party] };
  addStyle(state, 'loyalist');
  const note = say('log.tool.freeVote', { bill: billName(bill) });
  ledgerAdd(state, { from: state.player.mpId, to: party, kind: 'tool', what: `freeVote:${billId}`, note });
  log(state, note, 'tool');
  return { ok: true, note };
}

// Who a Chief Whip can put out of caucus: anyone in your own party but the leader and the Speaker, who
// belongs to the House. The front bench goes harder: the leader has to trust you more, it costs some of
// that trust, and it makes the papers.
const FRONT = ['cabinet', 'shadowCabinet', 'houseLeader', 'deputyWhip', 'assistantWhip'];
export const isFrontBench = (m) => FRONT.includes(m.caucusRole);
export function canExpel(state, mpId) {
  const m = state.mps[mpId];
  return !!m && mpId !== state.player.mpId && m.party === me(state).party && !['leader', 'speaker'].includes(m.caucusRole) && state.parties[m.party]?.leader !== mpId;
}

// A front-bencher the leader won't let you put out yet.
export function expelLocked(state, mpId) {
  const m = state.mps[mpId];
  return !!m && isFrontBench(m) && state.player.leaderTrust < tuning().tools.expelFrontLeaderTrust;
}

// Members you could expel, the most rebellious first: how often each has voted against a whipped line in
// this Parliament's recorded divisions (and how many of those in the last few weeks), then loyalty.
// Front-benchers are marked, and locked while the leader's trust is short.
export function expelCandidates(state) {
  const party = me(state).party;
  const since = (state.date.absWeek - tuning().tools.expelRecentWeeks) * 5;
  const rebels = {};
  const recent = {};
  for (const d of Object.values(state.divisions || {})) {
    const bill = d.recorded && state.bills[d.billId];
    if (!bill || bill.lines?.[party] !== 'whipped') continue;
    const against = bill.positions[party] === 'yea' ? d.nays : bill.positions[party] === 'nay' ? d.yeas : null;
    for (const id of against || []) {
      rebels[id] = (rebels[id] || 0) + 1;
      if (d.day >= since) recent[id] = (recent[id] || 0) + 1;
    }
  }
  return Object.values(state.mps)
    .filter((m) => canExpel(state, m.id))
    .map((m) => ({ mpId: m.id, rebellions: rebels[m.id] || 0, recent: recent[m.id] || 0, loyalty: Math.round(m.loyalty), role: m.caucusRole, front: isFrontBench(m), locked: expelLocked(state, m.id) }))
    .sort((a, b) => b.rebellions - a.rebellions || a.loyalty - b.loyalty || a.mpId.localeCompare(b.mpId));
}

// The room after a second expulsion in one morning: hands go up behind a revolt that's already standing,
// or, by the odds, one starts against you. The ringleader is whoever at the table thinks least of you.
function roomTurns(state, rng, c, before) {
  const T = tuning().tools;
  if (c.revolt) {
    if (!c.revolt.resolved) c.revolt.support = Math.min(c.revolt.size, c.revolt.support + T.expelRevoltSupport);
    return false;
  }
  if (!rng.chance(Math.min(1, T.expelRevoltOdds * before))) return false;
  const room = c.seats.filter((id) => id !== state.player.mpId).map((id) => state.mps[id]);
  if (!room.length) return false;
  const ringleader = [...room].sort((a, b) => a.rapport - b.rapport || a.id.localeCompare(b.id))[0];
  const against = room.filter((m) => m.rapport < 0).length + T.expelRevoltSupport;
  c.revolt = { target: 'whip', ringleader: ringleader.id, support: Math.min(room.length, against), size: room.length, text: data().career.revolt.whip.replace('{ringleader}', fullName(ringleader)), choice: null, resolved: false, sparked: true };
  return true;
}

function expel(state, rng, { mpId }) {
  const T = tuning().tools;
  if (!canExpel(state, mpId)) return { ok: false, reason: 'protected' };
  if (expelLocked(state, mpId)) return { ok: false, reason: 'front' };
  const m = state.mps[mpId];
  const partyId = m.party;
  const party = state.parties[partyId];
  const role = m.caucusRole;
  const front = isFrontBench(m);
  const c = state.caucus;
  // Each expulsion in the same morning costs more than the last. The first frightens the room into line;
  // the next makes everyone at the table wonder who's after them.
  const before = c?.expelled?.length || 0;
  const scale = 1 + before * T.expelEscalate;
  party.seats = Math.max(0, party.seats - 1);
  party.morale = clamp((party.morale ?? 60) + (front ? T.expelFrontMorale : T.expelMorale) * scale, 0, 100);
  if (front) state.player.leaderTrust = clamp(state.player.leaderTrust + T.expelFrontTrust, 0, 100);
  if (party.houseLeader === mpId) party.houseLeader = null;
  if (party.deputyWhip === mpId) party.deputyWhip = null;
  party.assistantWhips = (party.assistantWhips || []).filter((id) => id !== mpId);
  m.party = 'ind';
  m.caucusRole = 'backbencher';
  if (m.clique && state.cliques?.[m.clique]) state.cliques[m.clique].members = state.cliques[m.clique].members.filter((id) => id !== mpId);
  m.clique = null;
  m.mood = 'angry';
  adjustRapport(state, mpId, -60);
  if (before === 0) {
    for (const x of Object.values(state.mps)) if (x.party === partyId) x.loyalty = clamp(x.loyalty + T.expelFearLoyalty, 0, 100);
  } else state.player.caucusSupport = clamp(state.player.caucusSupport + T.expelSupport * before, 0, 100);
  state.player.record.expelled++;
  addStyle(state, 'enforcer');
  reseat(state);
  // In the room, the chair empties: one fewer voice at the table, and one fewer behind a revolt.
  let turned = false;
  if (c) {
    c.expelled = [...(c.expelled || []), mpId];
    c.seats = c.seats.filter((id) => id !== mpId);
    c.grievances = c.grievances.filter((g) => g.mpId !== mpId);
    if (c.revolt && !c.revolt.resolved) {
      c.revolt.size = Math.max(1, c.revolt.size - 1);
      c.revolt.support = Math.max(0, c.revolt.support - 1);
    }
    if (before > 0) turned = roomTurns(state, rng, c, before);
  }
  if (front) headline(state, rng, 'expelled', { member: fullName(m), role: data().headlines.roles?.[role] || say('who.frontBencher'), party: party.name });
  const note = say('log.tool.expelled', { name: fullName(m) });
  ledgerAdd(state, { from: state.player.mpId, to: mpId, kind: 'threat', what: 'expelled', note });
  log(state, note, 'tool');
  return { ok: true, note, front, turned, ringleader: turned ? c.revolt.ringleader : null };
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
  const REASONS = data().career.leave.reasons;
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
