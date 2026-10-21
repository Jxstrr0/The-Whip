// Faces you earn. Nobody in the rooms has a face until you've spoken to them. Talk once and they get eyes,
// brows and a nose; talk again and they get the one feature you'd pick out across the floor (glasses, a
// beard, heavy brows); know them well and they wear the thing they're known for (a bow tie, a flower in the
// lapel). It is the player's memory drawn on the figures, so the tier comes from the save; which feature and
// which keepsake a member has comes from their id, so it never changes once earned.
import * as THREE from 'three';
import { merge } from './kit3d.js';
import { familiarity } from './sim/knowledge.js';
import { data } from './sim/config.js';

export const HEAD_R = 0.115;
// The head is an egg: these stretch the sphere up and forward.
const HY = 1.12;
const HZ = 1.02;

const FEATURES = ['round', 'square', 'halfMoons', 'brows', 'earrings'];
const WHISKERS = ['beard', 'moustache'];
const SIGNATURES = ['bowtie', 'pocket', 'flower', 'boldTie'];
const FRAMES = ['#1a1714', '#5a3a22', '#b89a5e', '#8a8f98'];
const ACCENTS = ['#c8423b', '#e0a526', '#2a7f8a', '#efe9df', '#7a3b8c', '#d9772b'];

// Cosmetic only (sim randomness never comes from this), so the same small string hash as the figure kit.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// What a member's face would carry at full familiarity, and how much of it shows at `tier` (0–3).
export function faceFor(id, tier, { whiskers = false } = {}) {
  const h = hash(`${id || 'x'}:face`);
  const pool = whiskers ? [...FEATURES, ...WHISKERS] : FEATURES;
  return {
    tier: tier || 0,
    feature: pool[h % pool.length],
    frame: FRAMES[(h >>> 5) % FRAMES.length],
    signature: SIGNATURES[(h >>> 9) % SIGNATURES.length],
    accent: ACCENTS[(h >>> 13) % ACCENTS.length],
  };
}

// The same, read from the game: how well the player knows them, and whether the name grows whiskers.
export function faceOf(state, mpId, talksAgo = 0) {
  const m = state?.mps?.[mpId];
  if (!m) return null;
  return faceFor(mpId, familiarity(state, mpId, talksAgo), { whiskers: data().names.whiskers?.includes(m.name.first) });
}

// Which parts show at a tier: the face itself at 1, the feature at 2, the keepsake at 3. `level` says which
// tier a part arrives with, so a figure can grow just the new parts when the player learns more.
export function partsFor(face) {
  const out = [];
  if (!face || face.tier < 1) return out;
  out.push(['eyes', 1], ['nose', 1], [face.tier >= 2 && face.feature === 'brows' ? 'heavyBrows' : 'brows', face.tier >= 2 && face.feature === 'brows' ? 2 : 1]);
  if (face.tier >= 2 && face.feature !== 'brows') {
    if (face.feature === 'beard') out.push(['beard', 2], ['moustache', 2]);
    else out.push([face.feature, 2]);
  }
  if (face.tier >= 3 && face.signature !== 'boldTie') out.push([face.signature, 3]);
  return out;
}
export const HEAD_PARTS = ['eyes', 'nose', 'brows', 'heavyBrows', 'round', 'square', 'halfMoons', 'beard', 'moustache', 'earrings'];
export const BODY_PARTS = ['bowtie', 'pocket', 'flower'];

// The colour each part takes: hair for brows and whiskers, skin for the nose, the frame for glasses, the
// accent for the keepsake. Eyes and earrings have fixed materials.
export function partColour(part, face, look) {
  if (part === 'nose') return look.skin;
  if (['brows', 'heavyBrows', 'beard', 'moustache'].includes(part)) return look.hairStyle > 0 ? look.hair : '#8a8580';
  if (['round', 'square', 'halfMoons'].includes(part)) return face.frame;
  if (BODY_PARTS.includes(part)) return face.accent;
  return null;
}

// The tie a member wears once their keepsake is a loud one.
export function tieColour(face, tie) {
  return face?.tier >= 3 && face.signature === 'boldTie' ? face.accent : tie;
}

function egg(r, x, y, z, sx = 1, sy = 1, sz = 1, segs = 10) {
  const g = new THREE.SphereGeometry(r, segs, Math.max(6, segs >> 1));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}
function block(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}
// The z of the head's front surface at (x, y) from the head's centre, pushed out by `out`.
function onHead(x, y, out = 0) {
  const k = 1 - (x / HEAD_R) ** 2 - (y / (HEAD_R * HY)) ** 2;
  return HEAD_R * HZ * Math.sqrt(Math.max(0, k)) + out;
}

// Glasses: two rims, a bridge, the short hinges and the arms back to the ears.
function frames(rim, y) {
  const parts = [];
  for (const s of [-1, 1]) {
    const r = rim();
    r.translate(0.043 * s, y, onHead(0.043, y, 0.012));
    parts.push(r, block(0.044, 0.005, 0.005, 0.094 * s, y + 0.004, onHead(0.043, y, 0.008)), block(0.006, 0.006, 0.11, 0.117 * s, y + 0.004, 0.055));
  }
  parts.push(block(0.022, 0.005, 0.005, 0, y + 0.007, onHead(0, y, 0.013)));
  return merge(parts);
}

// Every part that rides on the head, centred on the middle of the head and facing +z.
export function headGeometries() {
  const brow = (s, thick) => {
    const g = new THREE.BoxGeometry(0.04, thick, 0.012);
    g.rotateZ(-0.14 * s);
    g.translate(0.043 * s, 0.047, onHead(0.043, 0.047, -0.002));
    return g;
  };
  const beard = new THREE.SphereGeometry(HEAD_R * 1.05, 16, 8, Math.PI / 2 - 1.3, 2.6, Math.PI * 0.6, Math.PI * 0.33);
  beard.scale(1, HY, HZ * 1.03);
  return {
    eyes: merge([-1, 1].map((s) => egg(0.0125, 0.041 * s, 0.014, onHead(0.041, 0.014, -0.006), 1, 1.15, 0.6, 8))),
    nose: egg(0.017, 0, -0.014, onHead(0, -0.014, -0.009), 0.8, 1.3, 1, 8),
    brows: merge([brow(-1, 0.008), brow(1, 0.008)]),
    heavyBrows: merge([brow(-1, 0.018), brow(1, 0.018)]),
    round: frames(() => new THREE.TorusGeometry(0.028, 0.0045, 5, 18), 0.012),
    square: frames(() => new THREE.TorusGeometry(0.033, 0.005, 4, 4).rotateZ(Math.PI / 4).scale(1, 0.8, 1), 0.012),
    halfMoons: frames(() => new THREE.TorusGeometry(0.027, 0.0045, 4, 10, Math.PI).rotateZ(Math.PI), 0.0),
    beard,
    moustache: merge([-1, 1].map((s) => egg(0.012, 0.016 * s, -0.04, onHead(0.016, -0.04, -0.003), 1.6, 0.75, 0.8, 8).rotateZ(0))),
    earrings: merge([-1, 1].map((s) => egg(0.011, 0.112 * s, -0.04, 0.004, 1, 1, 1, 8))),
  };
}

// The keepsakes worn on the jacket, each centred on its own anchor (returned alongside) so it can grow in place.
export function bodyGeometries(shoulderY) {
  const bowtie = merge([egg(0.022, -0.022, 0, 0, 1.3, 0.85, 0.45, 8), egg(0.022, 0.022, 0, 0, 1.3, 0.85, 0.45, 8), egg(0.011, 0, 0, 0.004, 1, 1, 0.8, 8)]);
  const pocket = merge([block(0.046, 0.012, 0.008, 0, -0.004, 0), new THREE.ConeGeometry(0.012, 0.022, 4).translate(-0.011, 0.012, 0), new THREE.ConeGeometry(0.012, 0.026, 4).translate(0.01, 0.014, 0)]);
  pocket.rotateZ(0.12);
  const flower = merge([[0, 0.008], [-0.008, -0.004], [0.008, -0.004], [0, 0]].map(([x, y], i) => egg(i === 3 ? 0.007 : 0.01, x, y, i === 3 ? 0.006 : 0, 1, 1, 0.7, 8)));
  return {
    geos: { bowtie, pocket, flower },
    anchors: { bowtie: [0, shoulderY - 0.1, 0.139], pocket: [0.088, shoulderY - 0.2, 0.127], flower: [-0.083, shoulderY - 0.075, 0.123] },
  };
}

// The hair cap: a crown and the back and sides, leaving the face open under a hairline.
export function hairCap() {
  const r = HEAD_R + 0.012;
  const crown = new THREE.SphereGeometry(r, 14, 4, 0, Math.PI * 2, 0, Math.PI * 0.3);
  const open = 1.5;
  const sides = new THREE.SphereGeometry(r, 14, 5, Math.PI / 2 + open / 2, Math.PI * 2 - open, Math.PI * 0.3, Math.PI * 0.34);
  const g = merge([crown, sides]);
  g.scale(1, 1.1, 1.02);
  g.translate(0, 0.005, -0.012);
  return g;
}

// Scale for a part that is growing in: a little overshoot, then settle.
export function growScale(k) {
  if (k >= 1) return 1;
  const c = 1.9;
  const x = k - 1;
  return Math.max(0, 1 + (c + 1) * x * x * x + c * x * x);
}
