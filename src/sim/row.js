// Your row, read for the screens: who sits with you, which of them are friends, and where each stands on the
// next vote the whip's office will want delivered. Pure reads over the rules in ranks.js and count.js.
import { rowOf } from './ranks.js';
import { nextVote } from './tools.js';
import { markOf } from './count.js';

// Most worrying first: the ones to spend an evening on, then the ones already with you.
export const ROW_ORDER = ['lost', 'leaning', 'unmarked', 'absent', 'firm'];

export const rowIds = (state) => new Set(rowOf(state).map((m) => m.id));

// A friend: your cohort, or someone who likes you (the same test the row's set piece uses).
export function isFriend(state, m) {
  const me = state.mps[state.player.mpId];
  return m.cohort === me.cohort || (m.relations[me.id] || 0) > 30 || m.rapport > 25;
}

export function rowReport(state) {
  const bill = nextVote(state);
  const members = rowOf(state).map((m) => {
    const k = bill ? markOf(state, m.id, bill.id) : null;
    return { id: m.id, mark: k && !k.stale ? k.mark : 'unmarked', stale: !!k?.stale, friend: isFriend(state, m) };
  });
  members.sort((a, b) => ROW_ORDER.indexOf(a.mark) - ROW_ORDER.indexOf(b.mark));
  const counts = { firm: 0, leaning: 0, lost: 0, absent: 0, unmarked: 0 };
  for (const m of members) counts[m.mark]++;
  return { bill, members, counts };
}
