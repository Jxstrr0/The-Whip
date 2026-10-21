// The riding: Friday leave from the whip, constituents with cases, the local reporter, the riding
// association president, town halls, announcements, riding standing and the nomination.
import { data, tuning } from './config.js';
import { withRng } from './rng.js';
import { registerActions } from './actions.js';
import { hooks, resolvers, log, isSittingWeek } from './pacing.js';
import { adjustRapport } from './relationships.js';
import { dilemmaFor } from './career.js';
import { baseScore } from './mp.js';
import { headline } from './media.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => (m ? `${m.name.first} ${m.name.last}` : '');

export function ridingVars(state) {
  const me = state.mps[state.player.mpId];
  const party = state.parties[me.party];
  const r = state.ridings[me.riding.id];
  const v = state.ridingVisit;
  const bill = v?.billId ? state.bills[v.billId]?.title : 'the bill';
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
  const vars = ridingVars(state);
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// The bill people at home are talking about: your dilemma, or the week's most visible vote.
function talkedAbout(state) {
  if (state.player.forceDilemma && state.bills[state.player.forceDilemma]) return state.player.forceDilemma;
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
  const presMood = p.nominationThreat > 40 || p.ridingStanding < 35 ? 'angry' : p.ridingStanding < 48 ? 'anxious' : p.ridingStanding > 62 ? 'cooperative' : 'guarded';
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

export function answerCase(state, carry) {
  const v = state.ridingVisit;
  const item = v?.queue[v.at];
  if (!item || item.kind !== 'case') return null;
  const c = data().constituents.cases.find((x) => x.id === item.id);
  const p = state.player;
  if (carry) {
    state.ridingCases.push({ id: `rc${state.ridingCases.length + 1}`, caseId: c.id, from: c.role, what: fillRiding(state, c.what), interest: c.interest, carried: true, week: state.date.absWeek, resolved: false });
    p.ridingStanding = clamp(p.ridingStanding + c.weight, 0, 100);
  } else p.ridingStanding = clamp(p.ridingStanding - Math.max(0, c.weight - 1), 0, 100);
  v.results.push({ kind: 'case', id: c.id, carry });
  next(v);
  return { carry };
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
  log(state, `The ${fillRiding(state, '{town}')} paper quotes you: “${fillRiding(state, opt.text)}”`, 'riding');
  v.results.push({ kind: 'reporter', stance: opt.stance });
  next(v);
  return { stance: opt.stance };
}

export function nodPresident(state) {
  const v = state.ridingVisit;
  if (v?.queue[v.at]?.kind !== 'president') return null;
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
    log(state, `Town hall in ${v.town}: the crowd ended ${th.crowd >= 60 ? 'on your side' : th.crowd <= 40 ? 'against you' : 'unconvinced'}.`, 'riding');
    // A full hall is sometimes a story in the weekend paper.
    withRng(state, (rng) => {
      if (rng.chance(tuning().media.townHallPress)) headline(state, rng, 'townHall', { bill: v.billId ? state.bills[v.billId]?.title || 'the bill' : 'the bill' });
    });
    v.phase = 'choose';
  }
  return { crowd: th.crowd };
}

export function announceProject(state) {
  const p = state.player;
  if (!p.pendingProject || !state.ridingVisit) return null;
  p.pendingProject = false;
  p.ridingStanding = clamp(p.ridingStanding + 6, 0, 100);
  log(state, `You announce new funding for ${state.ridingVisit.town}. The local paper puts it on the front page.`, 'riding');
  state.ridingVisit.announced = true;
  return {};
}

export function endVisit(state) {
  const v = state.ridingVisit;
  if (!v) return;
  const p = state.player;
  const d = p.ridingStanding - v.startStanding;
  log(state, `A day in ${state.mps[p.mpId].riding.name}: riding standing ${d >= 0 ? '+' : ''}${d}.`, 'riding');
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
    log(state, "The whip's office wants you in Ostrava this Friday. The riding will have to wait.", 'riding');
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
  log(state, `Friday in ${state.mps[p.mpId].riding.name}: coffee, two handshakes and a ribbon cutting.`, 'riding');
  return null;
});

// Weekly: the riding association watches your standing, and too many votes against home add up.
hooks.weekend.push((state) => {
  const p = state.player;
  if (p.ridingStanding < 35) p.nominationThreat = clamp(p.nominationThreat + 5, 0, 100);
  else if (p.ridingStanding > 55) p.nominationThreat = clamp(p.nominationThreat - 3, 0, 100);
});

resolvers.riding = (state) => endVisit(state);

function act(state, fn) {
  return withRng(state, (rng) => fn(rng));
}

registerActions({
  ridingCase: (state, a) => answerCase(state, !!a.carry),
  ridingReporter: (state, a) => answerReporter(state, a.index),
  ridingPresident: (state) => nodPresident(state),
  ridingTownHall: (state) => act(state, (rng) => startTownHall(state, rng)),
  ridingAnswer: (state, a) => answerTownHall(state, a.index),
  ridingAnnounce: (state) => announceProject(state),
});
