// Whom to invite tonight: up to three names worth a word, each with why. Pure reads; the office's invite
// picker shows them above the full list so a new member isn't left scrolling 119 strangers.
import { baseScore } from './mp.js';
import { nextVote } from './tools.js';
import { cliqueMates } from './relationships.js';

export function inviteSuggestions(state) {
  const meId = state.player.mpId;
  const me = state.mps[meId];
  const out = [];
  const taken = new Set([meId]);
  const add = (m, why, vars = {}) => {
    if (!m || taken.has(m.id) || m.caucusRole === 'speaker') return;
    taken.add(m.id);
    out.push({ id: m.id, why, vars });
  };
  // Your mentor knows people and wants to see you do well.
  add(state.mps[state.player.mentor], 'mentor');
  // Someone in your own party sitting on the fence on the next whipped vote: the closest call wins.
  const bill = nextVote(state);
  if (bill && bill.lines?.[me.party] === 'whipped') {
    const fence = Object.values(state.mps)
      .filter((m) => m.party === me.party && !taken.has(m.id) && m.caucusRole !== 'speaker')
      .map((m) => ({ m, s: Math.abs(baseScore(state, m, bill).score) }))
      .sort((a, b) => a.s - b.s || (a.m.id < b.m.id ? -1 : 1))[0];
    if (fence) add(fence.m, 'wavering', { bill: bill.title });
  }
  // The clique friend you're warmest with.
  const friend = cliqueMates(state, meId)
    .filter((m) => !taken.has(m.id))
    .sort((a, b) => b.rapport - a.rapport || (a.id < b.id ? -1 : 1))[0];
  add(friend, 'clique');
  return out.slice(0, 3);
}
