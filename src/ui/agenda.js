// The agenda: the date, Continue and Skip, the day's feed, the morning order paper and the weekly review.
import { t, esc, scenarioBrief } from './text.js';
import { tuning } from '../sim/config.js';
import { stageLabel } from '../sim/vote.js';
import { prediction } from '../sim/count.js';
import { countLine } from './text.js';
import { renderFrontPage } from './frontPage.js';
import { calendarOf } from '../sim/calendar.js';

export function createAgenda(root, { getState, onContinue, onSkip, photo = null }) {
  const bar = document.createElement('section');
  bar.className = 'agenda';
  root.appendChild(bar);
  const sheet = document.createElement('section');
  sheet.className = 'sheet agenda-sheet hidden';
  root.appendChild(sheet);
  let expanded = false;

  // Sheets sit on top of the bar, so the bar's real height (a long date, larger text, the safe area) sets
  // where they end. The expanded feed is left out: it is meant to lie over whatever is open.
  const fit = () => {
    if (!expanded && bar.offsetHeight) document.documentElement.style.setProperty('--agenda-h', `${bar.offsetHeight}px`);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(bar);

  function dateText(state) {
    const d = state.date;
    const day = tuning().calendar.days[d.dayOfWeek - 1];
    const c = calendarOf(d);
    return t('agenda.date', { day, date: c.dayOfMonth, month: c.month, week: c.week, year: c.year }) + (d.constituencyWeek ? ` · ${t('agenda.constituency')}` : '');
  }

  // The bar's short form: the day in full and the week, on one line.
  function dayText(state) {
    const d = state.date;
    const c = calendarOf(d);
    const day = t('agenda.day', { day: tuning().calendar.days[d.dayOfWeek - 1], date: c.dayOfMonth, month: c.month });
    return `${esc(day)} <span>· ${esc(d.constituencyWeek ? t('agenda.constituency') : t('agenda.week', { week: c.week }))}</span>`;
  }

  function renderBar() {
    const state = getState();
    const p = state.flow.pending;
    const blocked = p && p.needsChoice;
    const last = state.log.slice(-1)[0]?.text || '';
    const feed = expanded ? `<p class="feed-head">${esc(dateText(state))}</p><ol class="feed">${state.log.slice(-25).reverse().map((l) => `<li class="${l.kind}">${esc(l.text)}</li>`).join('')}</ol>` : '';
    bar.innerHTML = `
      <div class="agenda-row">
        <button class="agenda-date" data-act="expand" aria-expanded="${expanded}" aria-label="${esc(dateText(state))}"><span class="day">${dayText(state)}</span><small>${esc(last)}</small></button>
        ${blocked ? '' : `<button class="btn primary" data-act="continue">${t('agenda.continue')}</button>
        <button class="btn" data-act="skip" title="${t('agenda.skipHint')}" aria-label="${t('agenda.skipHint')}"><svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5l5 5-5 5M10 5l5 5-5 5"/></svg></button>`}
      </div>${feed}`;
    bar.querySelector('[data-act="expand"]').onclick = () => {
      expanded = !expanded;
      renderBar();
    };
    if (!blocked) {
      bar.querySelector('[data-act="continue"]').onclick = onContinue;
      bar.querySelector('[data-act="skip"]').onclick = onSkip;
    }
    fit();
  }

  function showMorning(p) {
    const state = getState();
    const rows = p.items.length
      ? p.items
          .map(({ billId, stage, stop }) => {
            const b = state.bills[billId];
            const tags = [b.confidence ? `<span class="badge">${t('agenda.confidence')}</span>` : '', stop === 'ownVote' ? `<span class="badge you">${t('agenda.yourVote')}</span>` : ''].join(' ');
            const count = state.player.act >= tuning().tools.officeFilesFromAct && b.lines[state.mps[state.player.mpId].party] === 'whipped' ? countLine(prediction(state, billId)) : '';
            return `<li><b>${esc(b.title)}</b> <small>${esc(stageLabel(stage))}</small> ${tags}<p>${esc(b.summary || '')}</p>${count}</li>`;
          })
          .join('')
      : `<li>${t('agenda.noVotes')}</li>`;
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${esc(dateText(state))}</h2>${scenarioBrief(state)}${p.note ? `<p class="tutorial">${t(p.note)}</p>` : ''}<h3>${t('agenda.orderPaper')}</h3><ul class="order-paper">${rows}</ul>
      <div class="card-actions"><button class="btn primary" data-act="go">${t('agenda.toHouse')}</button></div>`;
    sheet.querySelector('[data-act="go"]').onclick = onContinue;
    sheet.classList.remove('hidden');
  }

  // The weekly review is the weekend paper. The player's photograph is rendered on demand, once per member.
  function showWeek(p) {
    const state = getState();
    const me = state.mps[state.player.mpId];
    const url = p.summary.press?.[0]?.you && photo ? photo(me) : null;
    sheet.innerHTML = renderFrontPage(state, p, url);
    sheet.querySelector('[data-act="next"]').onclick = onContinue;
    sheet.classList.remove('hidden');
  }

  return {
    render(state) {
      renderBar();
      const p = state.flow.pending;
      if (p?.kind === 'morning') showMorning(p);
      else if (p?.kind === 'weekSummary') showWeek(p);
      else sheet.classList.add('hidden');
    },
  };
}
