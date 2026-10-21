// The count board: the bells and your choice during a division, then the standing count ticking up by party.
import { t, esc, stamp, partyShort, partyColor, mpName, countLine, firstWeekHint, jobLine } from './text.js';
import { tuning, data } from '../sim/config.js';
import { stageLabel, questionText } from '../sim/vote.js';
import { prediction } from '../sim/count.js';
import { budget, runners } from '../sim/tools.js';
import { createHillMap, hillHeader } from './hillMap.js';

function feeling(v) {
  const a = Math.abs(v);
  const dir = v > 0 ? 'for it' : 'against it';
  if (a > 0.9) return `strongly ${dir}`;
  if (a > 0.45) return dir;
  return `leaning ${v > 0 ? 'for' : 'against'}`;
}

export function createCountBoard(root, { getState, onChoose, onContinue, getRoom, dispatch }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet division-sheet hidden';
  root.appendChild(sheet);
  const board = document.createElement('section');
  board.className = 'count-board hidden';
  root.appendChild(board);
  let raf = null;
  let map = null;
  let shownResult = null;
  let shownChoice = null;

  function stopBells() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  // The bells sheet. From act 3, on a whipped vote of ours, it carries the map of the Hill and the chase.
  function showChoice(p) {
    const state = getState();
    const bill = state.bills[p.billId];
    const me = state.mps[state.player.mpId];
    const pos = p.position;
    const other = pos === 'yea' ? 'nay' : 'yea';
    const lineText = p.line === 'whipped' ? t('div.lineWhipped', { pos: t('vote.' + pos).toUpperCase() }) : t('div.lineFree');
    const d = p.dilemma;
    const total = p.bells;
    const T = tuning().tools;
    const countHtml = () => (state.player.act >= T.officeFilesFromAct && p.line === 'whipped' ? countLine(prediction(getState(), p.billId)) : '');
    const bells = state.bells?.key === `${p.billId}:${p.stage}` ? state.bells : null;
    const shown = bells ? Object.values(bells.away).filter((a) => a.where).length : 0;
    const budgetLine = () => esc(t('tool.budget', { min: budget(getState()).time, fav: budget(getState()).favors }));
    const hill = !bells
      ? ''
      : shown
        ? `<section class="hill">
            <div class="hill-head"><h3>${t('hill.title')}</h3><span data-staff>${hillHeader(bells, runners(state), runners(state))}</span></div>
            <p class="muted hill-help">${t('hill.help')}</p>
            <div class="hill-map" data-hill></div>
            <p class="note hill-note" data-chase-note aria-live="polite"></p>
            <p class="muted budget" data-budget>${budgetLine()}</p>
          </section>`
        : `<p class="note good">${t('hill.allHere')}</p>`;
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="bells-head">
        <p class="bells">🔔 ${t('div.bells')} · <span data-bells>${t('div.doorsClose', { s: total })}</span></p>
        <div class="bells-bar" aria-hidden="true"><i data-bells-bar></i></div>
      </div>
      <h2>${esc(bill.title)}</h2>
      <p class="muted">${esc(questionText(bill, p.stage))} · ${esc(stageLabel(p.stage))}</p>
      ${jobLine(state, 'division', { reason: p.reason, chase: shown > 0, dilemma: !!d, confidence: bill.confidence, line: p.line, pos: t('vote.' + pos) })}
      ${hill}
      <div data-count>${countHtml()}</div>
      <p>${esc(bill.summary || '')}</p>
      ${bill.confidence ? `<p class="warn">${t('div.confidence')}</p>` : ''}
      ${p.reason === 'ownBill' ? `<p class="tutorial">${t('div.ownBill')}</p>` : firstWeekHint(state, 'tutorial.bells')}
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
    sheet.scrollTop = 0;
    getRoom()?.setBells?.(true);

    const t0 = performance.now();
    const left = () => Math.max(0, total - (performance.now() - t0) / 1000);
    // The doors close, on the clock or because the player has voted. Runs still out were settled when they left.
    const doors = (choice) => {
      stopBells();
      map?.close();
      getRoom()?.setBells?.(false);
      onChoose(choice);
    };
    const note = sheet.querySelector('[data-chase-note]');
    const say = (text, kind = '') => {
      if (!note) return;
      note.textContent = text;
      note.className = `note hill-note ${kind}`;
    };
    const refresh = () => {
      const st = getState();
      const staff = sheet.querySelector('[data-staff]');
      if (staff && map) staff.innerHTML = hillHeader(bells, runners(st) - map.busy(), runners(st));
      const b = sheet.querySelector('[data-budget]');
      if (b) b.innerHTML = budgetLine();
    };
    map = null;
    const host = sheet.querySelector('[data-hill]');
    if (host) {
      map = createHillMap(host, {
        getState,
        bells,
        onSend(mpId, secsLeft) {
          const r = dispatch?.({ type: 'useTool', tool: 'chase', mpId, billId: p.billId, secsLeft });
          const m = getState().mps[mpId];
          const name = `${m.name.first} ${m.name.last}`;
          if (r?.ok) {
            const a = bells.away[mpId];
            say(t('hill.sent', { name, spot: data().hill.places[a.where].spots[a.spot].text, s: a.trip }));
          } else if (r?.reason === 'runners') say(t('hill.busy'), 'bad');
          else if (r?.reason === 'time') say(t('hill.noTime'), 'bad');
          else if (r?.reason === 'far') say(t('hill.far', { name }), 'bad');
          queueMicrotask(refresh);
          return r;
        },
      });
      map.onArrive((r) => {
        say(r.line, r.found ? 'good' : 'bad');
        const c = sheet.querySelector('[data-count]');
        if (c) c.innerHTML = countHtml();
        refresh();
      });
    }
    sheet.querySelectorAll('[data-c]').forEach((b) => {
      b.onclick = () => doors(b.dataset.c);
    });
    stopBells();
    // The bells ring in real seconds. When the doors close you're in your seat, voting with your party.
    const label = sheet.querySelector('[data-bells]');
    const bar = sheet.querySelector('[data-bells-bar]');
    let lastShown = total;
    const tick = () => {
      const l = left();
      const s = Math.ceil(l);
      if (s !== lastShown) {
        lastShown = s;
        label.textContent = t('div.doorsClose', { s });
        sheet.classList.toggle('bells-late', s <= 5);
      }
      bar.style.transform = `scaleX(${(l / total).toFixed(4)})`;
      map?.frame(l, total);
      if (l <= 0) return doors('line');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
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
      <div data-outcome><p class="muted">${t('div.counting')}</p><p class="roll" data-roll></p></div>
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
    const myParty = state.mps[state.player.mpId].party;
    const rollEl = board.querySelector('[data-roll]');
    room.playDivision(result, {
      secondsPerSeat: tuning().vote.secondsPerSeat,
      tick(c, mpId, kind) {
        // The Clerk reads each name as its seat lights: the last few run along the strip, your caucus in bold.
        const mp = mpId && state.mps[mpId];
        if (mp && rollEl) {
          // Append rather than rebuild, so only the new name slides in and the rest sit still.
          const span = document.createElement('span');
          span.className = `${kind}${mp.party === myParty ? ' mine' : ''}${mpId === state.player.mpId ? ' me' : ''}`;
          span.textContent = mp.name.last;
          rollEl.appendChild(span);
          while (rollEl.children.length > 4) rollEl.firstChild.remove();
        }
        // The numbers update at most every few seats so phones stay smooth.
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
