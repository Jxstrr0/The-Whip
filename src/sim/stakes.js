// Stakes: what a vote, a favour or a deal card would do for the player's riding (and the whip), read from the
// same rules the choice runs on. Pure reads; the screens use them to say what an ask costs at home up front.
import { tuning } from './config.js';
import { baseScore } from './mp.js';
import { dilemmaFor, homePull, voteEffects } from './career.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const me = (state) => state.mps[state.player.mpId];

// Which way the riding leans on a bill and how hard: { side, pull, level } or null when it hardly cares.
export function homeLean(state, bill) {
  const S = tuning().stakes;
  const pull = homePull(baseScore(state, me(state), bill).parts);
  const a = Math.abs(pull);
  if (a < S.noLean) return null;
  return { side: pull > 0 ? 'yea' : 'nay', pull, level: a > S.strong ? 'strong' : a > S.firm ? 'firm' : 'mild' };
}

// Casting `choice` (yea, nay or absent) on a bill: the change in riding standing and in the whip's rapport.
// Only whipped votes move either; a free vote costs nothing with the office.
export function voteStakes(state, bill, choice) {
  const party = me(state).party;
  const position = bill.positions[party];
  const whipped = bill.lines[party] === 'whipped' && ['yea', 'nay'].includes(position);
  const base = { riding: 0, whip: 0, lean: homeLean(state, bill), whipped, rebel: false };
  if (!whipped) return base;
  const kind = choice === 'absent' ? 'absent' : choice === position ? 'line' : 'rebel';
  const fx = voteEffects(bill, kind, dilemmaFor(state, bill, baseScore, tuning().pacing), tuning().player);
  return { ...base, riding: Math.round(fx.riding), whip: Math.round(fx.whip), rebel: kind === 'rebel' };
}

// A bill's stakes in full, for a scene about it: the line, the riding's lean, and what each way of voting does.
export function billStakes(state, bill) {
  const position = bill.positions[me(state).party];
  const whipped = bill.lines[me(state).party] === 'whipped' && ['yea', 'nay'].includes(position);
  const against = position === 'yea' ? 'nay' : 'yea';
  return {
    billId: bill.id,
    whipped,
    position,
    lean: homeLean(state, bill),
    line: voteStakes(state, bill, position),
    rebel: whipped ? voteStakes(state, bill, against) : null,
  };
}

// The bill a co-sponsorship would put the player's name to: the counterpart's own active bill.
export function cosponsorBill(state, mpId) {
  return Object.values(state.bills).find((b) => b.sponsor === mpId && b.status === 'active') || null;
}

function cosponsorRiding(state, mpId) {
  const bill = cosponsorBill(state, mpId);
  if (!bill) return { bill: null, riding: 0 };
  const pull = homePull(baseScore(state, me(state), bill).parts);
  return { bill, riding: Math.round(clamp(pull, -1, 1) * tuning().meetings.cosponsorRiding) };
}

// What a deal card does for the player. `side` is 'give' (the player puts it on the table) or 'get' (it comes
// to them). Returns { riding, whip, note } with whichever parts apply, or null when it has nothing to do with home.
export function cardStakes(state, card, side, mpId = null) {
  const [k, billId, v] = card.split(':');
  const P = tuning().player;
  switch (k) {
    case 'vote': {
      const bill = state.bills[billId];
      if (!bill || side !== 'give') return null;
      const s = voteStakes(state, bill, v);
      return s.whipped || s.lean ? { riding: s.riding, whip: s.whip, lean: s.lean, rebel: s.rebel, billId, vote: v } : null;
    }
    case 'cosponsor': {
      if (side !== 'give') return null;
      const c = cosponsorRiding(state, mpId);
      return c.bill ? { riding: c.riding, billId: c.bill.id } : null;
    }
    case 'ridingMention':
      return side === 'get' ? { riding: P.ridingMentionStanding } : null;
    case 'ridingProject':
      return side === 'get' ? { riding: P.ridingProjectStanding, note: 'announce' } : null;
    case 'leave':
      return side === 'get' ? { riding: 0, note: 'home' } : null;
    default:
      return null;
  }
}

// Co-signing a bill puts your name on it at home: the effect the deal card promised.
export function applyCosponsor(state, mpId) {
  const { bill, riding } = cosponsorRiding(state, mpId);
  if (!bill) return null;
  const p = state.player;
  p.ridingStanding = clamp(p.ridingStanding + riding, 0, 100);
  return { bill, riding };
}
