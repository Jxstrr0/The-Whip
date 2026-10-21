// Meetings: the office evening (slots, walk-ins, calls), the talk phase, the deal table, and what lands in the ledger.
import { data, tuning } from './config.js';
import { withRng } from './rng.js';
import { registerActions } from './actions.js';
import { hooks, resolvers, log } from './pacing.js';
import { reveal, revealMany, touch } from './knowledge.js';
import { adjustRapport, addStyle, spreadBrokenPromise } from './relationships.js';
import { dilemmaFor } from './career.js';
import { baseScore } from './mp.js';
import { dayIndex, sittingDayAfter } from './bills.js';
import { remember, person } from './memoir.js';

const MOODS = ['cooperative', 'guarded', 'angry', 'anxious'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (n) => String(n).padStart(3, '0');
const me = (state) => state.mps[state.player.mpId];
const whipOf = (state) => {
  const p = state.parties[me(state).party];
  return p?.chiefWhip || p?.leader;
};

export const REASONS = {
  whipCall: "The whip's office wants to see you about {bill}",
  introduction: 'Wants to say hello',
  favorAsk: 'Wants a favour',
  gossip: 'Has news from the lobby',
  rebelRecruit: 'Wants a quiet word about {bill}',
  complaint: 'Is unhappy with you',
  mentorAdvice: 'Your mentor drops by',
};

// ---------- text ----------

export function fillLine(state, text, ctx = {}) {
  const m = ctx.mp ? state.mps[ctx.mp] : null;
  const p = me(state);
  const party = state.parties[p.party];
  const name = (x) => (x ? `${x.name.first} ${x.name.last}` : '');
  const other = ctx.other ? state.mps[ctx.other] : null;
  const vars = {
    first: m?.name.first,
    last: m?.name.last,
    name: name(m),
    riding: m?.riding.name,
    province: m?.riding.province,
    bill: ctx.bill ? state.bills[ctx.bill]?.title : 'the bill',
    mentor: name(state.mps[state.player.mentor]) || 'your mentor',
    whip: name(state.mps[party?.chiefWhip]) || 'the whip',
    leader: name(state.mps[party?.leader]) || 'the leader',
    party: party?.name || 'the party',
    interest: data().world.interestNames[m?.interests?.[0]] || 'the riding',
    playerRiding: p.riding.name,
    playerFirst: p.name.first,
    clique: m?.clique ? state.cliques[m.clique].name : 'the caucus',
    other: name(other) || 'someone on our side',
    otherRiding: other?.riding.name || 'their riding',
  };
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// ---------- cards ----------

export function cardLabel(state, card) {
  const [k, a, b] = card.split(':');
  const bill = state.bills[a]?.title;
  switch (k) {
    case 'vote':
      return `A ${b} vote on ${bill}`;
    case 'favor':
      return 'A favour, owed';
    case 'cosponsor':
      return 'Co-sponsor their bill';
    case 'speakingTime':
      return 'Your speaking slot';
    case 'ridingMention':
      return 'A mention of their riding';
    case 'qpSlot':
      return 'A Question Period slot';
    case 'committeeSeat':
      return `A seat on ${state.committees[a]?.name || 'a committee'}`;
    case 'leave':
      return 'Friday leave for the riding';
    case 'ridingProject':
      return 'A project for your riding';
    case 'info':
      return 'What they know';
    default:
      return card;
  }
}

// How much the counterpart wants a card the player gives them.
function valueOf(state, m, card, meeting) {
  const [k, billId, v] = card.split(':');
  const isWhip = meeting.reversal;
  switch (k) {
    case 'vote': {
      if (isWhip) return tuning().meetings.whipNeed + (state.bills[billId]?.confidence ? 4 : 0);
      const lean = Math.sign(baseScore(state, m, state.bills[billId]).score);
      return lean === (v === 'yea' ? 1 : -1) ? 6 : -3;
    }
    case 'favor':
      return 4 + m.ambition / 25;
    case 'cosponsor':
      return Object.values(state.bills).some((b) => b.sponsor === m.id && b.status === 'active') ? 5 : 2;
    case 'speakingTime':
      return 3 + m.ambition / 20;
    case 'ridingMention':
      return 3 + (m.margin < 10 ? 3 : 0);
    case 'info':
      return 2;
    // The whip's own cards, offered from act 4 and 5.
    case 'leave':
      return 4 + (100 - m.attendance) / 20;
    case 'qpSlot':
      return 5 + m.ambition / 20;
    case 'committeeSeat':
      return 6 + m.ambition / 25;
    case 'ridingProject':
      return 7 + (m.margin < 10 ? 3 : 0);
    default:
      return 1;
  }
}

// How much it costs the counterpart to give the player a card.
function costOf(state, m, card, meeting) {
  const [k, billId, v] = card.split(':');
  switch (k) {
    case 'vote': {
      const bill = state.bills[billId];
      const { score } = baseScore(state, m, bill);
      const wants = score > 0 ? 'yea' : 'nay';
      if (wants === v) return 1;
      const againstLine = bill.lines[m.party] === 'whipped' && bill.positions[m.party] !== v;
      return 4 + Math.abs(score) * 6 + (againstLine ? m.loyalty / 15 : 0);
    }
    case 'favor':
      return 3;
    case 'info':
      return 2 + (m.loyalty > 70 ? 2 : 0);
    case 'cosponsor':
      return 3;
    case 'qpSlot':
      return 3;
    case 'committeeSeat':
      return 6;
    case 'leave':
      return 2;
    case 'ridingProject':
      return 7;
    case 'ridingMention':
    case 'speakingTime':
      return 2;
    default:
      return 2;
  }
}

// What each side may put on the table, gated by act (DESIGN section 8).
export function cardPalette(state, meeting) {
  const m = state.mps[meeting.mpId];
  const bill = meeting.billId && state.bills[meeting.billId]?.status === 'active' ? meeting.billId : null;
  const offers = ['favor', 'speakingTime', 'ridingMention'];
  const asks = ['favor', 'info'];
  if (bill) {
    offers.unshift(`vote:${bill}:yea`, `vote:${bill}:nay`);
    if (!meeting.reversal) asks.unshift(`vote:${bill}:yea`, `vote:${bill}:nay`);
  }
  if (Object.values(state.bills).some((b) => b.sponsor === m.id && b.status === 'active')) offers.push('cosponsor');
  // Once you hold the whip's cards (DESIGN section 8), you can put them on the table yourself.
  const act = state.player.act;
  if (!meeting.reversal && m.party === me(state).party) {
    if (act >= 4) offers.push('leave');
    if (act >= 5) {
      offers.push('qpSlot');
      const c = Object.values(state.committees).find((x) => x.interests.some((i) => m.interests.includes(i)));
      if (c) offers.push(`committeeSeat:${c.id}`);
      if (state.house.government === m.party) offers.push('ridingProject');
    }
  }
  if (meeting.reversal) {
    asks.length = 0;
    asks.push('qpSlot', 'ridingMention', 'leave');
    const c = Object.values(state.committees).find((x) => x.interests.some((i) => me(state).interests.includes(i)));
    if (c) asks.push(`committeeSeat:${c.id}`);
    if (state.house.government === me(state).party) asks.push('ridingProject');
  }
  return { offers, asks };
}

// ---------- the evening ----------

function upcomingDilemma(state) {
  const today = dayIndex(state.date);
  const horizon = sittingDayAfter(state, tuning().meetings.whipCallDaysAhead);
  return Object.values(state.bills)
    .filter((b) => b.status === 'active' && b.nextVote != null && b.nextVote > today && b.nextVote <= horizon)
    .map((b) => ({ bill: b, d: dilemmaFor(state, b, baseScore, tuning().pacing) }))
    .find((x) => x.d);
}

export function planEvening(state, rng) {
  const T = tuning().meetings;
  const p = state.player;
  const mine = me(state);
  const walkIns = [];
  const add = (mpId, situation, billId = null) => {
    if (!mpId || mpId === mine.id || walkIns.some((w) => w.mpId === mpId)) return;
    walkIns.push({ mpId, situation, billId, reason: REASONS[situation] });
  };
  p.whipCalls ||= [];
  const up = upcomingDilemma(state);
  let whipCall = null;
  if (up && !p.whipCalls.includes(up.bill.id) && whipOf(state)) {
    whipCall = { mpId: whipOf(state), situation: 'whipCall', billId: up.bill.id, reason: REASONS.whipCall, reversal: true };
  }
  const party = Object.values(state.mps).filter((m) => m.party === mine.party && m.id !== mine.id && m.caucusRole !== 'speaker');
  if (up && rng.chance(T.walkInOdds.rebelRecruit)) {
    const rebels = party.filter((m) => {
      const s = baseScore(state, m, up.bill);
      return Math.sign(s.score) !== (up.bill.positions[m.party] === 'yea' ? 1 : -1);
    });
    if (rebels.length) add(rng.pick(rebels).id, 'rebelRecruit', up.bill.id);
  }
  if (p.mentor && rng.chance(T.walkInOdds.mentorAdvice * (state.date.absWeek < 4 ? 2 : 1))) add(p.mentor, 'mentorAdvice', up?.bill.id);
  const sore = Object.values(state.mps).filter((m) => m.rapport < -25 && m.id !== mine.id);
  if (sore.length && rng.chance(T.walkInOdds.complaint)) add(rng.pick(sore).id, 'complaint');
  const cohort = Object.values(state.mps).filter((m) => m.cohort === mine.cohort && m.id !== mine.id && m.caucusRole !== 'speaker');
  if (state.date.absWeek < T.introductionWeeks && rng.chance(T.walkInOdds.introduction)) add(rng.pick(cohort).id, 'introduction');
  if (rng.chance(T.walkInOdds.gossip)) add(rng.pick(cohort.filter((m) => m.party === mine.party).length ? cohort.filter((m) => m.party === mine.party) : cohort).id, 'gossip');
  if (rng.chance(T.walkInOdds.favorAsk)) add(rng.weighted(party, (m) => 1 + (m.cohort === mine.cohort ? 2 : 0) + (m.clique && m.clique === mine.clique ? 2 : 0)).id, 'favorAsk');
  // The guided first week sends specific visitors on specific evenings.
  for (const sit of p.script?.[state.date.dayOfWeek] || []) {
    if (sit === 'mentorAdvice') add(p.mentor, 'mentorAdvice', up?.bill.id || p.forceDilemma);
    else if (sit === 'rebelRecruit' && p.forceDilemma) {
      const pos = state.bills[p.forceDilemma].positions[mine.party];
      const rebel = party.filter((m) => m.riding.type === mine.riding.type && m.caucusRole === 'backbencher').sort((a, b) => a.loyalty - b.loyalty)[0] || party.sort((a, b) => a.loyalty - b.loyalty)[0];
      if (rebel && pos) walkIns.unshift({ mpId: rebel.id, situation: 'rebelRecruit', billId: p.forceDilemma, reason: REASONS.rebelRecruit });
    } else {
      const pool = sit === 'introduction' ? cohort : party.filter((m) => m.cohort === mine.cohort);
      if (pool.length) add(rng.pick(pool).id, sit);
    }
  }
  const list = walkIns.slice(0, T.maxWalkIns + (p.script ? 1 : 0));
  if (!whipCall && !list.length) return null;
  return { slots: p.slots, used: 0, walkIns: list, whipCall, met: [], called: [] };
}

// The pending stop only names the room; the evening itself lives in state.evening.
function officePending() {
  return { kind: 'office', important: true, needsChoice: true };
}

// The office hook: after a sitting day, an evening that has walk-ins (or the whip calling) stops the game.
hooks.office.push((state, rng) => {
  const sittingDay = state.date.dayOfWeek <= 4 && !state.date.constituencyWeek;
  if (!sittingDay || !state.player.pacing.stopFor.includes('walkIn')) return null;
  let e = planEvening(state, rng);
  // On a day that mattered, you still go back to the office, even if nobody's waiting.
  if (!e && state.flow.day?.matters) e = { slots: state.player.slots, used: 0, walkIns: [], whipCall: null, met: [], called: [] };
  if (!e) return null;
  state.evening = e;
  // The first evening at a new rank, the room itself is the news.
  if (state.player.officeAct !== state.player.act) {
    state.player.officeAct = state.player.act;
    const line = data().career.office?.[String(state.player.act)];
    if (line) log(state, line, 'career');
  }
  return officePending(state);
});

// ---------- meetings ----------

function moodFor(state, m, situation) {
  if (situation === 'whipCall') {
    const reb = state.player.whipFile.length;
    if (m.rapport > 15 && !reb) return 'cooperative';
    if (reb && m.rapport < -10) return 'angry';
    return state.bills[state.evening?.whipCall?.billId]?.confidence ? 'anxious' : 'guarded';
  }
  if (situation === 'complaint') return m.mood === 'cooperative' ? 'guarded' : m.mood;
  if (situation === 'mentorAdvice') return m.mood === 'angry' ? 'guarded' : m.mood;
  return m.mood;
}

function pickLine(state, rng, filter) {
  const recent = new Set(state.player.recentLines || []);
  const act = state.player.act;
  const pool = data().dialogueLines.lines.filter((l) => filter(l) && (!l.act || l.act.includes(act)));
  const fresh = pool.filter((l) => !recent.has(l.id));
  const line = rng.pick(fresh.length ? fresh : pool);
  if (line) state.player.recentLines = [...(state.player.recentLines || []).slice(-60), line.id];
  return line;
}

function setupTurn(state, rng, mt) {
  const speaker = mt.reversal ? 'whip' : 'mp';
  const line = pickLine(state, rng, (l) => l.speaker === speaker && l.situation === mt.situation && l.turn === mt.turn && l.mood.includes(mt.mood));
  const players = data().dialogueLines.lines.filter((l) => l.speaker === 'player' && l.situation === mt.situation && l.turn === mt.turn && (!l.mood || l.mood.includes(mt.mood)));
  const byApproach = {};
  for (const l of rng.shuffle([...players])) byApproach[l.approach] ||= l;
  const opts = rng.shuffle(Object.values(byApproach)).slice(0, 4);
  // Always keep a way to listen and (when there's an ask) to concede. Each takes a different slot,
  // so adding one never knocks out the other.
  const MUST = ['listen', 'concede'];
  for (const must of MUST) {
    if (opts.some((o) => o.approach === must) || !byApproach[must]) continue;
    const slot = opts.findLastIndex((o) => !MUST.includes(o.approach));
    if (slot >= 0) opts[slot] = byApproach[must];
    else opts.push(byApproach[must]);
  }
  mt.talk.current = { line: line?.id, text: line ? fillLine(state, line.text, { mp: mt.mpId, bill: mt.billId, other: mt.otherId }) : '…' };
  mt.talk.options = opts.map((l) => ({ id: l.id, approach: l.approach, style: l.style || null, text: fillLine(state, l.text, { mp: mt.mpId, bill: mt.billId, other: mt.otherId }) }));
}

function initialTable(state, mt, m) {
  const pos = mt.billId ? state.bills[mt.billId].positions[me(state).party] : null;
  const against = pos === 'yea' ? 'nay' : 'yea';
  switch (mt.situation) {
    case 'whipCall':
      return { offers: [`vote:${mt.billId}:${pos}`], asks: [m.rapport > 10 ? 'qpSlot' : 'ridingMention'] };
    case 'rebelRecruit':
      return { offers: [`vote:${mt.billId}:${against}`], asks: ['favor'] };
    case 'favorAsk': {
      const want = m.ambition > 60 ? 'speakingTime' : m.margin < 10 ? 'ridingMention' : Object.values(state.bills).some((b) => b.sponsor === m.id && b.status === 'active') ? 'cosponsor' : 'favor';
      return { offers: [want], asks: [] };
    }
    default:
      return { offers: [], asks: [] };
  }
}

export function startMeeting(state, rng, { mpId, situation, walkIn = false, billId = null, reversal = false }) {
  state.meetingSeq = (state.meetingSeq || 0) + 1;
  const id = 'k' + pad(state.meetingSeq);
  const m = state.mps[mpId];
  const mt = {
    id,
    room: 'office',
    mpId,
    day: { year: state.date.year, week: state.date.week, dayOfWeek: state.date.dayOfWeek, absWeek: state.date.absWeek },
    walkIn,
    reason: situation,
    situation,
    reversal,
    billId,
    otherId: null,
    mood: moodFor(state, m, situation),
    turn: 1,
    maxTurns: tuning().meetings.turnsBySituation[situation] || 2,
    phase: 'talk',
    talk: { turns: [], moodAfter: null },
    deal: null,
    revealed: [],
    wantsKnown: false,
  };
  if (situation === 'gossip' || situation === 'complaint') {
    const pool = Object.values(state.mps).filter((x) => x.id !== mpId && x.id !== state.player.mpId && (x.relations[mpId] != null || m.relations[x.id] != null));
    mt.otherId = pool.length ? rng.pick(pool).id : null;
  }
  touch(state, mpId);
  // You can see how they're feeling when they sit down, and how they feel about you.
  mt.revealed.push(...revealMany(state, mpId, ['mood', 'rapport'], 'meeting'));
  m.mood = mt.mood;
  setupTurn(state, rng, mt);
  mt.deal = { ...initialTable(state, mt, m), counter: null, result: null, message: null };
  state.meetings[id] = mt;
  state.meeting = id;
  return mt;
}

const REVEAL_BY_TURN = [['interests', 'cohort'], ['ambition', 'clique'], ['loyalty', 'attendance']];

export function chooseTalk(state, rng, index) {
  const T = tuning().meetings;
  const mt = state.meetings[state.meeting];
  const opt = mt.talk.options[index];
  if (!opt || mt.phase !== 'talk') return null;
  const bg = data().backgrounds.backgrounds.find((b) => b.id === state.player.background);
  const delta = Math.round(T.approach[mt.mood][opt.approach] + (bg?.effects.talkBonus || 0) + rng.normal(0, T.noise));
  const m = state.mps[mt.mpId];
  adjustRapport(state, mt.mpId, delta);
  addStyle(state, opt.style);
  mt.talk.turns.push({ mpLine: mt.talk.current.line, choice: opt.id, approach: opt.approach, rapportDelta: delta });
  let note = null;
  if (delta >= T.goodRead) {
    // A good read: they open up, and you learn what they actually need.
    const fields = REVEAL_BY_TURN[Math.min(mt.turn - 1, 2)];
    mt.revealed.push(...revealMany(state, mt.mpId, fields, 'meeting'));
    mt.wantsKnown = true;
    if (mt.mood !== 'cooperative') mt.mood = rng.chance(0.5) ? 'cooperative' : mt.mood === 'angry' ? 'guarded' : mt.mood;
    if (mt.situation === 'gossip' && mt.otherId) mt.revealed.push(...revealMany(state, mt.otherId, ['mood', 'clique'], 'gossip').map((f) => `${mt.otherId}.${f}`));
    if (mt.situation === 'mentorAdvice') {
      const known = Object.entries(m.relations).filter(([id]) => id !== state.player.mpId).slice(0, 2);
      for (const [id] of known) mt.revealed.push(...revealMany(state, id, ['loyalty', 'clique'], 'mentor').map((f) => `${id}.${f}`));
    }
    note = 'good';
  } else if (delta <= T.badRead) {
    mt.mood = mt.mood === 'cooperative' ? 'guarded' : rng.chance(0.5) ? 'angry' : mt.mood;
    note = 'bad';
  }
  m.mood = mt.mood;
  if (mt.turn >= mt.maxTurns || (note === 'bad' && mt.mood === 'angry' && mt.situation !== 'whipCall' && rng.chance(0.3))) {
    mt.phase = 'deal';
    mt.talk.moodAfter = mt.mood;
  } else {
    mt.turn++;
    setupTurn(state, rng, mt);
  }
  return { delta, note };
}

// The counterpart weighs the table: what they get, what they give up, and how they feel about you.
export function evaluateDeal(state, mt, offers, asks) {
  const T = tuning().meetings;
  const m = state.mps[mt.mpId];
  const gain = offers.reduce((s, c) => s + valueOf(state, m, c, mt), 0);
  const cost = asks.reduce((s, c) => s + costOf(state, m, c, mt), 0);
  const moodAdj = { cooperative: 2, guarded: 0, anxious: 0, angry: -3 }[mt.mood];
  const bg = data().backgrounds.backgrounds.find((b) => b.id === state.player.background);
  return gain - cost + m.rapport * T.rapportPerPoint + moodAdj + (bg?.effects.dealBonus || 0);
}

export function proposeDeal(state, rng, offers, asks) {
  const T = tuning().meetings;
  const mt = state.meetings[state.meeting];
  if (!mt || mt.phase !== 'deal') return null;
  mt.deal.offers = [...offers];
  mt.deal.asks = [...asks];
  if (!offers.length && !asks.length) return finishMeeting(state, 'none');
  const score = evaluateDeal(state, mt, offers, asks);
  if (score >= T.acceptAt) return finishMeeting(state, 'accepted');
  if (score >= T.counterAt && !mt.deal.counter) {
    // Counter: drop the dearest ask, or ask for the thing they want.
    const m = state.mps[mt.mpId];
    const dear = [...asks].sort((a, b) => costOf(state, m, b, mt) - costOf(state, m, a, mt))[0];
    const counter = dear ? { offers: [...offers], asks: asks.filter((c) => c !== dear) } : { offers: [...offers, 'favor'], asks: [...asks] };
    mt.deal.counter = counter;
    mt.deal.message = 'counter';
    return { result: 'counter', counter };
  }
  return finishMeeting(state, mt.reversal ? 'declined' : 'walked');
}

export function acceptCounter(state) {
  const mt = state.meetings[state.meeting];
  if (!mt?.deal.counter) return null;
  mt.deal.offers = mt.deal.counter.offers;
  mt.deal.asks = mt.deal.counter.asks;
  return finishMeeting(state, 'accepted');
}

function promise(state, from, to, what, mt) {
  const T = tuning().meetings;
  const isVote = what.startsWith('vote:');
  state.ledgerSeq = (state.ledgerSeq || 0) + 1;
  const e = {
    id: 'g' + pad(state.ledgerSeq),
    from,
    to,
    kind: what === 'favor' ? 'favor' : 'promise',
    what,
    created: state.date.absWeek,
    dueWeek: isVote || what === 'favor' ? null : state.date.absWeek + T.promiseDueWeeks,
    settled: false,
    meeting: mt.id,
  };
  state.ledger.push(e);
  return e;
}

// The first time the whip's office calls you in goes in the memoir, however it went.
function rememberWhipCall(state, whipId, billId, sub) {
  const w = state.mps[whipId];
  remember(state, 'whipCall', { sub, once: true, ctx: { whip: w ? `${w.name.first} ${w.name.last}` : 'The whip', bill: state.bills[billId]?.title || 'the bill' }, people: [person(state, whipId, data().memoir.notes.whip)] });
}

export function finishMeeting(state, result) {
  const T = tuning().meetings;
  const mt = state.meetings[state.meeting];
  const m = state.mps[mt.mpId];
  const pid = state.player.mpId;
  mt.deal.result = result;
  mt.phase = 'done';
  if (result === 'accepted') {
    for (const c of mt.deal.offers) promise(state, pid, mt.mpId, c, mt);
    for (const c of mt.deal.asks) {
      if (c === 'info') {
        const others = Object.keys(m.relations).filter((id) => id !== pid);
        for (const id of others.slice(0, 2)) mt.revealed.push(...revealMany(state, id, ['mood', 'loyalty'], 'meeting').map((f) => `${id}.${f}`));
        continue;
      }
      promise(state, mt.mpId, pid, c, mt);
    }
    if (mt.situation === 'whipCall') addStyle(state, 'loyalist');
    else if (mt.deal.offers.length || mt.deal.asks.length) addStyle(state, 'fixer');
    adjustRapport(state, mt.mpId, 2);
  } else if (result === 'walked') {
    adjustRapport(state, mt.mpId, T.walkOutRapport);
  } else if (result === 'declined' && mt.reversal) {
    adjustRapport(state, mt.mpId, -4);
    addStyle(state, 'conscience');
  }
  if (mt.reversal) state.player.whipCalls.push(mt.billId);
  if (mt.situation === 'whipCall') rememberWhipCall(state, mt.mpId, mt.billId, result === 'accepted' ? 'accepted' : 'declined');
  log(state, meetingSummary(state, mt), 'meeting');
  // Keep saves small: finished meetings keep their record, not their screen text; old ones go.
  delete mt.talk.options;
  delete mt.talk.current;
  const ids = Object.keys(state.meetings);
  for (const id of ids.slice(0, Math.max(0, ids.length - 80))) delete state.meetings[id];
  if (state.evening) {
    state.evening.used += 1;
    state.evening.met.push(mt.mpId);
  }
  state.meeting = null;
  return { result };
}

export function meetingSummary(state, mt) {
  const m = state.mps[mt.mpId];
  const who = `${m.name.first} ${m.name.last}`;
  const deal = mt.deal;
  if (deal.result === 'accepted') {
    const give = deal.offers.map((c) => cardLabel(state, c).toLowerCase()).join(', ');
    const get = deal.asks.map((c) => cardLabel(state, c).toLowerCase()).join(', ');
    return `Meeting with ${who}: deal. You give ${give || 'nothing'}; you get ${get || 'nothing'}.`;
  }
  if (deal.result === 'walked') return `Meeting with ${who}: they walked out.`;
  if (deal.result === 'declined') return `Meeting with ${who}: you turned the whip down.`;
  return `Meeting with ${who}: talk, no deal.`;
}

export function phoneCall(state, rng, mpId) {
  const e = state.evening;
  const cost = tuning().meetings.phoneCallCost;
  if (!e || e.used + cost > e.slots || mpId === state.player.mpId) return null;
  e.used += cost;
  e.called.push(mpId);
  touch(state, mpId);
  revealMany(state, mpId, ['mood'], 'call');
  adjustRapport(state, mpId, 1);
  const m = state.mps[mpId];
  log(state, `You phoned ${m.name.first} ${m.name.last}. They sounded ${m.mood}.`, 'meeting');
  return { mood: m.mood };
}

export function endEvening(state) {
  const e = state.evening;
  if (!e) return;
  // Walk-ins you didn't see remember it.
  for (const w of e.walkIns) if (!e.met.includes(w.mpId)) adjustRapport(state, w.mpId, tuning().meetings.ignoredWalkIn);
  state.evening = null;
}

// ---------- promises coming due ----------

hooks.fallout.push((state) => {
  const T = tuning().meetings;
  const pid = state.player.mpId;
  for (const e of state.ledger) {
    if (e.processed) continue;
    if (e.settled && e.what.startsWith('vote:')) {
      e.processed = true;
      if (e.from === pid) {
        if (e.kept) {
          adjustRapport(state, e.to, T.keptPromiseRapport);
          state.player.record.promisesKept++;
        } else {
          spreadBrokenPromise(state, e.to, T.brokenPromiseHit * (e.to === whipOf(state) ? 1.5 : 1));
          state.player.record.promisesBroken++;
          const t = state.mps[e.to];
          remember(state, 'brokenPromise', { once: true, ctx: { name: `${t.name.first} ${t.name.last}` }, people: [person(state, e.to, data().memoir.notes.brokenWord)] });
          log(state, `You broke your word to ${t.name.first} ${t.name.last}. Their friends heard about it.`, 'meeting');
        }
      } else if (e.to === pid && !e.kept) {
        reveal(state, e.from, 'loyalty', 'votes');
        const t = state.mps[e.from];
        log(state, `${t.name.first} ${t.name.last} didn't vote the way they promised you.`, 'meeting');
      }
      continue;
    }
    if (e.dueWeek == null || e.dueWeek > state.date.absWeek || e.settled) continue;
    // Small promises come due: the player's are kept automatically; the whip delivers what they offered.
    e.settled = true;
    e.kept = true;
    e.processed = true;
    if (e.from === pid) {
      adjustRapport(state, e.to, T.keptPromiseRapport);
      state.player.record.promisesKept++;
    } else if (e.to === pid) deliver(state, e);
  }
});

function deliver(state, e) {
  const p = state.player;
  const [k, a] = e.what.split(':');
  if (k === 'qpSlot') {
    p.qpSlot = { from: e.from, week: state.date.absWeek };
    log(state, "The whip's office has put you down for a question. Next sitting day, you're on your feet.", 'career');
  } else if (k === 'committeeSeat') {
    me(state).committee = a;
    p.actProgress.noticed += 1;
    log(state, `You're now on ${state.committees[a]?.name}.`, 'career');
  } else if (k === 'leave') {
    p.leaveGranted = true;
  } else if (k === 'ridingProject') {
    p.pendingProject = true;
    log(state, 'A funding announcement for your riding is ready to make at home.', 'career');
  } else if (k === 'ridingMention') {
    p.ridingStanding = clamp(p.ridingStanding + 1, 0, 100);
  }
}

// ---------- actions ----------

function officeOrMeetingPending(state) {
  if (state.meeting) return { kind: 'meeting', important: true, needsChoice: true, meetingId: state.meeting };
  return officePending(state);
}

function act(state, fn) {
  const out = withRng(state, (rng) => fn(rng));
  state.flow.pending = officeOrMeetingPending(state);
  return out;
}

registerActions({
  meet(state, a) {
    return act(state, (rng) => {
      const e = state.evening;
      const w = a.whipCall ? e.whipCall : e.walkIns.find((x) => x.mpId === a.mpId);
      if (!w || e.used + 1 > e.slots) return null;
      if (a.whipCall) e.whipCall = null;
      return startMeeting(state, rng, { mpId: w.mpId, situation: w.situation, walkIn: true, billId: w.billId, reversal: !!w.reversal });
    });
  },
  invite(state, a) {
    return act(state, (rng) => {
      const e = state.evening;
      if (!e || e.used + 1 > e.slots || a.mpId === state.player.mpId) return null;
      return startMeeting(state, rng, { mpId: a.mpId, situation: 'introduction', billId: upcomingDilemma(state)?.bill.id || null });
    });
  },
  call: (state, a) => act(state, (rng) => phoneCall(state, rng, a.mpId)),
  talk: (state, a) => act(state, (rng) => chooseTalk(state, rng, a.index)),
  propose: (state, a) => act(state, (rng) => proposeDeal(state, rng, a.offers, a.asks)),
  acceptCounter: (state) => act(state, () => acceptCounter(state)),
  leaveMeeting: (state) => act(state, () => finishMeeting(state, state.meetings[state.meeting]?.reversal ? 'declined' : 'none')),
});

// Ending the evening resolves the office stop (the whip doesn't take no-shows lightly).
resolvers.office = (state) => {
  const e = state.evening;
  if (e?.whipCall) {
    const w = state.mps[e.whipCall.mpId];
    adjustRapport(state, w.id, -6);
    state.player.whipCalls.push(e.whipCall.billId);
    rememberWhipCall(state, w.id, e.whipCall.billId, 'missed');
    log(state, `You didn't go when the whip's office called. ${w.name.first} ${w.name.last} noticed.`, 'meeting');
  }
  endEvening(state);
};
resolvers.meeting = (state) => {
  if (state.meeting) finishMeeting(state, 'none');
  endEvening(state);
};

export { MOODS };
