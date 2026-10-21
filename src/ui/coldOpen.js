// The cold open, on the Order Paper. Election night: the count comes in poll by poll on a board that updates
// in place (votes count up, rows change places, the House fills in along the bottom), the crowd outside the
// campaign office rides the lead, and the returning officer declares. Then opening day: the camera walks you
// in from the bar while the lines of your first time in the room come up one by one.
import { t, esc, stamp } from './text.js';
import { tuning, data } from '../sim/config.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const ROW_H = 42;

export function createColdOpenUI(root, { getState, dispatch, getRoom, audio, colorOf }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet coldopen-sheet hidden';
  root.appendChild(sheet);

  let night = null; // the count being shown: { key, data, at, declared, timer, shown[] (votes on screen) }
  let walk = null; // the walk in: { key, shown, seated, timer }

  function stopTimers() {
    clearTimeout(night?.timer);
    clearTimeout(walk?.timer);
  }

  // ---- Election night -------------------------------------------------------------------------------------

  function signs(state, n) {
    const me = state.mps[state.player.mpId];
    const riding = state.ridings[me.riding.id];
    const town = riding.towns?.[0] || riding.name;
    const ctx = { LAST: me.name.last.toUpperCase(), Last: me.name.last, riding: riding.name, short: n.candidates[0].short, town };
    return data().coldOpen.signs.map((s) => s.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? ''));
  }

  // The street outside: the crowd's mood follows your lead; they cheer when you're ahead and roar at the end.
  function stageCount(state) {
    const room = getRoom('riding');
    if (!room?.setElectionNight) return;
    const n = night.data;
    const s = n.steps[night.at];
    const sum = s.votes.reduce((a, b) => a + b, 0) || 1;
    const best = Math.max(...s.votes.slice(1));
    const diff = ((s.votes[0] - best) / sum) * 100;
    const mood = night.declared ? 94 : Math.max(16, Math.min(84, 55 + diff * 2.4));
    const cheer = night.declared ? 1 : s.leader === 0 ? 0.22 : 0;
    room.setElectionNight(true, { mood, signs: signs(state, n), cheer });
  }

  function buildCount(state) {
    const n = night.data;
    const order = n.candidates.map((c, i) => i);
    const parties = Object.entries(n.steps[n.steps.length - 1].seats).sort((a, b) => b[1] - a[1]);
    const houseTotal = parties.reduce((a, [, k]) => a + k, 0);
    night.need = Math.floor(houseTotal / 2) + 1;
    night.houseTotal = houseTotal;
    night.parties = parties.map(([id]) => id);
    sheet.innerHTML = `<div class="sheet-handle"></div>
      <h2>${t('coldOpen.title')}</h2>
      <p class="muted co-where">${esc(t('coldOpen.where', { riding: n.riding, province: n.province }))}</p>
      <div class="co-polls"><span class="co-polls-text"></span><span class="co-polls-bar"><i></i></span></div>
      <div class="co-board" style="height:${order.length * ROW_H}px">${n.candidates
        .map(
          (c, i) => `<div class="co-row${c.you ? ' you' : ''}" data-i="${i}">
            <i class="chip" style="background:${colorOf(c.party)}"></i>
            <span class="nm">${esc(c.name)}${c.you ? ` <small class="badge you">${t('coldOpen.you')}</small>` : ''}<small>${esc(c.partyName)}</small></span>
            <span class="v">0</span>
            <span class="bar"><i style="background:${colorOf(c.party)}"></i></span>
          </div>`
        )
        .join('')}</div>
      <div class="co-line"></div>
      <div class="co-house">
        <p class="co-house-label">${esc(t('coldOpen.house', { need: night.need, total: houseTotal }))}</p>
        <div class="co-seats">${night.parties.map((id) => `<i data-p="${id}" style="background:${colorOf(id)}"></i>`).join('')}<b class="co-need" style="left:${(night.need / houseTotal) * 100}%"></b></div>
        <div class="co-seat-keys">${night.parties.map((id) => `<span data-p="${id}"><i style="background:${colorOf(id)}"></i>${esc(state.parties[id]?.short || id)} <b>0</b></span>`).join('')}</div>
      </div>
      <div class="co-result"></div>
      <div class="choices co-actions"></div>`;
    night.shown = n.candidates.map(() => 0);
  }

  // Count the numbers up to where they're going, so a poll coming in reads as a poll coming in.
  function tweenVotes(target) {
    const from = night.shown.slice();
    const t0 = performance.now();
    const rows = [...sheet.querySelectorAll('.co-row .v')];
    const id = (night.tween = (night.tween || 0) + 1);
    const step = (now) => {
      if (!night || night.tween !== id) return;
      const k = Math.min(1, (now - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      night.shown = from.map((f, i) => f + (target[i] - f) * e);
      rows.forEach((el, i) => (el.textContent = fmt(night.shown[i])));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function updateCount(state, fresh) {
    const n = night.data;
    const s = n.steps[night.at];
    const sum = s.votes.reduce((a, b) => a + b, 0) || 1;
    const top = Math.max(...s.votes);
    sheet.querySelector('.co-polls-text').textContent = t('coldOpen.polls', { in: fmt(s.polls), total: fmt(n.polls), time: s.time });
    sheet.querySelector('.co-polls-bar i').style.width = `${(s.polls / n.polls) * 100}%`;
    const rank = s.votes.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    rank.forEach(([v, i], r) => {
      const row = sheet.querySelector(`.co-row[data-i="${i}"]`);
      row.style.transform = `translateY(${r * ROW_H}px)`;
      row.classList.toggle('lead', r === 0);
      row.querySelector('.bar i').style.width = `${(v / top) * 100}%`;
      row.querySelector('.bar').dataset.pct = `${((v / sum) * 100).toFixed(1)}%`;
    });
    if (fresh) tweenVotes(s.votes);
    for (const id of night.parties) {
      const k = s.seats[id] || 0;
      sheet.querySelector(`.co-seats i[data-p="${id}"]`).style.width = `${(k / night.houseTotal) * 100}%`;
      sheet.querySelector(`.co-seat-keys [data-p="${id}"] b`).textContent = k;
    }
    // Each poll's line slides in fresh; the old one goes.
    const line = sheet.querySelector('.co-line');
    if (fresh || !line.firstChild) line.innerHTML = `<blockquote class="line">${s.called ? `<small class="co-called">${esc(t('coldOpen.called'))}</small>` : ''}${esc(s.line)}</blockquote>`;
    const result = sheet.querySelector('.co-result');
    const actions = sheet.querySelector('.co-actions');
    if (night.declared) {
      const kind = t(n.minority ? 'coldOpen.minority' : 'coldOpen.majority');
      const govSeats = s.seats[n.gov] || 0;
      if (!result.firstChild) {
        result.innerHTML = `<div class="verdict">${stamp(t('coldOpen.elected'), 'brass', true)}</div>
          <p class="co-declare">${esc(n.declaration)}</p>
          <div class="kvs">
            <div class="kv"><span class="k">${t('coldOpen.marginK')}</span><span class="v">${esc(t('coldOpen.margin', { votes: fmt(n.margin) }))}</span></div>
            <div class="kv"><span class="k">${t('coldOpen.nationK')}</span><span class="v">${esc(t('coldOpen.nation', { kind, gov: n.govName, seats: govSeats, total: night.houseTotal }))}</span></div>
          </div>`;
        actions.innerHTML = `<button class="btn primary" data-act="hill">${t('coldOpen.toHill')}</button><button class="btn sub" data-act="skip">${t('coldOpen.straight')}</button>`;
        actions.querySelector('[data-act="hill"]').onclick = () => dispatch({ type: 'resolve', choice: 'walk' });
        actions.querySelector('[data-act="skip"]').onclick = () => dispatch({ type: 'resolve', choice: 'skip' });
        sheet.scrollTo?.({ top: sheet.scrollHeight, behavior: 'smooth' });
      }
    } else if (!actions.firstChild) {
      actions.innerHTML = `<button class="btn sub" data-act="ahead">${t('coldOpen.ahead')}</button>`;
      actions.querySelector('[data-act="ahead"]').onclick = () => {
        clearTimeout(night.timer);
        night.at = n.steps.length - 1;
        declare(getState());
      };
    }
    stageCount(state);
  }

  function declare(state) {
    night.declared = true;
    sheet.querySelector('.co-actions').innerHTML = '';
    updateCount(state, true);
    audio?.cheer?.(true);
  }

  function tick() {
    const state = getState();
    const n = night.data;
    if (night.at < n.steps.length - 1) {
      const was = n.steps[night.at].leader;
      night.at++;
      const s = n.steps[night.at];
      updateCount(state, true);
      // A small cheer when the lead comes your way.
      if (s.leader === 0 && was !== 0) audio?.cheer?.(false);
      night.timer = setTimeout(tick, tuning().coldOpen.tickMs);
    } else declare(state);
  }

  function renderCount(state, p) {
    const key = `${state.seed}:${p.night.riding}:count`;
    if (night?.key !== key) {
      stopTimers();
      night = { key, data: p.night, at: 0, declared: false };
      buildCount(state);
      updateCount(state, true);
      night.timer = setTimeout(tick, tuning().coldOpen.tickMs * 1.2);
    } else stageCount(state);
  }

  // ---- Opening day ------------------------------------------------------------------------------------------

  function renderWalk(state, p) {
    const w = p.walk;
    const key = `${state.seed}:walk`;
    const lines = w.lines;
    if (walk?.key !== key) {
      stopTimers();
      night = null;
      walk = { key, shown: 1, seated: false };
      const T = tuning().coldOpen;
      const room = getRoom('chamber');
      const sit = () => {
        if (!walk || walk.key !== key || walk.seated) return;
        clearTimeout(walk.timer);
        walk.seated = true;
        walk.shown = lines.length;
        audio?.benches?.('home');
        draw();
      };
      walk.sit = sit;
      if (room?.walkIn) room.walkIn(w.seatId, T.walkSeconds, sit);
      else walk.timer = setTimeout(sit, 400);
      // The lines before the last come up across the walk; the last as you sit.
      const gap = (T.walkSeconds * 1000) / Math.max(1, lines.length - 1);
      const next = () => {
        if (walk?.key !== key || walk.seated) return;
        if (walk.shown < lines.length - 1) {
          walk.shown++;
          draw();
          walk.timer = setTimeout(next, gap);
        }
      };
      walk.timer = setTimeout(next, gap);
    }
    function draw() {
      const me = state.mps[state.player.mpId];
      sheet.innerHTML = `<div class="sheet-handle"></div>
        <h2>${t('coldOpen.walkTitle')}</h2>
        <p class="muted">${esc(t('coldOpen.walkSub', { nth: ordinal(w.parliament), name: `${me.name.first} ${me.name.last}`, riding: me.riding.name }))}</p>
        <ol class="co-walk">${lines
          .slice(0, walk.shown)
          .map((l, i) => `<li class="${i === walk.shown - 1 ? 'fresh' : ''}">${esc(l)}</li>`)
          .join('')}</ol>
        <div class="choices co-actions">${
          walk.seated ? `<button class="btn primary" data-act="begin">${t('coldOpen.begin')}</button>` : `<button class="btn sub" data-act="sit">${t('coldOpen.sit')}</button>`
        }</div>`;
      // Keep the newest line in view as they come.
      sheet.scrollTop = sheet.scrollHeight;
      sheet.querySelector('[data-act="begin"]')?.addEventListener('click', () => dispatch({ type: 'resolve' }));
      sheet.querySelector('[data-act="sit"]')?.addEventListener('click', () => {
        getRoom('chamber')?.finishWalk?.();
        walk.sit();
      });
    }
    draw();
  }

  function render(state) {
    const p = state.flow.pending;
    const on = p?.kind === 'coldOpen';
    document.body.classList.toggle('cold-open', on);
    if (!on) {
      if (night || walk) {
        stopTimers();
        night = walk = null;
      }
      sheet.classList.add('hidden');
      return;
    }
    sheet.classList.remove('hidden');
    sheet.classList.toggle('co-walking', p.phase === 'walk');
    if (p.phase === 'count') renderCount(state, p);
    else renderWalk(state, p);
  }

  return { render };
}
