// The MP card: a bottom sheet showing public facts plus only what the knowledge map says the player knows.
import { cardView, HIDDEN_FIELDS, familiarity } from '../sim/knowledge.js';
import { rowIds } from '../sim/row.js';
import { t, esc, partyColor, partyName, roleName, interestName, ideologyText, loyaltyText, ambitionText, rapportText, ordinal } from './text.js';

function seatText(state, seatId) {
  if (!seatId) return t('card.noseat');
  const n = Number(seatId.slice(1));
  const side = n <= 60 ? 'gov' : 'opp';
  const row = Math.floor(((n - 1) % 60) / 15) + 1;
  return t('card.seat', { seat: seatId, side: t('side.' + side), row });
}

function fieldValue(state, mp, f, v) {
  switch (f) {
    case 'loyalty':
      return loyaltyText(v);
    case 'ambition':
      return ambitionText(v);
    case 'ideology':
      return ideologyText(v);
    case 'interests':
      return v.map(interestName).join(', ');
    case 'cohort':
      return v === state.house.parliament ? t('card.parliamentNow', { n: ordinal(v) }) : t('card.parliamentThen', { n: ordinal(v), yrs: mp.tenure });
    case 'mood':
      return t('mood.' + v);
    case 'rapport':
      return rapportText(v);
    case 'attendance':
      return `${v}%`;
    case 'lifeEvents':
      return v.length ? v.map((e) => e.kind).join(', ') : t('card.lifeNone');
    case 'secrets':
      return v ? `${v}` : t('card.secretsNone');
    default:
      return String(v);
  }
}

export function createMpCard(root, { getState, onClose, actions = () => [] }) {
  const el = document.createElement('section');
  el.className = 'sheet mp-card hidden';
  el.setAttribute('aria-live', 'polite');
  root.appendChild(el);
  let current = null;

  function render() {
    const state = getState();
    if (!current || !state) return;
    const mp = state.mps[current];
    const v = cardView(state, current);
    const role = (mp.caucusRole !== 'backbencher' ? `<span class="badge">${esc(roleName(state, mp))}</span>` : '') + (!v.isPlayer && rowIds(state).has(mp.id) ? ` <span class="badge row">${esc(t('row.tag'))}</span>` : '');
    const rows = HIDDEN_FIELDS.map((f) => {
      const fv = v.fields[f];
      const tone = fv.known && f === 'rapport' ? (fv.value >= 20 ? 'good' : fv.value <= -20 ? 'bad' : 'plain') : '';
      const val = fv.known ? `<span class="${tone ? 'tone-' + tone : ''}">${esc(fieldValue(state, mp, f, fv.value))}</span>` : `<span class="unknown">${t('card.unknown')}</span>`;
      return `<div class="kv${fv.stale ? ' stale' : ''}"><span class="k">${t('field.' + f)}</span><span class="v">${val}${fv.stale ? ` <em>(${t('card.stale')})</em>` : ''}</span></div>`;
    }).join('');
    const extra = actions(current)
      .map((a, i) => `<button class="btn${a.primary ? ' primary' : ''}" data-i="${i}">${esc(a.label)}</button>`)
      .join('');
    el.innerHTML = `
      <div class="sheet-handle"></div>
      <header class="card-head">
        <span class="chip" style="background:${partyColor(state, mp)}"></span>
        <div class="who">
          <h2>${esc(v.name)}${v.isPlayer ? ` <span class="badge you">${t('card.you')}</span>` : ''}</h2>
          <p>${esc(partyName(state, mp.party))} ${role}</p>
        </div>
        <button class="btn icon" data-act="close" aria-label="${t('btn.close')}">✕</button>
      </header>
      <p class="riding">${esc(mp.riding.name)} · ${esc(mp.riding.province)} · ${t('type.' + mp.riding.type)}</p>
      <p class="seat">${esc(seatText(state, mp.seatId))}</p>
      ${v.isPlayer ? '' : `<p class="seat familiar">${t('card.face' + familiarity(state, mp.id))}</p>`}
      <h3>${t('card.known')}</h3>
      <div class="kvs">${rows}</div>
      ${Object.values(v.fields).some((f) => !f.known) ? `<p class="hint">${t('card.hint')}</p>` : ''}
      ${extra ? `<div class="card-actions">${extra}</div>` : ''}
    `;
    el.querySelector('[data-act="close"]').onclick = () => {
      api.hide();
      onClose?.();
    };
    el.querySelectorAll('.card-actions [data-i]').forEach((b) => {
      b.onclick = () => actions(current)[Number(b.dataset.i)].run();
    });
  }

  const api = {
    get mpId() {
      return current;
    },
    show(mpId) {
      current = mpId;
      el.classList.remove('hidden');
      render();
      el.scrollTop = 0;
    },
    refresh: render,
    hide() {
      current = null;
      el.classList.add('hidden');
    },
  };
  return api;
}
