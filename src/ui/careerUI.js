// Career moments as a sheet of paper: a new act, the rival, the vacancy contest, the lottery, the asks
// across the aisle, the whip's question, someone's life event. Each shows its text and its choices.
import { t, esc, mpName, partyColor, stamp } from './text.js';

const TITLES = { act2: 'career.act2Title', act3: 'career.act3Title', vacancy: 'career.vacancyTitle', lottery: 'career.lotteryTitle', crossAisle: 'career.crossAisleTitle', whipQuestion: 'career.whipQuestionTitle', lifeEvent: 'career.lifeEventTitle' };

export function createCareerUI(root, { getState, dispatch }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet career-sheet hidden';
  root.appendChild(sheet);
  let shown = null;

  function render(state) {
    const p = state.flow.pending;
    if (p?.kind !== 'career') {
      sheet.classList.add('hidden');
      shown = null;
      return;
    }
    const key = `${p.event}:${p.mpId || ''}:${p.asksLeft ?? ''}:${(p.options || []).map((o) => o.id).join(',')}`;
    if (shown === key) return;
    shown = key;
    const title = p.event === 'lost' ? t('career.lostTitle', { rival: mpName(state.mps[p.rival]) }) : t(TITLES[p.event] || 'career.continue');
    const who = p.mpId ? state.mps[p.mpId] : p.rival && p.event !== 'lost' ? state.mps[p.rival] : null;
    const head = who ? `<header class="card-head"><span class="chip" style="background:${partyColor(state, who)}"></span><div class="who"><h2>${esc(title)}</h2><p class="muted">${esc(mpName(who))}${p.event === 'act2' ? ` · ${t('career.rival')}` : ''}</p></div></header>` : `<h2>${esc(title)}</h2>`;
    const stampHtml = p.event === 'act2' ? stamp(t('career.act', { n: 2 }), 'yea', true) : p.event === 'act3' ? stamp(t('career.act', { n: 3 }), 'yea', true) : p.event === 'lost' ? stamp(t('career.passedOver'), 'nay') : '';
    const choices = (p.options || []).filter((o) => o.enabled !== false).map((o, i) => `<button class="btn${i === 0 ? ' primary' : ''}" data-c="${esc(o.id)}">${esc(o.label)}${o.note ? `<small class="approach">${esc(o.note)}</small>` : ''}</button>`).join('');
    sheet.innerHTML = `<div class="sheet-handle"></div>${head}
      ${stampHtml ? `<p>${stampHtml}</p>` : ''}
      <blockquote class="line">${esc(p.text || '')}</blockquote>
      ${p.rivalText ? `<p>${esc(p.rivalText)}</p>` : ''}
      ${p.score ? `<p class="muted">${esc(`The whip's reckoning: you ${p.score[0]}, ${mpName(state.mps[p.rival] || state.mps[state.player.rival] || { name: { first: 'your', last: 'rival' } })} ${p.score[1]}.`)}</p>` : ''}
      <div class="choices">${choices || `<button class="btn primary" data-c="">${t('career.continue')}</button>`}</div>`;
    sheet.classList.remove('hidden');
    sheet.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => dispatch({ type: 'resolve', choice: b.dataset.c || null })));
  }
  return { render };
}
