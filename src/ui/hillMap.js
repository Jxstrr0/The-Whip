// The Hill during the bells: an ink plan of the Centre Block, the office blocks across the street and the
// airport road, with each of our absent members where the whip's office has them. Tap one to send a staffer;
// the staffer walks the path in real time, and a trip that can no longer beat the doors greys out.
// The sim settles every run when it starts (src/sim/tools.js chase); this file only draws it.
import { t, esc, partyColor } from './text.js';
import { data } from '../sim/config.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 360;
const H = 236;
// Where runners come and go from: the floor of the House.
const FLOOR = [88, 108];
// Pip slots by spot, with the label's offset. Overflow spills into the other half of the same place.
const SLOTS = {
  lobby: [
    [40, 53, 0, -14],
    [88, 53, 0, -14],
    [136, 53, 0, -14],
    [64, 53, 0, 20],
  ],
  halden: [
    [212, 38, 0, 30],
    [244, 38, 0, 42],
  ],
  ferrier: [
    [292, 50, 0, 30],
    [328, 50, 0, 42],
  ],
  road: [
    [214, 186, 0, -13],
    [256, 192, 0, 21],
  ],
  airport: [
    [302, 196, 0, -13],
    [336, 208, -4, 21],
  ],
};
const SIBLING = { lobby: 'lobby', halden: 'ferrier', ferrier: 'halden', road: 'airport', airport: 'road' };
// The way out of the chamber to each part of the Hill.
const ROUTE = {
  lobby: (x, y) => [FLOOR, [FLOOR[0], 66], [x, 66], [x, y]],
  halden: (x, y) => [FLOOR, [150, 96], [186, 96], [186, 72], [x, 72], [x, y]],
  ferrier: (x, y) => [FLOOR, [150, 96], [186, 96], [186, 92], [x, 92], [x, y]],
  road: (x, y) => [FLOOR, [88, 150], [88, 180], [186, 180], [x, y]],
  airport: (x, y) => [FLOOR, [88, 150], [88, 180], [186, 180], [250, 186], [x, y]],
};

const el = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

// Length-parameterised polyline, so a runner can be placed anywhere along its route.
function polyline(pts) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, bx, by, len, from: total });
    total += len;
  }
  return {
    total,
    at(f) {
      const d = Math.max(0, Math.min(1, f)) * total;
      const s = segs.find((q) => d <= q.from + q.len) || segs[segs.length - 1];
      const k = s.len ? (d - s.from) / s.len : 1;
      return [s.ax + (s.bx - s.ax) * k, s.ay + (s.by - s.ay) * k];
    },
  };
}

// The drawing itself: plain ink lines on the sheet's paper, nothing that needs loading.
function drawPlan(svg) {
  const g = el('g', { class: 'plan' }, svg);
  // The river below the bluff.
  el('path', { class: 'river', d: 'M0 204 C50 196 96 214 150 210 C190 207 214 222 236 236 L0 236 Z' }, g);
  el('text', { class: 'note', x: 30, y: 226 }, g).textContent = t('hill.river');
  // The grounds and the front drive down to the gate and the street.
  el('path', { class: 'lawn', d: 'M10 34 H170 V196 H10 Z' }, g);
  el('path', { class: 'road', d: 'M88 166 V180 H186 M186 0 V180 C220 182 250 186 300 200 S350 222 362 226' }, g);
  el('path', { class: 'road-edge', d: 'M192 0 V174' }, g);
  // Centre Block, the lobby corridor behind the chamber, and the chamber with its benches and table.
  el('rect', { class: 'bldg', x: 18, y: 44, width: 140, height: 106 }, g);
  el('rect', { class: 'lobby', x: 18, y: 44, width: 140, height: 18 }, g);
  el('rect', { class: 'chamber', x: 36, y: 70, width: 104, height: 72 }, g);
  for (let i = 0; i < 4; i++) {
    el('line', { class: 'bench', x1: 44 + i * 7, y1: 78, x2: 44 + i * 7, y2: 134 }, g);
    el('line', { class: 'bench', x1: 132 - i * 7, y1: 78, x2: 132 - i * 7, y2: 134 }, g);
  }
  el('rect', { class: 'table', x: 80, y: 96, width: 16, height: 26 }, g);
  el('rect', { class: 'chair', x: 83, y: 74, width: 10, height: 7 }, g);
  // The tower on the front, with its clock face.
  el('rect', { class: 'bldg', x: 78, y: 150, width: 20, height: 16 }, g);
  el('circle', { class: 'face', cx: 88, cy: 158, r: 4 }, g);
  // Across the street: the two office blocks.
  el('rect', { class: 'bldg', x: 198, y: 14, width: 64, height: 46 }, g);
  el('rect', { class: 'bldg', x: 276, y: 24, width: 72, height: 50 }, g);
  for (let i = 0; i < 5; i++) el('line', { class: 'win', x1: 204 + i * 13, y1: 20, x2: 204 + i * 13, y2: 26 }, g);
  for (let i = 0; i < 6; i++) el('line', { class: 'win', x1: 282 + i * 12, y1: 30, x2: 282 + i * 12, y2: 36 }, g);
  // The terminal at the end of the airport road, with a plane on the apron.
  el('rect', { class: 'bldg', x: 318, y: 168, width: 38, height: 16 }, g);
  el('path', { class: 'plane', d: 'M338 152 l10 4 l6 -1 l1.5 1.5 l-6 1.5 l-3 6 h-2 l1 -5.5 l-8 -1.5 l-2 2 h-1.5 l1 -3.2 l-1 -3.2 h1.5 l2 2 l8 -1.6 z' }, g);
  // Labels.
  const label = (x, y, key, cls = 'place') => (el('text', { class: cls, x, y }, g).textContent = t(key));
  label(44, 161, 'hill.centre');
  label(230, 10, 'hill.halden');
  label(312, 20, 'hill.ferrier');
  label(337, 164, 'hill.airport');
  el('text', { class: 'place chamber-label', x: 88, y: 92 }, g).textContent = t('hill.house');
  // A scale bar: how far five seconds of running gets you.
  el('path', { class: 'scale', d: 'M226 132 v4 h40 v-4 M246 134 v2' }, g);
  el('text', { class: 'note', x: 246, y: 128 }, g).textContent = t('hill.scale');
  return g;
}

export function createHillMap(root, { getState, bells, onSend }) {
  const state = getState();
  const svg = el('svg', { class: 'hill-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('hill.aria') });
  root.appendChild(svg);
  drawPlan(svg);
  const walkers = el('g', { class: 'walkers' }, svg);
  const arrivals = el('g', { class: 'arrivals' }, svg);
  const pipsG = el('g', { class: 'pips' }, svg);
  const runnersG = el('g', { class: 'runners' }, svg);
  const places = data().hill.places;
  const used = {};
  const pips = {};
  let inCount = 0;

  // Members of every party walking in to vote: the building filling up while ours stay put.
  const crowd = [];
  const colours = Object.values(state.parties).map((p) => p.color).filter(Boolean);
  for (let i = 0; i < 14; i++) {
    const fromOffice = i % 3 !== 0;
    const sx = fromOffice ? 200 + Math.random() * 140 : 24 + Math.random() * 128;
    const sy = fromOffice ? 66 + Math.random() * 20 : 53;
    const route = fromOffice ? [[sx, sy], [sx, 86], [186, 86], [186, 96], [150, 96], [FLOOR[0] + (Math.random() - 0.5) * 30, FLOOR[1] + (Math.random() - 0.5) * 20]] : [[sx, sy], [sx, 66], [FLOOR[0], 66], [FLOOR[0] + (Math.random() - 0.5) * 30, 84 + Math.random() * 40]];
    const dot = el('circle', { class: 'walker', r: 2.2, fill: colours[i % colours.length] || '#777' }, walkers);
    crowd.push({ dot, path: polyline(route), start: Math.random() * 0.45, dur: 0.25 + Math.random() * 0.25 });
  }

  // One pip per member we know about.
  const ids = Object.keys(bells.away).filter((id) => bells.away[id].where);
  for (const id of ids) {
    const a = bells.away[id];
    let at = places[a.where].spots[a.spot]?.at || a.where;
    if ((used[at] || 0) >= SLOTS[at].length) at = SIBLING[at];
    const slot = SLOTS[at][used[at] || 0] || SLOTS[at][0];
    used[at] = (used[at] || 0) + 1;
    const [x, y, lx, ly] = slot;
    const m = state.mps[id];
    const g = el('g', { class: 'pip idle', 'data-pip': id, transform: `translate(${x} ${y})`, tabindex: 0, role: 'button' }, pipsG);
    el('circle', { class: 'halo', r: 12 }, g);
    el('circle', { class: 'dot', r: 6.5, fill: partyColor(state, m) }, g);
    const name = el('text', { class: 'name', x: lx, y: ly }, g);
    name.textContent = m.name.last.length > 11 ? m.name.last.slice(0, 10) + '…' : m.name.last;
    const tag = el('tspan', { class: 'trip', dx: 3 }, name);
    tag.textContent = t('hill.secs', { s: a.trip });
    el('circle', { class: 'hit', r: 22 }, g);
    pips[id] = { g, x, y, at, tag, a, state: 'idle', route: polyline(ROUTE[at](x, y)) };
  }

  // Tap a pip: the sim decides; the drawing follows.
  let last = bells.secs;
  const runs = [];
  function send(id) {
    const pip = pips[id];
    if (!pip || pip.state !== 'idle') return;
    const r = onSend(id, last);
    if (!r?.ok) return r;
    pip.state = 'sent';
    pip.g.setAttribute('class', 'pip sent');
    const dot = el('circle', { class: 'runner', r: 4 }, runnersG);
    const follow = r.found ? el('circle', { class: 'follower', r: 4.5, fill: partyColor(state, state.mps[id]) }, runnersG) : null;
    if (follow) follow.style.display = 'none';
    runs.push({ id, pip, dot, follow, from: last, trip: r.trip, found: r.found, line: r.line, done: false });
    return r;
  }
  svg.addEventListener('click', (e) => {
    const g = e.target.closest('[data-pip]');
    if (g) send(g.dataset.pip);
  });
  svg.addEventListener('keydown', (e) => {
    const g = e.target.closest?.('[data-pip]');
    if (g && (e.key === 'Enter' || e.key === ' ')) send(g.dataset.pip);
  });

  let onArrive = () => {};
  // One frame of the bells. `left` is the clock in seconds; `total` the length of these bells.
  function frame(left, total) {
    last = left;
    const gone = 1 - left / total;
    for (const c of crowd) {
      const f = (gone - c.start) / c.dur;
      if (f <= 0) c.dot.style.opacity = 0;
      else if (f >= 1) c.dot.style.opacity = 0;
      else {
        const [x, y] = c.path.at(f);
        c.dot.setAttribute('cx', x.toFixed(1));
        c.dot.setAttribute('cy', y.toFixed(1));
        c.dot.style.opacity = Math.min(1, f * 4, (1 - f) * 4) * 0.85;
      }
    }
    // Trips that can no longer beat the doors.
    for (const pip of Object.values(pips)) {
      if (pip.state === 'idle' && pip.a.trip > left + 0.05) {
        pip.state = 'far';
        pip.g.setAttribute('class', 'pip far');
        pip.tag.textContent = ' ' + t('hill.tooFar');
      }
    }
    for (const r of runs) {
      if (r.done) continue;
      const k = (r.from - left) / r.trip;
      if (k >= 1) {
        r.done = true;
        r.dot.remove();
        r.follow?.remove();
        if (r.found) {
          r.pip.state = 'in';
          r.pip.g.setAttribute('class', 'pip in');
          // Into a seat: the pip joins the row of arrivals on the floor of the House.
          const [x, y] = [48 + (inCount % 8) * 10, 136 - Math.floor(inCount / 8) * 9];
          inCount++;
          el('circle', { class: 'arrived', cx: x, cy: y, r: 3.6, fill: partyColor(state, state.mps[r.id]) }, arrivals);
          r.pip.g.style.opacity = 0;
        } else {
          r.pip.state = 'missed';
          r.pip.g.setAttribute('class', 'pip missed');
          r.pip.tag.textContent = ' ' + t('hill.notFound');
        }
        onArrive(r);
        continue;
      }
      // Out to the pip in the first half, back in the second.
      const there = k < 0.5;
      const [x, y] = r.pip.route.at(there ? k * 2 : 2 - k * 2);
      r.dot.setAttribute('cx', x.toFixed(1));
      r.dot.setAttribute('cy', y.toFixed(1));
      if (!there && r.follow) {
        const [fx, fy] = r.pip.route.at(Math.min(1, 2 - k * 2 + 0.06));
        r.follow.style.display = '';
        r.follow.setAttribute('cx', fx.toFixed(1));
        r.follow.setAttribute('cy', fy.toFixed(1));
        r.pip.g.style.opacity = 0.25;
      }
      if (!there && !r.found && r.pip.state === 'sent') {
        // The staffer is on the way back alone: the member wasn't there.
        r.pip.state = 'missing';
        r.pip.g.setAttribute('class', 'pip sent missing');
      }
    }
  }

  return {
    frame,
    send,
    onArrive(fn) {
      onArrive = fn;
    },
    busy: () => runs.filter((r) => !r.done).length,
    // The doors close: anyone still on the way is settled already in the sim; just finish the drawing.
    close() {
      for (const r of runs) if (!r.done) frame(Math.min(last, r.from - r.trip), Math.max(1, bells.secs));
    },
  };
}

// The words around the map: who's unaccounted for, how many staff are free.
export function hillHeader(bells, free, total) {
  const unknown = Object.values(bells.away).filter((a) => !a.where).length;
  const staff = Array.from({ length: total }, (_, i) => `<i class="${i < free ? 'free' : 'out'}"></i>`).join('');
  return `<span class="staff" aria-label="${esc(t('hill.staffAria', { n: free }))}">${esc(t('hill.staff'))} ${staff}</span>${unknown ? `<span class="unknown">${esc(t('hill.unknown', { n: unknown }))}</span>` : ''}`;
}
