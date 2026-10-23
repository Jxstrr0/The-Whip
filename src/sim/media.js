// The press gallery: one headline a day for the vote that mattered most, moving national polling and the
// player's standing at home. Scandal scores for members whose secrets get used.
import { data, tuning } from './config.js';
import { hooks, log, dissolution } from './pacing.js';
import { lineFor, billName } from './bills.js';
import { fill } from './fill.js';
import { voteOf } from './vote.js';

const SIGN = { yea: 1, nay: -1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
// Which story leads when a day has several.
const PRIORITY = ['confidenceLost', 'confidenceLostHandover', 'confidenceSurvived', 'billDefeated', 'playerRebelled', 'rebellion', 'closeVote', 'playerToedLine', 'billPassed'];
// Which story leads the weekend front page when a week has several (the day's lead list, plus what the week
// turned up outside the division lobby).
export const FRONT_PRIORITY = ['confidenceLost', 'confidenceLostHandover', 'confidenceSurvived', 'billDefeated', 'playerRebelled', 'expelled', 'walkout', 'rebellion', 'qpHit', 'leak', 'townHall', 'closeVote', 'absence', 'playerToedLine', 'qpRiding', 'qpParried', 'billPassed', 'qpLob', 'routine'];
// Stories the player is in: the front page runs their photograph beside these.
const PLAYER_EVENTS = new Set(['playerRebelled', 'expelled', 'playerToedLine', 'townHall', 'absence', 'qpHit', 'qpParried', 'qpLob', 'qpRiding']);

// Pick a headline for an event, filled in. Rotates papers so the same one isn't quoted every day.
export function headline(state, rng, event, ctx = {}) {
  const H = data().headlines;
  const pool = H.headlines.filter((h) => h.event === event);
  if (!pool.length) return null;
  const me = state.mps[state.player.mpId];
  const gov = state.parties[state.house.government];
  const base = { name: fullName(me), riding: me.riding.name, party: gov?.name || 'The government', leader: gov?.leader ? fullName(state.mps[gov.leader]) : 'The Prime Minister', paper: rng.pick(H.papers), bill: 'the bill', yeas: 0, nays: 0, count: 0 };
  const full = { ...base, ...ctx };
  const text = fill(rng.pick(pool).text, full);
  const decks = H.decks?.[event];
  const deck = decks?.length ? fill(rng.pick(decks), full) : null;
  state.press = [...(state.press || []), { day: state.date.absWeek * 5 + state.date.dayOfWeek, event, text, paper: full.paper, deck, you: PLAYER_EVENTS.has(event) }].slice(-30);
  log(state, `${full.paper}: ${text}`, 'press');
  return text;
}

// What the day's divisions give the gallery to write about.
function storiesOf(state) {
  const me = state.mps[state.player.mpId];
  const gov = state.house.government;
  const margin = tuning().pacing.closeVoteMargin;
  const out = [];
  for (const id of state.flow.day?.results || []) {
    const d = state.divisions[id];
    if (!d?.recorded) continue;
    const bill = state.bills[d.billId];
    const ctx = { bill: billName(bill), yeas: d.yeas.length, nays: d.nays.length };
    if (bill.confidence && bill.kind !== 'oppositionMotion') {
      // A fall early in the Parliament hands the House to the opposition; later it means an election.
      const handover = !d.carried && dissolution.canHandOver?.(state);
      const opp = Object.values(state.parties).find((q) => q.role === 'opposition');
      out.push({ event: d.carried ? 'confidenceSurvived' : handover ? 'confidenceLostHandover' : 'confidenceLost', ctx: { ...ctx, opposition: opp?.name || 'the opposition' }, bill });
    }
    else if (!d.carried && bill.kind === 'government') out.push({ event: 'billDefeated', ctx, bill });
    else if (Math.abs(d.yeas.length - d.nays.length) <= margin) out.push({ event: 'closeVote', ctx, bill });
    else if (d.carried && bill.kind !== 'oppositionMotion') out.push({ event: 'billPassed', ctx, bill });
    // Rebellions: the party with the most members voting against its own whipped line.
    let best = null;
    for (const p of Object.values(state.parties)) {
      const { line, position } = lineFor(bill, p.id);
      if (line !== 'whipped' || !SIGN[position]) continue;
      const rebels = (position === 'yea' ? d.nays : d.yeas).filter((mid) => state.mps[mid]?.party === p.id).length;
      if (rebels >= 2 && (!best || rebels > best.count)) best = { count: rebels, party: p.name };
    }
    if (best) out.push({ event: 'rebellion', ctx: { ...ctx, ...best }, bill });
    // The player's own vote against a whipped line, or for one their riding hated.
    const mine = lineFor(bill, me.party);
    const v = voteOf(d, me.id);
    if (mine.line === 'whipped' && SIGN[mine.position] && (v === 'yea' || v === 'nay')) {
      const hates = -(bill.ridingEffects[me.riding.type] || 0) * SIGN[mine.position] > 0.3;
      if (v !== mine.position) out.push({ event: 'playerRebelled', ctx, bill, hates });
      else if (hates) out.push({ event: 'playerToedLine', ctx, bill, hates });
    }
  }
  return out.sort((a, b) => PRIORITY.indexOf(a.event) - PRIORITY.indexOf(b.event));
}

// Scandal: what sticks to a member when their private life becomes a lever or a leak.
export function scandal(state, mpId, n) {
  const m = state.mps[mpId];
  if (!m) return;
  m.scandal = clamp((m.scandal || 0) + n, 0, 100);
}

hooks.fallout.push((state, rng) => {
  const M = tuning().media;
  const stories = storiesOf(state);
  const lead = stories[0];
  const gov = state.house.government;
  const p = state.player;
  if (lead) {
    headline(state, rng, lead.event, lead.ctx);
    const swing = M.pollSwing[lead.event] || 0;
    if (swing && state.polling[gov] != null) state.polling[gov] = Math.max(0.5, Math.round((state.polling[gov] + swing) * 10) / 10);
    // A rebellion the riding wanted plays well at home; a line they hated, toed, does not.
    if (lead.event === 'playerRebelled') p.ridingStanding = clamp(p.ridingStanding + (lead.hates ? M.playerStanding.playerRebelled : -1), 0, 100);
    if (lead.event === 'playerToedLine') p.ridingStanding = clamp(p.ridingStanding + M.playerStanding.playerToedLine, 0, 100);
  } else if ((state.flow.day?.results || []).length && rng.chance(M.routineOdds)) {
    const d = state.divisions[state.flow.day.results[0]];
    headline(state, rng, 'routine', { bill: billName(state.bills[d.billId]) });
  }
  return null;
});

// A week with no story of its own still gets a front page. Chosen by the week number, not the RNG, so a
// quiet week never reshuffles the draws that follow it.
export function quietLead(state) {
  const H = data().headlines;
  const me = state.mps[state.player.mpId];
  const week = state.date.absWeek;
  const pool = H.headlines.filter((h) => h.event === 'quiet');
  const decks = H.decks?.quiet || [];
  const ctx = { name: fullName(me), riding: me.riding.name };
  return {
    day: week * 5 + 5,
    event: 'quiet',
    quiet: true,
    text: fill(pool[week % pool.length].text, ctx),
    deck: decks.length ? fill(decks[(week * 7 + 3) % decks.length], ctx) : null,
    paper: H.papers[week % H.papers.length],
  };
}

// The weekend: scandal fades, the polls go on the record, and the week's press is sorted for the front page.
hooks.weekend.push((state) => {
  const M = tuning().media;
  for (const m of Object.values(state.mps)) if (m.scandal > 0) m.scandal = Math.max(0, m.scandal - M.scandalDecay);
  const week = state.date.absWeek;
  state.pollHistory = [...(state.pollHistory || []), { week, polling: { ...state.polling } }].slice(-M.pollHistoryWeeks);
  const rank = (e) => {
    const i = FRONT_PRIORITY.indexOf(e.event);
    return i < 0 ? FRONT_PRIORITY.length : i;
  };
  const press = (state.press || []).filter((e) => Math.floor((e.day - 1) / 5) === week).sort((a, b) => rank(a) - rank(b) || b.day - a.day);
  state.flow.week.press = press.length ? press : [quietLead(state)];
  return null;
});
