// The feel pass: the small motions that make the paper feel handled rather than redrawn. Numbers tick to
// their new value, a stamp that has just landed is felt in the hand, and a reply is pressed into the paper
// before it goes. Every timing is in tuning (look.feel) and all of it stands down for prefers-reduced-motion.
import { tuning } from '../sim/config.js';
import { buzz } from '../haptics.js';

const MINUS = '−';
const PREFIX = /^[+−-]?/;

let rm = null;
export function reducedMotion() {
  if (rm == null) {
    try {
      const q = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
      rm = !!q?.matches;
      q?.addEventListener?.('change', (e) => (rm = e.matches));
    } catch {
      rm = false;
    }
  }
  return rm;
}

// The number an element shows, sign and all, or null when it isn't one.
export function readNumber(text) {
  const s = String(text).trim().replace(MINUS, '-').replace(/,/g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

// The value `n` written the way `like` was: a leading + or − kept, the same number of decimals.
export function writeNumber(n, like) {
  const s = String(like).trim();
  const signed = /^[+−-]/.test(s);
  const dec = (s.split('.')[1] || '').length;
  const v = Math.abs(n).toFixed(dec);
  if (n < 0) return `${MINUS}${v}`;
  return signed && n > 0 ? `+${v}` : v;
}

const ease = (x) => 1 - (1 - x) * (1 - x) * (1 - x);

// Count one element from `from` to its own value over `ms`. The final frame writes the exact text back.
export function tick(el, from, ms) {
  const to = readNumber(el.textContent);
  if (to == null || from === to) return;
  const text = el.textContent;
  if (reducedMotion() || ms <= 0) return;
  const t0 = performance.now();
  el._tick?.();
  // Start on the old value at once, so the new one is never shown before the count begins.
  el.textContent = writeNumber(from, text);
  let raf = 0;
  const step = (now) => {
    const x = Math.min(1, (now - t0) / ms);
    const v = from + (to - from) * ease(x);
    el.textContent = x >= 1 ? text : writeNumber(to % 1 ? v : Math.round(v), text);
    if (x < 1) raf = requestAnimationFrame(step);
    else el._tick = null;
  };
  el._tick = () => {
    cancelAnimationFrame(raf);
    el.textContent = text;
    el._tick = null;
  };
  raf = requestAnimationFrame(step);
}

// Rendering rebuilds a sheet's HTML, so the numbers on it are matched by place: the nth number on the sheet
// last time is the nth this time. A sheet freshly shown counts up from nothing.
const seen = new WeakMap();
const NUMBERS = '.stake b, [data-tick]';

export function tickSheet(sheet) {
  if (!sheet || sheet.classList.contains('hidden')) {
    if (sheet) seen.delete(sheet);
    return;
  }
  const els = [...sheet.querySelectorAll(NUMBERS)];
  const now = els.map((el) => readNumber(el.textContent));
  const before = seen.get(sheet);
  seen.set(sheet, now);
  const ms = tuning().look.feel.tick;
  els.forEach((el, i) => {
    const to = now[i];
    if (to == null) return;
    const from = before ? before[i] : 0;
    if (from != null && from !== to) tick(el, from, ms);
  });
}

// A stamp that has just come down is felt: one short buzz when a stamp not on the page before appears on it.
// Sheets are redrawn whole, so stamps are known by their words per sheet, not by their elements; a stamp
// marked data-felt was felt some other way (a deal's own buzz) and is only noted.
const stamps = new WeakMap();
const PAGES = '.sheet, .count-board, .agenda, .paper';
export function feelStamps(root) {
  const pages = new Map();
  for (const s of root.querySelectorAll('.stamp')) {
    const page = s.closest(PAGES) || root;
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push(s);
  }
  for (const [page, list] of pages) {
    if (page.closest('.hidden')) {
      stamps.delete(page);
      continue;
    }
    const before = stamps.get(page) || new Set();
    const now = new Set(list.map((s) => s.textContent));
    stamps.set(page, now);
    if (list.some((s) => !before.has(s.textContent) && !('felt' in s.dataset))) buzz('stamp');
  }
}

// A reply is pressed before it goes: the row takes the ink, its siblings stand down, and the action follows
// a beat later. The beat is tuning's look.feel.press; under reduced motion it goes at once.
export function take(btn, fn) {
  if (btn.disabled) return;
  const group = btn.closest('.choices') || btn.parentElement;
  for (const b of group?.querySelectorAll('button') || []) b.disabled = true;
  btn.classList.add('taken');
  const ms = reducedMotion() ? 0 : tuning().look.feel.press;
  if (!ms) return fn();
  setTimeout(fn, ms);
}

// Timings the CSS shares, set once as custom properties on the root.
export function feelVars() {
  const f = tuning().look.feel;
  const st = document.documentElement.style;
  st.setProperty('--feel-sheet', `${f.sheet}ms`);
  st.setProperty('--feel-stamp', `${f.stamp}ms`);
  st.setProperty('--feel-press', `${f.press}ms`);
}
