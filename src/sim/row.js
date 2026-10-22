// Your row, read for the screens: who sits with you, which of them are friends, and where each stands on the
// next vote the whip's office will want delivered. Pure reads over the rules in ranks.js and count.js.
import { rowOf } from './ranks.js';
import { nextVote, wantedSide } from './tools.js';
import { markOf } from './count.js';
import { scoreToVote } from './mp.js';
import { tuning } from './config.js';

// Most worrying first: the ones to spend an evening on, then the ones already with you.
export const ROW_ORDER = ['lost', 'leaning', 'unmarked', 'absent', 'firm'];

export const rowIds = (state) => new Set(rowOf(state).map((m) => m.id));

// A friend: your cohort, or someone who likes you (the same test the row's set piece uses).
export function isFriend(state, m) {
  const me = state.mps[state.player.mpId];
  return m.cohort === me.cohort || (m.relations[me.id] || 0) > 30 || m.rapport > 25;
}

// How the meter is drawn: the vote's zones on the decision score (below `lower` they vote nay, above `upper` yea,
// between them they sit it out), and where a member turns firm for the side the whip needs.
export function rowScale(want) {
  const V = tuning().vote;
  const firm = V.upper + tuning().tools.firmMargin;
  return { lower: V.lower, upper: V.upper, firm: want === 'yea' ? firm : -firm, span: 1 };
}

// `billId` names the vote to read the marks for; without it, the next vote the House will take.
// `want` is the side the whip needs from the row; each member's `score` is where the files put them on the
// nay-to-yea line (null when there's no read), and `why` says why an away mark is away.
export function rowReport(state, billId = null) {
  const bill = (billId && state.bills[billId]) || nextVote(state);
  const want = bill ? wantedSide(state, bill) : null;
  const members = rowOf(state).map((m) => {
    const k = bill ? markOf(state, m.id, bill.id) : null;
    const known = k && !k.stale;
    const mark = known ? k.mark : 'unmarked';
    const score = known ? k.score : null;
    const why = mark === 'absent' ? (score != null && scoreToVote(score, false) === 'abstain' ? 'undecided' : 'away') : null;
    return { id: m.id, mark, score, why, stale: !!k?.stale, friend: isFriend(state, m) };
  });
  members.sort((a, b) => ROW_ORDER.indexOf(a.mark) - ROW_ORDER.indexOf(b.mark));
  const counts = { firm: 0, leaning: 0, lost: 0, absent: 0, unmarked: 0 };
  for (const m of members) counts[m.mark]++;
  return { bill, want, scale: rowScale(want), members, counts };
}
