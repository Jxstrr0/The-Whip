// The caucus meeting: Wednesday morning behind closed doors. The leader sets the week's line, grievances
// get aired, and the player can listen, speak and whisper. (Revolts and expulsion arrive in stage 7.)
import { data, tuning } from './config.js';
import { withRng } from './rng.js';
import { registerActions } from './actions.js';
import { hooks, resolvers, log, isSittingWeek, queueStop } from './pacing.js';
import { revealMany, touch } from './knowledge.js';
import { adjustRapport, addStyle } from './relationships.js';
import { dilemmaFor } from './career.js';
import { baseScore } from './mp.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
const fillText = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);

// Seat the caucus by clique around the table, leader at the head; the player moves up with rank.
export function caucusSeating(state, partyId) {
  const p = state.parties[partyId];
  const members = Object.values(state.mps).filter((m) => m.party === partyId && m.caucusRole !== 'speaker');
  const head = [p.leader, p.chiefWhip, p.houseLeader].filter(Boolean);
  const rank = { cabinet: 1, shadowCabinet: 1, deputyWhip: 2, assistantWhip: 2, parliamentarySecretary: 3, committeeChair: 3 };
  const rest = members
    .filter((m) => !head.includes(m.id))
    .sort((a, b) => String(a.clique).localeCompare(String(b.clique)) || (rank[a.caucusRole] || 9) - (rank[b.caucusRole] || 9) || b.tenure - a.tenure || a.id.localeCompare(b.id));
  return { head, rest: rest.map((m) => m.id) };
}

// The week's key question: the player's dilemma if there is one, else the most visible whipped bill.
function keyBill(state) {
  const me = state.mps[state.player.mpId];
  const week = Object.values(state.bills).filter((b) => b.status === 'active' && b.nextVote != null && Math.floor(b.nextVote / 5) === state.date.absWeek);
  const forced = state.player.forceDilemma && state.bills[state.player.forceDilemma];
  if (forced && forced.status === 'active') return forced;
  return week.find((b) => dilemmaFor(state, b, baseScore, tuning().pacing)) || week.filter((b) => b.lines[me.party] === 'whipped').sort((a, b) => b.visibility - a.visibility)[0] || null;
}

function roomMood(state, partyId, heat) {
  const morale = state.parties[partyId].morale;
  if (morale < 40 || heat >= 6) return 'angry';
  if (morale < 55 || heat >= 3) return 'restless';
  return 'calm';
}

export function startCaucus(state, rng) {
  const C = data().caucus;
  const me = state.mps[state.player.mpId];
  const party = state.parties[me.party];
  if (!party) return null;
  const bill = keyBill(state);
  const leader = state.mps[party.leader];
  const { head, rest } = caucusSeating(state, me.party);
  const fill = (text, extra = {}) =>
    text.replace(/\{(\w+)\}/g, (_, k) => ({ leader: leader ? fullName(leader) : 'The leader', bill: bill?.title || 'this week\'s business', whip: party.chiefWhip ? fullName(state.mps[party.chiefWhip]) : 'the whip', party: party.name, ...extra })[k] ?? `{${k}}`);
  // Grievances come from the unhappiest members: low rapport with the leader or whip, or a riding the bill hurts.
  const sore = rest
    .map((id) => state.mps[id])
    .filter((m) => m.id !== me.id)
    .map((m) => [m, -(m.relations[party.leader] || 0) - (m.relations[party.chiefWhip] || 0) + (bill ? -(bill.ridingEffects[m.riding.type] || 0) * 40 : 0) + rng.float(0, 30)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, rng.int(1, 3));
  const grievances = sore.map(([m]) => {
    const g = rng.pick(C.grievances);
    const other = state.mps[rng.pick(rest.filter((x) => x !== m.id))];
    return { mpId: m.id, heat: g.heat, target: g.target, text: fill(g.text, { name: fullName(m), riding: m.riding.name, other: other ? fullName(other) : 'a colleague' }) };
  });
  const heat = grievances.reduce((s, g) => s + g.heat, 0);
  const mood = roomMood(state, me.party, heat);
  // A hot room can turn: a revolt against the leader, or, if you hold the whip's chair, against you.
  const R = tuning().ranks;
  let revolt = null;
  if (sore.length && (state.forceRevolt || (heat >= R.revoltHeat && rng.chance(R.revoltOdds)))) {
    state.forceRevolt = false;
    const target = state.player.act === 5 && state.player.caucusSupport < 40 ? 'whip' : 'leader';
    const caucus = rest.map((id) => state.mps[id]).filter((m) => m.id !== me.id);
    const against = caucus.filter((m) => (target === 'leader' ? (m.relations[party.leader] || 0) < -10 || m.loyalty < 40 : m.rapport < 0)).length;
    const RV = data().career.revolt;
    revolt = { target, ringleader: sore[0][0].id, support: against, size: caucus.length, text: fill(RV[target], { ringleader: fullName(sore[0][0]) }), choice: null, resolved: false };
  }
  const opening = bill ? fill(rng.pick(C.leaderOpenings[party.leaderPersonality] || C.leaderOpenings.controlling)) : `${leader ? fullName(leader) : 'The leader'} runs through the week's business. Nothing contentious.`;
  state.caucus = {
    week: state.date.absWeek,
    billId: bill?.id || null,
    line: bill ? { line: bill.lines[me.party], position: bill.positions[me.party] } : null,
    opening,
    grievances,
    mood,
    moodText: rng.pick(C.roomMoods[mood]),
    head,
    seats: rest,
    revolt,
    actions: 3,
    // Three things you could say: back the line, speak for the riding, or challenge.
    stanceOptions: ['support', 'riding', 'challenge'].map((k) => rng.pick(C.stances.filter((x) => x.kind === k)).id),
    spoke: null,
    heard: [],
    whispers: [],
  };
  return state.caucus;
}

// The two members either side of the player at the table.
export function neighbours(state) {
  const c = state.caucus;
  const i = c.seats.indexOf(state.player.mpId);
  return [c.seats[i - 2], c.seats[i - 1], c.seats[i + 1], c.seats[i + 2]].filter((id) => id && id !== state.player.mpId);
}

export function caucusListen(state, rng) {
  const c = state.caucus;
  if (!c || c.actions <= 0) return null;
  c.actions--;
  // Listening reads the room: moods around the table and who's talking to whom.
  const sample = rng.shuffle([...c.seats.filter((id) => id !== state.player.mpId)]).slice(0, 6);
  for (const id of sample) revealMany(state, id, ['mood'], 'caucus');
  const pairs = [];
  const pairIds = [];
  for (const id of sample.slice(0, 3)) {
    const m = state.mps[id];
    const friend = Object.entries(m.relations).filter(([oid, v]) => v > 30 && state.mps[oid]?.party === m.party).sort((a, b) => b[1] - a[1])[0];
    if (friend) {
      revealMany(state, id, ['clique'], 'caucus');
      pairs.push(`${fullName(m)} keeps leaning over to ${fullName(state.mps[friend[0]])}.`);
      pairIds.push([id, friend[0]]);
    }
  }
  const moods = sample.map((id) => state.mps[id].mood);
  const angry = moods.filter((m) => m === 'angry').length;
  const note = `You listen. ${angry ? `${angry} of the six you watch look angry.` : 'Nobody near you looks angry.'} ${pairs.join(' ')}`;
  c.heard.push({ ids: sample, note, pairs: pairIds });
  log(state, note, 'caucus');
  return { note, ids: sample, pairs: pairIds };
}

export function caucusSpeak(state, rng, stanceId) {
  const c = state.caucus;
  if (!c || c.actions <= 0 || c.spoke) return null;
  const st = data().caucus.stances.find((s) => s.id === stanceId);
  if (!st) return null;
  c.actions--;
  c.spoke = stanceId;
  const p = state.player;
  const me = state.mps[p.mpId];
  const party = state.parties[me.party];
  p.leaderTrust = clamp(p.leaderTrust + st.leader, 0, 100);
  p.caucusSupport = clamp(p.caucusSupport + st.room, 0, 100);
  p.ridingStanding = clamp(p.ridingStanding + st.riding, 0, 100);
  if (party.chiefWhip) adjustRapport(state, party.chiefWhip, st.kind === 'support' ? 3 : st.kind === 'challenge' ? -4 : 0);
  addStyle(state, { support: 'loyalist', riding: 'conscience', challenge: 'conscience', quiet: 'operator' }[st.kind]);
  if (st.kind !== 'quiet') p.actProgress.noticed += 0.5;
  // The room remembers who spoke up: the cohort warms to a rookie who says the thing they were thinking.
  for (const id of c.seats) {
    const m = state.mps[id];
    if (id === p.mpId) continue;
    const agrees = st.kind === 'support' ? m.loyalty > 60 : st.kind === 'riding' || st.kind === 'challenge' ? m.loyalty < 55 : false;
    if (agrees && rng.chance(0.5)) adjustRapport(state, id, 1);
  }
  const text = fillStance(state, st.text);
  log(state, `In caucus you said: “${text}”`, 'caucus');
  return { text, kind: st.kind };
}

export function fillStance(state, text) {
  const c = state.caucus;
  const bill = c?.billId ? state.bills[c.billId].title : "this week's business";
  return text.replace(/\{bill\}/g, bill).replace(/\{(\w+)\}/g, (m) => m);
}

export function caucusWhisper(state, rng, mpId) {
  const c = state.caucus;
  if (!c || c.actions <= 0 || !neighbours(state).includes(mpId)) return null;
  c.actions--;
  const m = state.mps[mpId];
  touch(state, mpId);
  revealMany(state, mpId, ['mood'], 'caucus');
  adjustRapport(state, mpId, 2);
  const pool = data().caucus.whispers.filter((w) => w.mood === m.mood);
  const w = rng.pick(pool.length ? pool : data().caucus.whispers);
  const party = state.parties[m.party];
  const bill = c.billId ? state.bills[c.billId].title : "this week's business";
  const text = w.text.replace(/\{(\w+)\}/g, (_, k) => ({ bill, whip: party.chiefWhip ? fullName(state.mps[party.chiefWhip]) : 'the whip', leader: party.leader ? fullName(state.mps[party.leader]) : 'the leader', name: fullName(m), other: 'someone down the table' })[k] ?? `{${k}}`);
  c.whispers.push({ mpId, text });
  return { text };
}

// The revolt resolves when caucus ends: the room's numbers, plus or minus you.
export function resolveRevolt(state, rng) {
  const c = state.caucus;
  const r = c?.revolt;
  if (!r || r.resolved) return null;
  r.resolved = true;
  const R = tuning().ranks;
  const p = state.player;
  const me = state.mps[p.mpId];
  const party = state.parties[me.party];
  const RV = data().career.revolt;
  const strength = r.support + (r.choice === 'join' ? R.revoltJoin : r.choice === 'back' ? R.revoltBack : 0) + rng.int(-3, 3);
  const won = strength > r.size * 0.5;
  const leader = party.leader ? state.mps[party.leader] : null;
  let text;
  if (r.target === 'leader') {
    if (won) {
      const successor = Object.values(state.mps).filter((m) => m.party === me.party && m.id !== party.leader && ['cabinet', 'houseLeader', 'shadowCabinet'].includes(m.caucusRole)).sort((a, b) => b.ambition - a.ambition)[0] || state.mps[r.ringleader];
      if (leader) leader.caucusRole = 'backbencher';
      party.leader = successor.id;
      successor.caucusRole = 'leader';
      party.leaderPersonality = rng.pick(data().parties.leaderPersonalities);
      p.leaderTrust = r.choice === 'join' ? R.revoltLeaderTrustJoin : r.choice === 'back' ? R.revoltLeaderTrustBack : 30;
      text = fillText(RV.won, { leader: leader ? fullName(leader) : 'The leader', newLeader: fullName(successor) });
    } else {
      if (r.choice === 'join') p.leaderTrust = clamp(p.leaderTrust + R.revoltPunish, 0, 100);
      if (r.choice === 'back') p.leaderTrust = clamp(p.leaderTrust + 10, 0, 100);
      adjustRapport(state, r.ringleader, r.choice === 'join' ? 10 : -5);
      text = fillText(RV.lost, { leader: leader ? fullName(leader) : 'The leader' });
    }
  } else {
    text = won ? RV.whipWon : RV.whipLost;
    if (won) queueStop(state, { kind: 'career', event: 'revolted', important: true, needsChoice: true, text: data().career.revolted.intro, options: [{ id: 'stay', label: data().career.revolted.stay, note: data().career.revolted.stayNote, enabled: true }, { id: 'retire', label: data().career.revolted.retire, note: data().career.revolted.retireNote, enabled: true }] });
    else p.caucusSupport = clamp(p.caucusSupport + 10, 0, 100);
  }
  r.won = won;
  r.outcome = text;
  log(state, text, 'caucus');
  return { won, text };
}

export function caucusRevolt(state, choice) {
  const c = state.caucus;
  if (!c?.revolt || c.revolt.choice) return null;
  c.revolt.choice = choice;
  if (choice === 'join') addStyle(state, 'conscience');
  if (choice === 'back') addStyle(state, 'loyalist');
  return { ok: true };
}

export function endCaucus(state) {
  const c = state.caucus;
  if (!c) return;
  if (c.revolt && !c.revolt.resolved) withRng(state, (rng) => resolveRevolt(state, rng));
  if (c.billId) {
    const b = state.bills[c.billId];
    log(state, `Caucus: the line on ${b.title} is ${c.line.line === 'whipped' ? `whipped ${c.line.position.toUpperCase()}` : 'a free vote'}.`, 'caucus');
  }
  state.caucus = null;
}

// Wednesday of a sitting week. It stops the player in the first week, when their own dilemma is the week's
// question, or when the room is angry; otherwise caucus happens without them noticing.
hooks.caucus.push((state, rng) => {
  if (!isSittingWeek(state)) return null;
  const c = startCaucus(state, rng);
  if (!c) return null;
  const me = state.mps[state.player.mpId];
  const own = c.billId && (state.player.forceDilemma === c.billId || dilemmaFor(state, state.bills[c.billId], baseScore, tuning().pacing));
  const stop = state.date.absWeek === 0 || !!c.revolt || (own && state.player.pacing.stopFor.includes('ownVote')) || (c.mood === 'angry' && state.player.pacing.stopFor.includes('caucusFight'));
  if (!stop || !me) {
    endCaucus(state);
    return null;
  }
  return { kind: 'caucus', important: true, needsChoice: true };
});

resolvers.caucus = (state) => endCaucus(state);

function act(state, fn) {
  return withRng(state, (rng) => fn(rng));
}

registerActions({
  caucusRevolt: (state, a) => caucusRevolt(state, a.choice),
  caucusListen: (state) => act(state, (rng) => caucusListen(state, rng)),
  caucusSpeak: (state, a) => act(state, (rng) => caucusSpeak(state, rng, a.stance)),
  caucusWhisper: (state, a) => act(state, (rng) => caucusWhisper(state, rng, a.mpId)),
});
