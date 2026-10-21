// Relationships: cliques, friend and rival links, mentors, rapport with the player, and reputation style.
import { data } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const STYLES = ['fixer', 'enforcer', 'conscience', 'operator', 'loyalist'];

function regionOf(state, mp) {
  return state.ridings ? state.ridings[mp.riding.id]?.region : null;
}

function fill(template, m) {
  return template.replace('{first}', m.name.first).replace('{last}', m.name.last);
}

function cliqueKindsFor(seats) {
  if (seats >= 30) return ['regional', 'wing', 'camp', 'social'];
  if (seats >= 12) return ['regional', 'wing', 'social'];
  if (seats >= 5) return ['regional', 'social'];
  return seats >= 2 ? ['social'] : [];
}

// Three or four cliques per caucus (fewer for small parties), each MP in at most one.
export function buildCliques(rng, parties, mps, ridingsById = null) {
  const C = data().cliques;
  const cliques = {};
  let n = 0;
  const region = (m) => (ridingsById ? ridingsById[m.riding.id]?.region : null) ?? data().world.provinces.find((p) => p.name === m.riding.province)?.region;
  for (const p of Object.values(parties)) {
    const members = Object.values(mps).filter((m) => m.party === p.id && m.caucusRole !== 'speaker');
    const kinds = cliqueKindsFor(members.length);
    const made = [];
    for (const kind of kinds) {
      const q = { id: 'q' + ++n, party: p.id, kind, name: '', members: [], lean: 0, leader: null, ideology: { ...p.ideology } };
      if (kind === 'regional') {
        const counts = {};
        for (const m of members) counts[region(m)] = (counts[region(m)] || 0) + 1;
        q.region = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        const opts = C.regional.filter((r) => r.region === q.region);
        q.name = (opts.length ? rng.pick(opts) : rng.pick(C.regional)).name;
        q.lean = Math.round(rng.normal(0, 20));
      } else if (kind === 'wing') {
        const wing = rng.weighted(C.wing, (w) => {
          const d = Math.hypot(w.lean.economy - p.ideology.economy, w.lean.social - p.ideology.social);
          return d > 15 && d < 70 ? 1 : 0.05;
        });
        q.name = wing.name;
        q.ideology = { economy: clamp(p.ideology.economy + (wing.lean.economy - p.ideology.economy) * 0.6, -100, 100), social: clamp(p.ideology.social + (wing.lean.social - p.ideology.social) * 0.6, -100, 100) };
        q.lean = Math.round(rng.normal(-10, 25));
      } else if (kind === 'camp') {
        const contender = members.filter((m) => m.caucusRole !== 'leader' && m.tenure > 0).sort((a, b) => b.ambition + b.tenure - (a.ambition + a.tenure))[0];
        if (!contender) continue;
        q.contender = contender.id;
        q.name = fill(rng.pick(C.camp), contender);
        q.lean = Math.round(rng.normal(-15, 20));
      } else {
        q.name = rng.pick(C.social.filter((s) => !made.some((x) => x.name === s)));
        q.lean = Math.round(rng.normal(10, 15));
      }
      made.push(q);
    }
    for (const m of members) {
      let best = null;
      let bestScore = data().tuning.generate.cliqueThreshold;
      for (const q of made) {
        let s = rng.float(0, 0.35);
        if (q.kind === 'regional') s += region(m) === q.region ? 0.55 : 0;
        if (q.kind === 'wing') s += 0.7 - Math.hypot(m.ideology.economy - q.ideology.economy, m.ideology.social - q.ideology.social) / 70;
        if (q.kind === 'camp') s += m.id === q.contender ? 5 : (m.ambition / 100) * 0.5 + (m.loyalty < 50 ? 0.15 : 0);
        if (q.kind === 'social') s += 0.15;
        if (s > bestScore) {
          bestScore = s;
          best = q;
        }
      }
      if (best) {
        best.members.push(m.id);
        m.clique = best.id;
      }
    }
    for (const q of made) {
      // A clique of one is just an MP; let them go unaffiliated.
      if (q.members.length < 2) {
        for (const id of q.members) mps[id].clique = null;
        continue;
      }
      const ms = q.members.map((id) => mps[id]);
      q.leader = q.contender || ms.sort((a, b) => b.tenure - a.tenure)[0].id;
      if (q.kind !== 'wing') {
        q.ideology = {
          economy: Math.round(ms.reduce((s, m) => s + m.ideology.economy, 0) / ms.length),
          social: Math.round(ms.reduce((s, m) => s + m.ideology.social, 0) / ms.length),
        };
      }
      cliques[q.id] = q;
      p.cliques.push(q.id);
    }
  }
  return cliques;
}

function link(a, b, v) {
  a.relations[b.id] = clamp(Math.round(v), -100, 100);
}

// Three to eight friend or rival links per MP, mostly inside their party, cohort and clique.
export function buildRelations(rng, mps) {
  const list = Object.values(mps);
  for (const m of list) {
    const want = rng.int(3, 8);
    let guard = 0;
    while (Object.keys(m.relations).length < want && guard++ < 60) {
      const o = rng.weighted(list, (x) => {
        if (x.id === m.id || m.relations[x.id] != null) return 0;
        let w = 0.2;
        if (x.party === m.party) w += 2;
        if (x.cohort === m.cohort) w += 1.5;
        if (x.clique && x.clique === m.clique) w += 2;
        if (x.riding.province === m.riding.province) w += 0.8;
        return w;
      });
      if (!o || o.id === m.id) break;
      // Rivals are likelier between ambitious MPs of the same party and cohort chasing the same jobs.
      const rivalOdds = 0.18 + (o.party === m.party && o.cohort === m.cohort ? (m.ambition + o.ambition) / 400 : 0) + (o.party !== m.party ? 0.1 : 0);
      const v = rng.chance(rivalOdds) ? -rng.int(25, 80) : rng.int(25, 85);
      link(m, o, v);
      if (o.relations[m.id] == null) link(o, m, v + rng.int(-15, 15));
    }
  }
}

// Most rookies get a senior mentor in their own party at the start.
export function assignMentors(rng, mps) {
  const list = Object.values(mps);
  const share = data().tuning.generate.mentorShare;
  for (const m of list.filter((x) => x.tenure === 0 && x.party !== 'ind')) {
    if (!rng.chance(share)) continue;
    const pool = list.filter((x) => x.party === m.party && x.tenure >= 7 && x.proteges.length < 2 && x.caucusRole !== 'speaker');
    if (!pool.length) continue;
    const mentor = rng.weighted(pool, (x) => 1 + (x.relations[m.id] > 0 ? 2 : 0) + x.loyalty / 100);
    m.mentor = mentor.id;
    mentor.proteges.push(m.id);
    if (m.relations[mentor.id] == null) link(m, mentor, rng.int(30, 60));
    if (mentor.relations[m.id] == null) link(mentor, m, rng.int(30, 60));
  }
}

export function cohortOf(state, mpId) {
  const m = state.mps[mpId];
  return Object.values(state.mps).filter((x) => x.cohort === m.cohort && x.id !== mpId);
}

export function cliqueMates(state, mpId) {
  const m = state.mps[mpId];
  if (!m.clique) return [];
  return state.cliques[m.clique].members.filter((id) => id !== mpId).map((id) => state.mps[id]);
}

export function adjustRapport(state, mpId, delta) {
  const m = state.mps[mpId];
  if (!m) return 0;
  const before = m.rapport;
  m.rapport = clamp(Math.round(m.rapport + delta), -100, 100);
  return m.rapport - before;
}

// A broken promise spreads: the wronged MP takes the full hit, their cohort and clique a share each.
export function spreadBrokenPromise(state, mpId, hit) {
  adjustRapport(state, mpId, -hit);
  const m = state.mps[mpId];
  const touched = new Set([mpId, state.player?.mpId]);
  for (const o of [...cohortOf(state, mpId).filter((x) => x.party === m.party), ...cliqueMates(state, mpId)]) {
    if (touched.has(o.id)) continue;
    touched.add(o.id);
    adjustRapport(state, o.id, -hit * (o.clique && o.clique === m.clique ? 0.5 : 0.35));
  }
}

export function addStyle(state, style, n = 1) {
  if (!style || !STYLES.includes(style)) return;
  state.player.style[style] = (state.player.style[style] || 0) + n;
}

// The visible reputation: whichever style the player has leaned on most, once there's a pattern.
export function reputation(player) {
  const entries = Object.entries(player.style).sort((a, b) => b[1] - a[1]);
  return entries[0] && entries[0][1] >= 3 ? entries[0][0] : null;
}
