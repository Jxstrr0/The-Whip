// What the player knows about each MP: reveal sources, staleness, and the card view built from it.
import { tuning } from './config.js';

// Hidden attributes. Name, party, riding, seat and public role titles are always known.
export const HIDDEN_FIELDS = ['loyalty', 'ambition', 'ideology', 'interests', 'clique', 'cohort', 'mood', 'rapport', 'attendance', 'lifeEvents', 'secrets'];

function weekOf(state) {
  return state.date?.absWeek ?? 0;
}

function entry(state, mpId) {
  const k = state.player.knowledge;
  return (k[mpId] ||= {});
}

export function isKnown(state, mpId, field) {
  return !!state.player.knowledge[mpId]?.[field]?.known;
}

// Learn a field now. `source` is kept so the card can say where it came from.
export function reveal(state, mpId, field, source = 'meeting') {
  if (!state.mps[mpId] || mpId === state.player.mpId) return false;
  const e = entry(state, mpId);
  const was = e[field]?.known && !e[field]?.stale;
  e[field] = { known: true, asOf: weekOf(state), stale: false, source };
  return !was;
}

export function revealMany(state, mpId, fields, source) {
  return fields.filter((f) => reveal(state, mpId, f, source));
}

// Any contact refreshes everything already known about them.
export function touch(state, mpId) {
  const e = state.player.knowledge[mpId];
  state.player.contact ||= {};
  state.player.contact[mpId] = weekOf(state);
  if (!e) return;
  for (const f of Object.values(e)) {
    if (f.known) {
      f.stale = false;
      f.asOf = weekOf(state);
    }
  }
}

// Weekly: fields learned long ago with no contact since go stale and render faded.
export function decayKnowledge(state) {
  const limit = tuning().knowledge.staleWeeks;
  const now = weekOf(state);
  for (const [mpId, fields] of Object.entries(state.player.knowledge)) {
    const last = Math.max(state.player.contact?.[mpId] ?? -Infinity, ...Object.values(fields).map((f) => f.asOf ?? -Infinity));
    if (now - last < limit) continue;
    for (const f of Object.values(fields)) if (f.known) f.stale = true;
  }
}

// Everything the MP card may show: public facts plus each hidden field marked known, stale or unknown.
export function cardView(state, mpId) {
  const m = state.mps[mpId];
  const k = state.player.knowledge[mpId] || {};
  const own = mpId === state.player.mpId;
  const view = {
    id: m.id,
    name: `${m.name.first} ${m.name.last}`,
    party: m.party,
    riding: m.riding,
    seatId: m.seatId,
    role: m.caucusRole,
    isPlayer: own,
    fields: {},
  };
  for (const f of HIDDEN_FIELDS) {
    const known = own || !!k[f]?.known;
    view.fields[f] = { known, stale: !own && !!k[f]?.stale, value: known ? valueOf(state, m, f) : null, source: k[f]?.source };
  }
  return view;
}

function valueOf(state, m, f) {
  switch (f) {
    case 'clique':
      return m.clique ? state.cliques[m.clique]?.name : 'None';
    case 'secrets':
      return m.secrets.filter((s) => s.known).length;
    case 'lifeEvents':
      return m.lifeEvents.filter((e) => !e.resolvedBy);
    default:
      return m[f];
  }
}
