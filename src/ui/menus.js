// Menus: the start screen (continue, or a new career: name, party, background, riding, age, seed) and the
// in-game menu.
import { canBuzz } from '../haptics.js';
import { t, esc, longlightMark } from './text.js';
import { pickerHtml, wirePickers } from './picker.js';

// The riding types are written for mid-sentence use; as a field's value they take a capital.
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
import { data, tuning } from '../sim/config.js';

// A fresh seed for the form. The seed may come from anywhere (this is UI, not sim); everything after it is deterministic.
function randomSeed() {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `CALEDOR-${n}`;
}

function pickName(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// The title page. One sheet, read top to bottom: continue the latest game, pick a slot, then start something
// (a career, a scenario, today's seed, a friend's seed) or manage the saved games.
export function createStartMenu(root, { saves, latest, scenarios, onContinue, onNew, onScenario, onDaily, onShared, onImport, onDelete, onExport, onSeed, onSettings }) {
  const D = data();
  const el = document.createElement('section');
  el.className = 'start-menu';
  root.appendChild(el);
  const parties = D.parties.core;
  // Start in the first empty slot, so a new game never silently replaces one.
  const firstEmpty = saves.findIndex((x) => !x);
  let slot = firstEmpty >= 0 ? firstEmpty + 1 : latest?.slot || 1;
  const today = new Date();
  const slotLabel = (i) => (saves[i - 1] ? saves[i - 1].name : t('menu.emptySlot'));
  const whenSaved = (info) => {
    const d = new Date(info.savedAt || 0);
    return info.savedAt ? `${t('menu.saved')} ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : '';
  };
  const modeLabel = (info) => (info.mode === 'scenario' ? info.title : info.mode === 'daily' ? t('menu.daily') : info.mode === 'shared' ? t('menu.shared') : t('menu.career'));

  function render() {
    const replaces = saves[slot - 1] ? `<small>${esc(t('menu.replaces', { name: saves[slot - 1].name }))}</small>` : '';
    el.innerHTML = `
    <div class="start-inner">
      <h1>${t('title')}</h1>
      <p class="muted">${t('subtitle')}</p>
      <p class="tagline">${t('menu.tagline')}</p>
      ${latest ? `<button class="btn primary wide" data-act="continue" data-slot="${latest.slot}">${t('menu.continue')}<small>${esc(t('menu.continueInfo', latest))} · ${esc(modeLabel(latest))}</small></button>` : ''}

      <h3>${t('menu.slot')}</h3>
      <div class="slot-row" role="radiogroup">${[1, 2, 3].map((i) => `<button class="btn slot${i === slot ? ' on' : ''}" role="radio" aria-checked="${i === slot}" data-slot-pick="${i}"><b>${i}</b><small>${esc(slotLabel(i))}</small></button>`).join('')}</div>
      <p class="muted small-note">${t('menu.slotNote')}</p>

      <h3>${t('menu.new')}</h3>
      <div class="form">
        <label>${t('menu.first')}<input name="first" value="${esc(form.first)}" autocomplete="off"></label>
        <label>${t('menu.last')}<input name="last" value="${esc(form.last)}" autocomplete="off"></label>
        <label>${t('menu.party')}${pickerHtml({ name: 'party', options: picks.party, value: form.party, title: t('menu.party') })}</label>
        <div class="party-blurb"></div>
        <label>${t('menu.background')}${pickerHtml({ name: 'background', options: picks.background, value: form.background, title: t('menu.background') })}</label>
        <label>${t('menu.ridingType')}${pickerHtml({ name: 'ridingType', options: picks.ridingType, value: form.ridingType, title: t('menu.ridingType') })}</label>
        <label>${t('menu.province')}${pickerHtml({ name: 'province', options: picks.province, value: form.province, title: t('menu.province') })}</label>
        <label>${t('menu.age')}<input name="age" type="number" min="25" max="70" value="${esc(form.age)}"></label>
        <label>${t('menu.seed')}<input name="seed" value="${esc(form.seed)}" autocomplete="off"></label>
      </div>
      <button class="btn primary wide" data-act="new">${t('menu.begin')}${replaces}</button>

      <h3>${t('menu.scenarios')}</h3>
      <p class="muted small-note">${t('menu.scenarioNote')}</p>
      <div class="choices mode-cards">${scenarios.map((sc) => `<button class="btn" data-scenario="${esc(sc.id)}"><b>${esc(sc.title)}</b><small class="approach">${esc(sc.when)}</small><span class="blurb">${esc(sc.blurb)}</span></button>`).join('')}</div>

      <h3>${t('menu.daily')}</h3>
      <p class="muted small-note">${t('menu.dailyNote')}</p>
      <button class="btn wide" data-act="daily">${esc(t('menu.dailyPlay', { date: today.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) }))}${replaces}</button>

      <h3>${t('menu.shared')}</h3>
      <p class="muted small-note">${t('menu.sharedNote')}</p>
      <div class="form"><label>${t('menu.sharedSeed')}<input name="sharedSeed" value="" autocomplete="off" placeholder="CALEDOR-1234"></label></div>
      <button class="btn wide" data-act="shared">${t('menu.sharedPlay')}${replaces}</button>

      <h3>${t('menu.savedGames')}</h3>
      <ul class="save-list">${[1, 2, 3].map((i) => {
        const info = saves[i - 1];
        return `<li><div class="save-head"><b>${t('menu.slotN', { n: i })}</b>${info ? `<span>${esc(info.name)} · ${esc(info.party)} · ${esc(t('menu.actN', { n: info.act }))} · ${esc(t('menu.weekYear', info))}${info.ended ? ` · ${t('menu.ended')}` : ''}</span><small>${esc(modeLabel(info))} · ${esc(whenSaved(info))} · ${esc(info.seed)}</small>` : `<span class="muted">${t('menu.emptySlot')}</span>`}</div>
          ${info ? `<div class="save-actions"><button class="btn" data-act="continue" data-slot="${i}">${t('menu.load')}</button><button class="btn" data-act="export" data-slot="${i}">${t('menu.export')}</button><button class="btn danger" data-act="delete" data-slot="${i}">${t('menu.delete')}</button></div>` : ''}</li>`;
      }).join('')}</ul>
      <details class="import"${form.importOpen ? ' open' : ''}><summary>${t('menu.import')}</summary>
        <p class="muted small-note">${t('menu.importNote')}</p>
        <textarea name="importText" rows="4" placeholder="${t('menu.importPlaceholder')}">${esc(form.importText)}</textarea>
        <button class="btn wide" data-act="import">${esc(t('menu.importInto', { n: slot }))}</button>
      </details>
      <p class="status muted" aria-live="polite"></p>
      <div class="choices"><button class="btn" data-act="settings">${t('menu.settings')}</button></div>
      <footer class="colophon">${longlightMark()}${t('menu.studio')}</footer>
    </div>`;
    wire();
  }

  const v = (n) => el.querySelector(`[name="${n}"]`)?.value.trim() ?? '';
  // The paper pickers' lists: who you are, where you come from.
  const picks = {
    party: parties.map((p) => ({ value: p.id, label: p.name })),
    background: D.backgrounds.backgrounds.map((b) => ({ value: b.id, label: b.name, note: b.strength })),
    ridingType: ['urban', 'suburban', 'rural', 'northern'].map((x) => ({ value: x, label: cap(t('type.' + x)) })),
    province: [{ value: '', label: t('menu.anyProvince') }, ...D.world.provinces.map((p) => ({ value: p.id, label: p.name }))],
  };
  const form = { first: pickName(D.names.first), last: pickName(D.names.last), party: parties[0].id, background: D.backgrounds.backgrounds[0].id, ridingType: 'rural', province: '', age: 38, seed: randomSeed(), importText: '', importOpen: false };
  const readForm = () => Object.assign(form, { first: v('first'), last: v('last'), party: v('party'), background: v('background'), ridingType: v('ridingType'), province: v('province'), age: Math.max(25, Math.min(70, Number(v('age')) || 38)), seed: v('seed'), importText: v('importText'), importOpen: !!el.querySelector('details.import')?.open });
  const person = () => ({ first: form.first || undefined, last: form.last || undefined, age: form.age });
  const status = (msg) => {
    const p = el.querySelector('.status');
    if (p) p.textContent = msg;
  };
  const confirmReplace = () => !saves[slot - 1] || confirm(t('menu.confirmReplace', { name: saves[slot - 1].name }));

  function wire() {
    wirePickers(el, picks);
    el.querySelector('[data-act="settings"]').onclick = () => onSettings?.();
    const blurb = () => {
      const p = parties.find((x) => x.id === el.querySelector('[name="party"]').value);
      el.querySelector('.party-blurb').innerHTML = `<span class="chip small" style="background:${p.color}"></span> ${esc(p.home)}`;
    };
    el.querySelector('[name="party"]').onchange = blurb;
    blurb();
    el.querySelector('[name="seed"]').addEventListener('input', (e) => onSeed?.(e.target.value.trim()));
    el.querySelectorAll('[data-slot-pick]').forEach((b) => (b.onclick = () => {
      readForm();
      slot = Number(b.dataset.slotPick);
      const y = el.scrollTop;
      render();
      el.scrollTop = y;
    }));
    el.querySelectorAll('[data-act="continue"]').forEach((b) => (b.onclick = () => {
      el.remove();
      onContinue(Number(b.dataset.slot));
    }));
    el.querySelector('[data-act="new"]').onclick = () => {
      readForm();
      if (!confirmReplace()) return;
      el.remove();
      onNew({ ...form, first: form.first || undefined, last: form.last || undefined, province: form.province || undefined, seed: form.seed || randomSeed() }, slot);
    };
    el.querySelectorAll('[data-scenario]').forEach((b) => (b.onclick = () => {
      readForm();
      if (!confirmReplace()) return;
      el.remove();
      onScenario(b.dataset.scenario, person(), slot);
    }));
    el.querySelector('[data-act="daily"]').onclick = () => {
      readForm();
      if (!confirmReplace()) return;
      el.remove();
      onDaily(person(), slot);
    };
    el.querySelector('[data-act="shared"]').onclick = () => {
      readForm();
      const seed = v('sharedSeed');
      if (!seed) return status(t('menu.needSeed'));
      if (!confirmReplace()) return;
      el.remove();
      onShared({ ...form, seed, first: form.first || undefined, last: form.last || undefined, province: form.province || undefined }, slot);
    };
    el.querySelectorAll('[data-act="export"]').forEach((b) => (b.onclick = async () => {
      const text = onExport(Number(b.dataset.slot));
      if (!text) return status(t('menu.exportFailed'));
      let copied = false;
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        // No clipboard: show the text to copy by hand.
      }
      if (copied) return status(t('menu.copied', { kb: Math.round(text.length / 1024) }));
      const ta = el.querySelector('[name="importText"]');
      el.querySelector('details.import').open = true;
      ta.value = text;
      ta.focus();
      ta.select();
      status(t('menu.copyByHand'));
    }));
    el.querySelectorAll('[data-act="delete"]').forEach((b) => (b.onclick = () => {
      const i = Number(b.dataset.slot);
      if (!confirm(t('menu.confirmDelete', { name: saves[i - 1].name }))) return;
      onDelete(i);
      saves[i - 1] = null;
      if (latest?.slot === i) latest = saves.filter(Boolean).sort((a, c) => c.savedAt - a.savedAt)[0] || null;
      readForm();
      const y = el.scrollTop;
      render();
      el.scrollTop = y;
      status(t('menu.deleted'));
    }));
    el.querySelector('[data-act="import"]').onclick = () => {
      readForm();
      const text = v('importText');
      if (!text) return status(t('menu.needImport'));
      if (!confirmReplace()) return;
      const ok = onImport(text, slot);
      if (!ok) return status(t('menu.importFailed'));
      el.remove();
    };
  }

  render();
  return el;
}

export function createGameMenu(root, { getState, onQuit, onLedger, onMemoir, onRetire, onCross, onSettings }) {
  const el = document.createElement('section');
  el.className = 'sheet game-menu hidden';
  root.appendChild(el);
  return {
    open() {
      const s = getState();
      const career = s.player.act >= tuning().ranks.retireFromAct && !s.ending && s.flow.pending?.kind !== 'ending';
      el.innerHTML = `<div class="sheet-handle"></div><h2>${t('menu.menu')}</h2>
        <p class="muted">Seed ${esc(s.seed)} · ${t('menu.save')}</p>
        <div class="choices"><button class="btn" data-act="memoir">${t('menu.memoir')}</button><button class="btn" data-act="ledger">${t('menu.ledger')}</button>${career ? `<button class="btn" data-act="cross">${t('menu.cross')}</button><button class="btn" data-act="retire">${t('menu.retire')}</button>` : ''}<button class="btn" data-act="settings">${t('menu.settings')}</button><button class="btn" data-act="close">${t('menu.close')}</button><button class="btn" data-act="quit">${t('menu.quit')}</button></div>`;
      // Crossing the floor asks which bench, then asks again; it isn't a thing to do by accident.
      el.querySelector('[data-act="cross"]')?.addEventListener('click', () => {
        const mine = s.mps[s.player.mpId].party;
        const others = Object.values(s.parties).filter((q) => q.id !== mine && q.id !== 'ind');
        el.innerHTML = `<div class="sheet-handle"></div><h2>${t('menu.cross')}</h2><p class="muted">${t('menu.crossNote')}</p>
          <div class="choices">${others.map((q) => `<button class="btn" data-party="${esc(q.id)}">${esc(t('menu.crossTo', { party: q.name }))}</button>`).join('')}<button class="btn primary" data-act="close">${t('menu.crossCancel')}</button></div>`;
        el.querySelector('[data-act="close"]').onclick = () => el.classList.add('hidden');
        el.querySelectorAll('[data-party]').forEach((b) => (b.onclick = () => { el.classList.add('hidden'); onCross?.(b.dataset.party); }));
      });
      el.querySelector('[data-act="retire"]')?.addEventListener('click', () => {
        el.innerHTML = `<div class="sheet-handle"></div><h2>${t('menu.retire')}</h2><p class="muted">${t('menu.retireNote')}</p>
          <div class="choices"><button class="btn" data-act="confirm">${t('menu.retireConfirm')}</button><button class="btn primary" data-act="close">${t('menu.crossCancel')}</button></div>`;
        el.querySelector('[data-act="close"]').onclick = () => el.classList.add('hidden');
        el.querySelector('[data-act="confirm"]').onclick = () => { el.classList.add('hidden'); onRetire?.(); };
      });
      el.querySelector('[data-act="close"]').onclick = () => el.classList.add('hidden');
      el.querySelector('[data-act="memoir"]').onclick = () => {
        el.classList.add('hidden');
        onMemoir?.();
      };
      el.querySelector('[data-act="ledger"]').onclick = () => {
        el.classList.add('hidden');
        onLedger?.();
      };
      el.querySelector('[data-act="quit"]').onclick = onQuit;
      el.querySelector('[data-act="settings"]').onclick = () => {
        el.classList.add('hidden');
        onSettings?.();
      };
      el.classList.remove('hidden');
    },
  };
}

// The settings sheet: sound, volume, haptics (only on phones that can buzz), colour-blind colours, larger text, rich rooms. get() returns the current settings,
// set(key, value) stores one. Opens over the title page or the game.
export function createSettingsSheet(root, { get, set }) {
  const el = document.createElement('section');
  el.className = 'sheet settings hidden';
  root.appendChild(el);
  const toggle = (key, label, note) => `<div class="setting"><div class="what"><b>${t(label)}</b>${note ? `<small>${t(note)}</small>` : ''}</div><button class="switch" role="switch" aria-checked="${get()[key]}" aria-label="${t(label)}" data-k="${key}"><i></i></button></div>`;
  function render() {
    const s = get();
    el.innerHTML = `<div class="sheet-handle"></div><h2>${t('settings.title')}</h2>
      ${toggle('sound', 'settings.sound', 'settings.soundNote')}
      <label class="setting"><div class="what"><b>${t('settings.volume')}</b></div><input type="range" name="volume" min="0" max="1" step="0.05" value="${s.volume}" aria-label="${t('settings.volume')}"${s.sound ? '' : ' disabled'}></label>
      ${canBuzz ? toggle('haptics', 'settings.haptics', 'settings.hapticsNote') : ''}
      ${toggle('glossary', 'settings.glossary', 'settings.glossaryNote')}
      ${toggle('colourBlind', 'settings.colourBlind', 'settings.colourBlindNote')}
      ${toggle('largeText', 'settings.largeText', 'settings.largeTextNote')}
      ${toggle('richRooms', 'settings.richRooms', 'settings.richRoomsNote')}
      <div class="choices"><button class="btn primary" data-act="close">${t('settings.done')}</button></div>`;
    el.querySelectorAll('.switch').forEach((b) => {
      b.onclick = () => {
        set(b.dataset.k, !get()[b.dataset.k]);
        render();
      };
    });
    el.querySelector('[name="volume"]').oninput = (e) => set('volume', Number(e.target.value));
    el.querySelector('[data-act="close"]').onclick = () => el.classList.add('hidden');
  }
  return {
    open() {
      render();
      el.classList.remove('hidden');
    },
    close: () => el.classList.add('hidden'),
  };
}
