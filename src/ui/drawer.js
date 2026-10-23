// The drawer: a sheet opens at the height its scene wants (half for talking, so the room and the person in
// it stay in view; full for reading) and the handle swaps between the two. The player's choice holds for
// the scene it was made in and is forgotten with the next one. Heights are set in css/style.css.
import { t } from './text.js';

export const HANDLE = () => `<button type="button" class="sheet-handle" aria-label="${t('sheet.handle')}"></button>`;

export function drawer(sheet, { onChange } = {}) {
  let want = 'full';
  let chosen = null;
  let key = null;
  const apply = () => {
    const h = chosen ?? want;
    if (sheet.dataset.h !== h) sheet.dataset.h = h;
  };
  sheet.addEventListener('click', (e) => {
    if (!e.target.closest('.sheet-handle')) return;
    chosen = (chosen ?? want) === 'half' ? 'full' : 'half';
    apply();
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
