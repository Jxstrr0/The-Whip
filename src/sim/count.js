// The count board's marks (firm, leaning, lost, absent) and the whip's prediction for each upcoming vote.
// From act 3 the whip's office shares its files, so the player's own caucus is marked every sitting morning;
// before that, marks come only from what the player has done (meetings, tools, watching votes).
import { tuning } from './config.js';
import { hooks, isSittingWeek } from './pacing.js';
import { baseScore, scoreToVote, intentions } from './mp.js';
import { lineFor, dayIndex } from './bills.js';
import { wantedSide } from './tools.js';

const SIGN = { yea: 1, nay: -1 };
export const MARKS = ['firm', 'leaning', 'lost', 'absent'];

function markFromScore(state, m, bill, score) {
  const T = tuning().tools;
  const V = tuning().vote;
  const s = SIGN[wantedSide(state, bill)];
  const v = scoreToVote(score, false);
  if (v === 'abstain' || m.attendance < T.absenteeAttendance || state.leaves?.[bill.id]?.[m.id] === 'granted') return 'absent';
  if (s * score > V.upper + T.firmMargin) return 'firm';
  if (s * score > V.lower) return 'leaning';
  return 'lost';
}

// Mark one MP now, from the decision model (what a whip's office would conclude from the files).
export function setMark(state, mpId, billId, mark = null) {
  const bill = state.bills[billId];
  const m = state.mps[mpId];
  if (!bill || !m) return null;
  state.countBoard ||= {};
  state.countBoard[billId] ||= {};
  const value = mark || markFromScore(state, m, bill, baseScore(state, m, bill).score);
  state.countBoard[billId][mpId] = { mark: value, asOf: dayIndex(state.date) };
  return value;
}

export function markOf(state, mpId, billId) {
  const e = state.countBoard?.[billId]?.[mpId];
  if (!e) return null;
  const stale = dayIndex(state.date) - e.asOf > tuning().tools.markStaleDays;
  return { mark: e.mark, stale };
}

// Mark the player's whole caucus for a bill (the office files), or everyone (a perfect count, for tests).
export function refreshMarks(state, billId, { all = false } = {}) {
  const party = state.mps[state.player.mpId].party;
  for (const m of Object.values(state.mps)) {
    if (m.caucusRole === 'speaker') continue;
    if (!all && m.party !== party) continue;
    setMark(state, m.id, billId);
  }
}

// A deterministic read of everyone's intentions: no noise, everyone present. The prediction weights each
// vote by attendance, and replaces it with the board's mark where the player has one.
const STILL = { normal: () => 0, next: () => 0, chance: () => false, pick: (a) => a[0], shuffle: (a) => a, int: () => 0 };

export function prediction(state, billId) {
  const T = tuning().tools;
  const bill = state.bills[billId];
  const out = { yeas: 0, nays: 0, needed: 0, firm: 0, leaning: 0, lost: 0, absent: 0, marked: 0, unmarked: 0 };
  if (!bill) return out;
  const want = wantedSide(state, bill);
  const ints = intentions(state, bill, STILL);
  const paired = new Set(state.pairs.filter((p) => !p.broken && (!p.bill || p.bill === billId)).flatMap((p) => [p.a, p.b]));
  const party = state.mps[state.player.mpId].party;
  for (const [id, it] of Object.entries(ints)) {
    if (paired.has(id)) continue;
    const m = state.mps[id];
    const k = markOf(state, id, billId);
    let pYea = 0;
    let pNay = 0;
    if (k && !k.stale && m.party === party) {
      out.marked++;
      out[k.mark]++;
      const w = k.mark === 'firm' ? 1 : k.mark === 'leaning' ? 0.7 : k.mark === 'lost' ? 0 : 0;
      const other = k.mark === 'lost' ? 1 : 0;
      if (want === 'yea') {
        pYea = w;
        pNay = other;
      } else {
        pNay = w;
        pYea = other;
      }
      if (k.mark !== 'absent') {
        pYea *= Math.min(1, m.attendance / 100 + 0.15);
        pNay *= Math.min(1, m.attendance / 100 + 0.15);
      }
    } else {
      if (m.party === party) out.unmarked++;
      const present = state.chased?.[billId]?.[id] ? 1 : state.leaves?.[billId]?.[id] === 'granted' ? 0 : it.present ? Math.min(1, m.attendance / 100 + (it.line === 'whipped' ? 0.1 : 0)) : 0;
      if (it.vote === 'yea') pYea = present;
      else if (it.vote === 'nay') pNay = present;
    }
    out.yeas += pYea;
    out.nays += pNay;
  }
  out.yeas = Math.round(out.yeas);
  out.nays = Math.round(out.nays);
  out.needed = Math.floor((out.yeas + out.nays) / 2) + 1;
  out.side = want;
  out.ours = want === 'yea' ? out.yeas : out.nays;
  out.short = Math.max(0, out.needed - out.ours);
  return out;
}

// From act 3, the whip's office refreshes the caucus marks every sitting morning for the votes ahead.
hooks.morning.push((state) => {
  if (!isSittingWeek(state) || state.player.act < tuning().tools.officeFilesFromAct) return;
  for (const b of Object.values(state.bills)) {
    if (b.status !== 'active' || b.nextVote == null) continue;
    refreshMarks(state, b.id);
  }
});
