// The memoir: the moments that made a career, written down as they happen. Each entry keeps the day, the
// rank you held then, a line from data/memoir.json and the people in it. People are kept as a name and a
// party as well as an id, because members leave the House and their records go with them. Lines are dealt
// from a stream seeded by the game's seed and the kind of moment, never from the game's RNG, so writing
// something down can't change what happens next.
import { data, tuning } from './config.js';
import { createRng } from './rng.js';

const fullName = (m) => `${m.name.first} ${m.name.last}`;
const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

// Small numbers in words, the way a margin is said out loud: "three short", "by eleven".
export function inWords(n) {
  return WORDS[n] ?? String(n);
}

// A name list that reads: "A", "A and B", "A, B and C".
function names(list) {
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

// A member as the memoir keeps them. `id` is null for people who never sat (the candidate who ran second).
export function person(state, id, note = '') {
  const m = id && (state.mps[id] || state.alumni?.[id]);
  if (!m) return null;
  return { id, name: fullName(m), party: m.party, note };
}

function notes() {
  return data().memoir.notes;
}

// Lines for a kind of moment come round in a shuffled order, so the same line isn't used twice until the
// rest have been.
function deal(state, key, pool, nth) {
  if (!pool?.length) return '';
  const order = createRng(`${state.seed}:memoir:${key}`).shuffle(pool.map((_, i) => i));
  return pool[order[nth % order.length]];
}

// Write a moment down. `sub` picks the variant (accepted, declined...); `once` keeps only the first of its
// kind; `aside` is a sentence the caller built from the moment's details, added after the line.
export function remember(state, kind, { sub = null, ctx = {}, people = [], once = false, aside = '' } = {}) {
  const def = data().memoir?.kinds?.[kind];
  const lines = sub ? def?.[sub] : def;
  if (!lines?.text) return null;
  const key = sub ? `${kind}.${sub}` : kind;
  if (!state.memoir) {
    state.memoir = [];
    // A save from before the memoir (new games start with one): it begins here, and says so.
    state.memoirFrom = state.date.absWeek;
  }
  if (once && state.memoir.some((e) => e.kind === kind)) return null;
  const nth = state.memoir.filter((e) => e.key === key).length;
  const me = state.mps[state.player.mpId];
  const full = { nth: ordinal(state.house.parliament), riding: me.riding.name, party: state.parties[me.party]?.name || 'the party', ...ctx };
  const title = capFirst(fill(deal(state, `${key}:title`, lines.title, nth), full));
  const text = [fill(deal(state, `${key}:text`, lines.text, nth), full), aside].filter(Boolean).join(' ');
  state.memoirSeq = (state.memoirSeq || 0) + 1;
  const entry = {
    n: state.memoirSeq,
    kind,
    key,
    week: state.date.absWeek,
    day: state.date.dayOfWeek,
    parliament: state.house.parliament,
    act: state.player.act,
    role: me.caucusRole,
    title,
    text,
    tone: lines.tone || def.tone || 'grey',
    people: people.filter(Boolean).slice(0, tuning().memoir.peoplePerEntry),
  };
  state.memoir.push(entry);
  // A long career drops its smallest moments first; the openings, firsts and turning points stay.
  const cap = tuning().memoir.cap;
  while (state.memoir.length > cap) {
    const i = state.memoir.findIndex((e) => data().memoir.kinds[e.kind]?.minor);
    state.memoir.splice(i >= 0 ? i : 1, 1);
  }
  return entry;
}

// ---------- moments that need some working out ----------

const leaderOf = (state) => state.parties[state.mps[state.player.mpId].party]?.leader;
const whipOf = (state) => {
  const party = state.parties[state.mps[state.player.mpId].party];
  return party?.chiefWhip && party.chiefWhip !== state.player.mpId ? party.chiefWhip : null;
};
export { leaderOf, whipOf };

// A recorded division. A confidence vote goes in when it mattered: the first one, a close one, one that
// brought a government down, one your own side's rebels or absentees could have turned, one you fetched
// members in for, or one where you crossed your line. It
// keeps the margin and the members of your own party who decided it (the ones who broke, the ones away, the
// ones fetched in on the bells, the ones paired off). The first time you vote against your own line goes in too.
export function rememberDivision(state, result) {
  if (!result?.recorded) return;
  const bill = state.bills[result.billId];
  if (!bill) return;
  const M = data().memoir;
  const N = notes();
  const pid = state.player.mpId;
  const me = state.mps[pid];
  const vote = (id) => (result.yeas.includes(id) ? 'yea' : result.nays.includes(id) ? 'nay' : null);
  const pos = result.positions?.[me.party];
  const whipped = result.lines?.[me.party] === 'whipped' && (pos === 'yea' || pos === 'nay');
  const mine = vote(pid);
  const rebelled = whipped && mine && mine !== pos;
  const ours = (ids) => (ids || []).filter((id) => id !== pid && state.mps[id]?.party === me.party && state.mps[id].caucusRole !== 'speaker');
  const rebels = whipped ? ours(pos === 'yea' ? result.nays : result.yeas) : [];
  const ctx = { bill: bill.title, line: (pos || '').toUpperCase(), vote: (mine || '').toUpperCase(), yeas: result.yeas.length, nays: result.nays.length };

  if (bill.confidence) {
    const margin = Math.abs(result.yeas.length - result.nays.length);
    const fell = state.house.fallen?.divisionId === result.id;
    const gov = state.house.government === me.party;
    const sub = margin === 0 ? (fell ? 'castingFell' : 'castingHeld') : gov ? (fell ? 'govFell' : 'govHeld') : fell ? 'oppToppled' : 'oppFailed';
    const away = ours(result.absent);
    const chased = Object.keys(state.chased?.[bill.id] || {}).filter((id) => ours([id]).length && vote(id));
    const paired = ours((result.paired || []).flat());
    const first = !state.memoir?.some((e) => e.kind === 'confidence');
    // Your own side's absentees and rebels count when they could have turned it.
    const decisive = (rebels.length || away.length) && rebels.length * 2 + away.length >= margin;
    if (!(first || fell || rebelled || decisive || chased.length || margin <= tuning().memoir.closeMargin)) return;
    const people = [
      ...rebels.map((id) => person(state, id, N.rebel)),
      ...away.map((id) => person(state, id, N.away)),
      ...chased.map((id) => person(state, id, N.chased)),
      ...paired.map((id) => person(state, id, N.paired)),
    ].slice(0, tuning().memoir.confidencePeople);
    const asides = [];
    const say = (tpl, c) => capFirst(fill(tpl, c));
    const named = (list) => names(list.map((id) => fullName(state.mps[id])));
    if (rebelled) asides.push(say(M.asides.youRebelled, ctx));
    if (rebels.length) asides.push(say(rebels.length === 1 ? M.asides.rebelOne : M.asides.rebels, { names: named(rebels.slice(0, 3)), n: inWords(rebels.length) }));
    if (away.length && (fell === gov || margin <= away.length)) asides.push(say(away.length === 1 ? M.asides.awayOne : M.asides.away, { names: named(away.slice(0, 3)), n: inWords(away.length) }));
    if (chased.length) asides.push(say(chased.length === 1 ? M.asides.chasedOne : M.asides.chased, { names: named(chased.slice(0, 3)), n: inWords(chased.length) }));
    remember(state, 'confidence', { sub, ctx: { ...ctx, margin: inWords(margin), by: `by ${inWords(margin)}`, short: `${inWords(margin)} short`, Short: capFirst(`${inWords(margin)} short`) }, people, aside: asides.join(' ') });
    return;
  }
  if (rebelled) {
    const whip = whipOf(state);
    remember(state, 'firstRebellion', {
      once: true,
      ctx: { ...ctx, whip: whip ? fullName(state.mps[whip]) : M.fallback.whip },
      people: [person(state, whip, N.whip), ...rebels.slice(0, 3).map((id) => person(state, id, N.withYou))],
      aside: rebels.length ? fill(rebels.length === 1 ? M.asides.withYouOne : M.asides.withYou, { names: names(rebels.slice(0, 3).map((id) => fullName(state.mps[id]))), n: inWords(rebels.length) }) : fill(M.asides.alone, ctx),
    });
  }
}

// Your own bill's second reading: whether it passed, and what became of the votes you asked for.
export function rememberPmb(state, bill, res) {
  const M = data().memoir;
  const N = notes();
  const asked = state.player.pmb?.asked || [];
  const how = (id) => (res.yeas?.includes(id) ? N.votedFor : res.nays?.includes(id) ? N.votedAgainst : N.stayedAway);
  const kept = asked.filter((id) => res.yeas?.includes(id)).length;
  const margin = Math.abs((res.yeas?.length ?? res.yeasCount ?? 0) - (res.nays?.length ?? res.naysCount ?? 0));
  const aside = asked.length ? fill(kept === asked.length ? M.asides.askedAll : kept ? M.asides.askedSome : M.asides.askedNone, { n: inWords(asked.length), kept: inWords(kept) }) : M.asides.askedNobody;
  remember(state, 'pmb', { sub: res.carried ? 'passed' : 'defeated', ctx: { bill: bill.title, by: margin ? `by ${inWords(margin)}` : 'on the Speaker’s casting vote' }, people: asked.map((id) => person(state, id, how(id))), aside });
}
