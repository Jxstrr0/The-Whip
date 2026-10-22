// Your row: the members you answer for, the ones needing attention first, each with where they stand on the next vote.
import { t, esc, mpName, partyColor } from './text.js';
import { rowReport } from '../sim/row.js';

const GLYPH = { firm: '✔', leaning: '◐', lost: '✖', absent: '○', unmarked: '–' };

export function createRowSheet(root, { getState, onPick }) {
  const el = document.createElement('section');
  el.className = 'sheet row-sheet hidden';
  root.appendChild(el);
  let open = false;

  function render() {
    const state = getState();
    if (!open || !state) return;
    const { bill, members, counts } = rowReport(state);
    const tally = Object.entries(counts)
      .filter(([, n]) => n)
      .map(([k, n]) => `<span class="row-mark ${k}"><i aria-hidden="true">${GLYPH[k]}</i> ${n} ${esc(t('row.mark.' + k))}</span>`)
      .join('');
    const list = members
      .map((r) => {
        const m = state.mps[r.id];
        return `<li data-id="${m.id}"><span class="bar" style="background:${partyColor(state, m)}"></span>
          <span class="main"><b>${esc(mpName(m))}</b>${r.friend ? ` <span class="badge">${esc(t('row.friend'))}</span>` : ''}<small>${esc(m.riding.name)} · ${esc(m.seatId || '')}</small></span>
          <span class="row-mark ${r.mark}${r.stale ? ' stale' : ''}"><i aria-hidden="true">${GLYPH[r.mark]}</i> ${esc(t('row.mark.' + r.mark))}</span></li>`;
      })
      .join('');
    el.innerHTML = `<div class="sheet-handle"></div>
      <header class="card-head"><div class="who"><h2>${t('row.title')}</h2><p>${esc(t('row.sub', { n: members.length }))}</p></div>
        <button class="btn icon" data-act="close" aria-label="${t('btn.close')}">✕</button></header>
      <p class="row-bill">${bill ? esc(t('row.bill', { bill: bill.title })) : esc(t('row.noBill'))}</p>
      ${bill ? `<p class="row-tally">${tally}</p>` : ''}
      ${members.length ? `<ul class="book-list">${list}</ul>` : `<p class="muted">${t('row.empty')}</p>`}`;
    el.querySelector('[data-act="close"]').onclick = api.close;
    el.querySelectorAll('li[data-id]').forEach((li) => (li.onclick = () => onPick?.(li.dataset.id)));
  }

  const api = {
    get isOpen() {
      return open;
    },
    open() {
      open = true;
      el.classList.remove('hidden');
      render();
      el.scrollTop = 0;
    },
    close() {
      open = false;
      el.classList.add('hidden');
    },
    refresh: render,
  };
  return api;
}
