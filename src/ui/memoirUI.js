// The memoir: a career as a timeline you scroll through, the moments that defined it and the people in each
// one. It opens from the menu during a career, and it is the body of the record page when the career ends.
// Chapters turn where the act or the rank changed; a rule marks each new Parliament.
import { t, esc, partyColor } from './text.js';
import { calendarOf } from '../sim/calendar.js';
import { tuning } from '../sim/config.js';
import { ordinal } from '../sim/memoir.js';
import { whipRecord } from '../sim/record.js';

const STATS = ['weeks', 'votesWon', 'confidenceSurvived', 'promisesKept', 'promisesBroken'];

function dateOf(e) {
  const c = calendarOf({ absWeek: e.week, dayOfWeek: e.day });
  return t('memoir.date', { day: tuning().calendar.days[(e.day || 1) - 1], date: c.dayOfMonth, month: c.month, year: c.year });
}

function colourOf(state, p) {
  return p.party === 'ind' || state.parties[p.party] ? partyColor(state, p) : 'var(--grey)';
}

// A person in a moment. Members still in the House open their card; the rest are kept as a name.
function chip(state, p) {
  const inner = `<b>${esc(p.name)}</b><small>${esc(p.note)}</small>`;
  if (p.id && state.mps[p.id]) return `<button class="who" data-mp="${esc(p.id)}" style="--party:${colourOf(state, p)}">${inner}</button>`;
  const gone = p.id ? ` title="${esc(t('memoir.gone'))}"` : '';
  return `<span class="who${p.id ? ' gone' : ''}"${gone} style="--party:${colourOf(state, p)}">${inner}</span>`;
}

function moment(state, e) {
  const people = (e.people || []).map((p) => chip(state, p)).join('');
  return `<article class="moment tone-${esc(e.tone)}">
    <p class="when">${esc(dateOf(e))}<span class="what">${esc(t('memoir.kind.' + e.kind))}</span></p>
    <h4>${esc(e.title)}</h4>
    <p class="said">${esc(e.text)}</p>
    ${people ? `<div class="people">${people}</div>` : ''}
  </article>`;
}

// The whole timeline, oldest first, as a memoir reads.
export function timelineHTML(state) {
  const list = state.memoir || [];
  let out = '';
  if (state.memoirFrom != null) out += `<p class="memoir-from muted">${esc(t('memoir.from', { date: dateOf({ week: state.memoirFrom, day: 1 }) }))}</p>`;
  if (!list.length) return out + `<p class="muted">${t('memoir.empty')}</p>`;
  let chapter = null;
  let parliament = null;
  for (const e of list) {
    if (parliament !== null && e.parliament !== parliament) out += `<p class="parl-mark"><span>${esc(t('memoir.parliament', { nth: ordinal(e.parliament) }))}</span></p>`;
    parliament = e.parliament;
    const ch = `${e.act}:${e.role}`;
    if (ch !== chapter) out += `<h3 class="chapter"><small>${t('career.act', { n: e.act })}</small>${esc(t('role.' + e.role))}</h3>`;
    chapter = ch;
    out += moment(state, e);
  }
  return `<div class="timeline">${out}</div>`;
}

// The record in numbers, kept short: the memoir carries the rest.
export function statsHTML(state, rows = STATS) {
  const r = whipRecord(state);
  return `<div class="memoir-stats">${rows.map((k) => `<div><b>${esc(r[k])}</b><small>${t('record.' + k)}</small></div>`).join('')}</div>`;
}

// Wire a rendered timeline: people open their card, and moments fade up as they scroll into view.
export function wireTimeline(el, { onPerson }) {
  el.querySelectorAll('.who[data-mp]').forEach((b) => (b.onclick = () => onPerson?.(b.dataset.mp)));
  const moments = el.querySelectorAll('.moment, .chapter, .parl-mark');
  if (typeof IntersectionObserver === 'undefined') {
    moments.forEach((m) => m.classList.add('seen'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const x of entries) {
        if (!x.isIntersecting) continue;
        x.target.classList.add('seen');
        io.unobserve(x.target);
      }
    },
    { root: el, rootMargin: '0px 0px -6% 0px' },
  );
  moments.forEach((m) => io.observe(m));
}

// The memoir sheet opened from the menu mid-career.
export function createMemoir(root, { getState, onPerson }) {
  const el = document.createElement('section');
  el.className = 'sheet memoir-sheet hidden';
  root.appendChild(el);
  let open = false;

  function render() {
    const state = getState();
    if (!open || !state) return;
    const me = state.mps[state.player.mpId];
    el.innerHTML = `<div class="sheet-handle"></div>
      <header class="book-head"><h2>${t('memoir.title')}</h2><button class="btn icon" data-act="close" aria-label="${t('btn.close')}">✕</button></header>
      <p class="muted">${esc(`${me.name.first} ${me.name.last}`)} · ${esc(me.riding.name)} · ${esc(state.parties[me.party]?.name || '')}</p>
      ${statsHTML(state)}
      ${timelineHTML(state)}`;
    el.querySelector('[data-act="close"]').onclick = () => api.close();
    wireTimeline(el, { onPerson });
  }

  const api = {
    get isOpen() {
      return open;
    },
    open() {
      open = true;
      el.classList.remove('hidden');
      el.scrollTop = 0;
      render();
    },
    close() {
      open = false;
      el.classList.add('hidden');
    },
  };
  return api;
}
