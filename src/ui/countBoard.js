// The count board: the bells and your choice during a division, then the standing count ticking up by party.
import { t, esc, stamp, partyShort } from './text.js';
import { tuning } from '../sim/config.js';
import { stageLabel, questionText } from '../sim/vote.js';

function feeling(v) {
  const a = Math.abs(v);
  const dir = v > 0 ? 'for it' : 'against it';
  if (a > 0.9) return `strongly ${dir}`;
  if (a > 0.45) return dir;
  return `leaning ${v > 0 ? 'for' : 'against'}`;
}

export function createCountBoard(root, { getState, onChoose, onContinue, getRoom }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet division-sheet hidden';
  root.appendChild(sheet);
  const board = document.createElement('section');
  board.className = 'count-board hidden';
  root.appendChild(board);
  let bellTimer = null;
  let shownResult = null;
  let shownChoice = null;

  function stopBells() {
    if (bellTimer) clearInterval(bellTimer);
    bellTimer = null;
  }

  function showChoice(p) {
    const state = getState();
    const bill = state.bills[p.billId];
    const me = state.mps[state.player.mpId];
    const pos = p.position;
    const other = pos === 'yea' ? 'nay' : 'yea';
    const lineText = p.line === 'whipped' ? t('div.lineWhipped', { pos: t('vote.' + pos).toUpperCase() }) : t('div.lineFree');
    const d = p.dilemma;
    let secs = p.bells;
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <p class="bells">🔔 ${t('div.bells')} · <span data-bells>${t('div.doorsClose', { s: secs })}</span></p>
      <h2>${esc(bill.title)}</h2>
      <p class="muted">${esc(questionText(bill, p.stage))} · ${esc(stageLabel(p.stage))}</p>
      <p>${esc(bill.summary || '')}</p>
      ${bill.confidence ? `<p class="warn">${t('div.confidence')}</p>` : ''}
      <div class="kvs">
        <div class="kv"><span class="k">${t('div.line', { line: '' }).replace(': ', '')}</span><span class="v">${esc(lineText)}</span></div>
        ${d ? `<div class="kv"><span class="k">${esc(me.riding.name)}</span><span class="v">${esc(feeling(d.ridingPull))}</span></div>
        <div class="kv"><span class="k">${t('div.conscience', { feeling: '' }).replace(': ', '')}</span><span class="v">${esc(feeling(d.conscience))}</span></div>` : ''}
      </div>
      <div class="choices">
        <button class="btn primary" data-c="line">${t('div.choose.line', { pos: t('vote.' + pos) })}</button>
        ${p.line === 'whipped' && pos !== 'abstain' ? `<button class="btn" data-c="rebel">${t('div.choose.rebel', { pos: t('vote.' + other) })}</button>` : ''}
        <button class="btn" data-c="absent">${t('div.choose.absent')}</button>
      </div>`;
    sheet.classList.remove('hidden');
    getRoom()?.setBells?.(true);
    sheet.querySelectorAll('[data-c]').forEach((b) => {
      b.onclick = () => {
        stopBells();
        getRoom()?.setBells?.(false);
        onChoose(b.dataset.c);
      };
    });
    stopBells();
    // The bells ring in real seconds. When the doors close you're in your seat, voting with your party.
    bellTimer = setInterval(() => {
      secs--;
      const el = sheet.querySelector('[data-bells]');
      if (el) el.textContent = t('div.doorsClose', { s: Math.max(0, secs) });
      if (secs <= 0) {
        stopBells();
        getRoom()?.setBells?.(false);
        onChoose('line');
      }
    }, 1000);
  }

  function partyRows(state, result, counts) {
    const rows = {};
    const yeas = result.yeas.slice(0, counts.yea);
    const nays = result.nays.slice(0, counts.nay);
    for (const [list, k] of [[yeas, 'y'], [nays, 'n']]) {
      for (const id of list) {
        const key = partyShort(state, state.mps[id]);
        rows[key] ||= { y: 0, n: 0 };
        rows[key][k]++;
      }
    }
    return Object.entries(rows)
      .map(([k, v]) => `<span class="pr"><b>${esc(k)}</b> ✔${v.y} ✖${v.n}</span>`)
      .join('');
  }

  // One click handler for the board's lifetime, so a tap still lands while the count updates.
  board.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'fast') getRoom()?.lights.finish();
    else if (act === 'cont') {
      board.classList.add('hidden');
      getRoom()?.clearDivision();
      shownResult = null;
      onContinue();
    }
  });

  function boardScale(result) {
    const voting = result.yeas.length + result.nays.length;
    const needed = Math.floor(voting / 2) + 1;
    return { needed, max: Math.max(needed, result.yeas.length, result.nays.length, 1) };
  }

  // Build the board once per division; ticks only touch the numbers, so the buttons are never replaced mid-tap.
  function buildBoard(result) {
    const { needed, max } = boardScale(result);
    board.innerHTML = `
      <p class="muted">${esc(result.title)} · ${esc(stageLabel(result.stage))}</p>
      <div class="tally">
        <div class="bar-row"><span>✔ ${t('div.yeas')}</span><div class="bar"><i class="yea" data-bar="yea"></i><em style="left:${(100 * needed) / max}%"></em></div><b data-n="yea">0</b></div>
        <div class="bar-row"><span>✖ ${t('div.nays')}</span><div class="bar"><i class="nay" data-bar="nay"></i><em style="left:${(100 * needed) / max}%"></em></div><b data-n="nay">0</b></div>
      </div>
      <p class="muted">${t('div.needed', { n: needed })} · <span data-parties></span></p>
      <div data-outcome><p class="muted">${t('div.counting')}…</p></div>
      <div class="card-actions"><button class="btn" data-act="fast">${t('div.skipAnim')}</button></div>`;
  }

  function updateCounts(result, counts) {
    const { max } = boardScale(result);
    for (const k of ['yea', 'nay']) {
      board.querySelector(`[data-bar="${k}"]`).style.width = `${(100 * counts[k]) / max}%`;
      board.querySelector(`[data-n="${k}"]`).textContent = counts[k];
    }
    board.querySelector('[data-parties]').innerHTML = partyRows(getState(), result, counts);
  }

  function finishBoard(result) {
    getRoom()?.gavel?.();
    updateCounts(result, { yea: result.yeas.length, nay: result.nays.length });
    const me = getState().player.mpId;
    const mine = result.yeas.includes(me) ? 'yea' : result.nays.includes(me) ? 'nay' : 'absent';
    board.querySelector('[data-outcome]').innerHTML = `<p>${stamp(t(result.carried ? 'stamp.carried' : 'stamp.defeated'), result.carried ? 'yea' : 'nay', true)} <span class="verdict ${result.carried ? 'yea' : 'nay'}">${t(result.carried ? 'div.carried' : 'div.defeated', { y: result.yeas.length, n: result.nays.length })}</span></p>
        ${result.speakerVote ? `<p>${t('div.speaker', { v: t('vote.' + result.speakerVote) })}</p>` : ''}
        <p class="muted">${t('div.you', { v: t('vote.' + mine) })}</p>`;
    board.querySelector('.card-actions').innerHTML = `<button class="btn primary" data-act="cont">${t('div.continue')}</button>`;
  }

  function showResult(p) {
    if (shownResult === p.divisionId) return;
    shownResult = p.divisionId;
    const state = getState();
    const result = state.divisions[p.divisionId];
    sheet.classList.add('hidden');
    board.classList.remove('hidden');
    buildBoard(result);
    updateCounts(result, { yea: 0, nay: 0 });
    const room = getRoom();
    if (!room) return finishBoard(result);
    let last = 0;
    room.playDivision(result, {
      secondsPerSeat: tuning().vote.secondsPerSeat,
      tick(c) {
        // Update at most every few seats so phones stay smooth.
        if (c.yea + c.nay - last >= 3) {
          last = c.yea + c.nay;
          updateCounts(result, c);
        }
      },
      done: () => finishBoard(result),
    });
  }

  return {
    render(state) {
      const p = state.flow.pending;
      const key = p?.kind === 'division' ? `${p.billId}:${p.stage}` : null;
      if (key && key !== shownChoice) {
        shownChoice = key;
        showChoice(p);
      } else if (!key) {
        shownChoice = null;
        stopBells();
        sheet.classList.add('hidden');
      }
      if (p?.kind === 'result') showResult(p);
      else if (shownResult) {
        board.classList.add('hidden');
        getRoom()?.clearDivision();
        shownResult = null;
      }
    },
  };
}
