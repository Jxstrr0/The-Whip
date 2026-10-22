// The whip's book: all 120 MPs in a searchable, filterable list, built for one thumb.
import { cardView, HIDDEN_FIELDS } from '../sim/knowledge.js';
import { t, esc, mpName, partyColor, partyShort, partyName, roleName, ordinal, rowIcon } from './text.js';
import { pickerHtml, wirePickers } from './picker.js';
import { rowIds } from '../sim/row.js';

// The riding types are written for mid-sentence use; as a field's value they take a capital.
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const FILTERS = ['party', 'clique', 'cohort', 'type'];

export function createBook(root, { getState, onPick, onClose, riskOf = null }) {
  const el = document.createElement('section');
  el.className = 'sheet book hidden';
  root.appendChild(el);
  const ui = { q: '', party: '', clique: '', cohort: '', type: '', sort: 'seat', row: false };
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
    const opt = (value, label) => ({ value, label });
    return {
      party: [opt('', t('book.allParties')), ...parties.map(([id, n]) => opt(id, n))],
      clique: [opt('', t('book.allCliques')), opt('?', t('book.unknown')), ...[...cliques].map(([id, n]) => opt(id, n))],
      cohort: [opt('', t('book.allCohorts')), opt('?', t('book.unknown')), ...[...cohorts].sort((a, b) => b - a).map((c) => opt(c, `${ordinal(c)} Parliament`))],
      type: [opt('', t('book.allTypes')), ...['urban', 'suburban', 'rural', 'northern'].map((x) => opt(x, cap(t('type.' + x))))],
      // The field reads "Sort: seat"; inside the list the prefix would repeat on every row, so rows drop it.
      sort: ['seat', 'name', 'party', 'known', ...(riskOf ? ['risk'] : [])].map((s) => ({ ...opt(s, t('book.sort.' + s)), pick: t('book.sort.' + s).split(': ').pop() })),
    };
  }

  function rows(state) {
    const q = ui.q.trim().toLowerCase();
    const row = ui.row ? rowIds(state) : null;
    let list = Object.values(state.mps).filter((m) => {
      if (row && !row.has(m.id)) return false;
      // As a picker (whom to invite or call) the book leaves you out: an evening slot is never spent on yourself.
      if (title && m.id === state.player.mpId) return false;
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
    const myRow = rowIds(state);
    const total = Object.keys(state.mps).length - (title ? 1 : 0);
    el.innerHTML = `
      <header class="book-head">
        <h2>${esc(title || t('book.title'))}</h2>
        <button class="btn icon" data-act="close" aria-label="${t('btn.close')}">✕</button>
      </header>
      <input class="search" type="search" placeholder="${t('book.search')}" value="${esc(ui.q)}" autocomplete="off">
      <button class="chip-toggle${ui.row ? ' on' : ''}" data-act="row" aria-pressed="${ui.row}">${rowIcon} ${t('book.myRow')}</button>
      <div class="filters">
        ${[...FILTERS, 'sort'].map((f) => pickerHtml({ name: f, options: o[f], value: ui[f], title: t('book.pick.' + f), compact: true })).join('')}
      </div>
      <p class="count">${t('book.count', { n: list.length, total })}</p>
      <ul class="book-list">
        ${list
          .map((m) => {
            const known = knownCount(state, m.id);
            const risk = riskOf && ui.sort === 'risk' ? `<span class="risk">${esc(riskOf(state, m.id, true) ?? '')}</span>` : '';
            return `<li data-id="${m.id}">
              <span class="bar" style="background:${partyColor(state, m)}"></span>
              <span class="main"><b>${esc(mpName(m))}</b>${m.id === state.player.mpId ? ` <span class="badge you">${t('card.you')}</span>` : myRow.has(m.id) ? ` <span class="row-tag" title="${t('row.tag')}">${rowIcon}</span>` : ''}<small>${esc(partyShort(state, m))} · ${esc(m.riding.name)}${m.caucusRole !== 'backbencher' ? ' · ' + esc(roleName(state, m)) : ''}</small></span>
              ${risk}<span class="known" title="fields known">${'●'.repeat(Math.min(5, Math.ceil(known / 2)))}${'○'.repeat(5 - Math.min(5, Math.ceil(known / 2)))}</span>
            </li>`;
          })
          .join('')}
      </ul>
    `;
    el.querySelector('[data-act="close"]').onclick = api.close;
    el.querySelector('[data-act="row"]').onclick = () => {
      ui.row = !ui.row;
      render();
    };
    const search = el.querySelector('.search');
    search.oninput = () => {
      ui.q = search.value;
      const pos = search.selectionStart;
      render();
      const s2 = el.querySelector('.search');
      s2.focus();
      s2.setSelectionRange(pos, pos);
    };
    wirePickers(el, o);
    el.querySelectorAll('.filters input[type="hidden"]').forEach((s) => {
      s.onchange = () => {
        ui[s.name] = s.value;
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
