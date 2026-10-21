// A bot player for headless runs (tests.html): makes a random but legal choice at every stop.
import * as pacing from './pacing.js';
import { ACTIONS } from './actions.js';
import { cardPalette } from './meetings.js';

export function botAct(state, rng) {
  const p = state.flow.pending;
  if (!p) return pacing.next(state);
  switch (p.kind) {
    case 'division':
      return pacing.resolve(state, rng.pick(['line', 'line', 'rebel', 'absent']));
    case 'office': {
      const e = state.evening;
      if (e.whipCall && e.used + 1 <= e.slots && rng.chance(0.85)) return ACTIONS.meet(state, { whipCall: true });
      const w = e.walkIns.find((x) => !e.met.includes(x.mpId));
      if (w && e.used + 1 <= e.slots && rng.chance(0.8)) return ACTIONS.meet(state, { mpId: w.mpId });
      if (e.used + 0.5 <= e.slots && rng.chance(0.2)) {
        const ids = Object.keys(state.mps).filter((id) => id !== state.player.mpId);
        return ACTIONS.call(state, { mpId: rng.pick(ids) });
      }
      return pacing.resolve(state);
    }
    case 'meeting': {
      const mt = state.meetings[state.meeting];
      if (mt.phase === 'talk') return ACTIONS.talk(state, { index: rng.int(0, mt.talk.options.length - 1) });
      if (mt.deal.counter && mt.deal.message === 'counter') return rng.chance(0.6) ? ACTIONS.acceptCounter(state) : ACTIONS.leaveMeeting(state);
      const pal = cardPalette(state, mt);
      const offers = [...mt.deal.offers];
      const asks = [...mt.deal.asks];
      if (rng.chance(0.3)) asks.push(rng.pick(pal.asks));
      if (rng.chance(0.2)) offers.push(rng.pick(pal.offers));
      return ACTIONS.propose(state, { offers: [...new Set(offers)], asks: [...new Set(asks)] });
    }
    default:
      return pacing.resolve(state, null);
  }
}

// Play until the Parliament is dissolved (or a step limit), returning a few counts.
export function botPlayParliament(state, rng, limit = 400000) {
  const seen = {};
  for (let i = 0; i < limit; i++) {
    const p = state.flow.pending;
    if (p?.kind === 'dissolved') break;
    if (p) seen[p.kind] = (seen[p.kind] || 0) + 1;
    botAct(state, rng);
  }
  return seen;
}
