// The heads-up display: the top bar with the game's main buttons and, in debug, the Parliament hash.
import { t, esc } from './text.js';

export function createHud(root, { buttons = [], debugText = null }) {
  const el = document.createElement('header');
  el.className = 'topbar';
  root.appendChild(el);
  const status = document.createElement('div');
  status.className = 'status';

  function render() {
    el.innerHTML = `<span class="brand">${t('title')}</span>${buttons.map((b, i) => `<button class="btn" data-i="${i}">${esc(b.label)}</button>`).join('')}`;
    el.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => buttons[Number(b.dataset.i)].run()));
    if (debugText) {
      status.textContent = debugText();
      root.appendChild(status);
    }
  }
  render();
  return { el, render, setButtons(next) { buttons = next; render(); } };
}

// ?debug=1: a slider for every number in data/tuning.json, changed live (not saved).
export function createTuningPanel(root, tuning) {
  const wrap = document.createElement('details');
  wrap.className = 'tuning-panel';
  const rows = [];
  for (const [section, values] of Object.entries(tuning)) {
    for (const [key, v] of Object.entries(values)) {
      if (typeof v !== 'number') continue;
      const span = Math.max(1, Math.abs(v) * 3);
      const step = Number.isInteger(v) && Math.abs(v) >= 2 ? 1 : 0.01;
      rows.push(`<label><span>${section}.${key}</span><input type="range" data-s="${section}" data-k="${key}" min="${v < 0 ? -span : 0}" max="${span}" step="${step}" value="${v}"><output>${v}</output></label>`);
    }
  }
  wrap.innerHTML = `<summary>Tuning</summary><div class="tuning-rows">${rows.join('')}</div>`;
  wrap.querySelectorAll('input').forEach((inp) => {
    inp.oninput = () => {
      tuning[inp.dataset.s][inp.dataset.k] = Number(inp.value);
      inp.nextElementSibling.textContent = inp.value;
    };
  });
  // First in the overlay, so sheets and the book draw over it.
  root.prepend(wrap);
  return wrap;
}

// A short message across the top: meeting outcomes, calls, deliveries.
export function createToast(root) {
  const el = document.createElement('div');
  el.className = 'toast hidden';
  root.appendChild(el);
  let timer = null;
  el.onclick = () => el.classList.add('hidden');
  return {
    show(text, ms = 4500) {
      el.textContent = text;
      el.classList.remove('hidden');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.add('hidden'), ms);
    },
  };
}
