// How a figure moves: the channels every pose is written in, the poses themselves, breathing, the walk, and
// the small things people do while they sit and stand (a glance, a nod, a shift of weight, arms folded, a
// hand to the chin, the desk thumped). Shared by the instanced crowds (figures.js) and the jointed office
// figure (visitor.js), so a member fidgets the same way on the bench and across the desk. Cosmetic only:
// any randomness here is plain Math.random, never the sim's.
import { RIG } from './body.js';

// Lengths in metres, angles in radians. bodyY/bodyZ place the hips; lean, sway and turn tip the trunk about
// x, z and y; the head pivots at the neck; a shoulder swings forward with negative x, out with z and twists
// with y; an elbow folds with negative x and crosses the chest with y; hips and knees fold about x.
export const CH = ['bodyY', 'bodyZ', 'lean', 'sway', 'turn', 'headX', 'headY', 'headZ', 'aLx', 'aLy', 'aLz', 'aRx', 'aRy', 'aRz', 'eLx', 'eLy', 'eRx', 'eRy', 'hipL', 'hipR', 'kneeL', 'kneeR'];
export const NCH = CH.length;
export const IX = Object.fromEntries(CH.map((c, i) => [c, i]));

export function toChannels(obj, out = new Float32Array(NCH)) {
  out.fill(0);
  for (const k in obj) if (IX[k] != null) out[IX[k]] = obj[k];
  return out;
}
export function addChannels(out, obj, k = 1) {
  for (const key in obj) if (IX[key] != null) out[IX[key]] += obj[key] * k;
}

const PI = Math.PI;
const SIT = { bodyY: RIG.seat, hipL: -PI / 2, hipR: -PI / 2, kneeL: PI / 2, kneeR: PI / 2 };
// Both arms at once; y and z mirror for the right arm.
const arms = (x, y, z) => ({ aLx: x, aLy: y, aLz: z, aRx: x, aRy: -y, aRz: -z });
const elbows = (x, y) => ({ eLx: x, eLy: y, eRx: x, eRy: -y });

// Every pose, as a full set of channel values (unset channels are 0). `scale` is a whole-figure size for
// the jointed figure (a visitor who has shrunk into the chair) and is not a channel.
export const POSES = {
  standing: { bodyY: RIG.hip, ...arms(0, 0, 0.06), ...elbows(-0.15, 0) },
  walking: { bodyY: RIG.hip, lean: 0.05, ...arms(0, 0, 0.06), ...elbows(-0.3, 0) },
  // Forearms along the thighs, hands in the lap: how a member sits on the bench.
  seated: { ...SIT, ...arms(-0.2, 0, 0.05), ...elbows(-0.52, 0) },
  // Upright, hands on the knees.
  cooperative: { ...SIT, lean: -0.03, ...arms(-0.55, 0, 0.05), ...elbows(-0.95, 0) },
  // Arms folded across the chest, leaning back a touch.
  guarded: { ...SIT, lean: -0.1, headX: 0.05, ...arms(-0.9, 0, 0.3), eLx: -1.5, eLy: 1.35, eRx: -1.3, eRy: -1.35 },
  // Leaning in, both hands flat on the desk edge.
  angry: { ...SIT, lean: 0.35, headX: -0.15, ...arms(-1.2, 0, 0.15), ...elbows(-0.25, 0) },
  // Shoulders in, hands clasped in the lap, head down.
  anxious: { ...SIT, bodyY: RIG.seat - 0.01, lean: 0.15, headX: 0.3, ...arms(-0.75, 0, 0.3), ...elbows(-1.45, 0.7), scale: 0.95 },
  // On your feet at your seat, a step forward of the chair: standing to be counted, or to speak.
  risen: { bodyY: RIG.hip, bodyZ: 0.1, ...arms(0, 0, 0.06), ...elbows(-0.15, 0) },
  // At a keyboard: leaning to the screen, hands forward.
  typing: { ...SIT, lean: 0.08, headX: 0.12, ...arms(-0.5, 0, 0.1), ...elbows(-1.3, 0) },
};
const POSE_CH = Object.fromEntries(Object.entries(POSES).map(([k, v]) => [k, toChannels(v)]));
export const poseChannels = (name) => POSE_CH[name] || POSE_CH.standing;

const ARM_CH = ['aLx', 'aLy', 'aLz', 'aRx', 'aRy', 'aRz', 'eLx', 'eLy', 'eRx', 'eRy'];
const flip = (r) => (r() < 0.5 ? -1 : 1);
const between = (r, [a, b]) => a + (b - a) * r();
// What the arms would have to do to reach a pose from where they are now.
function armsTo(base, pose) {
  const out = {};
  for (const c of ARM_CH) out[c] = POSES[pose][c] - base[IX[c]];
  return out;
}

// A fidget rises, holds and falls away, `repeat` times over; `make` returns its peak as channel deltas
// over the pose it is layered on, `wobble` a second set that swings at `freq` Hz while it holds.
export const FIDGETS = {
  // A look at the neighbour.
  glance: { rise: 0.5, hold: [0.8, 1.8], fall: 0.5, make: (r) => ({ headY: flip(r) * (0.28 + r() * 0.22) }) },
  nod: { rise: 0.22, hold: 0, fall: 0.22, repeat: 2, make: () => ({ headX: 0.13 }) },
  // Head down to the papers.
  papers: { rise: 0.6, hold: [1.5, 4], fall: 0.6, make: (r) => ({ headX: 0.32, headY: flip(r) * 0.08 }) },
  // Shifting weight in the seat.
  settle: {
    rise: 0.8,
    hold: [2, 5],
    fall: 1.0,
    make: (r) => {
      const s = flip(r);
      return { sway: s * 0.035, bodyY: -0.006, turn: s * 0.07 };
    },
  },
  // Elbows down to the knees, forearms along the thighs.
  leanIn: { rise: 0.9, hold: [3, 7], fall: 1.0, make: () => ({ lean: 0.18, headX: -0.12, aLx: -0.3, aRx: -0.3, eLx: 0.45, eRx: 0.45 }) },
  fold: { rise: 0.9, hold: [5, 10], fall: 0.9, make: (r, base) => ({ ...armsTo(base, 'guarded'), lean: -0.05, headX: 0.03 }) },
  // One hand up to the chin.
  chin: {
    rise: 0.9,
    hold: [3, 6],
    fall: 0.9,
    make: (r, base) => {
      const L = r() < 0.5;
      const a = L ? 'aL' : 'aR';
      const e = L ? 'eL' : 'eR';
      const s = L ? 1 : -1;
      return { [a + 'x']: -1.05 - base[IX[a + 'x']], [a + 'z']: s * 0.3 - base[IX[a + 'z']], [e + 'x']: -2.4 - base[IX[e + 'x']], [e + 'y']: s * 0.55 - base[IX[e + 'y']], headX: 0.08, lean: 0.1 };
    },
  },
  // Standing: weight onto one leg.
  shift: {
    rise: 0.7,
    hold: [2, 6],
    fall: 0.8,
    make: (r) => {
      const s = flip(r);
      return { sway: s * 0.03, turn: s * 0.05, bodyY: -0.012, [s < 0 ? 'kneeL' : 'kneeR']: 0.14 };
    },
  },
  // A hand lifts off the desk and comes back down.
  jab: { rise: 0.18, hold: 0.08, fall: 0.16, make: (r) => ({ [r() < 0.5 ? 'aLx' : 'aRx']: 0.35, headX: -0.06 }) },
  // The desk thumped with both hands, in time with the room but never quite: the hands rest on the desk
  // at the bottom of the swing and come up a hand's height.
  thump: { rise: 0.3, hold: [2.2, 3.4], fall: 0.5, freq: [3.6, 4.6], make: (r, base) => ({ lean: 0.1, aLx: -0.75 - base[IX.aLx], aRx: -0.75 - base[IX.aRx], eLx: -0.95 - base[IX.eLx], eRx: -0.95 - base[IX.eRx] }), wobble: () => ({ eLx: 0.35, eRx: 0.35, lean: 0.02 }) },
  // Clapping, hands up in front of the chest.
  clap: { rise: 0.4, hold: [3, 6], fall: 0.5, freq: [3.4, 4.2], make: (r, base) => ({ ...armsTo(base, 'standing'), aLx: -0.9, aRx: -0.9, aLz: 0.12, aRz: -0.12, eLx: -1.75, eRx: -1.75, eLy: 0.5, eRy: -0.5 }), wobble: () => ({ eLy: 0.3, eRy: -0.3 }) },
  // On your feet making the point: one hand working, the head between the chair and the other side.
  speaking: { rise: 0.6, hold: 1e9, fall: 0.6, freq: [0.3, 0.42], make: () => ({ aLx: -0.75, eLx: -1.25, headY: -0.15 }), wobble: () => ({ aLx: 0.2, eLx: 0.15, headY: 0.3, headX: 0.04, sway: 0.025 }) },
  // Getting up: a push forward off the knees before the legs straighten; and the settle back down.
  standUp: { rise: 0.25, hold: 0.15, fall: 0.45, make: () => ({ lean: 0.3, headX: -0.12, aLx: -0.25, aRx: -0.25 }) },
  sitDown: { rise: 0.3, hold: 0.1, fall: 0.45, make: () => ({ lean: 0.2, headX: 0.05 }) },
  // One arm up: a cheer, or a question from the floor.
  raise: { rise: 0.35, hold: [1.5, 4], fall: 0.5, make: (r, base) => (r() < 0.5 ? { aLx: -2.7 - base[IX.aLx], aLz: 0.25, eLx: -0.2 - base[IX.eLx] } : { aRx: -2.7 - base[IX.aRx], aRz: -0.25, eRx: -0.2 - base[IX.eRx] }) },
};

// What people do, unprompted, by how they are sitting or standing: [fidget, weight].
export const POOLS = {
  seated: [['glance', 3], ['nod', 0.6], ['papers', 2], ['settle', 2.5], ['leanIn', 1.2], ['fold', 1], ['chin', 1]],
  standing: [['glance', 3], ['nod', 0.4], ['shift', 3.5], ['fold', 0.8], ['papers', 0.4]],
  // The office moods: what someone does while the meeting goes on.
  cooperative: [['nod', 3], ['glance', 1], ['settle', 1], ['leanIn', 0.8]],
  guarded: [['glance', 2], ['settle', 1.2], ['nod', 0.3]],
  angry: [['jab', 2.5], ['settle', 1], ['glance', 0.8]],
  anxious: [['glance', 2.5], ['settle', 2.5], ['papers', 1]],
  typing: [['glance', 2], ['nod', 0.5], ['settle', 0.6]],
  walking: [],
  risen: [],
};

const smooth = (u) => u * u * (3 - 2 * u);
const rnd = Math.random;

// Start a fidget over `base` (the pose it is layered on). `hold` overrides the fidget's own.
export function startFidget(name, base, { hold = null } = {}) {
  const d = FIDGETS[name];
  if (!d) return null;
  const peak = toChannels(d.make(rnd, base));
  const f = {
    name,
    t: 0,
    rise: d.rise,
    hold: hold ?? (Array.isArray(d.hold) ? between(rnd, d.hold) : d.hold),
    fall: d.fall,
    repeat: d.repeat || 1,
    peak,
    wobble: d.wobble ? toChannels(d.wobble(rnd)) : null,
    freq: d.freq ? between(rnd, d.freq) : 0,
    phase: rnd() * PI * 2,
    ending: false,
  };
  return f;
}
// Let a fidget fall away now: this cycle is its last, and its hold ends here.
export function endFidget(f) {
  if (!f || f.ending) return;
  const cycle = f.rise + f.hold + f.fall;
  const u = f.t - Math.floor(f.t / cycle) * cycle;
  if (u < f.rise) f.hold = 0;
  else if (u < f.rise + f.hold) f.hold = u - f.rise;
  f.t = u;
  f.repeat = 1;
  f.ending = true;
}
// Advance a fidget and add what it does to `out`. False once it has fallen away.
export function stepFidget(f, dt, out) {
  f.t += dt;
  const cycle = f.rise + f.hold + f.fall;
  const n = Math.floor(f.t / cycle);
  if (n >= f.repeat) return false;
  const u = f.t - n * cycle;
  const e = u < f.rise ? smooth(u / f.rise) : u < f.rise + f.hold ? 1 : 1 - smooth((u - f.rise - f.hold) / f.fall);
  for (let c = 0; c < NCH; c++) out[c] += f.peak[c] * e;
  if (f.wobble) {
    const w = e * Math.sin(f.t * f.freq * PI * 2 + f.phase);
    for (let c = 0; c < NCH; c++) out[c] += f.wobble[c] * w;
  }
  return true;
}
// One fidget from a pool, by weight.
export function pickFidget(pool) {
  const list = POOLS[pool] || [];
  let total = 0;
  for (const [, w] of list) total += w;
  let x = rnd() * total;
  for (const [name, w] of list) {
    x -= w;
    if (x <= 0) return name;
  }
  return list.length ? list[0][0] : null;
}

// Breathing and the small drift that keeps a still figure alive. `phase` is this person's own.
export function breathe(out, t, phase) {
  const b = Math.sin(t * 1.4 + phase);
  out[IX.bodyY] += b * 0.0025;
  out[IX.lean] += b * 0.007;
  out[IX.aLx] -= b * 0.012;
  out[IX.aRx] -= b * 0.012;
  out[IX.headX] += b * 0.006;
  out[IX.headY] += Math.sin(t * 0.37 + phase * 1.7) * 0.03;
}

// The walk, at time t: legs from the hip with a knee bend on the swing through, arms opposite, the body
// dipping on each stride, hips rocking, the head steady against the shoulders. `k` fades it in and out.
export function stride(out, t, k = 1) {
  const w = t * 9;
  const s = Math.sin(w);
  out[IX.hipL] += s * 0.5 * k;
  out[IX.hipR] -= s * 0.5 * k;
  out[IX.kneeL] += (Math.max(0, -s) * 0.7 + 0.05) * k;
  out[IX.kneeR] += (Math.max(0, s) * 0.7 + 0.05) * k;
  out[IX.aLx] -= s * 0.35 * k;
  out[IX.aRx] += s * 0.35 * k;
  out[IX.eLx] -= Math.max(0, s) * 0.3 * k;
  out[IX.eRx] -= Math.max(0, -s) * 0.3 * k;
  out[IX.bodyY] -= s * s * 0.018 * k;
  out[IX.sway] += s * 0.03 * k;
  out[IX.turn] -= s * 0.06 * k;
  out[IX.headY] += s * 0.05 * k;
  out[IX.headZ] -= s * 0.02 * k;
}

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
