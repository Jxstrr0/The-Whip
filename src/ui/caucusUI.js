// The caucus room UI: the leader's line, grievances, the player's three moves (listen, speak, whisper), and
// from Act 5 the Chief Whip's business: free a whipped vote, or put a member out of caucus.
import { t, esc, mpName, jobLine } from './text.js';
import { neighbours, fillStance } from '../sim/caucus.js';
import { canUse, canRelease, expelCandidates } from '../sim/tools.js';
import { data, tuning } from '../sim/config.js';
import { openPaperList } from './picker.js';

export function createCaucusUI(root, { getState, dispatch, getRoom }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet caucus-sheet hidden';
  root.appendChild(sheet);
  let open = null;
  let lastNote = null;
  let expelling = null;

  function render(state) {
    if (state.flow.pending?.kind !== 'caucus' || !state.caucus) {
      sheet.classList.add('hidden');
      open = null;
      lastNote = null;
      expelling = null;
      return;
    }
    const c = state.caucus;
    const bill = c.billId && state.bills[c.billId];
    const lineText = c.line ? (c.line.line === 'whipped' ? `whipped ${c.line.position.toUpperCase()}` : 'a free vote') : '';
    const stances = c.stanceOptions.map((id) => data().caucus.stances.find((s) => s.id === id));
    const nb = neighbours(state);
    sheet.classList.remove('hidden');
    sheet.innerHTML = `<div class="sheet-handle"></div>
      <h2>${t('caucus.title')}</h2>
      ${jobLine(state, 'caucus', { revolt: c.revolt })}
      <p class="muted">${esc(c.moodText)}</p>
      <blockquote class="line">${esc(c.opening)}</blockquote>
      <p><b>${bill ? esc(t('caucus.line', { bill: bill.title, line: lineText })) : t('caucus.noLine')}</b></p>
      ${c.revolt ? `<h3>${t('caucus.revolt')}</h3><blockquote class="line revolt">${esc(c.revolt.text)}</blockquote>${c.revolt.choice ? `<p class="note">${esc(t('caucus.revolt' + c.revolt.choice[0].toUpperCase() + c.revolt.choice.slice(1)))}.</p>` : `<div class="choices"><button class="btn" data-revolt="back">${t('caucus.revoltBack')}</button><button class="btn" data-revolt="join">${t('caucus.revoltJoin')}</button><button class="btn" data-revolt="quiet">${t('caucus.revoltQuiet')}</button></div>`}` : ''}
      ${c.grievances.length ? `<h3>${t('caucus.grievances')}</h3><ul class="feed">${c.grievances.map((g) => `<li>${esc(g.text)}</li>`).join('')}</ul>` : ''}
      <h3>${t('caucus.actions')} <span class="slots">${'●'.repeat(c.actions)}${'○'.repeat(3 - c.actions)}</span></h3>
      ${lastNote ? `<p class="note good">${esc(lastNote)}</p>` : ''}
      <div class="choices">
        <button class="btn" data-act="listen" ${c.actions < 1 ? 'disabled' : ''}>${t('caucus.listen')}</button>
        <button class="btn" data-act="speak" ${c.actions < 1 || c.spoke ? 'disabled' : ''}>${c.spoke ? t('caucus.spoken') : t('caucus.speak')}</button>
        ${open === 'speak' ? stances.map((s) => `<button class="btn sub" data-stance="${s.id}">${esc(fillStance(state, s.text))}</button>`).join('') : ''}
        <button class="btn" data-act="whisper" ${c.actions < 1 || !nb.length ? 'disabled' : ''}>${t('caucus.whisper')}</button>
        ${open === 'whisper' ? nb.map((id) => `<button class="btn sub" data-whisper="${id}">${esc(t('caucus.whisperTo', { name: mpName(state.mps[id]) }))}</button>`).join('') : ''}
      </div>
      ${chiefHtml(state, c, bill)}
      <div class="choices"><button class="btn primary" data-act="leave">${t('caucus.leave')}</button></div>
      <p class="hint">${t('caucus.hint')}</p>`;
    const on = (sel, fn) => sheet.querySelector(sel)?.addEventListener('click', fn);
    on('[data-act="listen"]', () => {
      const r = dispatch({ type: 'caucusListen' });
      lastNote = r?.note;
      if (r?.pairs?.length) getRoom?.()?.showPairs(r.pairs);
      open = null;
      render(getState());
    });
    on('[data-act="speak"]', () => {
      open = open === 'speak' ? null : 'speak';
      getRoom?.()?.focusHead(open === 'speak');
      render(getState());
    });
    on('[data-act="whisper"]', () => {
      open = open === 'whisper' ? null : 'whisper';
      render(getState());
    });
    sheet.querySelectorAll('[data-stance]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = dispatch({ type: 'caucusSpeak', stance: b.dataset.stance });
        lastNote = r ? `You said it. ${r.kind === 'support' ? 'The front bench nods.' : r.kind === 'challenge' ? 'The leader writes something down.' : 'A few heads turn your way.'}` : null;
        open = null;
        setTimeout(() => getRoom?.()?.focusHead(false), 2500);
        render(getState());
      })
    );
    sheet.querySelectorAll('[data-whisper]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = dispatch({ type: 'caucusWhisper', mpId: b.dataset.whisper });
        lastNote = r ? `${mpName(getState().mps[b.dataset.whisper])}: ${r.text}` : null;
        open = null;
        render(getState());
      })
    );
    sheet.querySelectorAll('[data-revolt]').forEach((b) =>
      b.addEventListener('click', () => {
        dispatch({ type: 'caucusRevolt', choice: b.dataset.revolt });
        if (b.dataset.revolt !== 'quiet') getRoom?.()?.focusHead(true);
        setTimeout(() => getRoom?.()?.focusHead(false), 2500);
        render(getState());
      })
    );
    on('[data-act="leave"]', () => dispatch({ type: 'resolve' }));
    on('[data-chief="release"]', () => {
      const r = dispatch({ type: 'useTool', tool: 'freeVote', billId: c.billId });
      lastNote = r?.ok ? t('caucus.released', { bill: bill.title }) : null;
      render(getState());
    });
    on('[data-chief="expel"]', () => {
      const s = getState();
      openPaperList({
        title: t('caucus.expelTitle'),
        options: expelCandidates(s).map((x) => ({
          value: x.mpId,
          label: mpName(s.mps[x.mpId]),
          note: t(x.rebellions > 1 ? 'caucus.expelRebel' : x.rebellions === 1 ? 'caucus.expelRebelOne' : 'caucus.expelClean', { n: x.rebellions, loyalty: x.loyalty }),
        })),
        value: null,
        onPick(o) {
          expelling = o.value;
          render(getState());
        },
      });
    });
    on('[data-chief="keep"]', () => {
      expelling = null;
      render(getState());
    });
    on('[data-chief="confirm"]', () => {
      const name = mpName(getState().mps[expelling]);
      const r = dispatch({ type: 'useTool', tool: 'expel', mpId: expelling });
      if (r?.ok) {
        getRoom?.()?.empty?.(expelling);
        lastNote = t('caucus.expelled', { name });
      }
      expelling = null;
      render(getState());
    });
  }

  // From Act 5: free the week's whipped line, or put a member out of caucus (with a confirm, since it can't
  // be undone). Each shows only when it can be used, or says why not.
  function chiefHtml(state, c, bill) {
    if (state.player.act < 5) return '';
    const rows = [];
    if (bill && canRelease(state, bill.id) && canUse(state, 'freeVote').ok) rows.push(`<div class="choices"><button class="btn" data-chief="release">${esc(t('caucus.release', { bill: bill.title }))}</button></div><p class="muted small">${t('caucus.releaseNote')}</p>`);
    const ex = canUse(state, 'expel');
    if (c.expelled) rows.push(`<p class="muted small">${t('caucus.expelOnce')}</p>`);
    else if (!ex.ok && ex.reason === 'leader') rows.push(`<p class="muted small">${esc(t('caucus.expelNeedsLeader', { need: tuning().tools.expelLeaderTrust, have: Math.round(state.player.leaderTrust) }))}</p>`);
    else if (ex.ok && expelling && state.mps[expelling]) {
      const name = mpName(state.mps[expelling]);
      rows.push(`<p class="note">${esc(t('caucus.expelConfirm', { name }))}</p><div class="choices"><button class="btn" data-chief="confirm">${esc(t('caucus.expelYes', { name }))}</button><button class="btn primary" data-chief="keep">${t('caucus.expelNo')}</button></div>`);
    } else if (ex.ok) rows.push(expelCandidates(state).length ? `<div class="choices"><button class="btn" data-chief="expel">${t('caucus.expel')}</button></div>` : `<p class="muted small">${t('caucus.expelNobody')}</p>`);
    return rows.length ? `<h3>${t('caucus.chief')}</h3>${rows.join('')}` : '';
  }
  return { render };
}
