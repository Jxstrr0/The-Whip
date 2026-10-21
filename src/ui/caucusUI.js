// The caucus room UI: the leader's line, grievances, and the player's three moves (listen, speak, whisper).
import { t, esc, mpName } from './text.js';
import { data } from '../sim/config.js';
import { neighbours, fillStance } from '../sim/caucus.js';

export function createCaucusUI(root, { getState, dispatch, getRoom }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet caucus-sheet hidden';
  root.appendChild(sheet);
  let open = null;
  let lastNote = null;

  function render(state) {
    if (state.flow.pending?.kind !== 'caucus' || !state.caucus) {
      sheet.classList.add('hidden');
      open = null;
      lastNote = null;
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
      <p class="muted">${esc(c.moodText)}</p>
      <blockquote class="line">${esc(c.opening)}</blockquote>
      <p><b>${bill ? esc(t('caucus.line', { bill: bill.title, line: lineText })) : t('caucus.noLine')}</b></p>
      ${c.grievances.length ? `<h3>${t('caucus.grievances')}</h3><ul class="feed">${c.grievances.map((g) => `<li>${esc(g.text)}</li>`).join('')}</ul>` : ''}
      <h3>${t('caucus.actions')} <span class="slots">${'●'.repeat(c.actions)}${'○'.repeat(3 - c.actions)}</span></h3>
      ${lastNote ? `<p class="note good">${esc(lastNote)}</p>` : ''}
      <div class="choices">
        <button class="btn" data-act="listen" ${c.actions < 1 ? 'disabled' : ''}>${t('caucus.listen')}</button>
        <button class="btn" data-act="speak" ${c.actions < 1 || c.spoke ? 'disabled' : ''}>${c.spoke ? t('caucus.spoken') : t('caucus.speak')}</button>
        ${open === 'speak' ? stances.map((s) => `<button class="btn sub" data-stance="${s.id}">${esc(fillStance(state, s.text))}</button>`).join('') : ''}
        <button class="btn" data-act="whisper" ${c.actions < 1 || !nb.length ? 'disabled' : ''}>${t('caucus.whisper')}</button>
        ${open === 'whisper' ? nb.map((id) => `<button class="btn sub" data-whisper="${id}">${esc(t('caucus.whisperTo', { name: mpName(state.mps[id]) }))}</button>`).join('') : ''}
        <button class="btn primary" data-act="leave">${t('caucus.leave')}</button>
      </div>
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
    on('[data-act="leave"]', () => dispatch({ type: 'resolve' }));
  }
  return { render };
}
