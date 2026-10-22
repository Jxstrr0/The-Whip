// What an ask means at home: riding-standing and whip numbers as small colour-coded chips (arrow and sign as well
// as colour, so they read without it), a panel for a bill, and a chip for a deal card.
import { t, esc } from './text.js';
import { billStakes, cardStakes } from '../sim/stakes.js';

const MINUS = '−';

// One number: ▲ +4 riding (good), ▼ −6 riding (bad), ● no change (flat).
export function delta(n, what) {
  const cls = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  const mark = n > 0 ? '▲' : n < 0 ? '▼' : '●';
  const num = n > 0 ? `+${n}` : n < 0 ? `${MINUS}${-n}` : t('stake.flat');
  return `<span class="stake ${cls}"><i aria-hidden="true">${mark}</i> ${n === 0 ? esc(num) : `${esc(num)} ${esc(what)}`}</span>`;
}

const sideWord = (v) => `<b class="${v}">${esc(t('vote.' + v).toUpperCase())}</b>`;

// The riding's view and what each way of voting does, for a scene about a bill (the whip's call, a recruiter, the bells).
export function stakePanel(state, bill) {
  const me = state.mps[state.player.mpId];
  const s = billStakes(state, bill);
  const lean = s.lean
    ? t('stake.lean.' + s.lean.level, { riding: esc(me.riding.name), side: sideWord(s.lean.side) })
    : t('stake.lean.none', { riding: esc(me.riding.name) });
  const row = (label, st) => `<li><span class="what">${esc(label)}</span><span class="nums">${delta(st.riding, t('stake.riding'))}${delta(st.whip, t('stake.whip'))}</span></li>`;
  const rows = s.whipped
    ? `<ul class="stake-rows">${row(t('stake.withLine', { pos: t('vote.' + s.position) }), s.line)}${row(t('stake.against', { pos: t('vote.' + (s.position === 'yea' ? 'nay' : 'yea')) }), s.rebel)}</ul>`
    : `<p class="muted small">${esc(t('stake.free'))}</p>`;
  return `<div class="stakes"><p class="stake-lean">${lean}</p>${rows}</div>`;
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
  if (s.note === 'home') return `<span class="stake up"><i aria-hidden="true">\u25B2</i> ${esc(t('stake.home'))}</span>`;
  return delta(s.riding, t('stake.riding'));
}

// The sum across the cards on the table: your riding standing once the deal has played out.
export function tableTotal(state, local, mpId) {
  const sum = (list, side) => list.reduce((n, c) => n + (cardStakes(state, c, side, mpId)?.riding || 0), 0);
  const total = sum(local.offers, 'give') + sum(local.asks, 'get');
  const any = [...local.offers.map((c) => cardStakes(state, c, 'give', mpId)), ...local.asks.map((c) => cardStakes(state, c, 'get', mpId))].some(Boolean);
  return any ? `<p class="stake-total"><span>${esc(t('stake.total'))}</span>${delta(total, t('stake.riding'))}</p>` : '';
}
