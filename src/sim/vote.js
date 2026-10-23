// Putting the question: the voice vote, the division bells, the standing count, pairs, and the Speaker's tie.
import { tuning } from './config.js';
import { intentions } from './mp.js';
import { STAGE_NAMES, advanceBill, dayIndex, billName } from './bills.js';

const pad = (n) => String(n).padStart(4, '0');

function seatOrder(seatId) {
  if (!seatId) return 999;
  const n = Number(seatId.slice(1)) - 1;
  const side = n < 60 ? 0 : 1;
  const row = Math.floor((n % 60) / 15);
  const idx = n % 15;
  // Members are read row by row from the front, each row from the Speaker's end, government side first.
  return row * 100 + side * 20 + idx;
}

export function questionText(bill, stage) {
  if (stage === 'motion') return bill.kind === 'supply' ? `That the ${bill.title} be concurred in` : `That the motion be agreed to: ${bill.title}`;
  return `That ${billName(bill)} be read ${stage === 'report' ? 'concurred in at report stage' : `a ${stage === 'second' ? 'second' : 'third'} time`}`;
}

// Speaker's casting vote, by convention (Denison's rule): keep the question open for further debate where
// that's possible (second reading, report stage), otherwise leave things as they are (no).
export function speakerCastingVote(stage) {
  return stage === 'second' || stage === 'report' ? 'yea' : 'nay';
}

// Put the question. Returns the intentions and whether at least five members rise to force a recorded division.
export function putQuestion(state, item, rng, overrides = {}) {
  const bill = state.bills[item.billId];
  const intents = intentions(state, bill, rng, overrides);
  const paired = new Set();
  for (const p of state.pairs) {
    if (p.broken || (p.bill && p.bill !== bill.id)) continue;
    paired.add(p.a);
    paired.add(p.b);
  }
  let yeas = 0;
  let nays = 0;
  for (const [id, it] of Object.entries(intents)) {
    if (!it.present || paired.has(id)) continue;
    if (it.vote === 'yea') yeas++;
    if (it.vote === 'nay') nays++;
  }
  const voiceCarried = yeas >= nays;
  // Divisions are demanded by parties, or by members who feel strongly; a mild grumble doesn't stand up.
  const losing = voiceCarried ? 'nay' : 'yea';
  let rising = 0;
  for (const [id, it] of Object.entries(intents)) {
    if (!it.present || paired.has(id) || it.vote !== losing) continue;
    if (it.position === losing || Math.abs(it.score) > tuning().vote.riseConviction) rising++;
  }
  const division = rising >= tuning().vote.divisionMinRising || !!bill.confidence;
  return { item, bill, intents, paired, voice: { yeas, nays, carried: voiceCarried }, division };
}

// The standing count: yeas then nays, each read in seat order; paired members don't count either way.
export function runDivision(state, q) {
  const { bill, intents, paired, item } = q;
  const yeas = [];
  const nays = [];
  const absent = [];
  for (const [id, it] of Object.entries(intents)) {
    if (paired.has(id)) continue;
    if (!it.present) absent.push(id);
    else if (it.vote === 'yea') yeas.push(id);
    else if (it.vote === 'nay') nays.push(id);
    else absent.push(id);
  }
  const bySeat = (a, b) => seatOrder(state.mps[a].seatId) - seatOrder(state.mps[b].seatId);
  yeas.sort(bySeat);
  nays.sort(bySeat);
  let speakerVote = null;
  let carried = yeas.length > nays.length;
  if (yeas.length === nays.length) {
    speakerVote = speakerCastingVote(item.stage);
    carried = speakerVote === 'yea';
  }
  state.divisionSeq = (state.divisionSeq || 0) + 1;
  const pairs = state.pairs.filter((p) => !p.broken && (!p.bill || p.bill === bill.id)).map((p) => [p.a, p.b]);
  return {
    id: 'd' + pad(state.divisionSeq),
    billId: bill.id,
    title: bill.title,
    stage: item.stage,
    question: questionText(bill, item.stage),
    day: dayIndex(state.date),
    date: { ...state.date },
    recorded: true,
    confidence: bill.confidence,
    scheduled: bill.scheduled,
    yeas,
    nays,
    absent,
    paired: pairs,
    speakerVote,
    carried,
    lines: { ...bill.lines },
    positions: { ...bill.positions },
  };
}

// A voice vote with no division: carried or lost on the Speaker's judgement of the shouts.
export function voiceResult(state, q) {
  state.divisionSeq = (state.divisionSeq || 0) + 1;
  return {
    id: 'd' + pad(state.divisionSeq),
    billId: q.bill.id,
    title: q.bill.title,
    stage: q.item.stage,
    question: questionText(q.bill, q.item.stage),
    day: dayIndex(state.date),
    date: { ...state.date },
    recorded: false,
    confidence: q.bill.confidence,
    carried: q.voice.carried,
    yeasCount: q.voice.yeas,
    naysCount: q.voice.nays,
  };
}

export function voteOf(result, mpId) {
  if (!result.recorded) return null;
  if (result.yeas.includes(mpId)) return 'yea';
  if (result.nays.includes(mpId)) return 'nay';
  if (result.paired.some(([a, b]) => a === mpId || b === mpId)) return 'paired';
  return 'absent';
}

// Record a result: store it, move the bill on, settle vote promises, and note a fallen government.
export function recordResult(state, result, rng) {
  state.divisions ||= {};
  state.divisions[result.id] = result;
  const bill = state.bills[result.billId];
  bill.results.push(result.id);
  // Report-stage motions from the floor: decided before concurrence, mostly lost unless the House is split.
  advanceBill(state, bill, result.carried, rng);
  if (result.recorded) {
    for (const e of state.ledger) {
      if (e.settled || e.kind !== 'promise') continue;
      const [k, billId, v] = String(e.what).split(':');
      if (k !== 'vote' || billId !== bill.id) continue;
      const actual = voteOf(result, e.from);
      e.settled = true;
      e.kept = actual === v;
      e.settledDay = result.day;
    }
  }
  if (!result.carried && bill.confidence && bill.kind !== 'oppositionMotion') {
    state.house.fallen = { day: result.day, billId: bill.id, divisionId: result.id };
  }
  pruneHistory(state);
  return result;
}

// Keep saves small: old division rolls collapse to counts after a while.
function pruneHistory(state) {
  const ids = Object.keys(state.divisions);
  if (ids.length <= 80) return;
  for (const id of ids.slice(0, ids.length - 80)) {
    const d = state.divisions[id];
    if (!d.recorded || d.compact) continue;
    const me = state.player?.mpId;
    d.yeasCount = d.yeas.length;
    d.naysCount = d.nays.length;
    d.playerVote = me ? voteOf(d, me) : null;
    d.yeas = [];
    d.nays = [];
    d.absent = [];
    delete d.question;
    delete d.lines;
    delete d.paired;
    delete d.positions;
    delete d.date;
    d.compact = true;
  }
  // Dead bills from long ago keep their title and results, not their details.
  const cutoff = state.date.absWeek * 5 - 200;
  for (const b of Object.values(state.bills)) {
    if (b.status === 'active' || b.compact || b.introduced > cutoff) continue;
    for (const k of ['summary', 'ridingEffects', 'regionEffects', 'beneficiaryRidings', 'lines', 'amendments']) delete b[k];
    b.compact = true;
  }
}

export function stageLabel(stage) {
  return STAGE_NAMES[stage] || stage;
}

export function tally(result) {
  if (!result.recorded) return `${result.carried ? 'carried' : 'defeated'} on a voice vote`;
  const y = result.compact ? result.yeasCount : result.yeas.length;
  const n = result.compact ? result.naysCount : result.nays.length;
  return `${y}–${n}${result.speakerVote ? ', Speaker casting' : ''}`;
}
