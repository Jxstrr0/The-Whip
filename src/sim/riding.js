// The riding: Friday leave from the whip, constituents with cases, the local reporter, the riding
// association president, town halls, announcements, riding standing and the nomination.
import { data, tuning, say } from './config.js';
import { withRng } from './rng.js';
import { registerActions } from './actions.js';
import { hooks, resolvers, log, isSittingWeek } from './pacing.js';
import { adjustRapport } from './relationships.js';
import { dilemmaFor } from './career.js';
import { baseScore } from './mp.js';
import { headline } from './media.js';
import { billName } from './bills.js';
import { bigVoteBill } from './bigVote.js';
import { fill } from './fill.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => (m ? `${m.name.first} ${m.name.last}` : '');

export function ridingVars(state) {
  const me = state.mps[state.player.mpId];
  const party = state.parties[me.party];
  const r = state.ridings[me.riding.id];
  const v = state.ridingVisit;
  const bill = billName(v?.billId && state.bills[v.billId]);
  return {
    riding: me.riding.name,
    playerRiding: me.riding.name,
    province: me.riding.province,
    bill,
    playerFirst: me.name.first,
    playerLast: me.name.last,
    party: party?.name || 'the party',
    whip: fullName(state.mps[party?.chiefWhip]) || 'the whip',
    leader: fullName(state.mps[party?.leader]) || 'the leader',
    town: v?.town || r?.towns?.[0] || me.riding.name,
  };
}

export function fillRiding(state, text) {
  return fill(text, ridingVars(state));
}

// The bill people at home are talking about: the week's big vote, your dilemma, or the most visible vote.
function talkedAbout(state) {
  if (state.player.forceDilemma && state.bills[state.player.forceDilemma]) return state.player.forceDilemma;
  const big = bigVoteBill(state);
  if (big) return big.id;
  const recent = Object.values(state.bills).filter((b) => b.introduced >= (state.date.absWeek - 2) * 5);
  const d = recent.find((b) => b.status === 'active' && dilemmaFor(state, b, baseScore, tuning().pacing));
  return (d || recent.sort((a, b) => b.visibility - a.visibility)[0])?.id || null;
}

export function startVisit(state, rng) {
  const C = data().constituents;
  const me = state.mps[state.player.mpId];
  const r = state.ridings[me.riding.id];
  const cases = rng.shuffle(C.cases.filter((c) => c.types.includes(me.riding.type)));
  const picked = [];
  for (const c of cases) {
    if (picked.length >= 2) break;
    if (!picked.some((p) => p.role === c.role)) picked.push(c);
  }
  const p = state.player;
  const S = tuning().stakes;
  const presMood = p.nominationThreat > 40 || p.ridingStanding < S.standingLow ? 'angry' : p.ridingStanding < S.standingMid ? 'anxious' : p.ridingStanding > S.standingHigh ? 'cooperative' : 'guarded';
  const pres = rng.pick(C.president.filter((x) => x.mood === presMood));
  state.ridingVisit = {
    week: state.date.absWeek,
    town: rng.pick(r?.towns?.length ? r.towns : [me.riding.name]),
    billId: talkedAbout(state),
    queue: [
      ...picked.map((c) => ({ kind: 'case', id: c.id, role: c.role })),
      { kind: 'reporter', id: rng.pick(C.reporter).id, role: 'reporter' },
      { kind: 'president', id: pres.id, role: 'associationPresident' },
    ],
    at: 0,
    results: [],
    townHall: null,
    phase: 'visitors',
    startStanding: p.ridingStanding,
  };
  return state.ridingVisit;
}

function next(v) {
  v.at++;
  if (v.at >= v.queue.length) v.phase = 'choose';
}

// What each answer to a case does to riding standing, so the sheet can show it before you choose.
export function caseStakes(c) {
  return { carry: c.weight, refer: tuning().player.caseReferStanding, decline: -Math.max(0, c.weight - 1) };
}

// Three ways to take a case: carry it to Ostrava (it can come up in Question Period, and goes stale if it
// never does), pass it to the office that actually handles it, or turn it down.
export function answerCase(state, mode) {
  const v = state.ridingVisit;
  const item = v?.queue[v.at];
  if (!item || item.kind !== 'case') return null;
  const c = data().constituents.cases.find((x) => x.id === item.id);
  const p = state.player;
  v.lastWord = null;
  const stakes = caseStakes(c);
  if (mode === 'carry') {
    state.ridingCases.push({ id: `rc${state.ridingCases.length + 1}`, caseId: c.id, from: c.role, what: fillRiding(state, c.what), interest: c.interest, carried: true, week: state.date.absWeek, resolved: false });
    p.ridingStanding = clamp(p.ridingStanding + stakes.carry, 0, 100);
  } else if (mode === 'refer') {
    p.ridingStanding = clamp(p.ridingStanding + stakes.refer, 0, 100);
    const said = data().constituents.refer[c.role]?.text;
    if (said) v.lastWord = { who: 'you', role: c.role, text: fillRiding(state, said) };
  } else p.ridingStanding = clamp(p.ridingStanding + stakes.decline, 0, 100);
  v.results.push({ kind: 'case', id: c.id, mode });
  next(v);
  return { mode };
}

export function answerReporter(state, index) {
  const v = state.ridingVisit;
  const item = v?.queue[v.at];
  if (!item || item.kind !== 'reporter') return null;
  const q = data().constituents.reporter.find((x) => x.id === item.id);
  const opt = q.options[index];
  const p = state.player;
  p.ridingStanding = clamp(p.ridingStanding + opt.standing, 0, 100);
  const whip = state.parties[state.mps[p.mpId].party]?.chiefWhip;
  if (whip) adjustRapport(state, whip, opt.whip);
  log(state, say('log.riding.quoted', { town: fillRiding(state, '{town}'), text: fillRiding(state, opt.text) }), 'riding');
  v.lastWord = null;
  v.results.push({ kind: 'reporter', stance: opt.stance });
  next(v);
  return { stance: opt.stance };
}

// The president has their say; what you say back moves the executive, and sometimes the whip.
export function answerPresident(state, index) {
  const v = state.ridingVisit;
  const item = v?.queue[v.at];
  if (item?.kind !== 'president') return null;
  const pr = data().constituents.president.find((x) => x.id === item.id);
  const r = data().constituents.presidentReplies?.[pr?.mood]?.[index];
  v.lastWord = null;
  if (r) {
    const p = state.player;
    p.ridingStanding = clamp(p.ridingStanding + r.standing, 0, 100);
    p.nominationThreat = clamp(p.nominationThreat + r.threat, 0, 100);
    const whip = state.parties[state.mps[p.mpId].party]?.chiefWhip;
    if (whip && r.whip) adjustRapport(state, whip, r.whip);
    v.lastWord = { who: 'president', text: fillRiding(state, r.reply) };
    v.results.push({ kind: 'president', index });
  }
  next(v);
  return {};
}

export function startTownHall(state, rng) {
  const v = state.ridingVisit;
  if (!v || v.townHall) return null;
  const T = data().constituents.townHall;
  const billTopics = T.topics.filter((t) => t.kind === 'bill');
  const local = T.topics.filter((t) => t.kind === 'local');
  const topics = [...(v.billId ? [rng.pick(billTopics)] : []), rng.pick(local)].map((t) => t.id);
  const bg = data().backgrounds.backgrounds.find((b) => b.id === state.player.background);
  v.townHall = { opener: rng.pick(T.openers), topics, at: 0, crowd: 50 + (bg?.effects.townHallBonus || 0), answers: [] };
  v.phase = 'townHall';
  v.lastWord = null;
  return v.townHall;
}

// What the four placards at the back say this week: the bill's and the local issue's slogans
// first, then the standing grievances, so the boards change with the topics rather than repeat.
export function townHallPlacards(state) {
  const v = state.ridingVisit;
  const th = v?.townHall;
  if (!th) return [];
  const P = data().constituents.townHall.placards || {};
  const lines = [];
  const perTopic = th.topics.map((id) => P[id] || []);
  for (let round = 0; round < 2; round++) for (const l of perTopic) if (l[round]) lines.push(l[round]);
  const generic = P.generic || [];
  for (let i = 0; lines.length < 4 && i < generic.length; i++) lines.push(generic[(v.week + i) % generic.length]);
  return lines.slice(0, 4).map((l) => fillRiding(state, l));
}

export function answerTownHall(state, index) {
  const v = state.ridingVisit;
  const th = v?.townHall;
  if (!th || th.at >= th.topics.length) return null;
  const topic = data().constituents.townHall.topics.find((t) => t.id === th.topics[th.at]);
  const opt = topic.options[index];
  th.crowd = clamp(th.crowd + opt.crowd, 0, 100);
  state.player.ridingStanding = clamp(state.player.ridingStanding + opt.standing, 0, 100);
  th.answers.push({ topic: topic.id, stance: opt.stance, crowd: opt.crowd });
  th.at++;
  if (th.at >= th.topics.length) {
    // A good room spreads by word of mouth; a bad one spreads faster.
    const swing = Math.round((th.crowd - 50) / 8);
    state.player.ridingStanding = clamp(state.player.ridingStanding + swing, 0, 100);
    const TH = tuning().stakes.townHall;
    log(state, say('log.riding.townHall.' + (th.crowd >= TH.won ? 'won' : th.crowd <= TH.lost ? 'lost' : 'even'), { town: v.town }), 'riding');
    // A full hall is sometimes a story in the weekend paper.
    withRng(state, (rng) => {
      if (rng.chance(tuning().media.townHallPress)) headline(state, rng, 'townHall', { bill: billName(v.billId && state.bills[v.billId]) });
    });
    v.phase = 'choose';
  }
  return { crowd: th.crowd };
}

export function announceProject(state) {
  const p = state.player;
  if (!p.pendingProject || !state.ridingVisit) return null;
  p.pendingProject = false;
  p.ridingStanding = clamp(p.ridingStanding + tuning().player.ridingProjectStanding, 0, 100);
  log(state, say('log.riding.project', { town: state.ridingVisit.town }), 'riding');
  state.ridingVisit.announced = true;
  return {};
}

export function endVisit(state) {
  const v = state.ridingVisit;
  if (!v) return;
  const p = state.player;
  const d = p.ridingStanding - v.startStanding;
  log(state, say('log.riding.day', { riding: state.mps[p.mpId].riding.name, d: d >= 0 ? `+${d}` : d }), 'riding');
  p.lastRidingWeek = state.date.absWeek;
  state.ridingVisit = null;
}

// Leaving Ostrava while the House sits needs the whip's sign-off.
function leaveGranted(state, rng) {
  const p = state.player;
  if (p.leaveGranted || state.date.absWeek === 0) return true;
  const whip = state.parties[state.mps[p.mpId].party]?.chiefWhip;
  const rapport = whip ? state.mps[whip].rapport : 0;
  return rapport >= -15 && rng.chance(0.55 + rapport / 200);
}

// Fridays (and constituency weeks): go home if the whip lets you. The visit stops the player in the
// first week, when standing is low, in constituency weeks, or every few weeks; otherwise it's routine.
hooks.riding.push((state, rng) => {
  const p = state.player;
  const sitting = isSittingWeek(state);
  if (!sitting && state.date.dayOfWeek !== 1) return null;
  if (sitting && state.date.dayOfWeek !== tuning().calendar.ridingDay) return null;
  if (sitting && !leaveGranted(state, rng)) {
    log(state, say('log.riding.kept'), 'riding');
    p.ridingStanding = clamp(p.ridingStanding - 1, 0, 100);
    return null;
  }
  p.leaveGranted = false;
  const crisis = p.ridingStanding < 38 && p.pacing.stopFor.includes('ridingCrisis');
  const due = state.date.absWeek - (p.lastRidingWeek ?? -99) >= 4;
  if (state.date.absWeek === 0 || !sitting || crisis || due) {
    startVisit(state, rng);
    return { kind: 'riding', important: true, needsChoice: true };
  }
  p.ridingStanding = clamp(p.ridingStanding + 1, 0, 100);
  log(state, say('log.riding.friday', { riding: state.mps[p.mpId].riding.name }), 'riding');
  return null;
});

// Weekly: the riding association watches your standing, and too many votes against home add up.
hooks.weekend.push((state) => {
  const p = state.player;
  // A big case you carried and never raised: whoever brought it starts ringing, once.
  const T = tuning().player;
  const weightOf = (c) => data().constituents.cases.find((x) => x.id === c.caseId)?.weight || 0;
  for (const c of state.ridingCases || []) {
    if (!c.carried || c.resolved || c.raised || c.stale || state.date.absWeek - c.week < T.staleCaseWeeks) continue;
    if (weightOf(c) < T.staleCaseMinWeight) continue;
    c.stale = true;
    p.ridingStanding = clamp(p.ridingStanding - T.staleCaseCost, 0, 100);
    const line = data().constituents.callbacks?.[c.from];
    if (line) log(state, fillRiding(state, line.replace('{what}', c.what)), 'riding');
  }
  if (p.ridingStanding < 35) p.nominationThreat = clamp(p.nominationThreat + 5, 0, 100);
  else if (p.ridingStanding > 55) p.nominationThreat = clamp(p.nominationThreat - 3, 0, 100);
});

resolvers.riding = (state) => endVisit(state);

function act(state, fn) {
  return withRng(state, (rng) => fn(rng));
}

registerActions({
  ridingCase: (state, a) => answerCase(state, a.mode || (a.carry ? 'carry' : 'decline')),
  ridingReporter: (state, a) => answerReporter(state, a.index),
  ridingPresident: (state, a = {}) => answerPresident(state, a.index ?? 0),
  ridingTownHall: (state) => act(state, (rng) => startTownHall(state, rng)),
  ridingAnswer: (state, a) => answerTownHall(state, a.index),
  ridingAnnounce: (state) => announceProject(state),
});
