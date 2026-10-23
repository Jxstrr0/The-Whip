// The drawer: a sheet opens at the height its scene wants (half for talking, so the room and the person in
// it stay in view; full for reading) and the handle moves it. A tap swaps half and full; a drag follows the
// thumb and settles on the nearest stop when it lets go, with a third stop, peek, that leaves only the top of
// the paper showing so the room can be looked at. The player's choice holds for the scene it was made in and
// is forgotten with the next one. Heights are set in css/style.css; the settle time in tuning (look.feel.sheet).
import { t } from './text.js';
import { tuning } from '../sim/config.js';
import { reducedMotion } from './feel.js';

export const STOPS = ['peek', 'half', 'full'];
const DRAG_FROM = 6; // px of travel before a touch counts as a drag and not a tap
const FLICK = 0.45; // px/ms: quicker than this and the sheet goes the way it was thrown

export const HANDLE = () => `<button type="button" class="sheet-handle" aria-label="${t('sheet.handle')}"></button>`;

// Which stop a released sheet settles on. `heights` maps stop → px; `vy` is the drag's speed in px/ms
// (positive is downwards, so towards a smaller sheet). A flick goes the next stop along in its direction;
// otherwise the nearest stop wins. Pure, so tests can run it.
export function snapStop(height, heights, vy = 0) {
  const order = STOPS.filter((s) => heights[s] != null).sort((a, b) => heights[a] - heights[b]);
  if (!order.length) return 'full';
  if (Math.abs(vy) >= FLICK) {
    // Thrown: the first stop past the current height in the thrown direction (or the end of the run).
    const list = vy > 0 ? [...order].reverse() : order;
    return list.find((s) => (vy > 0 ? heights[s] < height - 1 : heights[s] > height + 1)) ?? list[list.length - 1];
  }
  let best = order[0];
  for (const s of order) if (Math.abs(heights[s] - height) < Math.abs(heights[best] - height)) best = s;
  return best;
}

export function drawer(sheet, { onChange } = {}) {
  let want = 'full';
  let chosen = null;
  let key = null;
  let anim = null;

  // While the thumb has the sheet, or it's settling, its height is set here and the CSS stop stands aside.
  const lift = (on) => {
    sheet.style.maxHeight = on ? 'none' : '';
    if (!on) sheet.style.height = '';
  };

  // What the sheet's padding and border add to a set height (the CSS sizes the content box).
  function padOf() {
    const was = sheet.style.height;
    sheet.style.height = '100px';
    const pad = sheet.getBoundingClientRect().height - 100;
    sheet.style.height = was;
    return pad;
  }

  // The settled height of each stop, measured by trying the stop on with the CSS in charge, and whether the
  // sheet is a drawer here at all: on a phone on its side it's a side sheet the full height of the screen
  // (max-height none) and the handle does nothing.
  function measure() {
    const was = sheet.dataset.h;
    const inline = { h: sheet.style.height, m: sheet.style.maxHeight };
    sheet.style.height = '';
    sheet.style.maxHeight = '';
    const out = { drawer: getComputedStyle(sheet).maxHeight !== 'none' };
    for (const s of STOPS) {
      sheet.dataset.h = s;
      out[s] = sheet.getBoundingClientRect().height;
    }
    if (was) sheet.dataset.h = was;
    else delete sheet.dataset.h;
    sheet.style.height = inline.h;
    sheet.style.maxHeight = inline.m;
    return out;
  }

  // Move to a stop: measure where it lands, then run the height from where the sheet is now to there.
  function settle(h, from = null) {
    const start = from ?? sheet.getBoundingClientRect().height;
    anim?.cancel();
    anim = null;
    lift(false);
    sheet.dataset.h = h;
    if (reducedMotion() || typeof sheet.animate !== 'function' || getComputedStyle(sheet).maxHeight === 'none') return;
    const end = sheet.getBoundingClientRect().height;
    if (Math.abs(end - start) < 1) return;
    lift(true);
    // Held at the start height until the animation's first frame takes over (then it owns the height).
    const pad = padOf();
    sheet.style.height = `${start - pad}px`;
    const a = sheet.animate([{ height: `${start - pad}px` }, { height: `${end - pad}px` }], { duration: tuning().look.feel.sheet, easing: 'cubic-bezier(0.22, 1.1, 0.36, 1)' });
    anim = a;
    a.onfinish = a.oncancel = () => {
      if (anim === a) {
        anim = null;
        lift(false);
      }
    };
  }

  const apply = (animate = false) => {
    const h = chosen ?? want;
    if (sheet.dataset.h === h) return;
    if (animate) settle(h);
    else {
      anim?.cancel();
      anim = null;
      lift(false);
      sheet.dataset.h = h;
    }
  };

  // The handle: a tap swaps half and full; a drag follows the thumb.
  let drag = null;
  sheet.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.sheet-handle');
    if (!handle || e.button) return;
    const h0 = sheet.getBoundingClientRect().height;
    const heights = measure();
    if (!heights.drawer) return;
    anim?.cancel();
    anim = null;
    lift(true);
    const pad = padOf();
    sheet.style.height = `${h0 - pad}px`;
    drag = { id: e.pointerId, y0: e.clientY, y: e.clientY, t: performance.now(), vy: 0, h0, pad, moved: false, heights };
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.t);
    drag.vy = drag.vy * 0.6 + ((e.clientY - drag.y) / dt) * 0.4;
    drag.y = e.clientY;
    drag.t = now;
    if (!drag.moved && Math.abs(e.clientY - drag.y0) < DRAG_FROM) return;
    if (!drag.moved) {
      drag.moved = true;
      sheet.classList.add('dragging');
    }
    const lo = drag.heights.peek;
    const hi = drag.heights.full;
    const h = Math.max(lo, Math.min(hi, drag.h0 - (e.clientY - drag.y0)));
    sheet.style.height = `${h - drag.pad}px`;
    e.preventDefault();
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    sheet.classList.remove('dragging');
    if (!d.moved) return lift(false); // the click that follows does the tap
    const h = sheet.getBoundingClientRect().height;
    chosen = snapStop(h, d.heights, e.type === 'pointercancel' ? 0 : d.vy);
    settle(chosen, h);
    onChange?.();
    // Eat the click the tap would have sent.
    sheet.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => sheet.removeEventListener('click', stop, { capture: true }), 300);
  };
  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  sheet.addEventListener('pointerup', release);
  sheet.addEventListener('pointercancel', release);
  sheet.addEventListener('click', (e) => {
    if (!e.target.closest('.sheet-handle')) return;
    chosen = (chosen ?? want) === 'half' ? 'full' : 'half';
    apply(true);
    onChange?.();
  });
  return {
    // The height this scene opens at; `scope` names the scene, so a new one starts afresh.
    set(h, scope = null) {
      if (scope !== key) {
        key = scope;
        chosen = null;
      }
      want = h;
      apply();
    },
  };
}
