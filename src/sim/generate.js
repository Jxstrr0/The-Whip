// A whole Parliament from a seed: parties and the election result, ridings, 120 MPs, roles, cliques and links.
import { createRng, hashString } from './rng.js';
import { data, tuning } from './config.js';
import { buildCliques, buildRelations, assignMentors } from './relationships.js';

export const MOODS = ['cooperative', 'guarded', 'angry', 'anxious'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (n) => String(n).padStart(3, '0');

// How voters in each riding type and region tend to lean, before noise.
const TYPE_LEAN = { urban: [-20, -25], suburban: [5, 0], rural: [25, 25], northern: [-5, 10] };
const REGION_LEAN = { west: [-5, -10], prairie: [15, 10], central: [0, -5], east: [-5, 5], north: [-5, 5] };
const TYPE_INTERESTS = {
  urban: ['transit', 'housing', 'arts', 'immigration', 'health', 'labour', 'justice'],
  suburban: ['housing', 'transit', 'education', 'seniors', 'smallBusiness', 'health', 'roads'],
  rural: ['agriculture', 'rural', 'roads', 'energy', 'smallBusiness', 'seniors', 'trade'],
  northern: ['northern', 'energy', 'health', 'environment', 'roads'],
};
const REGION_INTERESTS = { west: ['environment', 'fisheries', 'trade'], prairie: ['agriculture', 'energy'], central: ['trade', 'immigration'], east: ['fisheries', 'seniors'], north: ['northern'] };

function ideoDist(a, b) {
  return Math.hypot(a.economy - b.economy, a.social - b.social);
}

// Riding towns fill the {town} slot: the place names inside the riding's name.
function townsOf(name) {
  const parts = name.split(/–|—| and /).map((p) => p.replace(/\b(Centre|North|South|East|West|Northeast|Northwest|Southeast|Southwest)\b/g, '').trim());
  return [...new Set(parts.filter(Boolean))];
}

function pickRidings(rng) {
  const D = data();
  const out = [];
  for (const prov of D.world.provinces) {
    const pool = rng.shuffle(D.ridings.ridings.filter((r) => r.province === prov.id));
    for (const r of pool.slice(0, prov.seats)) {
      const [te, ts] = TYPE_LEAN[r.type];
      const [re, rs] = REGION_LEAN[prov.region];
      out.push({
        name: r.name,
        province: prov.id,
        provinceName: prov.name,
        region: prov.region,
        type: r.type,
        lean: { economy: clamp(Math.round(te + re + rng.normal(0, 12)), -100, 100), social: clamp(Math.round(ts + rs + rng.normal(0, 12)), -100, 100) },
        towns: townsOf(r.name),
      });
    }
  }
  out.forEach((r, i) => (r.id = 'r' + pad(i + 1)));
  return out;
}

function buildParties(rng) {
  const D = data();
  const P = D.parties;
  const core = P.core.map((c) => ({ ...c, kind: 'core' }));
  const fifthT = rng.pick(D.partyNames.fifth);
  const aff = P.fifthAffinity[fifthT.kind];
  const fifth = { id: 'p5', name: fifthT.name, short: fifthT.short, color: P.fifthColor, home: fifthT.kind, kind: fifthT.kind, ideology: { ...fifthT.ideology }, ...aff };
  return [...core, fifth];
}

// Decide who governs and how many seats each party won, within the role ranges in data/parties.json.
function electionResult(rng, parties, { minority = false } = {}) {
  const R = data().parties.roles;
  const T = tuning().generate;
  const [nu, cp, ld, ec, fifth] = parties;
  let bigTwo = [nu, cp];
  if (rng.chance(T.bigPartySwapChance)) bigTwo = rng.chance(0.5) ? [nu, ld] : [cp, ld];
  const third = [nu, cp, ld].find((p) => !bigTwo.includes(p));
  const gov = rng.pick(bigTwo);
  const opp = bigTwo.find((p) => p !== gov);
  const seats = {};
  const independents = rng.int(...R.independents);
  seats[fifth.id] = rng.int(...R.minor);
  seats[ec.id] = rng.int(...R.regional);
  seats[third.id] = rng.int(...R.third);
  const rest = 120 - independents - seats[fifth.id] - seats[ec.id] - seats[third.id];
  const lo = Math.max(R.government[0], rest - R.opposition[1], Math.floor(rest / 2) + 1);
  // A scenario can ask for a minority: the government stays the largest party but short of the majority.
  const hi = Math.min(R.government[1], rest - R.opposition[0], minority ? data().world.majority - 1 : 999);
  seats[gov.id] = rng.int(Math.min(lo, hi), hi);
  seats[opp.id] = rest - seats[gov.id];
  const roles = { [gov.id]: 'government', [opp.id]: 'opposition', [third.id]: 'third', [ec.id]: 'regional', [fifth.id]: 'minor' };
  return { seats, roles, independents, gov: gov.id };
}

export function affinity(party, riding, rng) {
  const region = party.regionAffinity?.[riding.region] ?? 0;
  const type = party.typeAffinity?.[riding.type] ?? 0;
  return region + type - ideoDist(party.ideology, riding.lean) / 80 + rng.normal(0, 0.35);
}

// Give each party its seat count from the ridings that suit it best.
function allocateRidings(rng, ridings, parties, result) {
  const left = new Set(ridings.map((r) => r.id));
  const byId = new Map(ridings.map((r) => [r.id, r]));
  const owner = {};
  const take = (party, n) => {
    const scored = [...left].map((id) => [id, affinity(party, byId.get(id), rng)]).sort((a, b) => b[1] - a[1]);
    for (const [id] of scored.slice(0, n)) {
      owner[id] = party.id;
      left.delete(id);
    }
  };
  const byRole = (role) => parties.find((p) => result.roles[p.id] === role);
  take(byRole('regional'), result.seats[byRole('regional').id]);
  take(byRole('minor'), result.seats[byRole('minor').id]);
  take(byRole('third'), result.seats[byRole('third').id]);
  for (const id of rng.shuffle([...left]).slice(0, result.independents)) {
    owner[id] = 'ind';
    left.delete(id);
  }
  const gov = byRole('government');
  const opp = byRole('opposition');
  const scored = [...left].map((id) => [id, affinity(gov, byId.get(id), rng) - affinity(opp, byId.get(id), rng)]).sort((a, b) => b[1] - a[1]);
  scored.forEach(([id], i) => (owner[id] = i < result.seats[gov.id] ? gov.id : opp.id));
  return owner;
}

// Fresh names for new members: `taken` holds the first and last names already in the House.
export function uniqueNames(rng, n, taken = null) {
  const { first, last } = data().names;
  const usedFirst = new Set(taken?.first || []);
  const usedLast = new Set(taken?.last || []);
  const out = [];
  // Unique first and last names keep a 120-member House easy to tell apart on a phone.
  while (out.length < n) {
    const f = rng.pick(first);
    const l = rng.pick(last);
    if (usedFirst.has(f) || usedLast.has(l)) continue;
    usedFirst.add(f);
    usedLast.add(l);
    out.push({ first: f, last: l });
  }
  return out;
}

function pickInterests(rng, riding) {
  const pool = [...TYPE_INTERESTS[riding.type], ...TYPE_INTERESTS[riding.type], ...(REGION_INTERESTS[riding.region] || [])];
  const n = rng.weighted([1, 2, 3], (k) => [0.3, 0.45, 0.25][k - 1]);
  const out = new Set();
  while (out.size < n) out.add(rng.pick(pool));
  return [...out];
}

export function makeMp(rng, i, riding, partyId, partyRec, name, parliamentNo) {
  const D = data();
  const T = tuning().generate;
  const k = rng.weighted([0, 1, 2, 3, 4, 5, 6], (x) => T.cohortWeights[x]);
  const tenure = k === 0 ? 0 : Math.max(1, Math.round(k * T.yearsPerParliament + rng.float(-0.5, 0.8)));
  const home = partyRec ? partyRec.ideology : { economy: rng.normal(0, 30), social: rng.normal(0, 30) };
  const spread = T.ideologySpread;
  const ideo = (axis) => clamp(Math.round(home[axis] + rng.normal(0, spread) + (riding.lean[axis] - home[axis]) * T.ridingPull), -100, 100);
  const loyalty = clamp(Math.round(rng.normal(T.loyaltyMean, T.loyaltySd) + tenure * 0.4 - (partyId === 'ind' ? 25 : 0)), 5, 98);
  const secrets = [];
  const nSecrets = rng.weighted([0, 1, 2, 3], (x) => T.secretOdds[x]);
  for (let s = 0; s < nSecrets; s++) {
    const sk = rng.pick(D.backgrounds.secretKinds);
    secrets.push({ id: `x${pad(i)}${s}`, kind: sk.kind, severity: rng.int(1, 3), known: false });
  }
  return {
    id: 'm' + pad(i),
    name,
    age: clamp(Math.round(30 + tenure + rng.normal(12, 7)), 27, 79),
    party: partyId,
    caucusRole: 'backbencher',
    riding: { id: riding.id, name: riding.name, province: riding.provinceName, type: riding.type },
    margin: clamp(Math.round(Math.abs(rng.normal(T.marginMean, T.marginSd)) * (k === 0 ? 0.75 : 1) + 1), 1, 40),
    cohort: parliamentNo - k,
    tenure,
    clique: null,
    seatId: null,
    loyalty,
    ambition: clamp(Math.round(rng.normal(T.ambitionMean, T.ambitionSd)), 0, 100),
    ideology: { economy: ideo('economy'), social: ideo('social') },
    interests: pickInterests(rng, riding),
    committee: null,
    attendance: clamp(Math.round(rng.normal(T.attendanceMean, T.attendanceSd)), 40, 99),
    relations: {},
    mentor: null,
    proteges: [],
    rapport: 0,
    mood: rng.pick(MOODS),
    lifeEvents: [],
    secrets,
    floorCrossRisk: clamp(Math.round(rng.normal(6, 5) + (100 - loyalty) / 12), 0, 40),
    scandal: 0,
    bio: rng.pick(D.backgrounds.mpBios),
  };
}

// Leader, House Leader, whips, cabinet or shadow cabinet, parliamentary secretaries, committee chairs.
export function assignRoles(rng, party, members, isGov) {
  const free = new Set(members.map((m) => m.id));
  const byId = new Map(members.map((m) => [m.id, m]));
  // Score each candidate once: random draws inside a sort comparator would depend on the browser's sort.
  const choose = (score, filter = () => true) => {
    const pool = [...free].map((id) => byId.get(id)).filter(filter);
    if (!pool.length) return null;
    const scored = pool.map((m) => [m, score(m)]);
    scored.sort((a, b) => b[1] - a[1] || a[0].id.localeCompare(b[0].id));
    const m = scored[0][0];
    free.delete(m.id);
    return m;
  };
  const senior = (m) => m.tenure > 0;
  const n = members.length;
  const set = (m, role) => m && (m.caucusRole = role) && m.id;
  party.leader = set(choose((m) => m.tenure * 2 + m.ambition * 0.4 + rng.float(0, 10), senior) || choose(() => rng.next()), 'leader');
  party.houseLeader = n >= 8 ? set(choose((m) => m.tenure + m.loyalty * 0.3 + rng.float(0, 8), senior), 'houseLeader') : null;
  party.chiefWhip = n >= 2 ? set(choose((m) => m.loyalty + m.tenure + rng.float(0, 10), senior) || choose((m) => m.loyalty), 'chiefWhip') : null;
  party.deputyWhip = n >= 8 ? set(choose((m) => m.loyalty + m.tenure * 0.5 + rng.float(0, 10), senior), 'deputyWhip') : null;
  const aw = n >= 20 ? 3 : n >= 12 ? 1 : 0;
  party.assistantWhips = [];
  for (let i = 0; i < aw; i++) {
    const m = choose((x) => x.loyalty * 0.6 + x.ambition * 0.4 + rng.float(0, 10), senior);
    if (m) party.assistantWhips.push(set(m, 'assistantWhip'));
  }
  const front = isGov ? Math.min(18, Math.floor(n * 0.3)) : party.role === 'opposition' ? Math.min(14, Math.floor(n * 0.3)) : party.role === 'third' ? Math.min(5, Math.floor(n * 0.3)) : 0;
  for (let i = 0; i < front; i++) set(choose((m) => m.tenure + m.ambition * 0.15 + rng.float(0, 6), senior), isGov ? 'cabinet' : 'shadowCabinet');
  if (isGov) {
    for (let i = 0; i < Math.min(6, Math.floor(n / 9)); i++) set(choose((m) => m.ambition + rng.float(0, 20), senior), 'parliamentarySecretary');
  }
}

export function assignCommittees(rng, mps, committees, govId) {
  const load = Object.fromEntries(committees.map((c) => [c.id, 0]));
  const busy = new Set(['leader', 'cabinet', 'speaker', 'chiefWhip', 'houseLeader']);
  for (const m of rng.shuffle([...mps])) {
    if (busy.has(m.caucusRole)) continue;
    const fits = committees.filter((c) => c.interests.some((x) => m.interests.includes(x)) && load[c.id] < 10);
    const pool = fits.length ? fits : committees.filter((c) => load[c.id] < 10);
    if (!pool.length || rng.chance(0.08)) continue;
    const c = rng.pick(pool);
    m.committee = c.id;
    load[c.id]++;
  }
  // Government backbenchers chair most committees, as in Canada.
  const chairs = {};
  for (const c of committees) {
    const cand = mps.filter((m) => m.committee === c.id && m.party === govId && m.caucusRole === 'backbencher' && m.tenure > 0);
    if (cand.length) {
      const chair = cand.sort((a, b) => b.tenure - a.tenure)[0];
      chair.caucusRole = 'committeeChair';
      chairs[c.id] = chair.id;
    }
  }
  return chairs;
}

export function generateParliament(seed, { minority = false } = {}) {
  const D = data();
  const T = tuning().generate;
  const rng = createRng('parliament:' + seed);
  const parliamentNo = D.world.firstParliament;
  const partyDefs = buildParties(rng);
  const result = electionResult(rng, partyDefs, { minority });
  const ridings = pickRidings(rng);
  const owner = allocateRidings(rng, ridings, partyDefs, result);
  const names = uniqueNames(rng, ridings.length);

  const parties = {};
  for (const p of partyDefs) {
    const seats = Object.values(owner).filter((o) => o === p.id).length;
    parties[p.id] = {
      id: p.id,
      name: p.name,
      short: p.short,
      color: p.color,
      kind: p.kind,
      ideology: { ...p.ideology },
      role: result.roles[p.id],
      seats,
      leader: null,
      leaderPersonality: rng.pick(D.parties.leaderPersonalities),
      houseLeader: null,
      chiefWhip: null,
      deputyWhip: null,
      assistantWhips: [],
      cliques: [],
      morale: rng.int(50, 70),
      leaderTrust: {},
      agreements: [],
      whipAI: {
        style: rng.pick(D.parties.whipStyles),
        weeklyBudget: { time: Math.round(T.rivalTime * (0.6 + seats / 50)), favors: T.rivalFavors + Math.floor(seats / 25) },
        targets: [],
        digging: null,
      },
    };
  }

  const mps = {};
  ridings.forEach((r, i) => {
    const pid = owner[r.id];
    const m = makeMp(rng, i + 1, r, pid, parties[pid], names[i], parliamentNo);
    mps[m.id] = m;
  });
  const list = Object.values(mps);
  for (const p of Object.values(parties)) {
    assignRoles(rng, p, list.filter((m) => m.party === p.id), p.role === 'government');
  }

  // The Speaker: a senior government backbencher who leaves their desk for the chair.
  const speakerPool = list.filter((m) => m.party === result.gov && m.caucusRole === 'backbencher' && m.tenure >= 4);
  const speaker = (speakerPool.length ? speakerPool : list.filter((m) => m.party === result.gov && m.caucusRole === 'backbencher')).sort((a, b) => b.tenure - a.tenure)[0];
  speaker.caucusRole = 'speaker';

  const committees = D.world.committees.map((c) => ({ ...c, members: [] }));
  const chairs = assignCommittees(rng, list, committees, result.gov);
  for (const c of committees) {
    c.members = list.filter((m) => m.committee === c.id).map((m) => m.id);
    c.chair = chairs[c.id] || null;
  }

  const cliques = buildCliques(rng, parties, mps);
  buildRelations(rng, mps);
  assignMentors(rng, mps);

  const govSeats = parties[result.gov].seats;
  const totalPoll = {};
  for (const p of Object.values(parties)) totalPoll[p.id] = Math.max(1, (p.seats / 120) * 80 + rng.float(2, 8));
  const sum = Object.values(totalPoll).reduce((s, v) => s + v, 0);
  const polling = Object.fromEntries(Object.entries(totalPoll).map(([k, v]) => [k, Math.round((v / sum) * 1000) / 10]));

  return {
    parties,
    cliques,
    mps,
    ridings: Object.fromEntries(ridings.map((r) => [r.id, r])),
    committees: Object.fromEntries(committees.map((c) => [c.id, c])),
    house: { seats: 120, parliament: parliamentNo, government: result.gov, minority: govSeats < D.world.majority, speaker: speaker.id, independents: result.independents },
    polling,
    moods: MOODS,
  };
}

// A stable fingerprint of a generated Parliament, so tests and ?debug=1 can show two loads match.
export function parliamentHash(state) {
  const mps = Object.values(state.mps).map((m) => [m.id, m.name.first, m.name.last, m.party, m.riding.id, m.cohort, m.clique, m.loyalty, m.seatId, m.caucusRole, Object.keys(m.relations).length]);
  const cliques = Object.values(state.cliques).map((q) => [q.id, q.party, q.name, q.members.join(',')]);
  const parties = Object.values(state.parties).map((p) => [p.id, p.name, p.seats, p.role, p.leader, p.chiefWhip]);
  return hashString(JSON.stringify([mps, cliques, parties]));
}
