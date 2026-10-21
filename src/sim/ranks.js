// Acts 3 to 5: the row you answer for, leaning on a friend, the deputy's count and the pair before a
// confidence vote, the temptation, the chief whip's chair, setting the line with the leader, cabinet offers,
// and the fall. Graduation and failure are both reachable at every rank.
import { data, tuning } from './config.js';
import { hooks, log, resolvers, queueStop } from './pacing.js';
import { baseScore } from './mp.js';
import { lineFor } from './bills.js';
import { voteOf } from './vote.js';
import { adjustRapport, addStyle, reputation } from './relationships.js';
import { revealMany } from './knowledge.js';
import { buildSeats } from '../chamber/layout.js';
import { dilemmaFor } from './career.js';
import { prediction } from './count.js';
import { nextVote, likelyAbsentees } from './tools.js';
import { endCareer } from './record.js';

const SIGN = { yea: 1, nay: -1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
const me = (state) => state.mps[state.player.mpId];
const partyOf = (state) => state.parties[me(state).party];
const leaderName = (state) => (partyOf(state)?.leader ? fullName(state.mps[partyOf(state).leader]) : 'The leader');
const SEATS = new Map(buildSeats().map((s) => [s.seatId, s]));

// Your row: the members of your party seated in your row on your side, your friends among them.
export function rowOf(state) {
  const m = me(state);
  const mine = SEATS.get(m.seatId);
  const party = Object.values(state.mps).filter((x) => x.party === m.party && x.id !== m.id && x.caucusRole !== 'speaker');
  if (mine) {
    const row = party.filter((x) => { const s = SEATS.get(x.seatId); return s && s.side === mine.side && s.row === mine.row; });
    if (row.length >= 5) return row.slice(0, 15);
  }
  return party.sort((a, b) => Number(a.seatId?.slice(1) || 0) - Number(b.seatId?.slice(1) || 0)).slice(0, 15);
}

function setRank(state, act, role, stopEvent, text) {
  const p = state.player;
  const m = me(state);
  const party = partyOf(state);
  p.highestAct = Math.max(p.highestAct || 1, act);
  if (['assistantWhip', 'deputyWhip', 'chiefWhip'].includes(role)) p.highestRole = role;
  p.act = act;
  p.actStart = state.date.absWeek;
  party.assistantWhips = party.assistantWhips.filter((id) => id !== m.id);
  if (party.deputyWhip === m.id) party.deputyWhip = null;
  if (party.chiefWhip === m.id) party.chiefWhip = null;
  if (role === 'assistantWhip') party.assistantWhips.push(m.id);
  if (role === 'deputyWhip') {
    const old = party.deputyWhip;
    if (old && state.mps[old]) { state.mps[old].caucusRole = 'assistantWhip'; party.assistantWhips.push(old); }
    party.deputyWhip = m.id;
  }
  if (role === 'chiefWhip') {
    const old = party.chiefWhip;
    if (old && state.mps[old]) state.mps[old].caucusRole = 'cabinet';
    party.chiefWhip = m.id;
    if (party.deputyWhip === m.id) party.deputyWhip = null;
  }
  m.caucusRole = role;
  p.slots = tuning().meetings.slotsByAct?.[act] ?? p.slots;
  return { kind: 'career', event: stopEvent, important: true, needsChoice: true, text };
}

// Act 3 opens the whip's office files on your own caucus: the single biggest jump in what you know.
export function shareFiles(state) {
  const party = me(state).party;
  for (const m of Object.values(state.mps)) if (m.party === party && m.id !== state.player.mpId) revealMany(state, m.id, ['loyalty', 'attendance', 'clique', 'ideology', 'interests'], 'office');
}

// ---------- the row (Act 3) ----------

// After each division: did the row hold? A carry when someone was at risk counts; a rebellion on a vote
// that mattered is a failure. The deputy whip grades you on it.
hooks.fallout.push((state) => {
  const p = state.player;
  if (p.act !== 3) return null;
  const m = me(state);
  for (const id of state.flow.day?.results || []) {
    const d = state.divisions[id];
    if (!d || !d.recorded) continue;
    const bill = state.bills[d.billId];
    const { line, position } = lineFor(bill, m.party);
    if (line !== 'whipped' || !SIGN[position]) continue;
    let rebels = 0;
    let atRisk = 0;
    for (const r of rowOf(state)) {
      const v = voteOf(d, r.id);
      if (v === 'yea' || v === 'nay') {
        if (v !== position) rebels++;
        else if (SIGN[position] * baseScore(state, r, bill).score < 0) atRisk++;
      }
    }
    p.rowStats ||= { carried: 0, rebels: 0, failures: 0 };
    if (!rebels && atRisk) { p.actProgress.rowVotesCarried++; p.rowStats.carried++; }
    p.rowStats.rebels += rebels;
    const mattered = bill.confidence || Math.abs(d.yeas.length - d.nays.length) <= tuning().pacing.closeVoteMargin;
    if (rebels >= tuning().ranks.rowRebelsForFailure && mattered) p.rowStats.failures++;
  }
  return null;
});

// The set piece: a friend in your row whose riding hates the week's whipped bill.
hooks.morning.push((state) => {
  const p = state.player;
  if (p.act !== 3 || state.date.dayOfWeek !== 1) return null;
  const bill = nextVote(state);
  if (!bill) return null;
  const m = me(state);
  const { line, position } = lineFor(bill, m.party);
  if (line !== 'whipped' || !SIGN[position] || p.leanedOn?.includes(bill.id)) return null;
  const friend = rowOf(state).find((r) => (r.cohort === m.cohort || (r.relations[m.id] || 0) > 30 || r.rapport > 25) && -(bill.ridingEffects[r.riding.type] || 0) * SIGN[position] > 0.4);
  if (!friend) return null;
  p.leanedOn = [...(p.leanedOn || []), bill.id];
  const L = data().career.leanOnFriend;
  return { kind: 'career', event: 'leanOnFriend', important: true, needsChoice: true, mpId: friend.id, billId: bill.id, text: fill(L.intro, { name: fullName(friend), bill: bill.title, position: position.toUpperCase() }), options: [{ id: 'gentle', label: L.gentle, note: L.gentleNote, enabled: true }, { id: 'hard', label: L.hard, note: L.hardNote, enabled: true }, { id: 'go', label: L.go, note: L.goNote, enabled: true }] };
});

function leanOn(state, p, choice) {
  const R = tuning().ranks;
  const bill = state.bills[p.billId];
  const m = state.mps[p.mpId];
  const s = SIGN[lineFor(bill, me(state).party).position];
  state.nudges ||= {};
  state.nudges[m.id] ||= {};
  if (choice === 'hard') {
    state.nudges[m.id][bill.id] = (state.nudges[m.id][bill.id] || 0) + s * R.leanHardNudge;
    adjustRapport(state, m.id, R.leanHardRapport);
    addStyle(state, 'enforcer', 2);
    log(state, `You leaned on ${fullName(m)}. They'll vote the line on ${bill.title}, and they won't forget how you asked.`, 'career');
  } else if (choice === 'gentle') {
    state.nudges[m.id][bill.id] = (state.nudges[m.id][bill.id] || 0) + s * R.leanGentleNudge;
    adjustRapport(state, m.id, R.leanGentleRapport);
    addStyle(state, 'fixer', 2);
    log(state, `You asked ${fullName(m)} as a friend. They said they'd think about it.`, 'career');
  } else {
    addStyle(state, 'conscience', 2);
    log(state, `You let ${fullName(m)} vote their riding on ${bill.title}. The deputy whip will see the gap.`, 'career');
  }
}

// ---------- the deputy (Act 4) ----------

// Each Monday the deputy says whether the week's vote is safe; the record holds you to it.
hooks.morning.push((state) => {
  const p = state.player;
  if (p.act < 4 || state.date.dayOfWeek !== 1) return null;
  const bill = nextVote(state);
  if (!bill) return null;
  p.predicted ||= {};
  p.predicted[bill.id] = prediction(state, bill.id).short;
  return null;
});

hooks.fallout.push((state) => {
  const p = state.player;
  if (p.act !== 4) return null;
  const m = me(state);
  for (const id of state.flow.day?.results || []) {
    const d = state.divisions[id];
    if (!d || !d.recorded) continue;
    const bill = state.bills[d.billId];
    const pos = lineFor(bill, m.party).position;
    const lost = (pos === 'yea') !== d.carried && SIGN[pos];
    if (lost && (bill.confidence || bill.kind === 'government') && p.predicted?.[bill.id] === 0) {
      p.wrongCounts = (p.wrongCounts || 0) + 1;
      log(state, `You had ${bill.title} down as safe. It wasn't.`, 'career');
    }
  }
  return null;
});

// The pair before a confidence vote: the opposite number offers; you find out whether it holds at the bells.
hooks.morning.push((state) => {
  const p = state.player;
  if (p.act < 4 || state.date.dayOfWeek !== 1) return null;
  const bill = nextVote(state);
  if (!bill || !bill.confidence || p.pairOffered?.includes(bill.id)) return null;
  const absent = likelyAbsentees(state, bill.id).find((a) => !state.pairs.some((x) => !x.broken && (x.a === a.id || x.b === a.id)));
  const opp = Object.values(state.parties).filter((q) => q.id !== me(state).party && q.chiefWhip).sort((a, b) => b.seats - a.seats)[0];
  if (!absent || !opp) return null;
  p.pairOffered = [...(p.pairOffered || []), bill.id];
  const C = data().career.confidencePair;
  const ctx = { bill: bill.title, absent: fullName(absent), opposite: fullName(state.mps[opp.deputyWhip || opp.chiefWhip]), party: opp.name };
  return { kind: 'career', event: 'confidencePair', important: true, needsChoice: true, mpId: absent.id, billId: bill.id, party: opp.id, text: fill(C.intro, ctx), options: [{ id: 'accept', label: C.accept, note: C.acceptNote, enabled: true }, { id: 'decline', label: C.decline, note: fill(C.declineNote, ctx), enabled: true }] };
});

function confidencePair(state, p, choice) {
  if (choice !== 'accept') { log(state, 'You turned the pair down. You’ll get them into the chamber yourself.', 'career'); return; }
  const opp = state.parties[p.party];
  const theirs = Object.values(state.mps).filter((m) => m.party === opp.id && m.caucusRole !== 'speaker').sort((a, b) => a.attendance - b.attendance)[0];
  if (!theirs) return;
  state.pairs.push({ bill: p.billId, a: p.mpId, b: theirs.id, by: 'player', party: opp.id, week: state.date.absWeek, tested: false, broken: false });
  log(state, `Paired ${fullName(state.mps[p.mpId])} with ${fullName(theirs)} (${opp.short}) for the confidence vote. Now you wait for the bells.`, 'career');
}

// ---------- weekends: graduation, failure, offers ----------

function act3Weekend(state) {
  const R = tuning().ranks;
  const p = state.player;
  const weeks = state.date.absWeek - (p.actStart ?? 0);
  if ((p.rowStats?.failures || 0) >= 1 && weeks >= 2) {
    const rep = reputation(p);
    const soft = rep === 'fixer' || rep === 'conscience' || rep === 'loyalist';
    p.reputation = soft ? 'soft' : 'bully';
    p.rowStats = null;
    return setRank(state, 2, 'backbencher', 'demoted', data().career.demoted[soft ? 'soft' : 'bully']);
  }
  if (p.actProgress.rowVotesCarried >= R.rowCarriesForAct4 && weeks >= R.act3MinWeeks) {
    log(state, 'The deputy whip put your name forward. You run the count now.', 'career');
    return setRank(state, 4, 'deputyWhip', 'act4', data().career.act4);
  }
  return null;
}

function act4Weekend(state, rng) {
  const R = tuning().ranks;
  const p = state.player;
  const weeks = state.date.absWeek - (p.actStart ?? 0);
  if ((p.wrongCounts || 0) >= R.wrongCountsForFailure) {
    p.wrongCounts = 0;
    return setRank(state, 3, 'assistantWhip', 'demoted', data().career.demoted.wrongCount);
  }
  if (!p.tempted && weeks >= R.temptationWeek) {
    p.tempted = true;
    const T = data().career.temptation;
    return { kind: 'career', event: 'temptation', important: true, needsChoice: true, text: fill(T.intro, { leader: leaderName(state) }), options: [{ id: 'accept', label: T.accept, note: T.acceptNote, enabled: true }, { id: 'decline', label: T.decline, note: T.declineNote, enabled: true }] };
  }
  if (weeks >= R.act4MinWeeks && (p.forceChiefVacancy || rng.chance(R.chiefVacancyOdds))) {
    p.forceChiefVacancy = false;
    const party = partyOf(state);
    const chief = party.chiefWhip ? state.mps[party.chiefWhip] : null;
    const V = data().career.chiefVacancy;
    const ok = p.caucusSupport >= R.caucusSupportForChief || p.leaderTrust >= R.leaderTrustForChief;
    const ctx = { chief: chief ? fullName(chief) : 'The Chief Whip', leader: leaderName(state) };
    if (ok) {
      const support = p.caucusSupport >= R.caucusSupportForChief ? 'The caucus wanted you.' : 'The caucus had other ideas; the leader overruled them, and will pay for it.';
      if (p.caucusSupport < R.caucusSupportForChief) p.leaderTrust = clamp(p.leaderTrust - 5, 0, 100);
      log(state, `${ctx.chief} is going to cabinet. ${ctx.leader} appointed you Chief Whip.`, 'career');
      return setRank(state, 5, 'chiefWhip', 'act5', fill(V.intro, ctx) + ' ' + fill(V.appointed, { ...ctx, support }) + ' ' + data().career.act5);
    }
    const other = party.assistantWhips[0] ? state.mps[party.assistantWhips[0]] : null;
    if (chief) chief.caucusRole = 'cabinet';
    if (other) { other.caucusRole = 'chiefWhip'; party.chiefWhip = other.id; party.assistantWhips = party.assistantWhips.filter((id) => id !== other.id); }
    log(state, `${ctx.chief} went to cabinet and ${other ? fullName(other) : 'someone else'} got the chair.`, 'career');
    return { kind: 'career', event: 'chiefVacancy', important: true, needsChoice: true, text: fill(V.intro, ctx) + ' ' + fill(V.kept, { ...ctx, other: other ? fullName(other) : 'someone else' }) };
  }
  return null;
}

export function cabinetOffer(state) {
  const C = data().career.cabinetOffer;
  const portfolios = ['Rural Affairs', 'Fisheries and Coasts', 'Heritage', 'Small Business', 'Veterans', 'Public Works'];
  const portfolio = portfolios[(state.player.cabinetOffers || 0) % portfolios.length];
  return { kind: 'career', event: 'cabinetOffer', important: true, needsChoice: true, portfolio, text: fill(C.intro, { leader: leaderName(state), portfolio }), options: [{ id: 'accept', label: C.accept, note: C.acceptNote, enabled: true }, { id: 'decline', label: C.decline, note: C.declineNote, enabled: true }] };
}

hooks.weekend.push((state, rng) => {
  const R = tuning().ranks;
  const p = state.player;
  if (state.ending) return null;
  if (p.act === 3) {
    const r = act3Weekend(state);
    if (r) return r;
  }
  if (p.act === 4) {
    const r = act4Weekend(state, rng);
    if (r) return r;
  }
  if (p.act >= R.cabinetOfferFromAct && (p.forceCabinetOffer || rng.chance(R.cabinetOfferOdds * (0.3 + p.leaderTrust / 100)))) {
    p.forceCabinetOffer = false;
    return cabinetOffer(state);
  }
  return null;
});

// Act 3 begins with the files. (The vacancy win in career.js sets the rank; this notices the act change.)
hooks.morning.push((state) => {
  const p = state.player;
  if (p.act >= 3 && !p.filesShared) {
    p.filesShared = true;
    shareFiles(state);
    log(state, "The whip's office opened its files to you. You know your caucus now.", 'career');
  }
  return null;
});

// ---------- the Chief Whip (Act 5) ----------

// Monday: set the line on the week's question with the leader.
hooks.morning.push((state) => {
  const p = state.player;
  if (p.act !== 5 || state.date.dayOfWeek !== 1) return null;
  const bill = nextVote(state);
  if (!bill || bill.sponsor === p.mpId || p.linesSet?.includes(bill.id)) return null;
  const m = me(state);
  const { position } = lineFor(bill, m.party);
  if (!SIGN[position]) return null;
  p.linesSet = [...(p.linesSet || []), bill.id].slice(-20);
  const S = data().career.setLine;
  const gov = state.house.government === m.party && bill.kind === 'government' && !bill.confidence;
  return { kind: 'career', event: 'setLine', important: true, needsChoice: true, billId: bill.id, text: fill(S.intro, { bill: bill.title, leader: leaderName(state) }), options: [{ id: 'whip', label: fill(S.whip, { position: position.toUpperCase() }), note: S.whipNote, enabled: true }, { id: 'free', label: S.free, note: S.freeNote, enabled: true }, { id: 'confidence', label: S.confidence, note: S.confidenceNote, enabled: gov }] };
});

function setLine(state, p, choice) {
  const R = tuning().ranks;
  const bill = state.bills[p.billId];
  const m = me(state);
  const party = partyOf(state);
  if (choice === 'free') {
    bill.lines[m.party] = 'free';
    for (const x of Object.values(state.mps)) if (x.party === m.party) x.loyalty = clamp(x.loyalty + 1, 0, 100);
    state.player.leaderTrust = clamp(state.player.leaderTrust + (R.freeVoteTrust[party.leaderPersonality] ?? -3), 0, 100);
    log(state, `A free vote on ${bill.title}.`, 'career');
  } else if (choice === 'confidence' && p.options.find((o) => o.id === 'confidence')?.enabled) {
    bill.confidence = true;
    bill.lines[m.party] = 'whipped';
    state.player.leaderTrust = clamp(state.player.leaderTrust + R.confidenceTrust, 0, 100);
    log(state, `${bill.title} is a matter of confidence. Everyone comes home for it.`, 'career');
  } else {
    bill.lines[m.party] = 'whipped';
    log(state, `${bill.title} is whipped ${lineFor(bill, m.party).position.toUpperCase()}.`, 'career');
  }
}

// The fall: the government loses confidence on your count.
hooks.fallout.push((state) => {
  const p = state.player;
  if (p.act !== 5 || !state.house.fallen || p.fallen || state.house.government !== me(state).party) return null;
  p.fallen = true;
  const F = data().career.fall;
  const d = (state.flow.day?.results || []).map((id) => state.divisions[id]).find((x) => x && state.bills[x.billId]?.confidence);
  return { kind: 'career', event: 'fall', important: true, needsChoice: true, text: fill(F.intro, { bill: d ? state.bills[d.billId].title : 'the confidence vote', leader: leaderName(state) }), options: [{ id: 'stay', label: F.stay, note: F.stayNote, enabled: true }, { id: 'retire', label: F.retire, note: F.retireNote, enabled: true }] };
});

export function demoteToBackbench(state, reputationLabel = null) {
  const p = state.player;
  if (reputationLabel) p.reputation = reputationLabel;
  return setRank(state, 2, 'backbencher', 'demoted', '');
}

const prevExtra = resolvers.careerExtra;
resolvers.careerExtra = (state, p, choice) => {
  const R = tuning().ranks;
  if (p.event === 'leanOnFriend') return leanOn(state, p, choice || 'gentle');
  if (p.event === 'confidencePair') return confidencePair(state, p, choice || 'accept');
  if (p.event === 'temptation') {
    if (choice === 'accept') return endCareer(state, 'exit');
    state.player.leaderTrust = clamp(state.player.leaderTrust + R.temptationTrust, 0, 100);
    log(state, 'You told the leader no. They said they understood.', 'career');
    return;
  }
  if (p.event === 'cabinetOffer') {
    if (choice === 'accept') return endCareer(state, 'cabinet', { portfolio: p.portfolio });
    state.player.cabinetOffers = (state.player.cabinetOffers || 0) + 1;
    log(state, `You declined cabinet. ${leaderName(state)} said the offer stands.`, 'career');
    return;
  }
  if (p.event === 'setLine') return setLine(state, p, choice || 'whip');
  if (p.event === 'fall' || p.event === 'revolted') {
    if (choice === 'retire') return endCareer(state, p.event === 'fall' ? 'fall' : 'revolt');
    demoteToBackbench(state, p.event === 'fall' ? 'fallen' : 'overthrown');
    return;
  }
  prevExtra?.(state, p, choice);
};
