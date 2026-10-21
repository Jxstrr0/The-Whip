// Menus: the start screen (continue, or a new career: name, party, background, riding, age, seed) and the
// in-game menu.
import { t, esc } from './text.js';
import { data } from '../sim/config.js';

// A fresh seed for the form. The seed may come from anywhere (this is UI, not sim); everything after it is deterministic.
function randomSeed() {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `CALEDOR-${n}`;
}

function pickName(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function createStartMenu(root, { info, onContinue, onNew, onSeed }) {
  const D = data();
  const el = document.createElement('section');
  el.className = 'start-menu';
  root.appendChild(el);
  const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
  const parties = D.parties.core;
  el.innerHTML = `
    <div class="start-inner">
      <h1>${t('title')}</h1>
      <p class="muted">${t('subtitle')}</p>
      <p class="tagline">${t('menu.tagline')}</p>
      ${info ? `<button class="btn primary wide" data-act="continue">${t('menu.continue')}<small>${esc(t('menu.continueInfo', info))}</small></button>` : ''}
      <h3>${t('menu.new')}</h3>
      <div class="form">
        <label>${t('menu.first')}<input name="first" value="${esc(pickName(D.names.first))}" autocomplete="off"></label>
        <label>${t('menu.last')}<input name="last" value="${esc(pickName(D.names.last))}" autocomplete="off"></label>
        <label>${t('menu.party')}<select name="party">${parties.map((p, i) => opt(p.id, p.name, i === 0)).join('')}</select></label>
        <div class="party-blurb"></div>
        <label>${t('menu.background')}<select name="background">${D.backgrounds.backgrounds.map((b) => opt(b.id, `${b.name} · ${b.strength}`)).join('')}</select></label>
        <label>${t('menu.ridingType')}<select name="ridingType">${['urban', 'suburban', 'rural', 'northern'].map((x, i) => opt(x, t('type.' + x), i === 2)).join('')}</select></label>
        <label>${t('menu.province')}<select name="province">${opt('', t('menu.anyProvince'), true)}${D.world.provinces.map((p) => opt(p.id, p.name)).join('')}</select></label>
        <label>${t('menu.age')}<input name="age" type="number" min="25" max="70" value="38"></label>
        <label>${t('menu.seed')}<input name="seed" value="${esc(randomSeed())}" autocomplete="off"></label>
      </div>
      <button class="btn primary wide" data-act="new">${t('menu.begin')}</button>
      <footer class="colophon"><span class="mark">W</span>${t('menu.studio')}</footer>
    </div>`;
  const blurb = () => {
    const p = parties.find((x) => x.id === el.querySelector('[name="party"]').value);
    el.querySelector('.party-blurb').innerHTML = `<span class="chip small" style="background:${p.color}"></span> ${esc(p.home)}`;
  };
  el.querySelector('[name="party"]').onchange = blurb;
  blurb();
  el.querySelector('[name="seed"]').addEventListener('input', (e) => onSeed?.(e.target.value.trim()));
  el.querySelector('[data-act="continue"]')?.addEventListener('click', () => {
    el.remove();
    onContinue();
  });
  el.querySelector('[data-act="new"]').onclick = () => {
    const v = (n) => el.querySelector(`[name="${n}"]`).value.trim();
    const opts = {
      first: v('first') || undefined,
      last: v('last') || undefined,
      party: v('party'),
      background: v('background'),
      ridingType: v('ridingType'),
      province: v('province') || undefined,
      age: Math.max(25, Math.min(70, Number(v('age')) || 38)),
      seed: v('seed') || randomSeed(),
    };
    el.remove();
    onNew(opts);
  };
  return el;
}

export function createGameMenu(root, { getState, onQuit }) {
  const el = document.createElement('section');
  el.className = 'sheet game-menu hidden';
  root.appendChild(el);
  return {
    open() {
      const s = getState();
      el.innerHTML = `<div class="sheet-handle"></div><h2>${t('menu.menu')}</h2>
        <p class="muted">Seed ${esc(s.seed)} · ${t('menu.save')}</p>
        <div class="choices"><button class="btn" data-act="close">${t('menu.close')}</button><button class="btn" data-act="quit">${t('menu.quit')}</button></div>`;
      el.querySelector('[data-act="close"]').onclick = () => el.classList.add('hidden');
      el.querySelector('[data-act="quit"]').onclick = onQuit;
      el.classList.remove('hidden');
    },
  };
}
