// The press gallery: one headline a day for the vote that mattered most, moving national polling and the
// player's standing at home. Scandal scores for members whose secrets get used.
import { data, tuning } from './config.js';
import { hooks, log } from './pacing.js';
import { lineFor } from './bills.js';
import { voteOf } from './vote.js';

const SIGN = { yea: 1, nay: -1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => `${m.name.first} ${m.name.last}`;
// Which story leads when a day has several.
const PRIORITY = ['confidenceLost', 'confidenceSurvived', 'billDefeated', 'playerRebelled', 'rebellion', 'closeVote', 'playerToedLine', 'billPassed'];

function fill(text, ctx) {
  return text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
}

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
  state.press = [...(state.press || []), { day: state.date.absWeek * 5 + state.date.dayOfWeek, event, text, paper: full.paper }].slice(-30);
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
    const ctx = { bill: bill.title, yeas: d.yeas.length, nays: d.nays.length };
    if (bill.confidence && bill.kind !== 'oppositionMotion') out.push({ event: d.carried ? 'confidenceSurvived' : 'confidenceLost', ctx, bill });
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
    headline(state, rng, 'routine', { bill: state.bills[d.billId].title });
  }
  return null;
});

hooks.weekend.push((state) => {
  const decay = tuning().media.scandalDecay;
  for (const m of Object.values(state.mps)) if (m.scandal > 0) m.scandal = Math.max(0, m.scandal - decay);
  return null;
});
