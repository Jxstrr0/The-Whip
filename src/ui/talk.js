// The office UI: the evening board (slots, walk-ins, invite, call) and the meeting's talk phase.
import { t, esc, mpName, partyColor, partyShort, jobLine, stamp } from './text.js';
import { fillLine, cardLabel } from '../sim/meetings.js';
import { renderDealTable } from './dealTable.js';
import { stakeStamps, stakeBrief, delta, cardChip, tableTotal } from './stakes.js';
import { drawer, HANDLE } from './drawer.js';
import { take } from './feel.js';
import { billStakes } from '../sim/stakes.js';
import { tuning } from '../sim/config.js';
import { prediction } from '../sim/count.js';
import { canUse, likelyAbsentees, budget, nextVote } from '../sim/tools.js';
import { billName } from '../sim/bills.js';
import { countLine, rowLine } from './text.js';
import { buzz } from '../haptics.js';

// Which ink the verdict is stamped in: a deal is good news, a door slammed is bad, a polite no is neither.
const INK = { deal: 'yea', theyWalked: 'nay', youDeclined: 'nay', refused: 'nay' };

export function createOfficeUI(root, { getState, dispatch, pickMp, onLedger, onVerdict, getRoom = () => null }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet office-sheet hidden';
  root.appendChild(sheet);
  // Pulled to full height, the paper carries the line and the room's note goes away.
  let said = null;
  const speak = () => getRoom()?.setSpeech?.(sheet.dataset.h === 'full' ? null : said);
  const heights = drawer(sheet, { onChange: speak });
  let local = null;
  let localFor = null;
  let lastNote = null;
  let deskNote = null;
  let stamped = null;

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
      if (reqs.length) html += `<p class="muted">${t('tool.leaveRequests')}</p><ul class="book-list">${reqs.map((r) => { const m = state.mps[r.mpId]; return `<li><span class="bar" style="background:${partyColor(state, m)}"></span><span class="main"><b>${esc(mpName(m))}</b><small>${esc(t('tool.leaveReason', { reason: r.reason, bill: billName(bill) }))}</small></span><button class="btn" data-leave="${m.id}" data-grant="1">${t('tool.grant')}</button><button class="btn" data-leave="${m.id}" data-grant="0">${t('tool.refuse')}</button></li>`; }).join('')}</ul>`;
      if (opp && canUse(state, 'pair').ok) html += away.length ? `<p class="muted">${t('tool.absentees')}</p><ul class="book-list">${away.map((m) => `<li><span class="bar" style="background:${partyColor(state, m)}"></span><span class="main"><b>${esc(mpName(m))}</b><small>${esc(t('tool.attendance', { n: m.attendance }))}</small></span><button class="btn" data-pair="${m.id}">${esc(t('tool.pair', { party: opp.short }))}</button></li>`).join('')}</ul>` : `<p class="muted">${t('tool.nobody')}</p>`;
    }
    return html;
  }

  function slotDots(e) {
    const full = Math.floor(e.slots - e.used);
    const half = e.slots - e.used - full >= 0.5;
    return '●'.repeat(full) + (half ? '◐' : '') + '○'.repeat(Math.max(0, Math.ceil(e.used)));
  }

  // After a one-to-one: DEAL or NO DEAL in ink, their parting words, the terms, and what it did between you.
  // Each meeting buzzes at most once for the whip's call and once for a deal, however often the sheet redraws.
  let buzzed = '';
  function buzzOnce(state, kind) {
    const key = `${state.meeting}:${kind}`;
    if (buzzed === key) return;
    buzzed = key;
    buzz(kind);
  }

  // The memo's letterhead: whose paper it is, and where in the meeting you are.
  const letterhead = (mt, right) => `<p class="lh"><span>${t(mt.situation === 'whipCall' ? 'memo.whip' : 'memo.member')}</span><span>${right}</span></p>`;

  function verdict(state, mt) {
    const m = state.mps[mt.mpId];
    const o = mt.outcome;
    const dealt = o === 'deal';
    if (dealt) buzzOnce(state, 'deal');
    const terms = (list, label, toYou) => `<div class="deal-col"><h4>${label}</h4>${list.length ? list.map((c) => `<div class="card-chip settled"><span class="lbl">${esc(cardLabel(state, c, toYou))}</span>${cardChip(state, c, toYou ? 'get' : 'give', mt.mpId)}</div>`).join('') : `<p class="muted">${t('debrief.nothing')}</p>`}</div>`;
    const theirs = mt.revealed.filter((f) => !f.includes('.') && f !== 'mood' && f !== 'rapport').length;
    const others = new Set(mt.revealed.filter((f) => f.includes('.')).map((f) => f.split('.')[0])).size;
    const learned = [theirs ? t(theirs === 1 ? 'debrief.learnedOne' : 'debrief.learned', { n: theirs }) : '', others ? t(others === 1 ? 'debrief.othersOne' : 'debrief.others', { n: others }) : ''].filter(Boolean).join(' ');
    const r = mt.after?.rapport ?? 0;
    const owed = dealt && [...mt.deal.offers, ...mt.deal.asks].some((c) => c !== 'info');
    heights.set('half', mt.id);
    sheet.classList.add('memo');
    sheet.innerHTML = `${HANDLE()}<i class="memo-clip" aria-hidden="true"></i>${letterhead(mt, t('memo.record'))}
      <header class="card-head"><span class="chip" style="background:${partyColor(state, m)}"></span>
        <div class="who"><h2>${esc(mpName(m))}</h2><p>${esc(partyShort(state, m))}</p></div></header>
      <div class="verdict-row">${stamp(t(dealt ? 'debrief.stamp.deal' : 'debrief.stamp.noDeal'), INK[o] || 'grey', true)}<p class="verdict-line">${esc(t('debrief.' + (dealt && mt.reversal ? 'dealWhip' : o), { first: m.name.first }))}</p></div>
      ${mt.after?.parting ? `<blockquote class="line in-room">${esc(mt.after.parting)}</blockquote>` : ''}
      ${dealt ? `<div class="deal-cols">${terms(mt.deal.offers, t('deal.youGive'), false)}${terms(mt.deal.asks, t('deal.youGet'), true)}</div>${tableTotal(state, mt.deal, mt.mpId)}` : ''}
      <p class="debrief-facts"><span class="k">${esc(t('debrief.rapport'))}</span> ${delta(r, '')}${learned ? ` <span class="muted">${esc(learned)}</span>` : ''}</p>
      ${owed ? `<p class="hint">${t('debrief.ledger')}</p>` : ''}
      <div class="choices">
        ${owed ? `<button class="btn" data-act="ledger">${t('tool.ledger')}</button>` : ''}
        <button class="btn primary" data-act="back">${t('debrief.back')}</button>
      </div>`;
    // A deal has its own buzz (above); the stamp's would double it.
    if (dealt) sheet.querySelector('.stamp').dataset.felt = '';
    sheet.querySelector('[data-act="ledger"]')?.addEventListener('click', () => onLedger?.());
    sheet.querySelector('[data-act="back"]').onclick = () => dispatch({ type: 'closeDebrief' });
    sheet.scrollTop = 0;
    // The thump plays once per card, not on every re-render behind it.
    if (stamped !== mt.id) {
      stamped = mt.id;
      onVerdict?.(dealt);
    }
  }

  function evening(state) {
    const e = state.evening;
    if (!e) return;
    const done = e.debrief && state.meetings[e.debrief];
    if (done?.outcome) return verdict(state, done);
    const left = e.slots - e.used;
    const whip = e.whipCall
      ? `<div class="whip-call slip"><p class="whip-call-label">${t('office.whipCall')}</p><p class="whip-call-bill">${esc(state.bills[e.whipCall.billId]?.title || '')}</p>
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
    heights.set('full', 'evening');
    sheet.classList.remove('memo');
    sheet.innerHTML = `${HANDLE()}
      <header class="card-head"><div class="who"><h2>${t(`office.title.${Math.max(1, Math.min(5, state.player.act))}`)}</h2><p>${t('office.slots')}: <span class="slots">${slotDots(e)}</span></p></div></header>
      ${jobLine(state, 'office', { slots: e.slots, whipCall: !!e.whipCall })}
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
      deskNote = r?.note || (r?.reason === 'favor' ? t('office.noFavours') : null);
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
    if (mt.reversal && mt.phase !== 'debrief') buzzOnce(state, 'reversal');
    // After the first turn the job has been read: the talk gets the room.
    const later = mt.phase === 'talk' && mt.turn > 1;
    const bill = ['whipCall', 'rebelRecruit'].includes(mt.situation) ? state.bills[mt.billId] : null;
    // The talk is a memo on the pad (letterhead, clip, the stakes stamped on); the deal table is its own sheet.
    const memo = mt.phase === 'talk';
    sheet.classList.toggle('memo', memo);
    const head = `${HANDLE()}${memo ? `<i class="memo-clip" aria-hidden="true"></i>${letterhead(mt, t('talk.turn', { n: mt.turn, max: mt.maxTurns }))}` : ''}
      <header class="card-head"><span class="chip" style="background:${partyColor(state, m)}"></span>
        <div class="who"><h2>${esc(mpName(m))}</h2><p>${memo ? `${esc(m.riding.name)} · ` : ''}<span class="badge mood-${mt.mood}">${t('mood.' + mt.mood)}</span></p></div></header>
      ${later ? '' : jobLine(state, 'meeting', { situation: mt.situation, pos: mt.billId ? t('vote.' + state.bills[mt.billId]?.positions[state.mps[state.player.mpId].party]) : '' })}
      ${bill ? stakeStamps(state, bill) : ''}`;
    if (mt.phase === 'talk') {
      // The talk opens at half height: their line is set beside them in the room, and the sheet holds the replies.
      // Where the room can't show it (a phone on its side under a bottom sheet) the line stays on the paper.
      heights.set('half', mt.id);
      const note = lastNote ? `<p class="note ${lastNote}">${t(lastNote === 'good' ? 'talk.good' : lastNote === 'bad' ? 'talk.bad' : 'talk.ok')}</p>` : '';
      sheet.innerHTML = `${head}${note}<blockquote class="line in-room">${esc(mt.talk.current.text)}</blockquote>
        <div class="choices talk-choices">${mt.talk.options.map((o, i) => `<button class="btn" data-i="${i}"><small class="approach">${t('approach.' + o.approach)}</small>${esc(o.text)}</button>`).join('')}</div>`;
      sheet.querySelectorAll('[data-i]').forEach((b) => {
        b.onclick = () => take(b, () => {
          const r = dispatch({ type: 'talk', index: Number(b.dataset.i) });
          lastNote = r?.note || 'ok';
          render(getState());
        });
      });
      // Each new turn opens on the replies: from the top if they're in view there, otherwise scrolled to them.
      const said = sheet.querySelector('.note') || sheet.querySelector('.talk-choices');
      const fits = said.offsetTop + 60 <= sheet.clientHeight;
      sheet.scrollTop = later && !fits ? Math.max(0, said.offsetTop - 8) : 0;
      return;
    }
    heights.set('full', mt.id);
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
    const mt = p?.kind === 'meeting' && state.meeting ? state.meetings[state.meeting] : null;
    if (p?.kind === 'office') {
      lastNote = null;
      sheet.classList.remove('hidden');
      evening(state);
    } else if (mt) {
      sheet.classList.remove('hidden');
      meeting(state);
    } else sheet.classList.add('hidden');
    // Their line goes to the room, beside them: what they're saying while the talk is on, and their parting
    // words while the verdict is up and they're still in the chair.
    const done = p?.kind === 'office' && state.evening?.debrief ? state.meetings[state.evening.debrief] : null;
    const parting = done?.outcome && done.outcome !== 'theyWalked' ? done.after?.parting : null;
    said = mt?.phase === 'talk' ? mt.talk.current.text : parting || null;
    speak();
  }
  return { render, sheet };
}
