// The office UI: the evening board (slots, walk-ins, invite, call) and the meeting's talk phase.
import { t, esc, mpName, partyColor, partyShort, firstWeekHint, jobLine } from './text.js';
import { fillLine } from '../sim/meetings.js';
import { renderDealTable } from './dealTable.js';
import { stakePanel, stakeBrief, delta } from './stakes.js';
import { billStakes } from '../sim/stakes.js';
import { tuning } from '../sim/config.js';
import { prediction } from '../sim/count.js';
import { canUse, likelyAbsentees, budget, nextVote } from '../sim/tools.js';
import { countLine, rowLine } from './text.js';

export function createOfficeUI(root, { getState, dispatch, pickMp, onLedger }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet office-sheet hidden';
  root.appendChild(sheet);
  let local = null;
  let localFor = null;
  let lastNote = null;
  let deskNote = null;

  // The other side's whip you pair through: the biggest caucus that isn't yours.
  function oppositeParty(state) {
    const mine = state.mps[state.player.mpId].party;
    return Object.values(state.parties).filter((p) => p.id !== mine && p.chiefWhip).sort((a, b) => b.seats - a.seats)[0] || null;
  }

  // From act 3 the desk shows the count; from act 4, who's asking for leave and who needs pairing.
  function whipsDesk(state) {
    const T = tuning().tools;
    const bill = nextVote(state);
    if (!bill || state.player.act < T.officeFilesFromAct) return '';
    const b = budget(state);
    let html = `<h3>${t('count.title')} · ${esc(bill.title)}</h3>${countLine(prediction(state, bill.id))}${rowLine(state, bill.id)}<p class="muted budget">${esc(t('tool.budget', { min: b.time, fav: b.favors }))}</p>`;
    if (deskNote) html += `<p class="note good">${esc(deskNote)}</p>`;
    if (canUse(state, 'leave').ok || canUse(state, 'pair').ok) {
      const reqs = (state.leaveRequests || []).filter((r) => r.billId === bill.id);
      const paired = new Set(state.pairs.filter((x) => !x.broken && (!x.bill || x.bill === bill.id)).flatMap((x) => [x.a, x.b]));
      const away = likelyAbsentees(state, bill.id).filter((m) => !paired.has(m.id)).slice(0, 4);
      const opp = oppositeParty(state);
      html += `<h3>${t('tool.pairsTitle')}</h3>`;
      if (reqs.length) html += `<p class="muted">${t('tool.leaveRequests')}</p><ul class="book-list">${reqs.map((r) => { const m = state.mps[r.mpId]; return `<li><span class="bar" style="background:${partyColor(state, m)}"></span><span class="main"><b>${esc(mpName(m))}</b><small>${esc(t('tool.leaveReason', { reason: r.reason, bill: bill.title }))}</small></span><button class="btn" data-leave="${m.id}" data-grant="1">${t('tool.grant')}</button><button class="btn" data-leave="${m.id}" data-grant="0">${t('tool.refuse')}</button></li>`; }).join('')}</ul>`;
      if (opp && canUse(state, 'pair').ok) html += away.length ? `<p class="muted">${t('tool.absentees')}</p><ul class="book-list">${away.map((m) => `<li><span class="bar" style="background:${partyColor(state, m)}"></span><span class="main"><b>${esc(mpName(m))}</b><small>${esc(t('tool.attendance', { n: m.attendance }))}</small></span><button class="btn" data-pair="${m.id}">${esc(t('tool.pair', { party: opp.short }))}</button></li>`).join('')}</ul>` : `<p class="muted">${t('tool.nobody')}</p>`;
    }
    return html;
  }

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
         ${stakeBrief(state, state.bills[e.whipCall.billId])}
         <button class="btn primary" data-act="whip" ${left < 1 ? 'disabled' : ''}>${t('office.go')}</button></div>`
      : '';
    const rows = e.walkIns.length
      ? e.walkIns
          .map((w) => {
            const m = state.mps[w.mpId];
            const seen = e.met.includes(w.mpId);
            const asked = w.situation === 'rebelRecruit' && state.bills[w.billId] ? billStakes(state, state.bills[w.billId]).rebel : null;
            return `<li${seen ? ' class="done"' : ''}><span class="bar" style="background:${partyColor(state, m)}"></span>
              <span class="main"><b>${esc(mpName(m))}</b><small>${esc(partyShort(state, m))} · ${esc(fillLine(state, w.reason, { bill: w.billId }))}</small>${asked ? `<small class="stake-line">${delta(asked.riding, t('stake.riding'))}${delta(asked.whip, t('stake.whip'))}</small>` : ''}</span>
              ${seen ? `<span class="muted">${t('office.seen')}</span>` : `<button class="btn" data-meet="${w.mpId}" ${left < 1 ? 'disabled' : ''}>${t('office.go')}</button>`}</li>`;
          })
          .join('')
      : `<li class="muted">${t('office.none')}</li>`;
    sheet.innerHTML = `<div class="sheet-handle"></div>
      <header class="card-head"><div class="who"><h2>${t(`office.title.${Math.max(1, Math.min(5, state.player.act))}`)}</h2><p>${t('office.slots')}: <span class="slots">${slotDots(e)}</span></p></div></header>
      ${jobLine(state, 'office', { slots: e.slots, whipCall: !!e.whipCall })}
      ${firstWeekHint(state, 'tutorial.office')}
      ${whip}
      <h3>${t('office.walkIns')}</h3><ul class="book-list">${rows}</ul>
      ${whipsDesk(state)}
      <div class="choices">
        <button class="btn" data-act="invite" ${left < 1 ? 'disabled' : ''}>${t('office.invite')}</button>
        <button class="btn" data-act="call" ${left < 0.5 ? 'disabled' : ''}>${t('office.call')}</button>
        <button class="btn" data-act="ledger">${t('tool.ledger')}</button>
        <button class="btn primary" data-act="end">${t('office.end')}</button>
      </div>`;
    const bill = nextVote(state);
    sheet.querySelectorAll('[data-leave]').forEach((b) => (b.onclick = () => {
      deskNote = dispatch({ type: 'useTool', tool: 'leave', mpId: b.dataset.leave, billId: bill.id, grant: b.dataset.grant === '1' })?.note || null;
    }));
    sheet.querySelectorAll('[data-pair]').forEach((b) => (b.onclick = () => {
      const r = dispatch({ type: 'useTool', tool: 'pair', mpId: b.dataset.pair, billId: bill.id, withParty: oppositeParty(state).id });
      deskNote = r?.note || (r?.reason === 'favor' ? 'No favours left to call in this week.' : null);
    }));
    sheet.querySelector('[data-act="ledger"]').onclick = () => onLedger?.();
    sheet.querySelector('[data-act="whip"]')?.addEventListener('click', () => dispatch({ type: 'meet', whipCall: true }));
    sheet.querySelectorAll('[data-meet]').forEach((b) => (b.onclick = () => dispatch({ type: 'meet', mpId: b.dataset.meet })));
    sheet.querySelector('[data-act="invite"]').onclick = () => pickMp(t('office.pickInvite'), (id) => dispatch({ type: 'invite', mpId: id }));
    sheet.querySelector('[data-act="call"]').onclick = () => pickMp(t('office.pickCall'), (id) => dispatch({ type: 'call', mpId: id }));
    sheet.querySelector('[data-act="end"]').onclick = () => dispatch({ type: 'resolve' });
  }

  function meeting(state) {
    const mt = state.meetings[state.meeting];
    const m = state.mps[mt.mpId];
    // After the first turn the job and the full stakes have been read: keep one short stakes line so the talk has the room.
    const later = mt.phase === 'talk' && mt.turn > 1;
    const bill = ['whipCall', 'rebelRecruit'].includes(mt.situation) ? state.bills[mt.billId] : null;
    const stakes = bill ? (later ? stakeBrief(state, bill) : stakePanel(state, bill)) : '';
    const head = `<div class="sheet-handle"></div>
      <header class="card-head"><span class="chip" style="background:${partyColor(state, m)}"></span>
        <div class="who"><h2>${esc(mpName(m))}</h2><p><span class="badge mood-${mt.mood}">${t('mood.' + mt.mood)}</span> ${mt.phase === 'talk' ? t('talk.turn', { n: mt.turn, max: mt.maxTurns }) : ''}</p></div></header>
      ${later ? '' : jobLine(state, 'meeting', { situation: mt.situation, pos: mt.billId ? t('vote.' + state.bills[mt.billId]?.positions[state.mps[state.player.mpId].party]) : '' })}
      ${stakes}`;
    if (mt.phase === 'talk') {
      const note = lastNote ? `<p class="note ${lastNote}">${t(lastNote === 'good' ? 'talk.good' : lastNote === 'bad' ? 'talk.bad' : 'talk.ok')}</p>` : '';
      sheet.innerHTML = `${head}${note}<blockquote class="line">${esc(mt.talk.current.text)}</blockquote>
        <div class="choices talk-choices">${mt.talk.options.map((o, i) => `<button class="btn" data-i="${i}"><small class="approach">${t('approach.' + o.approach)}</small>${esc(o.text)}</button>`).join('')}</div>`;
      sheet.querySelectorAll('[data-i]').forEach((b) => {
        b.onclick = () => {
          const r = dispatch({ type: 'talk', index: Number(b.dataset.i) });
          lastNote = r?.note || 'ok';
          render(getState());
        };
      });
      // Each new turn opens on what they just said: from the top if it's in view there, otherwise scrolled to it.
      const said = sheet.querySelector('blockquote.line');
      const fits = said.offsetTop + said.offsetHeight + 60 <= sheet.clientHeight;
      sheet.scrollTop = later && !fits ? Math.max(0, (sheet.querySelector('.note') || said).offsetTop - 8) : 0;
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
