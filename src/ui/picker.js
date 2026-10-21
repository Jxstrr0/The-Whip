// A paper picker (options are { value, label, note?, pick? }; `pick` is the row's wording in the list when it should differ from the field's): a field that opens an Order Paper list instead of the browser's own dropdown, which
// looks different on every phone. It renders as a button showing the current choice over a hidden input
// that carries the value under `name`, so forms read it like any field and its `change` event fires on a pick.
import { t, esc } from './text.js';

export function pickerHtml({ name, options, value = '', title = '', compact = false }) {
  const cur = options.find((o) => String(o.value) === String(value)) || options[0];
  return `<button type="button" class="picker${compact ? ' compact' : ''}" data-picker="${esc(name)}" data-title="${esc(title)}" aria-haspopup="listbox"><span class="picker-value">${esc(cur?.label ?? '')}</span></button><input type="hidden" name="${esc(name)}" value="${esc(cur?.value ?? '')}">`;
}

// Hook up every picker under `root`; `optionsByName[name]` is the list it rendered with.
export function wirePickers(root, optionsByName) {
  root.querySelectorAll('[data-picker]').forEach((btn) => {
    const input = btn.nextElementSibling;
    btn.onclick = () =>
      openPaperList({
        title: btn.dataset.title,
        options: optionsByName[btn.dataset.picker] || [],
        value: input.value,
        onPick(o) {
          if (String(o.value) === String(input.value)) return;
          input.value = o.value;
          btn.querySelector('.picker-value').textContent = o.label;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        },
        onClose: () => btn.focus(),
      });
  });
}

// The list itself: a sheet over everything, the current choice ticked, one tap to choose, a tap outside,
// the close button or Escape to leave it as it was.
export function openPaperList({ title, options, value, onPick, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'paper-list-backdrop';
  wrap.innerHTML = `<section class="sheet paper-list" role="dialog" aria-label="${esc(title)}">
    <header><h3>${esc(title)}</h3><button type="button" class="btn icon" data-act="close" aria-label="${t('btn.close')}">✕</button></header>
    <div role="listbox">${options
      .map((o, i) => {
        const on = String(o.value) === String(value);
        return `<button type="button" role="option" aria-selected="${on}" data-i="${i}"${on ? ' class="on"' : ''}><span><b>${esc(o.pick ?? o.label)}</b>${o.note ? `<small>${esc(o.note)}</small>` : ''}</span><span class="tick">✔</span></button>`;
      })
      .join('')}</div>
  </section>`;
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    wrap.classList.add('leaving');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => wrap.remove(), 160);
    onClose?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  wrap.onclick = (e) => {
    if (e.target === wrap) close();
  };
  wrap.querySelector('[data-act="close"]').onclick = close;
  wrap.querySelectorAll('[data-i]').forEach((b) => {
    b.onclick = () => {
      onPick(options[Number(b.dataset.i)]);
      close();
    };
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  (wrap.querySelector('[role="option"].on') || wrap.querySelector('[role="option"]'))?.focus({ preventScroll: true });
  return close;
}
