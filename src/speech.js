// A person's line, set beside them in the room: a small paper note on the label layer, anchored to a figure's
// shoulder and shown once they're in their chair. The sheet below holds the replies; the words stay with the
// face that said them.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// The note hangs off the figure's shoulder on the side the camera leaves clear and keeps clear of the screen's
// edge: it narrows to the room left beside the face before it will slide over them. (On a phone on its side
// the paper is a side sheet and carries the line itself; the note is for upright phones.)
const ANCHOR = [0.3, 1.3, 0.12];
const EDGE = 12;
const NARROWEST = 150;

export function createSpeech() {
  const el = document.createElement('div');
  el.className = 'speech-anchor';
  const note = document.createElement('div');
  note.className = 'speech';
  el.appendChild(note);
  const obj = new CSS2DObject(el);
  obj.position.set(...ANCHOR);
  obj.visible = false;
  let text = null;
  let holder = null;
  let on = false;
  let fitAt = 0;

  function reset() {
    note.style.marginLeft = '0px';
    note.style.maxWidth = '';
  }

  // Keep the note on screen and off the face: it takes the width left beside the figure, and only when that
  // is too little to read does it slide left over them.
  function fit() {
    reset();
    const limit = window.innerWidth - EDGE;
    const r = note.getBoundingClientRect();
    if (!r.width) return;
    const room = limit - r.left;
    if (room >= r.width) return;
    if (room >= NARROWEST) note.style.maxWidth = `${Math.floor(room)}px`;
    else {
      note.style.maxWidth = `${NARROWEST}px`;
      note.style.marginLeft = `${Math.min(0, limit - note.getBoundingClientRect().right)}px`;
    }
  }

  return {
    // Hang the note off a figure (its group), or off nothing. `lift` raises it for someone who stands.
    attach(figure, lift = 0) {
      obj.position.set(ANCHOR[0], ANCHOR[1] + lift, ANCHOR[2]);
      if (holder === figure) return;
      obj.removeFromParent();
      holder = figure || null;
      holder?.group.add(obj);
      reset();
    },
    set(next) {
      const t = next || null;
      if (t === text) return;
      text = t;
      if (t) note.textContent = t;
      reset();
      fitAt = 0;
    },
    // Shown while there's a line and the figure is seated; a change of line fades through.
    update(_dt, seated) {
      const want = !!(text && holder && seated);
      obj.visible = !!(text && holder);
      if (want !== on) {
        on = want;
        note.classList.toggle('on', on);
        fitAt = 0;
      }
      if (!on) return;
      // Refit a few times a second by the clock, so it keeps up with the camera settling however the frames run.
      const now = performance.now();
      if (now - fitAt >= 120) {
        fitAt = now;
        fit();
      }
    },
    dispose() {
      obj.removeFromParent();
      el.remove();
    },
  };
}
