// The riding UI: who's in the chair, carrying cases, the reporter, the president, the town hall, standing.
import { t, esc, jobLine, standingTone } from './text.js';
import { data } from '../sim/config.js';
import { fillRiding, caseStakes } from '../sim/riding.js';
import { delta } from './stakes.js';

export function createRidingUI(root, { getState, dispatch }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet riding-sheet hidden';
  root.appendChild(sheet);

  function bar(label, v) {
    const tone = standingTone(v);
    return `<div class="bar-row"><span>${label}</span><div class="bar"><i class="tone-${tone}" style="width:${v}%"></i><em style="left:50%"></em></div><b class="tone-${tone}">${v}</b></div>`;
  }

  function render(state) {
    const v = state.ridingVisit;
    if (state.flow.pending?.kind !== 'riding' || !v) {
      sheet.classList.add('hidden');
      return;
    }
    sheet.classList.remove('hidden');
    const C = data().constituents;
    const me = state.mps[state.player.mpId];
    const p = state.player;
    let body = '';
    // What was just said, kept on screen while the next person sits down.
    const w = v.lastWord;
    const lastWord = w ? `<p class="muted last-word">${esc(t(w.who === 'you' ? 'riding.youSaid' : 'riding.presidentSaid', { role: t('role.' + w.role).toLowerCase(), text: w.text }))}</p>` : '';
    if (v.phase === 'visitors') {
      const item = v.queue[v.at];
      const who = `${lastWord}<h3>${t('role.' + item.role)}</h3>`;
      if (item.kind === 'case') {
        const c = C.cases.find((x) => x.id === item.id);
        const k = caseStakes(c);
        const chip = (n) => `<small class="stake-line">${delta(n, t('stake.riding'))}</small>`;
        body = `${who}<blockquote class="line">${esc(fillRiding(state, c.text))}</blockquote>
          <div class="choices"><button class="btn primary" data-act="carry">${t('riding.carry')} <small class="approach">${esc(fillRiding(state, c.what))}</small>${chip(k.carry)}</button>
          ${C.refer[c.role] ? `<button class="btn" data-act="refer">${esc(C.refer[c.role].label)}${chip(k.refer)}</button>` : ''}
          <button class="btn" data-act="decline">${t('riding.decline')}${chip(k.decline)}</button></div>`;
      } else if (item.kind === 'reporter') {
        const q = C.reporter.find((x) => x.id === item.id);
        body = `${who}<blockquote class="line">${esc(fillRiding(state, q.prompt))}</blockquote>
          <div class="choices replies">${q.options.map((o, i) => `<button class="btn" data-rep="${i}">${esc(fillRiding(state, o.text))}</button>`).join('')}</div>`;
      } else {
        const pr = C.president.find((x) => x.id === item.id);
        const replies = C.presidentReplies?.[pr.mood] || [];
        body = `${who}<blockquote class="line">${esc(fillRiding(state, pr.text))}</blockquote>
          <div class="choices replies">${replies.length ? replies.map((r, i) => `<button class="btn" data-pres="${i}">${esc(fillRiding(state, r.text))}</button>`).join('') : `<button class="btn primary" data-pres="0">${t('riding.thanks')}</button>`}</div>`;
      }
    } else if (v.phase === 'townHall') {
      const th = v.townHall;
      const topic = C.townHall.topics.find((x) => x.id === th.topics[th.at]);
      body = `${th.at === 0 ? `<p class="muted">${esc(fillRiding(state, th.opener))}</p>` : ''}
        <div class="tally">${bar(t('riding.crowd'), th.crowd)}</div>
        <blockquote class="line">${esc(fillRiding(state, topic.prompt))}</blockquote>
        <div class="choices replies">${topic.options.map((o, i) => `<button class="btn" data-th="${i}">${esc(fillRiding(state, o.text))}</button>`).join('')}</div>`;
    } else {
      body = `${lastWord}<p class="muted">${t('riding.done')}</p><div class="choices">
        ${!v.townHall ? `<button class="btn" data-act="townhall">${esc(t('riding.townHall', { town: v.town }))}</button>` : ''}
        ${p.pendingProject ? `<button class="btn" data-act="announce">${t('riding.announce')}</button>` : ''}
        <button class="btn primary" data-act="home">${t('riding.home')}</button></div>`;
    }
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${esc(t('riding.title', { riding: me.riding.name }))}</h2>
      <div class="tally">${bar(t('riding.standing'), p.ridingStanding)}</div>${jobLine(state, 'riding')}${body}`;
    const on = (sel, action) => sheet.querySelector(sel)?.addEventListener('click', () => dispatch(action));
    on('[data-act="carry"]', { type: 'ridingCase', mode: 'carry' });
    on('[data-act="refer"]', { type: 'ridingCase', mode: 'refer' });
    on('[data-act="decline"]', { type: 'ridingCase', mode: 'decline' });
    on('[data-act="townhall"]', { type: 'ridingTownHall' });
    on('[data-act="announce"]', { type: 'ridingAnnounce' });
    on('[data-act="home"]', { type: 'resolve' });
    sheet.querySelectorAll('[data-pres]').forEach((b) => b.addEventListener('click', () => dispatch({ type: 'ridingPresident', index: Number(b.dataset.pres) })));
    sheet.querySelectorAll('[data-rep]').forEach((b) => b.addEventListener('click', () => dispatch({ type: 'ridingReporter', index: Number(b.dataset.rep) })));
    sheet.querySelectorAll('[data-th]').forEach((b) => b.addEventListener('click', () => dispatch({ type: 'ridingAnswer', index: Number(b.dataset.th) })));
  }
  return { render };
}
