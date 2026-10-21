// Elections: the writ drops (a fixed date, or a fallen government), the campaign, and election night. National
// polling sets seat totals; each riding is decided by its member's margin, standing and scandal. The House is
// rebuilt around the survivors: new cohort, roles and cliques reassigned, the ledger carried over. A fallen
// government early in a Parliament may hand over instead, with no election.
import { data, tuning } from './config.js';
import { log, resolvers, queueStop, initFlow, dissolution } from './pacing.js';
import { withRng } from './rng.js';
import { makeMp, assignRoles, assignCommittees, uniqueNames, affinity } from './generate.js';
import { buildCliques, buildRelations, assignMentors } from './relationships.js';
import { reseat } from './modes.js';
import { endCareer } from './record.js';
import { headline } from './media.js';
import { remember, ordinal } from './memoir.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
const pad = (n) => String(n).padStart(3, '0');

// Seats by polling share with largest remainders, over the seats independents don't hold.
function seatTargets(state, rng, contested) {
  const E = tuning().election;
  const parties = Object.values(state.parties).filter((p) => p.id !== 'ind');
  const poll = {};
  for (const p of parties) poll[p.id] = Math.max(0.5, (state.polling[p.id] || 0) + rng.normal(0, E.pollNoiseSd));
  const sum = Object.values(poll).reduce((s, v) => s + v, 0);
  const exact = parties.map((p) => [p.id, (poll[p.id] / sum) * contested]);
  const out = Object.fromEntries(exact.map(([id, v]) => [id, Math.floor(v)]));
  let left = contested - Object.values(out).reduce((s, v) => s + v, 0);
  for (const [id] of exact.slice().sort((a, b) => b[1] % 1 - (a[1] % 1))) if (left-- > 0) out[id]++;
  return out;
}

// Each member's chance of holding: margin, the party's swing, standing at home for the player, scandal.
function holdScore(state, rng, m, swing) {
  const E = tuning().election;
  const p = state.player;
  let s = m.margin + (swing[m.party] || 0) * E.swingWeight - (m.scandal || 0) * E.scandalWeight + rng.normal(0, E.noiseSd);
  if (m.id === p.mpId) s += (p.ridingStanding - 55) * E.standingWeight;
  return s;
}

function rerole(state, rng, keep) {
  for (const p of Object.values(state.parties)) {
    const members = Object.values(state.mps).filter((m) => m.party === p.id);
    const kept = members.filter((m) => keep.has(m.id));
    for (const m of members) if (!keep.has(m.id)) m.caucusRole = 'backbencher';
    const oldLeader = p.leader && state.mps[p.leader]?.party === p.id ? p.leader : null;
    assignRoles(rng, p, members.filter((m) => !keep.has(m.id) && m.id !== oldLeader), p.role === 'government');
    if (oldLeader) {
      if (p.leader && p.leader !== oldLeader && state.mps[p.leader]) state.mps[p.leader].caucusRole = 'backbencher';
      p.leader = oldLeader;
      state.mps[oldLeader].caucusRole = 'leader';
    }
    // The player keeps the rank they held; whoever was given it steps aside.
    for (const m of kept) {
      const role = m.caucusRole;
      if (role === 'chiefWhip') { if (p.chiefWhip && p.chiefWhip !== m.id) state.mps[p.chiefWhip].caucusRole = 'backbencher'; p.chiefWhip = m.id; }
      if (role === 'deputyWhip') { if (p.deputyWhip && p.deputyWhip !== m.id) state.mps[p.deputyWhip].caucusRole = 'backbencher'; p.deputyWhip = m.id; }
      if (role === 'assistantWhip' && !p.assistantWhips.includes(m.id)) p.assistantWhips.push(m.id);
    }
  }
}

function pickSpeaker(state) {
  const gov = state.house.government;
  const list = Object.values(state.mps).filter((m) => m.party === gov && m.caucusRole === 'backbencher' && m.id !== state.player.mpId);
  const speaker = (list.filter((m) => m.tenure >= 4).length ? list.filter((m) => m.tenure >= 4) : list).sort((a, b) => b.tenure - a.tenure)[0];
  if (speaker) speaker.caucusRole = 'speaker';
  state.house.speaker = speaker?.id || null;
}

function rebuildHouse(state, rng) {
  const list = Object.values(state.mps);
  for (const c of Object.values(state.committees)) { c.members = []; c.chair = null; }
  for (const m of list) { m.committee = null; m.clique = null; }
  for (const p of Object.values(state.parties)) p.cliques = [];
  pickSpeaker(state);
  const chairs = assignCommittees(rng, list.filter((m) => m.id !== state.player.mpId || m.caucusRole === 'backbencher'), Object.values(state.committees), state.house.government);
  for (const c of Object.values(state.committees)) {
    c.members = list.filter((m) => m.committee === c.id).map((m) => m.id);
    c.chair = chairs[c.id] || null;
  }
  state.cliques = buildCliques(rng, state.parties, state.mps, state.ridings);
  buildRelations(rng, state.mps);
  assignMentors(rng, state.mps);
  // Polling settles to the result.
  const total = {};
  for (const p of Object.values(state.parties)) total[p.id] = Math.max(1, (p.seats / 120) * 80 + rng.float(2, 8));
  const sum = Object.values(total).reduce((s, v) => s + v, 0);
  state.polling = Object.fromEntries(Object.entries(total).map(([k, v]) => [k, Math.round((v / sum) * 1000) / 10]));
}

function recount(state) {
  for (const p of Object.values(state.parties)) p.seats = Object.values(state.mps).filter((m) => m.party === p.id).length;
  state.house.independents = Object.values(state.mps).filter((m) => m.party === 'ind').length;
  const core = Object.values(state.parties).filter((p) => p.role !== 'regional' && p.role !== 'minor').sort((a, b) => b.seats - a.seats || a.id.localeCompare(b.id));
  core.forEach((p, i) => (p.role = i === 0 ? 'government' : i === 1 ? 'opposition' : 'third'));
  state.house.government = core[0].id;
  state.house.minority = core[0].seats < data().world.majority;
}

// The campaign: what the player did with the five weeks.
function campaign(state, choice) {
  const E = tuning().election.campaign;
  const p = state.player;
  const texts = data().career.campaign;
  if (choice === 'tour') {
    p.ridingStanding = clamp(p.ridingStanding + E.tourStanding, 0, 100);
    p.leaderTrust = clamp(p.leaderTrust + E.tourTrust, 0, 100);
    p.caucusSupport = clamp(p.caucusSupport + E.tourSupport, 0, 100);
    return texts.tour;
  }
  if (choice === 'rest') {
    p.ridingStanding = clamp(p.ridingStanding + E.restStanding, 0, 100);
    return texts.rest;
  }
  p.ridingStanding = clamp(p.ridingStanding + E.canvassStanding, 0, 100);
  return texts.canvass;
}

// Election night. Returns the result stop; the state is already the new Parliament (or the player is out).
export function runElection(state, rng, choice = 'canvass') {
  const E = tuning().election;
  const p = state.player;
  const me = state.mps[p.mpId];
  const campaignText = campaign(state, choice);
  const before = Object.fromEntries(Object.values(state.parties).map((q) => [q.id, q.seats]));
  const oldGov = state.house.government;
  const oldParliament = state.house.parliament;
  const newParliament = oldParliament + 1;
  // The nomination: a riding association that has been muttering can drop you before the writ.
  const deselected = p.nominationThreat >= E.nominationChallengeAt && p.ridingStanding < 45;
  const swing = {};
  for (const q of Object.values(state.parties)) swing[q.id] = (state.polling[q.id] || 0) - (q.seats / 120) * 100;
  const list = Object.values(state.mps);
  const scores = new Map(list.map((m) => [m.id, holdScore(state, rng, m, swing)]));
  // Retirements open ridings; the party's new candidate runs on a thinner margin.
  const retiring = new Set(list.filter((m) => m.id !== p.mpId && m.caucusRole !== 'leader' && m.age >= E.retireAge && rng.chance(E.retireOdds)).map((m) => m.id));
  for (const id of retiring) scores.set(id, scores.get(id) * 0.6);
  if (deselected) scores.set(me.id, -99);
  // Independents hold on their own number; the parties split the rest by polling.
  const indsHeld = list.filter((m) => m.party === 'ind' && scores.get(m.id) > 0);
  const targets = seatTargets(state, rng, 120 - indsHeld.length);
  const held = {};
  for (const q of Object.values(state.parties)) held[q.id] = list.filter((m) => m.party === q.id).length;
  const freed = list.filter((m) => m.party === 'ind' && scores.get(m.id) <= 0).map((m) => m.id);
  for (const q of Object.values(state.parties)) {
    const loss = held[q.id] - targets[q.id];
    if (loss <= 0) continue;
    const weakest = list.filter((m) => m.party === q.id).sort((a, b) => scores.get(a.id) - scores.get(b.id)).slice(0, loss);
    for (const m of weakest) freed.push(m.id);
  }
  const need = {};
  for (const q of Object.values(state.parties)) need[q.id] = Math.max(0, targets[q.id] - held[q.id]);
  // Each freed riding goes to the gaining party that suits it best.
  const winners = {};
  for (const id of freed.sort((a, b) => scores.get(a) - scores.get(b))) {
    const r = state.ridings[state.mps[id].riding.id];
    const gainers = Object.values(state.parties).filter((q) => need[q.id] > 0 && q.id !== state.mps[id].party);
    const q = gainers.sort((a, b) => affinity(b, r, rng) - affinity(a, r, rng))[0] || Object.values(state.parties).filter((x) => x.id !== state.mps[id].party).sort((a, b) => affinity(b, r, rng) - affinity(a, r, rng))[0];
    winners[id] = q.id;
    need[q.id] = Math.max(0, need[q.id] - 1);
  }
  const playerLost = deselected || winners[me.id] != null;
  // Depart: the defeated, the retired. Arrive: new members for every open riding.
  state.alumni ||= {};
  const gone = [];
  const taken = { first: list.map((m) => m.name.first), last: list.map((m) => m.name.last) };
  let nextId = Math.max(...[...list, ...Object.values(state.alumni)].map((m) => Number(m.id.slice(1)))) + 1;
  const openings = [...new Set([...Object.keys(winners), ...retiring])].filter((id) => id !== me.id);
  const names = uniqueNames(rng, openings.length, taken);
  const Y = E.yearsPerParliament;
  const cohortLost = list.filter((m) => m.cohort === me.cohort && m.id !== me.id && winners[m.id] != null).length;
  openings.forEach((id, i) => {
    const old = state.mps[id];
    const party = winners[id] || old.party;
    state.alumni[id] = { id, name: old.name, party: old.party, riding: old.riding, left: retiring.has(id) && !winners[id] ? 'retired' : 'defeated', parliament: oldParliament, cohort: old.cohort, caucusRole: old.caucusRole };
    gone.push(id);
    delete state.mps[id];
    const riding = state.ridings[old.riding.id];
    const m = makeMp(rng, nextId++, riding, party, state.parties[party], names[i], newParliament);
    m.cohort = newParliament;
    m.tenure = 0;
    m.margin = clamp(Math.round(Math.abs(rng.normal(E.newMarginMean, E.newMarginSd)) + 1), 1, 40);
    m.rapport = Math.round(rng.normal(0, 4));
    state.mps[m.id] = m;
  });
  for (const m of Object.values(state.mps)) {
    if (m.cohort === newParliament) continue;
    m.tenure += Y;
    m.age += Y;
    m.margin = clamp(Math.round(scores.get(m.id) ?? m.margin), 1, 40);
    m.proteges = m.proteges.filter((id) => state.mps[id]);
    if (m.mentor && !state.mps[m.mentor]) m.mentor = null;
    m.caucusRole = 'backbencher';
    for (const k of Object.keys(m.relations)) if (!state.mps[k]) delete m.relations[k];
  }
  recount(state);
  const seats = Object.values(state.parties).map((q) => ({ id: q.id, name: q.name, short: q.short, color: q.color, before: before[q.id], after: q.seats }));
  const gov = state.parties[state.house.government];
  const summary = { kind: 'election', phase: 'result', important: true, needsChoice: true, parliament: newParliament, government: gov.id, governmentName: gov.name, minority: state.house.minority, seats, campaignText, cohortLost, newcomers: openings.length, gone: gone.length, player: { riding: me.riding.name, result: deselected ? 'deselected' : playerLost ? 'lost' : 'held', margin: clamp(Math.abs(Math.round(scores.get(me.id))), 1, 40), standing: p.ridingStanding }, changed: gov.id !== oldGov };
  log(state, `Election night: ${gov.name} ${state.house.minority ? 'forms a minority government' : 'forms the government'} with ${gov.seats} seats.`, 'confidence');
  const govCtx = { gov: gov.name, govKind: state.house.minority ? 'minority' : 'majority' };
  remember(state, 'election', {
    sub: summary.player.result,
    ctx: { nth: ordinal(newParliament), ...govCtx },
    aside: summary.player.result === 'held' ? fill(data().memoir.asides[summary.changed ? 'govChanged' : 'govSame'], govCtx) : '',
  });
  if (playerLost) {
    log(state, deselected ? `The riding association deselected you before the writ.` : `You lost ${me.riding.name}.`, 'career');
    summary.needsChoice = true;
    p.lostSeat = deselected ? 'nomination' : 'defeated';
    return summary;
  }
  // The new Parliament around the survivor.
  const keep = new Set([me.id]);
  me.caucusRole = p.heldRole || me.caucusRole;
  const prevRole = p.heldRole;
  rerole(state, rng, keep);
  if (prevRole) me.caucusRole = prevRole;
  if (me.caucusRole === 'backbencher') {
    const q = state.parties[me.party];
    if (p.act === 5) { if (q.chiefWhip && state.mps[q.chiefWhip]) state.mps[q.chiefWhip].caucusRole = 'backbencher'; q.chiefWhip = me.id; me.caucusRole = 'chiefWhip'; }
    else if (p.act === 4) { if (q.deputyWhip && state.mps[q.deputyWhip]) state.mps[q.deputyWhip].caucusRole = 'backbencher'; q.deputyWhip = me.id; me.caucusRole = 'deputyWhip'; }
    else if (p.act === 3) { q.assistantWhips.push(me.id); me.caucusRole = 'assistantWhip'; }
  }
  rebuildHouse(state, rng);
  openParliament(state, newParliament);
  p.record.parliaments++;
  p.ridingStanding = clamp(Math.round((p.ridingBase ?? 55) + (p.ridingStanding - (p.ridingBase ?? 55)) / 2), 0, 100);
  p.nominationThreat = 0;
  me.margin = summary.player.margin;
  headline(state, rng, 'billPassed', { bill: `${gov.name} ${state.house.minority ? 'minority' : 'majority'}`, yeas: gov.seats, nays: 120 - gov.seats });
  return summary;
}

// Everything per-Parliament starts again; the ledger and the people carry over.
function openParliament(state, parliamentNo) {
  const p = state.player;
  Object.assign(state, { bills: {}, orderPaper: [], divisions: {}, pairs: [], countBoard: {}, meetings: {}, ridingCases: [], caucus: null, nudges: {}, leverage: {}, leaves: {}, chased: {}, evening: null, meeting: null, visit: null });
  for (const q of Object.values(state.parties)) q.agreements = [];
  state.house.fallen = null;
  state.house.parliament = parliamentNo;
  state.date = { parliament: parliamentNo, year: 1, week: 1, dayOfWeek: 1, phase: 'morning', constituencyWeek: false, absWeek: 0 };
  state.pressure = Math.round((state.pressure || 0) / 2);
  Object.assign(p, { actStart: 0, rowStats: null, predicted: {}, linesSet: [], leanedOn: [], pairOffered: [], pmb: null, lottery: null, heldRole: null });
  if (p.rival && !state.mps[p.rival]) p.rival = null;
  if (p.mentor && !state.mps[p.mentor]) p.mentor = null;
  reseat(state);
  initFlow(state);
  log(state, `The ${parliamentNo}th Parliament opens.`, 'confidence');
}

// A government that falls early in a Parliament can be replaced without an election, if the rest of the House
// can carry a majority against it.
// A government that falls in its first months hands over to the opposition, if the rest of the House could
// carry one, instead of sending the country back to the polls. Pure, so the press can call it on the night.
export function canHandOver(state) {
  const C = tuning().confidence;
  if (state.date.absWeek >= C.handoverWeeks) return false;
  const gov = state.parties[state.house.government];
  const opp = Object.values(state.parties).find((q) => q.role === 'opposition');
  const others = Object.values(state.parties).filter((q) => q.id !== gov.id && q.id !== 'ind').reduce((s, q) => s + q.seats, 0);
  return !!opp && others >= data().world.majority;
}

export function tryHandover(state, rng) {
  if (!state.house.fallen || !canHandOver(state)) return null;
  const gov = state.parties[state.house.government];
  const opp = Object.values(state.parties).find((q) => q.role === 'opposition');
  gov.role = 'opposition';
  opp.role = 'government';
  state.house.government = opp.id;
  state.house.minority = opp.seats < data().world.majority;
  state.house.fallen = null;
  for (const q of Object.values(state.parties)) q.agreements = [];
  const keep = new Set([state.player.mpId]);
  const me = state.mps[state.player.mpId];
  const role = me.caucusRole;
  rerole(state, rng, keep);
  me.caucusRole = role;
  pickSpeaker(state);
  reseat(state);
  for (const b of Object.values(state.bills)) if (b.status === 'active' && b.kind === 'government') b.status = 'dropped';
  state.flow.queue = [];
  log(state, `${gov.name} has lost the confidence of the House. The Governor General has asked ${opp.name} to govern.`, 'confidence');
  headline(state, rng, 'confidenceLost', { yeas: 0, nays: 0, party: gov.name });
  return { kind: 'election', phase: 'handover', important: true, needsChoice: true, from: gov.id, to: opp.id, fromName: gov.name, toName: opp.name };
}

dissolution.canHandOver = canHandOver;
dissolution.beforeDissolve = tryHandover;

// The campaign stop resolves into election night; election night into the new Parliament or the record.
resolvers.dissolved = (state, p, choice) => {
  const me = state.mps[state.player.mpId];
  state.player.heldRole = me.caucusRole === 'speaker' ? 'backbencher' : me.caucusRole;
  queueStop(state, withRng(state, (rng) => runElection(state, rng, choice || 'canvass')));
};

resolvers.election = (state, p) => {
  if (p.phase === 'result' && state.player.lostSeat) {
    const kind = state.player.lostSeat;
    state.player.lostSeat = null;
    endCareer(state, kind);
  }
};

