// The agenda: the date, Continue and Skip, the day's feed, the morning order paper and the weekly review.
import { t, esc } from './text.js';
import { tuning } from '../sim/config.js';
import { stageLabel } from '../sim/vote.js';

export function createAgenda(root, { getState, onContinue, onSkip, onNewGame }) {
  const bar = document.createElement('section');
  bar.className = 'agenda';
  root.appendChild(bar);
  const sheet = document.createElement('section');
  sheet.className = 'sheet agenda-sheet hidden';
  root.appendChild(sheet);
  let expanded = false;

  function dateText(state) {
    const d = state.date;
    const day = tuning().calendar.days[d.dayOfWeek - 1];
    return t('agenda.date', { day, week: d.week ?? (d.absWeek % tuning().calendar.weeksPerYear) + 1, year: d.year ?? 1 }) + (d.constituencyWeek ? ` · ${t('agenda.constituency')}` : '');
  }

  function renderBar() {
    const state = getState();
    const p = state.flow.pending;
    const blocked = p && p.needsChoice;
    const last = state.log.slice(-1)[0]?.text || '';
    const feed = expanded ? `<ol class="feed">${state.log.slice(-25).reverse().map((l) => `<li class="${l.kind}">${esc(l.text)}</li>`).join('')}</ol>` : '';
    bar.innerHTML = `
      <div class="agenda-row">
        <button class="agenda-date" data-act="expand" aria-expanded="${expanded}">${esc(dateText(state))}<small>${esc(last)}</small></button>
        <button class="btn primary" data-act="continue" ${blocked ? 'disabled' : ''}>${t('agenda.continue')}</button>
        <button class="btn" data-act="skip" ${blocked ? 'disabled' : ''} title="${t('agenda.skipHint')}">⏭</button>
      </div>${feed}`;
    bar.querySelector('[data-act="expand"]').onclick = () => {
      expanded = !expanded;
      renderBar();
    };
    bar.querySelector('[data-act="continue"]').onclick = onContinue;
    bar.querySelector('[data-act="skip"]').onclick = onSkip;
  }

  function showMorning(p) {
    const state = getState();
    const rows = p.items.length
      ? p.items
          .map(({ billId, stage, stop }) => {
            const b = state.bills[billId];
            const tags = [b.confidence ? `<span class="badge">${t('agenda.confidence')}</span>` : '', stop === 'ownVote' ? `<span class="badge you">${t('agenda.yourVote')}</span>` : ''].join(' ');
            return `<li><b>${esc(b.title)}</b> <small>${esc(stageLabel(stage))}</small> ${tags}<p>${esc(b.summary || '')}</p></li>`;
          })
          .join('')
      : `<li>${t('agenda.noVotes')}</li>`;
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${esc(dateText(state))}</h2><h3>${t('agenda.orderPaper')}</h3><ul class="order-paper">${rows}</ul>
      <div class="card-actions"><button class="btn primary" data-act="go">${t('agenda.toHouse')}</button></div>`;
    sheet.querySelector('[data-act="go"]').onclick = onContinue;
    sheet.classList.remove('hidden');
  }

  function showWeek(p) {
    const s = p.summary;
    const delta = ([a, b]) => `${a} → <b>${b}</b>${b > a ? ' ▲' : b < a ? ' ▼' : ''}`;
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${t('week.title', { week: s.week })}</h2>
      <div class="kvs">
        <div class="kv"><span class="k">${t('week.riding')}</span><span class="v">${delta(s.ridingStanding)}</span></div>
        <div class="kv"><span class="k">${t('week.whip')}</span><span class="v">${delta(s.whipRapport)}</span></div>
        <div class="kv"><span class="k">${t('week.rebellions')}</span><span class="v">${s.rebellions}</span></div>
        <div class="kv"><span class="k">${t('week.divisions')}</span><span class="v">${s.divisions}</span></div>
      </div>
      <h3>${t('agenda.feed')}</h3><ol class="feed">${s.lines.slice().reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
      <div class="card-actions"><button class="btn primary" data-act="next">${t('week.next')}</button></div>`;
    sheet.querySelector('[data-act="next"]').onclick = onContinue;
    sheet.classList.remove('hidden');
  }

  function showDissolved(p) {
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${t('dissolved.title')}</h2><p>${t('dissolved.' + p.reason)}</p>
      <div class="card-actions"><button class="btn primary" data-act="new">${t('dissolved.new')}</button></div>`;
    sheet.querySelector('[data-act="new"]').onclick = onNewGame;
    sheet.classList.remove('hidden');
  }

  return {
    render(state) {
      renderBar();
      const p = state.flow.pending;
      if (p?.kind === 'morning') showMorning(p);
      else if (p?.kind === 'weekSummary') showWeek(p);
      else if (p?.kind === 'dissolved') showDissolved(p);
      else sheet.classList.add('hidden');
    },
  };
}
