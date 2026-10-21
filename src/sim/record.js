// The whip's record and the ways a career ends: retirement, cabinet, an exit, the fall, a revolt. Also
// floor-crossing, which doesn't end a career but starts it again in another caucus.
import { data, tuning } from './config.js';
import { registerActions } from './actions.js';
import { log } from './pacing.js';
import { reseat } from './modes.js';
import { reputation } from './relationships.js';
import { remember, person } from './memoir.js';

const ROLE_RANK = { backbencher: 'Backbencher', committeeChair: 'Committee chair', assistantWhip: 'Assistant whip', deputyWhip: 'Deputy whip', chiefWhip: 'Chief Whip', parliamentarySecretary: 'Parliamentary secretary', cabinet: 'Minister' };

export function whipRecord(state) {
  const p = state.player;
  const me = state.mps[p.mpId];
  const r = p.record;
  return {
    votesWon: r.votesWon,
    votesLost: r.votesLost,
    confidenceSurvived: r.confidenceSurvived,
    promoted: r.promoted,
    expelled: r.expelled,
    promisesKept: r.promisesKept,
    promisesBroken: r.promisesBroken,
    mentored: (me.proteges || []).length + r.mentored,
    parliaments: r.parliaments,
    weeks: state.date.absWeek,
    act: Math.max(p.act, p.highestAct || 1),
    rank: ROLE_RANK[p.highestRole || me.caucusRole] || me.caucusRole,
    style: p.reputation && !['reliable', 'usefulTrouble'].includes(p.reputation) ? p.reputation : reputation(p) || p.reputation || 'unproven',
    ridingStanding: p.ridingStanding,
    name: `${me.name.first} ${me.name.last}`,
    riding: me.riding.name,
    party: state.parties[me.party]?.name || 'Independent',
  };
}

// Close the career. The ending stop shows the record; nothing moves past it.
export function endCareer(state, kind, extra = {}) {
  // The last page of the memoir (a lost seat already has its election night there).
  if (!['defeated', 'nomination'].includes(kind)) {
    const leader = state.parties[state.mps[state.player.mpId].party]?.leader;
    remember(state, 'ending', { sub: kind, ctx: { portfolio: extra.portfolio || 'a portfolio', leader: leader ? `${state.mps[leader].name.first} ${state.mps[leader].name.last}` : 'The leader' }, people: kind === 'cabinet' || kind === 'exit' ? [person(state, leader, data().memoir.notes.leader)] : [] });
  }
  state.ending = { endingKind: kind, week: state.date.absWeek, record: whipRecord(state), epilogue: data().career.ending[kind] || '', ...extra };
  state.flow.pending = { kind: 'ending', important: true, needsChoice: true, ...state.ending };
  log(state, `The whip's career ends: ${kind}.`, 'career');
  return state.flow.pending;
}

export function canRetire(state) {
  return state.player.act >= tuning().ranks.retireFromAct && !state.ending;
}

// Cross the floor: a new caucus, the bottom rung, your reputation in tow and your old ledger burned.
export function crossFloor(state, partyId) {
  const p = state.player;
  const me = state.mps[p.mpId];
  const R = tuning().ranks;
  const to = state.parties[partyId];
  if (!to || partyId === me.party || p.act < 2 || state.ending) return { ok: false };
  const from = state.parties[me.party];
  // The old caucus: every open promise to or from them is broken; their rapport collapses.
  for (const e of state.ledger) {
    const other = e.from === me.id ? e.to : e.to === me.id ? e.from : null;
    if (!other || !state.mps[other] || state.mps[other].party !== me.party) continue;
    if (!e.settled) { e.settled = true; e.kept = false; e.processed = true; }
  }
  for (const m of Object.values(state.mps)) if (m.party === me.party && m.id !== me.id) m.rapport = Math.max(-100, m.rapport + R.crossFloorRapport);
  if (from) {
    from.seats = Math.max(0, from.seats - 1);
    from.assistantWhips = from.assistantWhips.filter((id) => id !== me.id);
    if (from.deputyWhip === me.id) from.deputyWhip = null;
    if (from.chiefWhip === me.id) from.chiefWhip = from.deputyWhip || null;
  }
  if (me.clique && state.cliques[me.clique]) state.cliques[me.clique].members = state.cliques[me.clique].members.filter((id) => id !== me.id);
  me.clique = null;
  me.party = partyId;
  me.caucusRole = 'backbencher';
  me.committee = null;
  to.seats += 1;
  p.highestAct = Math.max(p.highestAct || 1, p.act);
  p.act = 1;
  p.actStart = state.date.absWeek;
  p.actProgress = { noticed: 0, rebellions: 0, rowVotesCarried: 0 };
  p.leaderTrust = 15;
  p.caucusSupport = 25;
  p.rival = null;
  p.mentor = null;
  p.whipFile = [];
  p.crossed = (p.crossed || 0) + 1;
  p.ridingStanding = Math.max(0, p.ridingStanding + R.crossFloorStanding);
  p.whipTrust[from?.id] = -40;
  delete p.whipTrust[partyId];
  reseat(state);
  remember(state, 'crossed', { ctx: { from: from ? from.name : 'your old party', to: to.name }, people: [person(state, to.leader, data().memoir.notes.tookYouIn)] });
  log(state, `You crossed the floor to ${to.name}. ${from ? from.name : 'Your old caucus'} won't forget it. You start again as a rookie, with your name going ahead of you.`, 'career');
  return { ok: true };
}

registerActions({
  retire(state) {
    if (!canRetire(state)) return { ok: false };
    return endCareer(state, 'retirement');
  },
  crossFloor: (state, a) => crossFloor(state, a.party),
});
