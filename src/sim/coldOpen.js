// The cold open: a career from the menu starts on its own election night. The count comes in poll by poll in
// the player's riding while the national seats fill in, the returning officer declares, and the next stop walks
// the new member into the chamber for the first time. The night is built from the Parliament already generated
// (the player's margin, the House's seats), on its own seeded stream so the game's RNG is untouched.
import { data, tuning } from './config.js';
import { createRng } from './rng.js';
import { uniqueNames } from './generate.js';
import { resolvers, queueStop, log } from './pacing.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// How strongly a party runs in a riding: its region and riding-type pull (the fifth party's by its kind).
function affinity(state, partyId, riding) {
  const P = data().parties;
  const def = P.core.find((c) => c.id === partyId) || P.fifthAffinity[state.parties[partyId]?.kind] || {};
  return (def.regionAffinity?.[riding.region] || 0) + (def.typeAffinity?.[riding.type] || 0);
}

// A pool of lines dealt in a seeded order, so one night never repeats itself.
function dealer(rng, pools) {
  const decks = {};
  return (key) => {
    const pool = pools[key];
    if (!decks[key]?.length) decks[key] = rng.shuffle(pool.slice());
    return decks[key].pop();
  };
}

function clock(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 && h < 24 ? 'p.m.' : 'a.m.'}`;
}

// Election night in the player's riding and across the country. Returns the steps of the count (polls in,
// each candidate's votes, the seats nationally, a line of commentary), then the declaration.
export function electionNight(state) {
  const T = tuning().coldOpen;
  const C = data().coldOpen;
  const rng = createRng(`${state.seed}:coldOpen`);
  const me = state.mps[state.player.mpId];
  const riding = state.ridings[me.riding.id];
  const towns = riding.towns?.length ? riding.towns : [riding.name];
  const deal = dealer(rng, C.count);

  // Who ran against you: the parties that run strongest here, the national polls breaking ties.
  const rivals = Object.values(state.parties)
    .filter((p) => p.id !== me.party && p.id !== 'ind')
    .map((p) => ({ p, a: affinity(state, p.id, riding) + (state.polling[p.id] || 0) / 12 + rng.normal(0, 0.25) }))
    .sort((x, y) => y.a - x.a)
    .slice(0, T.rivals)
    .map((x) => x.p);
  const taken = { first: Object.values(state.mps).map((m) => m.name.first), last: Object.values(state.mps).map((m) => m.name.last) };
  const names = uniqueNames(rng, rivals.length + 1, taken);
  const officer = names.pop();

  // Final shares: yours from your margin, the runner-up exactly that margin behind, the rest split.
  const youShare = clamp(T.shareBase + me.margin * T.shareMargin + rng.normal(0, 1.5), 30, 72);
  const shares = [youShare, youShare - me.margin];
  let rest = 100 - shares[0] - shares[1];
  for (let i = 2; i < rivals.length + 1; i++) {
    const s = i === rivals.length ? rest : rest * rng.float(0.55, 0.72);
    shares.push(s);
    rest -= s;
  }
  const cast = rng.int(T.votesMin, T.votesMax);
  const candidates = [
    { name: fullName(me), party: me.party, you: true },
    ...rivals.map((p, i) => ({ name: `${names[i].first} ${names[i].last}`, party: p.id, you: false })),
  ].map((c, i) => ({ ...c, partyName: state.parties[c.party].name, short: state.parties[c.party].short, votes: Math.round((cast * shares[i]) / 100) }));
  const rival = candidates[1];

  // Early polls lean one way and settle as the rest come in. A close seat starts behind.
  const close = me.margin < T.closeMargin;
  const bias = close ? -(me.margin / 2 + rng.float(1.5, 4)) : rng.float(-me.margin * 0.3, 3);
  const polls = rng.int(T.pollsMin, T.pollsMax);

  // The House as it will sit: seats by party, elected or leading as the night goes on.
  const final = {};
  for (const m of Object.values(state.mps)) final[m.party] = (final[m.party] || 0) + 1;
  const jitter = Object.fromEntries(Object.keys(final).map((id) => [id, rng.float(-0.25, 0.25)]));
  const gov = state.parties[state.house.government];
  const kind = state.house.minority ? 'minority' : 'majority';

  let time = T.firstPollsAt;
  let lastLead = null;
  let called = false;
  const steps = T.reporting.map((f, i) => {
    const tilt = bias * Math.pow(1 - f, 1.5);
    const sh = shares.map((s, k) => (k === 0 ? s + tilt : k === 1 ? s - tilt : s));
    const total = sh.reduce((a, b) => a + b, 0);
    const counted = Math.round(cast * f);
    const votes = sh.map((s, k) => (f === 1 ? candidates[k].votes : Math.round((counted * s) / total)));
    const leader = votes.indexOf(Math.max(...votes));
    const second = votes.slice().sort((a, b) => b - a)[1];
    const lead = votes[leader] - second;
    const g = T.nationalReporting[i] ?? 1;
    const seats = Object.fromEntries(Object.entries(final).map(([id, n]) => [id, g >= 1 ? n : Math.min(n, Math.round(n * g * (1 + jitter[id] * (1 - g))))]));
    const ctx = { town: towns[i % towns.length], rival: rival.name, lead: fmt(lead), polls: Math.max(1, Math.round(polls * f)), party: state.parties[me.party].name, broadcaster: C.broadcaster, gov: gov.name, kind, time: clock(time) };
    let line;
    if (!called && g >= T.callAt) {
      called = true;
      line = fill(deal('call'), ctx);
    } else if (f === 1) line = fill(deal('concede'), ctx);
    else if (i === 0) line = fill(deal(leader === 0 ? 'firstAhead' : 'firstBehind'), { ...ctx, rival: candidates[leader].name });
    else if (leader === 0 && lastLead !== 0) line = fill(deal('flip'), ctx);
    else if (leader !== 0) line = fill(deal('trailing'), { ...ctx, rival: candidates[leader].name });
    else line = fill(deal(!close && i < 2 ? 'safe' : 'leading'), ctx);
    lastLead = leader;
    const step = { time: clock(time), polls: Math.max(1, Math.round(polls * f)), votes, leader, lead, seats, called, line };
    time += rng.int(T.stepMinutes[0], T.stepMinutes[1]) / 60;
    return step;
  });
  const venue = fill(rng.pick(C.venues), { town: towns[0] });
  const declaration = fill(C.count.declare, { officer: `${officer.first} ${officer.last}`, venue, name: fullName(me), party: state.parties[me.party].name, votes: fmt(candidates[0].votes) });
  return {
    riding: riding.name,
    province: riding.provinceName,
    parliament: state.house.parliament,
    polls,
    candidates,
    steps,
    margin: candidates[0].votes - rival.votes,
    marginPts: me.margin,
    close,
    gov: gov.id,
    govName: gov.name,
    minority: state.house.minority,
    declaration,
  };
}

// Where a seat is, in words: the row from the aisle, how far down the chamber, which side.
export function seatWords(seatId) {
  const W = data().coldOpen.walk;
  const n = Number(String(seatId).slice(1));
  const side = n <= 60 ? 'government' : 'opposition';
  const idx = (n - 1) % 60;
  return { row: W.rows[Math.min(3, Math.floor(idx / 15))], where: W.where[Math.min(2, Math.floor((idx % 15) / 5))], side: W.sides[side] };
}

// The first walk into the chamber: the lines that come up as the camera goes from the bar to your seat.
export function walkIn(state) {
  const W = data().coldOpen.walk;
  const rng = createRng(`${state.seed}:walkIn`);
  const me = state.mps[state.player.mpId];
  const speaker = state.mps[state.house.speaker];
  const lines = [
    fill(rng.pick(W.door), { nth: ordinal(state.house.parliament) }),
    fill(rng.pick(W.chair), { speaker: speaker ? `Speaker ${fullName(speaker)}` : 'The Speaker' }),
    fill(W.seat, seatWords(me.seatId)),
  ];
  const mentor = state.player.mentor && state.mps[state.player.mentor];
  if (mentor?.seatId) {
    const w = seatWords(mentor.seatId);
    lines.push(fill(rng.pick(W.mentor), { mentor: fullName(mentor), mentorFirst: mentor.name.first, mentorWhere: `the ${w.row} row ${w.where}`, tenure: mentor.tenure }));
  }
  lines.push(rng.pick(W.close));
  return { parliament: state.house.parliament, seatId: me.seatId, mentorSeat: mentor?.seatId || null, lines };
}

export function coldOpenStop(state) {
  return { kind: 'coldOpen', phase: 'count', needsChoice: true, important: true, night: electionNight(state) };
}

// The count resolves into the walk (or, skipped, straight to the first morning); the walk into the week.
resolvers.coldOpen = (state, p, choice) => {
  if (p.phase !== 'count') return;
  const n = p.night;
  log(state, `Election night in ${n.riding}: elected by ${fmt(n.margin)} votes. ${n.minority ? 'A minority' : 'A majority'} ${n.govName} government.`, 'career');
  if (choice !== 'skip') queueStop(state, { kind: 'coldOpen', phase: 'walk', needsChoice: true, important: true, walk: walkIn(state) });
};
