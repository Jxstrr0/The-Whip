// Bills: kinds, the five stages, templates, party lines, scheduling, amendments, and the PMB lottery hook.
import { data, tuning, say } from './config.js';
import { createRng } from './rng.js';

const pad = (n) => String(n).padStart(3, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const VOTE_STAGES = ['second', 'report', 'third'];
// How a bill reads mid-sentence: "the Rural Roads Fund Act", or a motion's spoken name ("the rent freeze motion").
export function billName(bill) {
  if (!bill) return 'the bill';
  return data().billTemplates.templates.find((x) => x.id === bill.template)?.prose || `the ${bill.title}`;
}

export function dayIndex(date) {
  return date.absWeek * 5 + (date.dayOfWeek - 1);
}

export function regionOfRiding(state, ridingId) {
  return state.ridings[ridingId]?.region;
}

// How much a bill moves someone at `x` on its axis: closer to the bill than to the status quo (0) is support.
export function ideoFit(x, bill) {
  const T = tuning().vote;
  return clamp((Math.abs(x) - Math.abs(x - bill.position)) / T.ideoScale, -1, 1);
}

function sponsorFor(state, rng, kind, category) {
  const gov = state.house.government;
  const mps = Object.values(state.mps);
  if (kind === 'government' || kind === 'supply') {
    const cab = mps.filter((m) => m.party === gov && m.caucusRole === 'cabinet');
    const fit = cab.filter((m) => m.interests.includes(category));
    return (fit.length ? rng.pick(fit) : rng.pick(cab.length ? cab : mps.filter((m) => m.party === gov))).id;
  }
  if (kind === 'oppositionMotion') {
    const opp = Object.values(state.parties).find((p) => p.role === 'opposition');
    const critics = mps.filter((m) => m.party === opp.id && ['shadowCabinet', 'leader'].includes(m.caucusRole));
    return rng.pick(critics.length ? critics : mps.filter((m) => m.party === opp.id)).id;
  }
  const backbench = mps.filter((m) => m.caucusRole === 'backbencher' && m.id !== state.player?.mpId);
  return rng.pick(backbench).id;
}

export function makeBill(state, rng, template, extra = {}) {
  state.billSeq = (state.billSeq || 0) + 1;
  const id = 'b' + pad(state.billSeq);
  let title = template.title;
  const beneficiaryRidings = [];
  const regionEffects = { ...(template.regionEffects || {}) };
  if (title.includes('{province}')) {
    const prov = rng.pick(data().world.provinces);
    title = title.replace('{province}', prov.name);
    for (const r of Object.values(state.ridings)) if (r.province === prov.id) beneficiaryRidings.push(r.id);
  }
  if (title.includes('{region}')) {
    const region = rng.pick(['west', 'prairie', 'central', 'east', 'north']);
    title = title.replace('{region}', { west: 'Western', prairie: 'Prairie', central: 'Central', east: 'Eastern', north: 'Northern' }[region]);
    regionEffects[region] = Math.max(regionEffects[region] || 0, 0.6);
  }
  const bill = {
    id,
    title,
    template: template.id,
    kind: template.kind,
    confidence: !!template.confidence || template.kind === 'supply',
    sponsor: extra.sponsor || sponsorFor(state, rng, template.kind, template.category),
    category: template.category,
    axis: template.axis,
    position: template.position,
    visibility: template.visibility,
    ridingEffects: { ...template.ridingEffects },
    regionEffects,
    beneficiaryRidings,
    summary: template.summary,
    stage: 'first',
    status: 'active',
    lines: {},
    positions: {},
    amendments: [],
    results: [],
    introduced: dayIndex(state.date),
    committeeUntil: null,
    nextVote: null,
    scheduled: true,
  };
  state.bills[id] = bill;
  setLines(state, bill, rng);
  return bill;
}

// Each party's position and whether it's whipped. Government whips its own bills; the opposition
// reflexively leans against; parties weigh ideology, their members' ridings, and on confidence votes,
// whether an election would suit them.
export function setLines(state, bill, rng) {
  const T = tuning().bills;
  const gov = state.house.government;
  const year = Math.floor(state.date.absWeek / tuning().calendar.weeksPerYear) + 1;
  const sponsorParty = state.mps[bill.sponsor]?.party;
  for (const p of Object.values(state.parties)) {
    const members = Object.values(state.mps).filter((m) => m.party === p.id);
    const avgRiding = members.length ? members.reduce((s, m) => s + (bill.ridingEffects[m.riding.type] || 0) + (bill.regionEffects[regionOfRiding(state, m.riding.id)] || 0), 0) / members.length : 0;
    // Small, low-profile government bills are consensus business: nobody rises against them.
    const consensus = bill.kind === 'government' && Math.abs(bill.position) <= 20 && bill.visibility <= 45;
    let support = (consensus ? 0.5 : 0) + ideoFit(p.ideology.economy * (bill.axis === 'economy' ? 1 : 0) + p.ideology.social * (bill.axis === 'social' ? 1 : 0), bill) + avgRiding * 0.5;
    if (p.id === gov && (bill.kind === 'government' || bill.kind === 'supply')) support += 2;
    else if (p.id !== gov && !consensus && (bill.kind === 'government' || bill.kind === 'supply')) support -= T.oppositionReflex;
    if (bill.kind === 'oppositionMotion') support += p.id === sponsorParty ? 2 : p.id === gov ? -0.6 : 0;
    if (bill.kind === 'privateMember' && p.id === sponsorParty) support += 0.3;
    if (bill.confidence && p.id !== gov) {
      const seatShare = (p.seats / 120) * 100;
      const appetite = year >= T.confidenceAppetiteFromYear && (state.polling[p.id] || 0) - seatShare > T.confidenceAppetiteMargin;
      if (appetite) support -= 1.5;
      else if (p.role === 'opposition') support -= 0.8;
      else support += 0.45;
      // Nobody wants to send voters back to the polls months after an election.
      if (p.role !== 'opposition' && state.date.absWeek < T.honeymoonWeeks) support += 1;
    }
    const thr = T.partySupportThreshold;
    let position = support > thr ? 'yea' : support < -thr ? 'nay' : bill.confidence && p.id !== gov ? 'abstain' : support >= 0 ? 'yea' : 'nay';
    let line = 'whipped';
    if (bill.kind === 'privateMember') line = Math.abs(support) > 0.8 && p.id === gov ? 'whipped' : 'free';
    else if (bill.axis === 'social' && Math.abs(bill.position) > 50 && !bill.confidence && rng.chance(T.freeVoteSocialOdds)) line = 'free';
    bill.lines[p.id] = line;
    bill.positions[p.id] = position;
  }
}

// Governments bring bills that suit them (and in a minority, their likeliest partners); the Official
// Opposition picks motions that suit it. Private members' bills are anyone's.
function templateWeight(state, t) {
  const fit = (p) => ideoFit(t.axis === 'economy' ? p.ideology.economy : p.ideology.social, t);
  const gov = state.parties[state.house.government];
  if (t.kind === 'government' || t.kind === 'supply') {
    const partners = Object.values(state.parties).filter((p) => p.id !== gov.id && p.role !== 'opposition');
    const best = partners.length ? Math.max(...partners.map(fit)) : 0;
    return 0.1 + Math.max(0, fit(gov)) + (state.house.minority ? 0.5 * Math.max(0, best) : 0);
  }
  if (t.kind === 'oppositionMotion') {
    const opp = Object.values(state.parties).find((p) => p.role === 'opposition');
    return 0.15 + Math.max(0, opp ? fit(opp) : 0);
  }
  return 1;
}

function pickTemplate(state, rng, kind) {
  const active = new Set(Object.values(state.bills).filter((b) => b.status === 'active').map((b) => b.template));
  const used = state.usedTemplates || [];
  const pool = data().billTemplates.templates.filter((t) => t.kind === kind && !active.has(t.id));
  const fresh = pool.filter((t) => !used.includes(t.id));
  const t = rng.weighted(fresh.length ? fresh : pool, (x) => templateWeight(state, x));
  if (t) state.usedTemplates = [...used.slice(-60), t.id];
  return t;
}

// Next sitting day `n` sitting days from today (skipping constituency weeks).
export function sittingDayAfter(state, n) {
  const pattern = tuning().calendar.weekPattern;
  let w = state.date.absWeek;
  let d = state.date.dayOfWeek - 1;
  let left = n;
  while (left > 0) {
    d++;
    if (d > 4) {
      d = 0;
      w++;
    }
    if (pattern[w % pattern.length] === 'S' && d < 4) left--;
  }
  return w * 5 + d;
}

export function scheduleVote(state, bill, rng, stage, delay = null) {
  const [a, b] = tuning().bills.scheduleDelayDays;
  bill.stage = stage;
  bill.nextVote = sittingDayAfter(state, delay ?? rng.int(a, b));
  bill.scheduled = rng.chance(0.7);
}

export function introduceBill(state, rng, kind, templateTitle = null) {
  const t = templateTitle ? data().billTemplates.templates.find((x) => x.title === templateTitle) : pickTemplate(state, rng, kind);
  if (!t) return null;
  const bill = makeBill(state, rng, t);
  // Motions and supply go straight to a single vote; bills start at second reading.
  if (bill.kind === 'oppositionMotion' || bill.kind === 'supply') scheduleVote(state, bill, rng, 'motion');
  else scheduleVote(state, bill, rng, 'second', rng.int(2, 6));
  return bill;
}

// Monday of each sitting week: new government business, private members' bills, opposition days, supply.
export function weeklyBusiness(state, rng) {
  const T = tuning().bills;
  const weekOfYear = (state.date.absWeek % tuning().calendar.weeksPerYear) + 1;
  const out = [];
  const supply = T.supplySchedule[String(weekOfYear)];
  // The Throne Speech reply only opens a Parliament; the rest of the supply calendar repeats yearly.
  if (supply && (!supply.startsWith('Address in Reply') || state.date.absWeek < tuning().calendar.weeksPerYear)) {
    out.push(introduceBill(state, rng, 'supply', supply));
  }
  let n = Math.floor(T.govBillsPerWeek + rng.next());
  while (n-- > 0) out.push(introduceBill(state, rng, 'government'));
  if (rng.chance(T.pmbPerWeek)) out.push(introduceBill(state, rng, 'privateMember'));
  if (state.date.absWeek % T.oppositionDayEvery === 1) out.push(introduceBill(state, rng, 'oppositionMotion'));
  return out.filter(Boolean);
}

// Committee study: weeks pass, members add amendments (usually riding wins for committee members).
export function committeeTick(state, rng) {
  const T = tuning().bills;
  for (const bill of Object.values(state.bills)) {
    if (bill.status !== 'active' || bill.stage !== 'committee' || bill.committeeUntil > state.date.absWeek) continue;
    const n = rng.weighted([0, 1, 2, 3], (k) => T.amendmentOdds[k]);
    for (let i = 0; i < n; i++) addAmendment(state, bill, rng, 'committee');
    scheduleVote(state, bill, rng, 'report');
  }
}

export function addAmendment(state, bill, rng, at) {
  const committee = Object.values(state.committees).find((c) => c.interests.includes(bill.category));
  const pool = committee?.members?.length ? committee.members : Object.keys(state.mps);
  const by = rng.pick(pool);
  const mp = state.mps[by];
  const kind = rng.chance(0.65) ? 'riding' : 'soften';
  const a = { id: `${bill.id}a${bill.amendments.length + 1}`, at, by, kind, adopted: at === 'committee' };
  if (kind === 'riding') {
    a.riding = mp.riding.id;
    a.text = say('amendment.riding', { riding: mp.riding.name });
  } else {
    a.text = 'Softens the bill';
  }
  bill.amendments.push(a);
  if (a.adopted) applyAmendment(bill, a);
  return a;
}

export function applyAmendment(bill, a) {
  if (a.kind === 'riding' && !bill.beneficiaryRidings.includes(a.riding)) bill.beneficiaryRidings.push(a.riding);
  if (a.kind === 'soften') bill.position = Math.round(bill.position * 0.8);
}

// After a division: carried bills move on, defeated ones die.
export function advanceBill(state, bill, carried, rng) {
  if (!carried) {
    bill.status = 'defeated';
    bill.nextVote = null;
    return;
  }
  const next = { second: 'committee', report: 'third', third: 'passed', motion: 'passed' }[bill.stage];
  if (next === 'passed') {
    bill.status = 'passed';
    bill.stage = bill.kind === 'oppositionMotion' || bill.kind === 'supply' ? bill.stage : 'third';
    bill.nextVote = null;
    return;
  }
  if (next === 'committee') {
    const [a, b] = tuning().bills.committeeWeeks;
    bill.stage = 'committee';
    bill.committeeUntil = state.date.absWeek + rng.int(a, b);
    bill.nextVote = null;
    return;
  }
  scheduleVote(state, bill, rng, next);
}

// The order paper for today: votes scheduled for this sitting day, capped per day.
export function todaysItems(state) {
  const today = dayIndex(state.date);
  const max = tuning().bills.votesPerDayMax;
  const due = Object.values(state.bills)
    .filter((b) => b.status === 'active' && b.nextVote != null && b.nextVote <= today)
    .sort((a, b) => (b.confidence ? 1 : 0) - (a.confidence ? 1 : 0) || a.nextVote - b.nextVote || a.id.localeCompare(b.id));
  // Overflow rolls to tomorrow rather than vanishing.
  for (const b of due.slice(max)) b.nextVote = sittingDayAfter(state, 1);
  return due.slice(0, max).map((b) => ({ billId: b.id, stage: b.stage }));
}

export function lineFor(bill, partyId) {
  if (partyId === 'ind' || !bill.lines[partyId]) return { line: 'free', position: null };
  return { line: bill.lines[partyId], position: bill.positions[partyId] };
}

// Report stage: the opposition may move amendments from the floor. In a minority they sometimes carry.
export function reportStageAmendments(state, bill, rng) {
  if (bill.kind !== 'government' || !rng.chance(tuning().bills.reportAmendmentOdds)) return null;
  const a = addAmendment(state, bill, rng, 'report');
  a.adopted = state.house.minority ? rng.chance(0.4) : rng.chance(0.08);
  if (a.adopted) applyAmendment(bill, a);
  return a;
}

// Before a confidence vote, the government counts. If it's short, it buys a smaller party's support with
// concessions; failing that, a bill (not supply) is declared not a matter of confidence. Parties that want
// an election won't deal. Stage 8 turns this into real confidence-and-supply agreements.
export function shoreUpConfidence(state, bill, predict) {
  if (bill.kind !== 'government' && bill.kind !== 'supply') return [];
  // Ordinary bills get the same treatment, just less reliably: sometimes the government lets one lose.
  if (!bill.confidence && createRng(`${state.seed}:${bill.id}:${bill.stage}:deal`).next() > tuning().bills.ordinaryDealOdds) return [];
  const notes = [];
  const gov = state.house.government;
  const margin = () => {
    const it = predict(createRng(`${state.seed}:${bill.id}:${bill.stage}:count`));
    let y = 0;
    let n = 0;
    for (const v of Object.values(it)) {
      if (!v.present) continue;
      if (v.vote === 'yea') y++;
      if (v.vote === 'nay') n++;
    }
    return y - n;
  };
  if (margin() > 1) return notes;
  const T = tuning().bills;
  const year = Math.floor(state.date.absWeek / tuning().calendar.weeksPerYear) + 1;
  const partners = Object.values(state.parties)
    .filter((p) => p.id !== gov && p.role !== 'opposition' && bill.positions[p.id] !== 'yea')
    .filter((p) => !(year >= T.confidenceAppetiteFromYear && (state.polling[p.id] || 0) - (p.seats / 120) * 100 > T.confidenceAppetiteMargin))
    .sort((a, b) => b.seats - a.seats);
  for (const p of partners) {
    bill.positions[p.id] = 'yea';
    bill.lines[p.id] = 'whipped';
    // The price: something for the partner's ridings.
    const theirs = Object.values(state.mps).filter((m) => m.party === p.id).map((m) => m.riding.id);
    for (const r of theirs.slice(0, 6)) if (!bill.beneficiaryRidings.includes(r)) bill.beneficiaryRidings.push(r);
    notes.push(say('log.bill.partnerBought', { party: p.name, bill: billName(bill) }));
    if (margin() > 1) return notes;
  }
  if (bill.kind !== 'supply' && margin() <= 0) {
    bill.confidence = false;
    notes.push(say('log.bill.notConfidence', { bill: billName(bill) }));
  }
  return notes;
}
