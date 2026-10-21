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
