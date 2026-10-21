// The deal table: what you offer, what you ask, tap cards in and out, propose; they accept, counter or walk.
import { t, esc } from './text.js';
import { cardLabel, cardPalette } from '../sim/meetings.js';

export function renderDealTable(el, state, mt, local, { onPropose, onLeave, onAcceptCounter, onWalk, rerender }) {
  const pal = cardPalette(state, mt);
  const want = mt.situation === 'favorAsk' || mt.situation === 'rebelRecruit' ? mt.deal.offers[0] : null;
  const rev = mt.reversal;
  // Cards on the ask side come to you, so a riding on them reads as yours.
  const chip = (c, side, i, toYou) => `<button class="card-chip${c === want && mt.wantsKnown ? ' want' : ''}" data-side="${side}" data-i="${i}">${esc(cardLabel(state, c, toYou))}</button>`;
  const col = (list, side, label, toYou) => `<div class="deal-col"><h4>${label}</h4>${list.length ? list.map((c, i) => chip(c, side, i, toYou)).join('') : `<p class="muted">${t('deal.empty')}</p>`}</div>`;
  const avail = (list, side) => list.filter((c) => !local[side].includes(c)).map((c) => `<button class="card-chip add" data-add="${side}" data-card="${esc(c)}">+ ${esc(cardLabel(state, c, side === 'asks'))}</button>`).join('');
  const counter = mt.deal.message === 'counter' && mt.deal.counter;
  el.innerHTML = `
    <h3>${t('deal.title')}</h3>
    ${want && mt.wantsKnown ? `<p class="hint">${t('deal.wants', { card: esc(cardLabel(state, want)) })}</p>` : ''}
    ${counter ? `<p><b>${t('deal.counter')}</b></p>
      <div class="deal-cols">${col(counter.offers, 'x', rev ? t('deal.youGive') : t('deal.youOffer'), false)}${col(counter.asks, 'x', rev ? t('deal.youGet') : t('deal.youAsk'), true)}</div>
      <div class="card-actions"><button class="btn primary" data-act="acc">${t('deal.acceptCounter')}</button><button class="btn" data-act="walk">${t('deal.walk')}</button></div>`
    : `<div class="deal-cols">${col(local.offers, 'offers', rev ? t('deal.youGive') : t('deal.youOffer'), false)}${col(local.asks, 'asks', rev ? t('deal.youGet') : t('deal.youAsk'), true)}</div>
      <p class="hint">${t('deal.hint')}</p>
      <details class="palette"><summary>${t('deal.addOffer')}</summary>${avail(pal.offers, 'offers')}</details>
      <details class="palette"><summary>${t('deal.addAsk')}</summary>${avail(pal.asks, 'asks')}</details>
      <div class="card-actions"><button class="btn primary" data-act="propose">${t('deal.propose')}</button><button class="btn" data-act="leave">${rev ? t('deal.decline') : t('deal.leave')}</button></div>`}
  `;
  el.querySelectorAll('[data-side="offers"],[data-side="asks"]').forEach((b) => {
    b.onclick = () => {
      local[b.dataset.side].splice(Number(b.dataset.i), 1);
      rerender();
    };
  });
  el.querySelectorAll('[data-add]').forEach((b) => {
    b.onclick = () => {
      local[b.dataset.add].push(b.dataset.card);
      rerender();
    };
  });
  el.querySelector('[data-act="propose"]')?.addEventListener('click', () => onPropose(local.offers, local.asks));
  el.querySelector('[data-act="leave"]')?.addEventListener('click', onLeave);
  el.querySelector('[data-act="acc"]')?.addEventListener('click', onAcceptCounter);
  el.querySelector('[data-act="walk"]')?.addEventListener('click', onWalk);
}
