// The caucus room UI: the leader's line, grievances, the player's three moves (listen, speak, whisper), and
// from Act 5 the Chief Whip's business: free a whipped vote, or put a member out of caucus.
import { t, esc, mpName, jobLine, foldBlock } from './text.js';
import { take } from './feel.js';
import { neighbours, fillStance, stanceChoices, lineName } from '../sim/caucus.js';
import { canUse, canRelease, expelCandidates } from '../sim/tools.js';
import { data, tuning } from '../sim/config.js';
import { openPaperList } from './picker.js';
import { billName } from '../sim/bills.js';

export function createCaucusUI(root, { getState, dispatch, getRoom }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet caucus-sheet hidden';
  root.appendChild(sheet);
  let open = null;
  let lastNote = null;
  let expelling = null;
  let griefOpen = false; // the grievances fold away; this keeps them open across a re-render once opened

  function render(state) {
    if (state.flow.pending?.kind !== 'caucus' || !state.caucus) {
      sheet.classList.add('hidden');
      open = null;
      lastNote = null;
      expelling = null;
      griefOpen = false;
      return;
    }
    const c = state.caucus;
    const bill = c.billId && state.bills[c.billId];
    const lineText = c.line ? lineName(c.line) : '';
    const stances = stanceChoices(state).map((id) => data().caucus.stances.find((s) => s.id === id));
    const nb = neighbours(state);
    sheet.classList.remove('hidden');
    sheet.innerHTML = `<div class="sheet-handle"></div>
      <h2>${t('caucus.title')}</h2>
      ${jobLine(state, 'caucus', { revolt: c.revolt })}
      <p class="muted">${esc(c.moodText)}</p>
      <blockquote class="line">${esc(c.opening)}</blockquote>
      <p><b>${bill ? esc(t('caucus.line', { bill: billName(bill), line: lineText })) : t('caucus.noLine')}</b></p>
      ${c.revolt ? revoltHtml(c.revolt) : ''}
      ${c.grievances.length ? foldBlock(`${t('caucus.grievances')} <span class="fold-n">${c.grievances.length}</span>`, `<ul class="feed">${c.grievances.map((g) => `<li>${esc(g.text)}</li>`).join('')}</ul>`, { open: griefOpen, attr: 'data-grief' }) : ''}
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
    sheet.querySelector('[data-grief]')?.addEventListener('toggle', (e) => (griefOpen = e.target.open));
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
        lastNote = r ? t('caucus.said.' + (r.kind === 'support' || r.kind === 'challenge' ? r.kind : 'other')) : null;
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
      b.addEventListener('click', () => take(b, () => {
        dispatch({ type: 'caucusRevolt', choice: b.dataset.revolt });
        if (b.dataset.revolt !== 'quiet') getRoom?.()?.focusHead(true);
        setTimeout(() => getRoom?.()?.focusHead(false), 2500);
        render(getState());
      }))
    );
    on('[data-act="leave"]', () => dispatch({ type: 'resolve' }));
    on('[data-chief="release"]', () => {
      const r = dispatch({ type: 'useTool', tool: 'freeVote', billId: c.billId });
      lastNote = r?.ok ? t('caucus.released', { bill: billName(bill) }) : null;
      render(getState());
    });
    on('[data-chief="expel"]', () => {
      const s = getState();
      openPaperList({
        title: t('caucus.expelTitle'),
        options: expelCandidates(s)
          .filter((x) => !x.locked)
          .map((x) => {
            const record = t(x.rebellions > 1 ? 'caucus.expelRebel' : x.rebellions === 1 ? 'caucus.expelRebelOne' : 'caucus.expelClean', { n: x.rebellions, loyalty: x.loyalty });
            return { value: x.mpId, label: mpName(s.mps[x.mpId]), note: x.front ? `${t('caucus.role.' + x.role)} · ${record}` : record };
          }),
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
        lastNote = r.turned ? t('caucus.expelTurned', { name, ringleader: mpName(getState().mps[r.ringleader]) }) : t('caucus.expelled', { name });
      }
      expelling = null;
      render(getState());
    });
  }

  // A revolt against the leader: back them, join it or sit still. Against you, there's no joining it: face
  // them down, or let the room decide.
  function revoltHtml(r) {
    const you = r.target === 'whip';
    const choices = you ? ['back', 'quiet'] : ['back', 'join', 'quiet'];
    const label = (k) => t((you ? 'caucus.revoltYou' : 'caucus.revolt') + k[0].toUpperCase() + k.slice(1));
    return `<h3>${t('caucus.revolt')}</h3><blockquote class="line revolt">${esc(r.text)}</blockquote>${r.choice ? `<p class="note">${esc(label(r.choice))}.</p>` : `<div class="choices replies">${choices.map((k) => `<button class="btn" data-revolt="${k}">${label(k)}</button>`).join('')}</div>`}`;
  }

  // From Act 5: free the week's whipped line, or put a member out of caucus (with a confirm, since it can't
  // be undone). Each shows only when it can be used, or says why not. The confirm names what this one costs:
  // more for the front bench, and more again after the first of the morning.
  function chiefHtml(state, c, bill) {
    if (state.player.act < 5) return '';
    const T = tuning().tools;
    const rows = [];
    if (bill && canRelease(state, bill.id) && canUse(state, 'freeVote').ok) rows.push(`<div class="choices"><button class="btn" data-chief="release">${esc(t('caucus.release', { bill: billName(bill) }))}</button></div><p class="muted small">${t('caucus.releaseNote')}</p>`);
    const ex = canUse(state, 'expel');
    const again = c.expelled?.length > 0;
    const pool = ex.ok ? expelCandidates(state) : [];
    if (!ex.ok && ex.reason === 'leader') rows.push(`<p class="muted small">${esc(t('caucus.expelNeedsLeader', { need: T.expelLeaderTrust, have: Math.round(state.player.leaderTrust) }))}</p>`);
    else if (ex.ok && expelling && state.mps[expelling]) {
      const m = state.mps[expelling];
      const name = mpName(m);
      const front = pool.find((x) => x.mpId === expelling)?.front;
      const confirm = front ? t('caucus.expelConfirmFront', { name, role: data().headlines.roles[m.caucusRole], cost: -T.expelFrontTrust }) : t('caucus.expelConfirm', { name });
      rows.push(`<p class="note">${esc(confirm)}${again ? ` ${esc(t('caucus.expelConfirmAgain'))}` : ''}</p><div class="choices"><button class="btn" data-chief="confirm">${esc(t('caucus.expelYes', { name }))}</button><button class="btn primary" data-chief="keep">${t('caucus.expelNo')}</button></div>`);
    } else if (ex.ok) {
      const open = pool.filter((x) => !x.locked);
      rows.push(open.length ? `<div class="choices"><button class="btn" data-chief="expel">${t('caucus.expel')}</button></div>` : `<p class="muted small">${t('caucus.expelNobody')}</p>`);
      if (again && open.length) rows.push(`<p class="muted small">${t('caucus.expelAgain')}</p>`);
      if (pool.some((x) => x.locked)) rows.push(`<p class="muted small">${esc(t('caucus.expelFrontLocked', { need: T.expelFrontLeaderTrust, have: Math.round(state.player.leaderTrust) }))}</p>`);
    }
    return rows.length ? `<h3>${t('caucus.chief')}</h3>${rows.join('')}` : '';
  }
  return { render };
}
