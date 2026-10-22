// Your row: the members you answer for, the ones needing attention first, each placed on a NAY-to-YEA line against
// the side the whip needs from them.
import { t, esc, mpName, partyColor, ROW_GLYPH as GLYPH } from './text.js';
import { rowReport } from '../sim/row.js';

const side = (v) => `<b class="${v}">${esc(t('vote.' + v).toUpperCase())}</b>`;

// One member's place on the line. The zones are the vote's own (nay, sits it out, yea); the outlined end is the
// side needed; the tick is where they turn firm; the dot is where the files put them.
function meter(want, scale, r) {
  const at = (v) => `${Math.max(0, Math.min(100, ((v / scale.span + 1) / 2) * 100)).toFixed(1)}%`;
  const dot = r.score == null ? '' : `<b class="dot ${r.mark}" style="left:${at(r.score)}"></b>`;
  return `<span class="aim" aria-hidden="true">
    <span class="aim-track"><i class="z nay${want === 'nay' ? ' need' : ''}" style="width:${at(scale.lower)}"></i><i class="z mid" style="width:calc(${at(scale.upper)} - ${at(scale.lower)})"></i><i class="z yea${want === 'yea' ? ' need' : ''}" style="width:calc(100% - ${at(scale.upper)})"></i><em class="tick" style="left:${at(scale.firm)}"></em>${dot}</span>
    <span class="aim-ends"><span class="${want === 'nay' ? 'need' : ''}">${want === 'nay' ? '▶ ' : ''}NAY</span><span class="${want === 'yea' ? 'need' : ''}">YEA${want === 'yea' ? ' ◀' : ''}</span></span>
  </span>`;
}

// Words for the same thing, so the line never has to be read by colour or position alone.
function caption(want, r) {
  const other = want === 'yea' ? 'nay' : 'yea';
  const vars = { side: side(want), other: side(other) };
  const key = r.mark === 'absent' ? (r.why === 'undecided' ? 'undecided' : 'away') : r.mark;
  return t('row.cap.' + key, vars);
}

export function createRowSheet(root, { getState, onPick }) {
  const el = document.createElement('section');
  el.className = 'sheet row-sheet hidden';
  root.appendChild(el);
  let open = false;
  let forBill = null;

  function render() {
    const state = getState();
    if (!open || !state) return;
    const { bill, want, scale, members, counts } = rowReport(state, forBill);
    const tally = Object.entries(counts)
      .filter(([, n]) => n)
      .map(([k, n]) => `<span class="row-mark ${k}"><i aria-hidden="true">${GLYPH[k]}</i> ${n} ${esc(t('row.mark.' + k))}</span>`)
      .join('');
    const list = members
      .map((r) => {
        const m = state.mps[r.id];
        return `<li data-id="${m.id}"><span class="bar" style="background:${partyColor(state, m)}"></span>
          <span class="main"><b>${esc(mpName(m))}</b>${r.friend ? ` <span class="badge">${esc(t('row.friend'))}</span>` : ''}<small>${esc(m.riding.name)} · ${esc(m.seatId || '')}</small></span>
          <span class="row-mark ${r.mark}${r.stale ? ' stale' : ''}"><i aria-hidden="true">${GLYPH[r.mark]}</i> ${esc(t('row.mark.' + r.mark))}</span>
          ${bill ? `<span class="aim-wrap">${meter(want, scale, r)}<small class="aim-cap">${caption(want, r)}</small></span>` : ''}</li>`;
      })
      .join('');
    el.innerHTML = `<div class="sheet-handle"></div>
      <header class="card-head"><div class="who"><h2>${t('row.title')}</h2><p>${esc(t('row.sub', { n: members.length }))}</p></div>
        <button class="btn icon" data-act="close" aria-label="${t('btn.close')}">✕</button></header>
      <p class="row-bill">${bill ? esc(t('row.bill', { bill: bill.title })) : esc(t('row.noBill'))}</p>
      ${bill ? `<p class="row-need">${t('row.need', { side: side(want) })}</p><p class="row-tally">${tally}</p><p class="muted small">${esc(t('row.legend'))}</p>` : ''}
      ${members.length ? `<ul class="book-list row-list">${list}</ul>` : `<p class="muted">${t('row.empty')}</p>`}`;
    el.querySelector('[data-act="close"]').onclick = api.close;
    el.querySelectorAll('li[data-id]').forEach((li) => (li.onclick = () => onPick?.(li.dataset.id)));
  }

  const api = {
    get isOpen() {
      return open;
    },
    // `billId`: the vote the marks are for (from a count board line); none means the next vote.
    open(billId = null) {
      open = true;
      forBill = billId;
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
