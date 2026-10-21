// The whip's record: the last page of a career, stamped with how it ended, then the memoir of the moments
// that made it, the numbers, and a way to start another.
import { t, esc, stamp } from './text.js';
import { timelineHTML, statsHTML, wireTimeline } from './memoirUI.js';

const STAMP = { retirement: 'brass', cabinet: 'yea', exit: 'grey', fall: 'nay', revolt: 'nay', defeated: 'nay', nomination: 'nay' };
const ROWS = ['weeks', 'parliaments', 'votesWon', 'votesLost', 'confidenceSurvived', 'promoted', 'expelled', 'promisesKept', 'promisesBroken', 'mentored'];

export function createRecordUI(root, { getState, onNewGame, onPerson }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet record-sheet hidden';
  root.appendChild(sheet);
  let shown = null;

  function render(state) {
    const p = state.flow.pending;
    if (p?.kind !== 'ending') {
      sheet.classList.add('hidden');
      shown = null;
      return;
    }
    if (shown === p.endingKind) return;
    shown = p.endingKind;
    const r = p.record;
    const rows = ROWS.map((k) => `<div class="kv"><span class="k">${t('record.' + k)}</span><span class="v">${esc(r[k])}</span></div>`).join('');
    sheet.innerHTML = `<div class="sheet-handle"></div>
      <h2>${t('ending.title')}</h2>
      <p class="muted">${esc(r.name)} · ${esc(r.riding)} · ${esc(r.party)}</p>
      <p>${stamp(t('ending.' + p.endingKind), STAMP[p.endingKind] || '', true)}</p>
      <blockquote class="line">${esc(p.epilogue || '')}</blockquote>
      ${statsHTML(state, ['weeks', 'parliaments', 'votesWon', 'promisesKept'])}
      <h3>${t('memoir.moments')}</h3>
      ${timelineHTML(state)}
      <h3>${t('memoir.numbers')}</h3>
      <div class="kvs">
        <div class="kv"><span class="k">${t('record.act')}</span><span class="v">${esc(r.rank)} · ${t('career.act', { n: r.act })}</span></div>
        <div class="kv"><span class="k">${t('record.style')}</span><span class="v">${esc(t('rep.' + r.style))}</span></div>
        ${rows}
      </div>
      <div class="card-actions"><button class="btn primary" data-act="new">${t('ending.new')}</button></div>`;
    sheet.querySelector('[data-act="new"]').onclick = onNewGame;
    sheet.classList.remove('hidden');
    sheet.scrollTop = 0;
    wireTimeline(sheet, { onPerson });
  }
  return { render };
}
