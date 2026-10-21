// The ledger: every promise, favour, pair, threat and rival move on the books, from both sides, with what
// came of it. Opened from the menu, the office, or an MP's card (filtered to them).
import { t, esc, mpName, partyColor, stamp } from './text.js';
import { cardLabel } from '../sim/meetings.js';

export function createLedger(root, { getState }) {
  const el = document.createElement('section');
  el.className = 'sheet ledger-sheet hidden';
  root.appendChild(el);
  let open = false;
  let filter = null;

  function who(state, id) {
    if (!id) return '';
    if (state.mps[id]) return mpName(state.mps[id]);
    if (state.parties[id]) return state.parties[id].name;
    return id;
  }

  function label(state, e) {
    if (e.note) return e.note;
    try {
      return cardLabel(state, e.what);
    } catch {
      return e.what;
    }
  }

  function outcome(e) {
    if (e.kind === 'rival' && e.what.startsWith('pair')) return stamp(t(e.kept ? 'ledger.honoured' : 'ledger.reneged'), e.kept ? 'yea' : 'nay');
    if (e.settled && e.kept === true) return stamp(t('ledger.kept'), 'yea');
    if (e.settled && e.kept === false) return stamp(t('ledger.broken'), 'nay');
    if (!e.settled && e.dueWeek != null) return `<span class="when">${esc(t('ledger.due', { w: e.dueWeek + 1 }))}</span>`;
    return `<span class="when">${esc(t('ledger.week', { w: e.created + 1 }))}</span>`;
  }

  function row(state, e) {
    const pid = state.player.mpId;
    const other = e.from === pid ? e.to : e.from;
    const m = state.mps[other];
    const bar = m ? partyColor(state, m) : state.parties[other]?.color || '#6b6f76';
    return `<li><span class="bar" style="background:${bar}"></span><span class="main"><b>${esc(who(state, other))}</b><small>${esc(label(state, e))}</small></span>${outcome(e)}</li>`;
  }

  function group(state, title, list) {
    if (!list.length) return '';
    return `<h3>${title}</h3><ul class="book-list">${list.map((e) => row(state, e)).join('')}</ul>`;
  }

  function render() {
    const state = getState();
    if (!open || !state) return;
    const pid = state.player.mpId;
    const rivalWhips = new Set(Object.values(state.parties).map((p) => p.chiefWhip).filter(Boolean));
    let all = state.ledger.slice().reverse();
    if (filter) all = all.filter((e) => e.from === filter || e.to === filter);
    const owe = all.filter((e) => e.from === pid && !e.settled && (e.kind === 'promise' || e.kind === 'favor'));
    const owed = all.filter((e) => e.to === pid && !e.settled && (e.kind === 'promise' || e.kind === 'favor'));
    const pairs = all.filter((e) => e.kind === 'pair');
    const threats = all.filter((e) => e.kind === 'threat' || e.kind === 'tool');
    const rivals = all.filter((e) => e.kind === 'rival' && rivalWhips.has(e.from));
    const settled = all.filter((e) => e.settled && (e.kind === 'promise' || e.kind === 'favor'));
    const head = filter ? `${t('ledger.title')} · ${esc(who(state, filter))}` : t('ledger.title');
    el.innerHTML = `<div class="sheet-handle"></div>
      <header class="book-head"><h2>${head}</h2>${filter ? `<button class="btn" data-act="all">${t('ledger.all')}</button>` : ''}<button class="btn icon" data-act="close" aria-label="${t('btn.close')}">✕</button></header>
      ${all.length ? '' : `<p class="muted">${t('ledger.empty')}</p>`}
      ${group(state, t('ledger.owe'), owe)}${group(state, t('ledger.owed'), owed)}${group(state, t('ledger.pairs'), pairs)}${group(state, t('ledger.threats'), threats)}${group(state, t('ledger.rivals'), rivals)}${group(state, t('ledger.settled'), settled)}`;
    el.querySelector('[data-act="close"]').onclick = () => api.close();
    el.querySelector('[data-act="all"]')?.addEventListener('click', () => {
      filter = null;
      render();
    });
  }

  const api = {
    get isOpen() {
      return open;
    },
    open(mpId = null) {
      filter = mpId;
      open = true;
      el.classList.remove('hidden');
      render();
    },
    close() {
      open = false;
      el.classList.add('hidden');
    },
    refresh: render,
  };
  return api;
}
