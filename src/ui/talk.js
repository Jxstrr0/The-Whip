// The office UI: the evening board (slots, walk-ins, invite, call) and the meeting's talk phase.
import { t, esc, mpName, partyColor, partyShort } from './text.js';
import { fillLine } from '../sim/meetings.js';
import { renderDealTable } from './dealTable.js';

export function createOfficeUI(root, { getState, dispatch, pickMp }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet office-sheet hidden';
  root.appendChild(sheet);
  let local = null;
  let localFor = null;
  let lastNote = null;

  function slotDots(e) {
    const full = Math.floor(e.slots - e.used);
    const half = e.slots - e.used - full >= 0.5;
    return '●'.repeat(full) + (half ? '◐' : '') + '○'.repeat(Math.max(0, Math.ceil(e.used)));
  }

  function evening(state) {
    const e = state.evening;
    if (!e) return;
    const left = e.slots - e.used;
    const whip = e.whipCall
      ? `<div class="whip-call"><p><b>${t('office.whipCall')}</b></p><p>${esc(fillLine(state, e.whipCall.reason, { bill: e.whipCall.billId }))}</p>
         <button class="btn primary" data-act="whip" ${left < 1 ? 'disabled' : ''}>${t('office.go')}</button></div>`
      : '';
    const rows = e.walkIns.length
      ? e.walkIns
          .map((w) => {
            const m = state.mps[w.mpId];
            const seen = e.met.includes(w.mpId);
            return `<li${seen ? ' class="done"' : ''}><span class="bar" style="background:${partyColor(state, m)}"></span>
              <span class="main"><b>${esc(mpName(m))}</b><small>${esc(partyShort(state, m))} · ${esc(fillLine(state, w.reason, { bill: w.billId }))}</small></span>
              ${seen ? `<span class="muted">${t('office.seen')}</span>` : `<button class="btn" data-meet="${w.mpId}" ${left < 1 ? 'disabled' : ''}>${t('office.go')}</button>`}</li>`;
          })
          .join('')
      : `<li class="muted">${t('office.none')}</li>`;
    sheet.innerHTML = `<div class="sheet-handle"></div>
      <header class="card-head"><div class="who"><h2>${t('office.title')}</h2><p>${t('office.slots')}: <span class="slots">${slotDots(e)}</span></p></div></header>
      ${whip}
      <h3>${t('office.walkIns')}</h3><ul class="book-list">${rows}</ul>
      <div class="choices">
        <button class="btn" data-act="invite" ${left < 1 ? 'disabled' : ''}>${t('office.invite')}</button>
        <button class="btn" data-act="call" ${left < 0.5 ? 'disabled' : ''}>${t('office.call')}</button>
        <button class="btn primary" data-act="end">${t('office.end')}</button>
      </div>`;
    sheet.querySelector('[data-act="whip"]')?.addEventListener('click', () => dispatch({ type: 'meet', whipCall: true }));
    sheet.querySelectorAll('[data-meet]').forEach((b) => (b.onclick = () => dispatch({ type: 'meet', mpId: b.dataset.meet })));
    sheet.querySelector('[data-act="invite"]').onclick = () => pickMp(t('office.pickInvite'), (id) => dispatch({ type: 'invite', mpId: id }));
    sheet.querySelector('[data-act="call"]').onclick = () => pickMp(t('office.pickCall'), (id) => dispatch({ type: 'call', mpId: id }));
    sheet.querySelector('[data-act="end"]').onclick = () => dispatch({ type: 'resolve' });
  }

  function meeting(state) {
    const mt = state.meetings[state.meeting];
    const m = state.mps[mt.mpId];
    const head = `<div class="sheet-handle"></div>
      <header class="card-head"><span class="chip" style="background:${partyColor(state, m)}"></span>
        <div class="who"><h2>${esc(mpName(m))}</h2><p><span class="badge mood-${mt.mood}">${t('mood.' + mt.mood)}</span> ${mt.phase === 'talk' ? t('talk.turn', { n: mt.turn, max: mt.maxTurns }) : ''}</p></div></header>`;
    if (mt.phase === 'talk') {
      const note = lastNote ? `<p class="note ${lastNote}">${t(lastNote === 'good' ? 'talk.good' : lastNote === 'bad' ? 'talk.bad' : 'talk.ok')}</p>` : '';
      sheet.innerHTML = `${head}${note}<blockquote class="line">${esc(mt.talk.current.text)}</blockquote>
        <div class="choices">${mt.talk.options.map((o, i) => `<button class="btn" data-i="${i}"><small class="approach">${t('approach.' + o.approach)}</small>${esc(o.text)}</button>`).join('')}</div>`;
      sheet.querySelectorAll('[data-i]').forEach((b) => {
        b.onclick = () => {
          const r = dispatch({ type: 'talk', index: Number(b.dataset.i) });
          lastNote = r?.note || 'ok';
          render(getState());
        };
      });
      return;
    }
    if (localFor !== mt.id) {
      local = { offers: [...mt.deal.offers], asks: [...mt.deal.asks] };
      localFor = mt.id;
      lastNote = null;
    }
    sheet.innerHTML = `${head}<div class="deal"></div>`;
    renderDealTable(sheet.querySelector('.deal'), state, mt, local, {
      onPropose: (offers, asks) => dispatch({ type: 'propose', offers, asks }),
      onLeave: () => dispatch({ type: 'leaveMeeting' }),
      onAcceptCounter: () => dispatch({ type: 'acceptCounter' }),
      onWalk: () => dispatch({ type: 'leaveMeeting' }),
      rerender: () => meeting(getState()),
    });
  }

  function render(state) {
    const p = state.flow.pending;
    if (p?.kind === 'office') {
      lastNote = null;
      sheet.classList.remove('hidden');
      evening(state);
    } else if (p?.kind === 'meeting' && state.meeting) {
      sheet.classList.remove('hidden');
      meeting(state);
    } else sheet.classList.add('hidden');
  }
  return { render };
}
