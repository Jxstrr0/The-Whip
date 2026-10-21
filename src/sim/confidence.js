// Confidence: confidence-and-supply agreements a minority government signs and either side can break,
// and the pressure meter: how close the leader's office is to replacing the whip.
import { data, tuning } from './config.js';
import { hooks, log } from './pacing.js';
import { lineFor } from './bills.js';
import { voteOf } from './vote.js';
import { demoteToBackbench } from './ranks.js';
import { headline } from './media.js';

const SIGN = { yea: 1, nay: -1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);

export function activeAgreement(state, partyId = null) {
  const gov = state.parties[state.house.government];
  if (!gov) return null;
  return (gov.agreements || []).find((a) => !a.broken && a.until > state.date.absWeek && (!partyId || a.with === partyId)) || null;
}

// A partner wants an election when its polling runs well ahead of its seats.
function wantsElection(state, party) {
  const C = tuning().confidence;
  return (state.polling[party.id] || 0) - (party.seats / 120) * 100 > C.breakAppetite;
}

export function signAgreement(state, rng, partnerId = null) {
  const C = tuning().confidence;
  const gov = state.parties[state.house.government];
  if (!gov || !state.house.minority || activeAgreement(state)) return null;
  const dist = (p) => Math.hypot(p.ideology.economy - gov.ideology.economy, p.ideology.social - gov.ideology.social);
  const partners = Object.values(state.parties).filter((p) => p.id !== gov.id && p.id !== 'ind' && p.role !== 'opposition' && p.seats > 0 && !wantsElection(state, p)).sort((a, b) => dist(a) - dist(b));
  const partner = partnerId ? state.parties[partnerId] : partners.find((p) => gov.seats + p.seats >= data().world.majority) || partners[0];
  if (!partner) return null;
  const interests = Object.values(state.mps).filter((m) => m.party === partner.id).flatMap((m) => m.interests);
  const counts = {};
  for (const i of interests) counts[i] = (counts[i] || 0) + 1;
  const category = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'their ridings';
  const a = { with: partner.id, gov: gov.id, category, from: state.date.absWeek, until: state.date.absWeek + C.agreementWeeks, broken: false };
  gov.agreements = [...(gov.agreements || []), a];
  partner.agreements = [...(partner.agreements || []), a];
  const A = data().career.agreement;
  log(state, fill(A.signed, { gov: gov.name, partner: partner.name, weeks: C.agreementWeeks, category: data().world.interestNames[category] || category }), 'confidence');
  return a;
}

export function breakAgreement(state, a, by = 'partner') {
  const gov = state.parties[a.gov];
  const partner = state.parties[a.with];
  a.broken = true;
  a.brokenBy = by;
  a.brokenWeek = state.date.absWeek;
  const A = data().career.agreement;
  log(state, fill(A.broken, { gov: gov.name, partner: partner.name, leader: partner.leader ? fullName(state.mps[partner.leader]) : 'their leader' }), 'confidence');
}

// Mondays: a minority government short of the majority looks for a partner; a partner that would rather
// have an election walks. Active agreements whip the partner YEA on confidence votes.
hooks.morning.push((state, rng) => {
  if (state.date.dayOfWeek !== 1 || !state.house.minority) return null;
  const C = tuning().confidence;
  const gov = state.parties[state.house.government];
  const a = activeAgreement(state);
  if (!a && rng.chance(C.agreementOdds)) signAgreement(state, rng);
  const live = activeAgreement(state);
  if (live) {
    const partner = state.parties[live.with];
    if (wantsElection(state, partner) && rng.chance(C.breakOdds * 4)) breakAgreement(state, live, 'partner');
    else if (rng.chance(C.breakOdds)) breakAgreement(state, live, 'partner');
    else {
      for (const b of Object.values(state.bills)) {
        if (b.status !== 'active' || !b.confidence || b.kind === 'oppositionMotion') continue;
        b.positions[partner.id] = 'yea';
        b.lines[partner.id] = 'whipped';
      }
    }
  }
  for (const x of gov.agreements || []) {
    if (!x.broken && !x.expiredNoted && x.until <= state.date.absWeek) {
      x.expiredNoted = true;
      log(state, fill(data().career.agreement.expired, { partner: state.parties[x.with].name }), 'confidence');
    }
  }
  return null;
});

// ---------- the pressure meter ----------

hooks.fallout.push((state) => {
  const C = tuning().confidence;
  const me = state.mps[state.player.mpId];
  let add = 0;
  for (const id of state.flow.day?.results || []) {
    const d = state.divisions[id];
    if (!d?.recorded) continue;
    const bill = state.bills[d.billId];
    const { line, position } = lineFor(bill, me.party);
    if (line !== 'whipped' || !SIGN[position]) continue;
    if (bill.confidence && !d.carried && state.house.government === me.party) add += C.pressureConfidenceLost;
    const rebels = (position === 'yea' ? d.nays : d.yeas).filter((mid) => state.mps[mid]?.party === me.party && mid !== me.id).length;
    if (state.player.act >= 3) add += rebels * C.pressureRebellion;
    const v = voteOf(d, me.id);
    if ((v === 'yea' || v === 'nay') && v !== position) add += C.pressurePlayerRebel;
  }
  if (add) state.pressure = clamp((state.pressure || 0) + add, 0, 100);
  return null;
});

hooks.weekend.push((state) => {
  const C = tuning().confidence;
  const p = state.player;
  // A meter that topped out during the week costs the whip their office at the weekend, before any decay.
  const toppedOut = (state.pressure || 0) >= C.pressureReplaced;
  state.pressure = clamp((state.pressure || 0) - C.pressureDecay, 0, 100);
  if (!toppedOut || state.ending) return null;
  const R = data().career.replaced;
  const leader = state.parties[state.mps[p.mpId].party]?.leader;
  const ctx = { leader: leader ? fullName(state.mps[leader]) : 'The leader' };
  if (p.act >= 3) {
    state.pressure = 40;
    const stop = demoteToBackbench(state, 'replaced');
    stop.text = fill(R.intro, ctx);
    stop.event = 'replaced';
    return stop;
  }
  state.pressure = 70;
  log(state, R.warn, 'career');
  return null;
});
