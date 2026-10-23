// Question Period in three beats: the Speaker calls your name and you choose how to ask; the minister answers
// and the benches react; the gallery's verdict and what it cost or bought you. The chamber plays along: you
// stand, the minister stands, the gavel falls when you sit.
import { t, esc, stamp, firstWeekHint, jobLine, mpName, roleName } from './text.js';
import { tuning } from '../sim/config.js';
import { FRAMINGS } from '../sim/questionPeriod.js';

const STAMP_KIND = { lob: 'grey', parried: 'grey', hit: 'yea', home: 'brass' };
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export function createQpUI(root, { getState, dispatch, getRoom, onBenches }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet qp-sheet hidden';
  root.appendChild(sheet);
  // The sim knows two phases (stand, answer); the gallery's verdict is a page turn of our own.
  let verdictFor = null;
  let roomPhase = null;
  let heardFor = null;

  function stage(phase, qp, state) {
    const room = getRoom?.();
    const key = qp ? `${qp.week}:${qp.day}:${phase}` : null;
    if (!room || key === roomPhase) return;
    roomPhase = key;
    const me = state.mps[state.player.mpId];
    room.questionPeriod(phase, { seatId: me.seatId, mpId: me.id, ministerId: qp?.ministerId || null });
  }

  function render(state) {
    const qp = state.questionPeriod;
    if (state.flow.pending?.kind !== 'questionPeriod' || !qp) {
      sheet.classList.add('hidden');
      if (roomPhase) stage(null, null, state);
      return;
    }
    sheet.classList.remove('hidden');
    const me = state.mps[state.player.mpId];
    const minister = state.mps[qp.ministerId];
    const day = tuning().calendar.days[qp.day - 1];
    const key = `${qp.week}:${qp.day}`;
    let body = '';
    let phase = 'stand';
    if (qp.phase === 'stand') {
      // One line for the slot and who answers it, then the Speaker's call.
      const slot = minister ? t('qp.slotTo', { day, minister: mpName(minister), role: roleName(state, minister) }) : t('qp.slot', { day });
      body = `<p class="muted to">${esc(slot)}${qp.source === 'deal' ? ` · ${esc(t('qp.deal'))}` : ''}</p>
        <blockquote class="line call">${esc(qp.call)}</blockquote>
        ${jobLine(state, 'questionPeriod')}${firstWeekHint(state, 'tutorial.qp')}
        <div class="choices replies">${FRAMINGS.map((f) => `<button class="btn" data-framing="${f}"><small class="approach">${t('qp.' + f)}</small>${esc(qp.questions[f])}</button>`).join('')}</div>`;
    } else if (verdictFor !== key) {
      phase = 'answer';
      body = `<p class="muted who">${t('qp.you')}</p>
        <blockquote class="line">${esc(qp.questions[qp.framing])}</blockquote>
        <h3>${esc(minister ? `${mpName(minister)}, ${roleName(state, minister)}` : t('role.cabinet'))}</h3>
        <blockquote class="line answer">${esc(qp.answer)}</blockquote>
        <p class="muted">${esc(qp.benches)}</p>
        <div class="choices"><button class="btn primary" data-act="verdict">${t('qp.continue')}</button></div>`;
      if (heardFor !== key) {
        heardFor = key;
        onBenches?.(qp.outcome);
      }
    } else {
      phase = 'gallery';
      const fx = qp.effects || {};
      const rows = [
        fx.whip ? ['qp.fx.whip', signed(fx.whip)] : null,
        ['qp.fx.noticed', signed(fx.noticed || 0)],
        ['qp.fx.riding', signed(fx.riding || 0)],
        fx.poll ? ['qp.fx.poll', signed(fx.poll)] : null,
        ['qp.fx.press', fx.headline ? `“${fx.headline}”` : t('qp.fx.noPress')],
      ].filter(Boolean);
      body = `<div class="verdict">${stamp(t('qp.outcome.' + qp.outcome), STAMP_KIND[qp.outcome], true)}</div>
        <p class="muted">${esc(qp.gallery)}</p>
        <div class="kvs">${rows.map(([k, v]) => `<div class="kv"><span class="k">${t(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>
        <div class="choices"><button class="btn primary" data-act="sit">${t('qp.sit')}</button></div>`;
    }
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${t('qp.title')}</h2>${body}`;
    stage(phase, qp, state);
    sheet.querySelectorAll('[data-framing]').forEach((b) => b.addEventListener('click', () => dispatch({ type: 'qpAsk', framing: b.dataset.framing })));
    sheet.querySelector('[data-act="verdict"]')?.addEventListener('click', () => {
      verdictFor = key;
      getRoom?.()?.gavel();
      render(getState());
    });
    sheet.querySelector('[data-act="sit"]')?.addEventListener('click', () => dispatch({ type: 'resolve' }));
  }
  return { render };
}
