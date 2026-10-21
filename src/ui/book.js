// The whip's book: all 120 MPs in a searchable, filterable list, built for one thumb.
import { cardView, HIDDEN_FIELDS } from '../sim/knowledge.js';
import { t, esc, mpName, partyColor, partyShort, partyName, roleName, ordinal } from './text.js';

const FILTERS = ['party', 'clique', 'cohort', 'type'];

export function createBook(root, { getState, onPick, onClose, riskOf = null }) {
  const el = document.createElement('section');
  el.className = 'sheet book hidden';
  root.appendChild(el);
  const ui = { q: '', party: '', clique: '', cohort: '', type: '', sort: 'seat' };
  let title = null;

  function knownCount(state, id) {
    const v = cardView(state, id);
    return HIDDEN_FIELDS.filter((f) => v.fields[f].known).length;
  }

  function options(state) {
    const mps = Object.values(state.mps);
    const parties = [...Object.values(state.parties).map((p) => [p.id, p.name]), ['ind', t('party.ind')]];
    const cliques = new Map();
    const cohorts = new Set();
    for (const m of mps) {
      const v = cardView(state, m.id);
      if (v.fields.clique.known && m.clique) cliques.set(m.clique, state.cliques[m.clique].name);
      if (v.fields.cohort.known) cohorts.add(m.cohort);
    }
    const opt = (val, label, cur) => `<option value="${esc(val)}"${String(cur) === String(val) ? ' selected' : ''}>${esc(label)}</option>`;
    return {
      party: opt('', t('book.allParties'), ui.party) + parties.map(([id, n]) => opt(id, n, ui.party)).join(''),
      clique: opt('', t('book.allCliques'), ui.clique) + opt('?', t('book.unknown'), ui.clique) + [...cliques].map(([id, n]) => opt(id, n, ui.clique)).join(''),
      cohort: opt('', t('book.allCohorts'), ui.cohort) + opt('?', t('book.unknown'), ui.cohort) + [...cohorts].sort((a, b) => b - a).map((c) => opt(c, `${ordinal(c)} Parliament`, ui.cohort)).join(''),
      type: opt('', t('book.allTypes'), ui.type) + ['urban', 'suburban', 'rural', 'northern'].map((x) => opt(x, t('type.' + x), ui.type)).join(''),
      sort: ['seat', 'name', 'party', 'known', ...(riskOf ? ['risk'] : [])].map((s) => opt(s, t('book.sort.' + s), ui.sort)).join(''),
    };
  }

  function rows(state) {
    const q = ui.q.trim().toLowerCase();
    let list = Object.values(state.mps).filter((m) => {
      const v = cardView(state, m.id);
      if (q && !`${mpName(m)} ${m.riding.name} ${m.riding.province}`.toLowerCase().includes(q)) return false;
      if (ui.party && m.party !== ui.party) return false;
      if (ui.type && m.riding.type !== ui.type) return false;
      if (ui.clique === '?' ? v.fields.clique.known : ui.clique && (!v.fields.clique.known || m.clique !== ui.clique)) return false;
      if (ui.cohort === '?' ? v.fields.cohort.known : ui.cohort && (!v.fields.cohort.known || String(m.cohort) !== ui.cohort)) return false;
      return true;
    });
    const by = {
      seat: (a, b) => (a.seatId || 's999').localeCompare(b.seatId || 's999'),
      name: (a, b) => a.name.last.localeCompare(b.name.last),
      party: (a, b) => partyName(state, a.party).localeCompare(partyName(state, b.party)) || a.name.last.localeCompare(b.name.last),
      known: (a, b) => knownCount(state, b.id) - knownCount(state, a.id),
      risk: (a, b) => (riskOf ? riskOf(state, b.id) - riskOf(state, a.id) : 0),
    };
    list.sort(by[ui.sort] || by.seat);
    return list;
  }

  function render() {
    const state = getState();
    if (!state) return;
    const o = options(state);
    const list = rows(state);
    const total = Object.keys(state.mps).length;
    el.innerHTML = `
      <header class="book-head">
        <h2>${esc(title || t('book.title'))}</h2>
        <button class="btn icon" data-act="close" aria-label="${t('btn.close')}">✕</button>
      </header>
      <input class="search" type="search" placeholder="${t('book.search')}" value="${esc(ui.q)}" autocomplete="off">
      <div class="filters">
        ${FILTERS.map((f) => `<select data-f="${f}">${o[f]}</select>`).join('')}
        <select data-f="sort">${o.sort}</select>
      </div>
      <p class="count">${t('book.count', { n: list.length, total })}</p>
      <ul class="book-list">
        ${list
          .map((m) => {
            const known = knownCount(state, m.id);
            const risk = riskOf && ui.sort === 'risk' ? `<span class="risk">${esc(riskOf(state, m.id, true) ?? '')}</span>` : '';
            return `<li data-id="${m.id}">
              <span class="bar" style="background:${partyColor(state, m)}"></span>
              <span class="main"><b>${esc(mpName(m))}</b>${m.id === state.player.mpId ? ` <span class="badge you">${t('card.you')}</span>` : ''}<small>${esc(partyShort(state, m))} · ${esc(m.riding.name)}${m.caucusRole !== 'backbencher' ? ' · ' + esc(roleName(state, m)) : ''}</small></span>
              ${risk}<span class="known" title="fields known">${'●'.repeat(Math.min(5, Math.ceil(known / 2)))}${'○'.repeat(5 - Math.min(5, Math.ceil(known / 2)))}</span>
            </li>`;
          })
          .join('')}
      </ul>
    `;
    el.querySelector('[data-act="close"]').onclick = api.close;
    const search = el.querySelector('.search');
    search.oninput = () => {
      ui.q = search.value;
      const pos = search.selectionStart;
      render();
      const s2 = el.querySelector('.search');
      s2.focus();
      s2.setSelectionRange(pos, pos);
    };
    el.querySelectorAll('select').forEach((s) => {
      s.onchange = () => {
        ui[s.dataset.f] = s.value;
        render();
      };
    });
    el.querySelectorAll('li[data-id]').forEach((li) => {
      li.onclick = () => {
        el.classList.add('hidden');
        onPick?.(li.dataset.id);
      };
    });
  }

  const api = {
    get isOpen() {
      return !el.classList.contains('hidden');
    },
    // A title turns the book into a picker (whom to invite or call).
    open(opts = {}) {
      title = opts.title || null;
      el.classList.remove('hidden');
      render();
    },
    close() {
      el.classList.add('hidden');
      onClose?.();
    },
    refresh() {
      if (api.isOpen) render();
    },
  };
  return api;
}
