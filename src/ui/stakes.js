// What an ask means at home: riding-standing and whip numbers set as ink (a signed tabular numeral in colour,
// the unit in plain ink; the sign carries the meaning, so it reads without colour), a ruled table for a bill,
// and a chip for a deal card.
import { t, esc } from './text.js';
import { billStakes, cardStakes } from '../sim/stakes.js';

const MINUS = '\u2212';

// One number: +4 riding (good), \u22126 riding (bad), no change (flat).
export function delta(n, what) {
  const cls = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  if (n === 0) return `<span class="stake flat">${esc(t('stake.flat'))}</span>`;
  const num = n > 0 ? `+${n}` : `${MINUS}${-n}`;
  return `<span class="stake ${cls}"><b>${esc(num)}</b> ${esc(what)}</span>`;
}

const sideWord = (v) => `<b class="${v}">${esc(t('vote.' + v).toUpperCase())}</b>`;

// The riding's view and what each way of voting does, for a scene about a bill (the whip's call, a recruiter, the bells):
// a small ruled table, the riding's lean as its heading, one row per way of voting, the numbers in their own columns.
export function stakePanel(state, bill) {
  const me = state.mps[state.player.mpId];
  const s = billStakes(state, bill);
  const lean = s.lean
    ? t('stake.lean.' + s.lean.level, { riding: esc(me.riding.name), side: sideWord(s.lean.side) })
    : t('stake.lean.none', { riding: esc(me.riding.name) });
  const row = (label, st) => `<tr><th scope="row">${esc(label)}</th><td>${delta(st.riding, t('stake.riding'))}</td><td>${delta(st.whip, t('stake.whip'))}</td></tr>`;
  const rows = s.whipped
    ? `<tbody>${row(t('stake.withLine', { pos: t('vote.' + s.position) }), s.line)}${row(t('stake.against', { pos: t('vote.' + (s.position === 'yea' ? 'nay' : 'yea')) }), s.rebel)}</tbody>`
    : `<tbody><tr><td colspan="3" class="muted small">${esc(t('stake.free'))}</td></tr></tbody>`;
  return `<table class="stakes"><caption class="stake-lean">${lean}</caption>${rows}</table>`;
}

// The same thing as one ruled line, for a talk that needs the room: the riding's lean, then each way of voting
// with both its numbers. It wraps on a narrow phone and stays one block.
export function stakeLine(state, bill) {
  const me = state.mps[state.player.mpId];
  const s = billStakes(state, bill);
  const lean = s.lean
    ? t('stake.lean.' + s.lean.level, { riding: esc(me.riding.name), side: sideWord(s.lean.side) })
    : t('stake.lean.none', { riding: esc(me.riding.name) });
  if (!s.whipped) return `<p class="stakes-line"><span class="lean">${lean}</span><span class="free">${esc(t('stake.free'))}</span></p>`;
  const way = (label, st) => `<span class="way"><span class="side">${esc(label)}</span> ${delta(st.riding, t('stake.riding'))} ${delta(st.whip, t('stake.whip'))}</span>`;
  const other = s.position === 'yea' ? 'nay' : 'yea';
  return `<p class="stakes-line"><span class="lean">${lean}</span>${way(t('stake.withLine', { pos: t('vote.' + s.position) }), s.line)}${way(t('stake.against', { pos: t('vote.' + other) }), s.rebel)}</p>`;
}

// The same thing rubber-stamped on a memo: the riding's lean as a line, then one stamp per way of voting
// with its label small above the numbers. The numbers are the same signed inks as everywhere else.
export function stakeStamps(state, bill) {
  const me = state.mps[state.player.mpId];
  const s = billStakes(state, bill);
  const lean = s.lean
    ? t('stake.lean.' + s.lean.level, { riding: esc(me.riding.name), side: sideWord(s.lean.side) })
    : t('stake.lean.none', { riding: esc(me.riding.name) });
  if (!s.whipped) return `<p class="stakes-line"><span class="lean">${lean}</span><span class="free">${esc(t('stake.free'))}</span></p>`;
  const stampOf = (label, st, k) => `<span class="stake-stamp ${k}"><small>${esc(label)}</small><span class="ink">${delta(st.riding, t('stake.riding'))}<i>·</i>${delta(st.whip, t('stake.whip'))}</span></span>`;
  const other = s.position === 'yea' ? 'nay' : 'yea';
  return `<div class="stake-stamps"><p class="lean">${lean}</p><div class="row">${stampOf(t('stake.withLine', { pos: t('vote.' + s.position) }), s.line, 'a')}${stampOf(t('stake.against', { pos: t('vote.' + other) }), s.rebel, 'b')}</div></div>`;
}

// The same thing in one short block, for a card that only needs to hint at it (the whip's call on the evening board).
export function stakeBrief(state, bill) {
  const s = billStakes(state, bill);
  if (!s.whipped) return '';
  const side = (v, st) => `<span class="side">${esc(t('vote.' + v))}</span> ${delta(st.riding, t('stake.riding'))}`;
  const other = s.position === 'yea' ? 'nay' : 'yea';
  return `<p class="stake-brief">${side(s.position, s.line)} ${side(other, s.rebel)}</p>`;
}

// The chip on a deal card: what it does for the riding, if anything. Empty when it has nothing to do with home.
export function cardChip(state, card, side, mpId) {
  const s = cardStakes(state, card, side, mpId);
  if (!s) return '';
  if (s.note === 'home') return `<span class="stake up"><b>+</b> ${esc(t('stake.home'))}</span>`;
  return delta(s.riding, t('stake.riding'));
}

// The sum across the cards on the table: your riding standing once the deal has played out.
export function tableTotal(state, local, mpId) {
  const sum = (list, side) => list.reduce((n, c) => n + (cardStakes(state, c, side, mpId)?.riding || 0), 0);
  const total = sum(local.offers, 'give') + sum(local.asks, 'get');
  const any = [...local.offers.map((c) => cardStakes(state, c, 'give', mpId)), ...local.asks.map((c) => cardStakes(state, c, 'get', mpId))].some(Boolean);
  return any ? `<p class="stake-total"><span>${esc(t('stake.total'))}</span>${delta(total, t('stake.riding'))}</p>` : '';
}
