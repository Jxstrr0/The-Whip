// The office: where evenings happen. It grows with rank: a shared room in Act 1, your own room in Act 2, the
// annex off the whip's office in Act 3, the deputy's room in Act 4 and the chief whip's corner office in
// Act 5. The whip's own office is built alongside and swapped in for the Act 1 reversal (the whip calls you
// in). Furniture from the Kenney kit, retinted; cabinets, rugs, flags and nameplates built here.
import * as THREE from 'three';
import { box, slab, panel, cylinder, sphere, merge, vertexMaterial, glowMaterial, washMaterial, worldUVs, disposeTree, roomLights, lamp, bakeAO, contactShadows, paintedTexture, texturedPanel } from '../kit3d.js';
import { DETAIL } from '../look.js';
import { surface, brass } from '../textures.js';
import { placeModel } from '../models.js';
import { tuning } from '../sim/config.js';
import { createOfficeCamera } from './officeCamera.js';
import { createSpeech } from '../speech.js';
import { reducedMotion } from '../ui/feel.js';
import { createVisitor, createFigure, poseFigure } from './visitor.js';
import { wardrobe } from '../figures.js';
import { createPrecipitation, DEFAULT_WEATHER, GREY_SKIES, mix } from '../weatherFx.js';

const H = 3.2;
const C = { plaster: '#d6ccb8', plasterDark: '#b9ab93', floor: '#5e4b3a', oak: '#6e4a2b', oakDark: '#3f2a17', walnut: '#3b2616', walnutDark: '#241508', paper: '#ece6d6', brass: '#c9a24a', steel: '#6f746f', card: '#b8956a', rug: '#5b2b2b', rugGreen: '#2f4a3a', drape: '#3a5a46', iron: '#3e403d', black: '#1f1d1b', blotter: '#4a1e1e', tile: '#56616d', tileAlt: '#4c5763', gilt: '#8a6a2a' };

// The desk sits at the origin in every set, so the camera and the chairs never move: visitors come in the
// door on the +x wall and walk round the desk to the left-hand visitor chair.
const VISITOR_SEAT = [-0.5, -1.0];
const DESK_SEAT = [0, 0.9];
const doorZ = (D) => D - 0.5;
const visitorPath = (W, D) => [[W - 0.25, doorZ(D)], [W - 1.3, D - 0.8], [W - 1.4, -1.65], [-0.5, -1.65], VISITOR_SEAT];

// What the window shows depends on the time of year: a long dusk over the lawn in September, dark by five
// with snow on the ground in January, wet and grey in March, a bright late evening in June.
function paintLawn(g, w, h, wx = DEFAULT_WEATHER) {
  const grey = GREY_SKIES.has(wx.kind) ? 0.65 : 0;
  const dark = wx.dark;
  const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, mix(mix('#2f3d63', '#0b1020', dark), '#3c414c', grey));
  sky.addColorStop(0.55, mix(mix('#8a6f8f', '#2a2f4a', dark), '#656a76', grey));
  sky.addColorStop(1, mix(mix(wx.season === 'summer' ? '#f2c47a' : '#e8a66a', '#5a4040', dark), '#8c8c90', grey));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // The Gothic tower across the lawn, dark against the sky, its windows lit as the evening darkens.
  g.fillStyle = mix('#3a3a44', '#1c1c24', dark);
  g.fillRect(w * 0.62, h * 0.16, w * 0.08, h * 0.47);
  g.beginPath();
  g.moveTo(w * 0.605, h * 0.17);
  g.lineTo(w * 0.66, h * 0.03);
  g.lineTo(w * 0.715, h * 0.17);
  g.fill();
  g.fillRect(w * 0.45, h * 0.4, w * 0.45, h * 0.23);
  if (wx.snow > 0.4) {
    g.fillStyle = '#dfe6ee';
    g.fillRect(w * 0.45, h * 0.4, w * 0.45, h * 0.012);
    g.fillRect(w * 0.62, h * 0.16, w * 0.08, h * 0.01);
  }
  g.fillStyle = '#f2d59a';
  g.globalAlpha = 0.45 + dark * 0.55;
  for (let i = 0; i < 7; i++) if (dark > 0.3 || i % 2) g.fillRect(w * (0.47 + i * 0.06), h * 0.47, w * 0.015, h * 0.035);
  g.fillRect(w * 0.645, h * 0.3, w * 0.012, h * 0.04);
  g.globalAlpha = 1;
  // Trees in two layers: green, then turning, then bare with snow on the boughs, then green again.
  const bare = wx.season === 'winter' || (wx.season === 'spring' && wx.snow > 0.3);
  const leaf = wx.season === 'autumn' ? [['#7a4a22', '#4a2e1a'], ['#9a5a26', '#5a3a1c']] : wx.season === 'summer' ? [['#3b5a36', '#263a24'], ['#2f4a2c', '#1d2d1b']] : [['#3d4a3a', '#2a3328'], ['#36443a', '#24302a']];
  for (const [li, [y0, r]] of [[0.6, 30], [0.64, 22]].entries()) {
    const [near, far] = leaf[li];
    g.fillStyle = mix(near, far, dark * 0.7);
    for (let i = 0; i < 14; i++) {
      const cx = (i / 13) * w;
      const rr = r + (i % 3) * 8;
      if (bare) {
        // A haze of twigs makes the crown, then the limbs over it; snow lies along the top of each limb.
        const path = (dy) => {
          g.moveTo(cx, h * (y0 + 0.08));
          g.lineTo(cx, h * y0 - rr * 0.9 + dy);
          for (let k = -2; k <= 2; k++) {
            if (!k) continue;
            const sx = cx;
            const sy = h * y0 - rr * (0.2 + Math.abs(k) * 0.2) + dy;
            const ex = cx + k * rr * 0.45;
            const ey = h * y0 - rr * (0.9 + Math.abs(k) * 0.15) + dy;
            g.moveTo(sx, sy);
            g.quadraticCurveTo(sx + k * rr * 0.12, (sy + ey) / 2 - rr * 0.1, ex, ey);
          }
        };
        g.fillStyle = mix('#5a4a40', '#26242c', dark * 0.6);
        g.globalAlpha = 0.32;
        g.beginPath();
        g.ellipse(cx, h * y0 - rr * 0.62, rr * 1.05, rr * 0.62, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = mix('#4a3a30', '#222028', dark * 0.6);
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.beginPath();
        path(0);
        g.stroke();
        if (wx.snow > 0.4) {
          g.strokeStyle = mix('#e8edf3', '#aab4c6', dark * 0.6);
          g.lineWidth = 1.8;
          g.beginPath();
          path(-2);
          g.stroke();
          // Snow caught on the crown, a few soft clots.
          g.fillStyle = g.strokeStyle;
          g.globalAlpha = 0.55;
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            g.ellipse(cx + (k - 2) * rr * 0.36, h * y0 - rr * (0.95 + ((k * 7 + i) % 3) * 0.1), rr * 0.16, rr * 0.06, 0, 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 1;
        }
        g.lineCap = 'butt';
        g.fillStyle = mix(near, far, dark * 0.7);
      } else {
        g.beginPath();
        g.arc(cx, h * y0, rr, 0, Math.PI * 2);
        g.fill();
        if (wx.snow > 0.4) {
          g.fillStyle = '#dde4ec';
          g.beginPath();
          g.arc(cx, h * y0, rr, Math.PI * 1.15, Math.PI * 1.85);
          g.fill();
          g.fillStyle = mix(near, far, dark * 0.7);
        }
      }
    }
  }
  // The lawn: green, wet and dark, or under snow with blue shadows.
  const grass = mix(wx.season === 'autumn' ? '#3a4a2a' : '#2f4a2c', '#1d2e1c', Math.max(dark * 0.6, wx.wet * 0.5));
  g.fillStyle = mix(grass, mix('#e6ebf1', '#9aa6bc', dark * 0.7), wx.snow);
  g.fillRect(0, h * 0.66, w, h * 0.34);
  g.fillStyle = mix(mix('#3a5a34', '#243a22', dark * 0.6), mix('#c9d3e0', '#7f8ca6', dark * 0.7), wx.snow);
  for (let i = 0; i < 6; i++) g.fillRect(0, h * (0.7 + i * 0.05), w, h * 0.018);
  if (wx.wet > 0.5 && wx.snow < 0.3) {
    // A wet lawn throws the sky back in streaks.
    g.fillStyle = 'rgba(190,200,220,0.16)';
    for (let i = 0; i < 5; i++) g.fillRect(w * (0.05 + i * 0.19), h * (0.72 + (i % 2) * 0.08), w * 0.12, h * 0.02);
  }
  if (wx.kind === 'fog') {
    g.fillStyle = 'rgba(200,205,215,0.45)';
    g.fillRect(0, 0, w, h);
  }
  if (wx.kind === 'rain') {
    // Rain on the glass: thin runs down the pane.
    g.strokeStyle = 'rgba(230,236,245,0.22)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i < 26; i++) {
      const x = ((i * 97) % w) + 3;
      const y = (i * 53) % h;
      g.moveTo(x, y);
      g.lineTo(x + 4, y + 24 + (i % 4) * 14);
    }
    g.stroke();
  }
}

// The count board is a corkboard with pinned cards: what's coming up and your line on each.
export function drawBoard(g, w, h, rows, title) {
  g.fillStyle = '#a97c4f';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = i % 2 ? 'rgba(80,50,25,0.18)' : 'rgba(255,220,170,0.12)';
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.strokeStyle = '#4a2e18';
  g.lineWidth = 12;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#f3ead8';
  g.fillRect(22, 18, 230, 40);
  g.fillStyle = '#1d1a16';
  g.font = '600 24px Newsreader, Georgia, serif';
  g.fillText(title.toUpperCase(), 34, 46);
  rows.slice(0, 5).forEach((r, i) => {
    const y = 74 + i * 36;
    const tilt = ((i * 7) % 5 - 2) * 0.01;
    g.save();
    g.translate(30, y);
    g.rotate(tilt);
    g.fillStyle = '#f3ead8';
    g.fillRect(0, 0, w - 70, 30);
    g.fillStyle = r.color || '#1d1a16';
    g.font = '18px Newsreader, Georgia, serif';
    g.fillText(r.text.slice(0, 44), 10, 21);
    g.fillStyle = '#a8322d';
    g.beginPath();
    g.arc(w - 82, 8, 5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

// A brass nameplate for the desk, facing the visitors.
function paintNameplate(name) {
  return paintedTexture(256, 56, (g, w, h) => {
    g.fillStyle = '#c9a24a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2214';
    g.font = '600 26px Newsreader, Georgia, serif';
    g.textAlign = 'center';
    g.fillText(name.toUpperCase().slice(0, 18), w / 2, 37);
  });
}

// ---------- the sets ----------
// Each set: the room's half-size (W along x, D along z), its windows, where the board hangs, the lighting
// and what's in it. `furnish` places the furniture and returns the contact-shadow spots.

function windowGeometry(win, W, D) {
  // Frame, sill and a centre mullion, built as if on the -z wall and turned onto the -x wall when asked.
  const onX = win.wall === '-x';
  const rot = onX ? Math.PI / 2 : 0;
  const at = (dx, dz) => (onX ? [-W + dz, win.at - dx] : [win.at + dx, -D + dz]);
  const parts = [];
  const put = (w, h, d, dx, y, dz, color) => {
    const [x, z] = at(dx, dz);
    parts.push(box(w, h, d, x, y, z, color, rot));
  };
  put(win.w + 0.16, 0.08, 0.1, 0, win.y + win.h / 2 + 0.04, 0.05, C.oakDark);
  put(win.w + 0.3, 0.06, 0.18, 0, win.y - win.h / 2 - 0.03, 0.09, C.oak);
  for (const dx of [-1, 1]) put(0.08, win.h + 0.1, 0.1, dx * (win.w / 2 + 0.04), win.y, 0.05, C.oakDark);
  put(0.04, win.h, 0.04, 0, win.y, 0.04, C.oakDark);
  // Curtains either side under a pelmet, and a cast-iron radiator under the sill, built the same way.
  const curtains = [];
  const iron = [];
  const put2 = (list, w, h, d, dx, y, dz, color) => {
    const [x, z] = at(dx, dz);
    list.push(box(w, h, d, x, y, z, color, rot));
  };
  for (const side of [-1, 1]) put2(curtains, 0.3, win.h + 0.7, 0.16, side * (win.w / 2 + 0.28), win.y + 0.08, 0.14, C.drape);
  put2(curtains, win.w + 1.16, 0.24, 0.2, 0, win.y + win.h / 2 + 0.32, 0.16, C.drape);
  const cols = Math.max(6, Math.round(win.w * 6));
  for (let i = 0; i < cols; i++) {
    const [x, z] = at((i - (cols - 1) / 2) * 0.09, 0.14);
    iron.push(cylinder(0.034, 0.034, 0.58, x, 0.44, z, C.iron, 8));
  }
  put2(iron, cols * 0.09, 0.04, 0.08, 0, 0.72, 0.14, C.iron);
  put2(iron, cols * 0.09, 0.04, 0.08, 0, 0.17, 0.14, C.iron);
  return { parts, curtains, iron, at, rot };
}

function buildShell(set) {
  const { W, D } = set;
  const g = { plaster: [], oak: [], walnut: [], wool: [], drape: [], iron: [] };
  if (set.tiles) {
    // The shared room's floor: half-metre carpet tiles in two greys, laid in a chequer.
    for (let i = 0; i < Math.ceil((2 * W) / 0.5); i++) {
      for (let j = 0; j < Math.ceil((2 * D) / 0.5); j++) {
        const x0 = -W + i * 0.5;
        const z0 = -D + j * 0.5;
        g.wool.push(slab(x0, -0.05, z0, Math.min(W, x0 + 0.5), 0, Math.min(D, z0 + 0.5), (i + j) % 2 ? C.tile : C.tileAlt));
      }
    }
  } else g.wool.push(slab(-W, -0.05, -D, W, 0, D, C.floor, 1));
  const wall = set.wall || C.plaster;
  const wallDark = mix(wall, '#000000', 0.14);
  g.plaster.push(panel(2 * D, H, -W, H / 2, 0, wall, '+x', 1));
  g.plaster.push(panel(2 * D, H, W, H / 2, 0, wall, '-x', 1));
  g.plaster.push(panel(2 * W, H, 0, H / 2, -D, wall, '+z', 1));
  g.plaster.push(panel(2 * W, H, 0, H / 2, D, wallDark, '-z', 1));
  g.plaster.push(panel(2 * W, 2 * D, 0, H, 0, '#e9e2d3', 'down', 1));
  // A wainscot to 1.0 m with panel strips, a top rail and a skirting, on every wall, with a picture rail above
  // it; oak in the junior rooms, walnut from the deputy's room up. Every layer stands a clear centimetre proud
  // of the one behind it: coplanar faces shimmer on a phone's shallower depth buffer. The senior rooms also
  // get a plaster cornice.
  const wain = 1.0;
  const dark = set.wainscot === 'walnut';
  const wood = dark ? g.walnut : g.oak;
  const [cWood, cTrim] = dark ? [C.walnut, C.walnutDark] : [C.oak, C.oakDark];
  for (const [len, x, z, facing] of [[2 * D, -W + 0.01, 0, '+x'], [2 * D, W - 0.01, 0, '-x'], [2 * W, 0, -D + 0.01, '+z'], [2 * W, 0, D - 0.01, '-z']]) {
    const inward = facing === '+x' || facing === '+z' ? 0.01 : -0.01;
    const along = facing === '+x' || facing === '-x';
    const at = (s, out) => (along ? [x + out, z + s] : [x + s, z + out]);
    const [rx, rz] = at(0, inward);
    wood.push(panel(len, wain, x, wain / 2, z, cWood, facing, 1));
    wood.push(panel(len, 0.07, rx, wain, rz, cTrim, facing));
    wood.push(panel(len, 0.1, rx, 0.05, rz, cTrim, facing));
    wood.push(panel(len, 0.05, rx, 2.3, rz, cTrim, facing));
    for (let s = -len / 2 + 0.6; s < len / 2; s += 0.9) {
      // No strips behind the door: they would show through it.
      if (facing === '-x' && Math.abs(z + s - doorZ(D)) < 0.6) continue;
      const [sx, sz] = at(s, inward);
      wood.push(panel(0.05, wain - 0.25, sx, wain / 2 - 0.02, sz, cTrim, facing));
    }
    if (set.cornice) {
      const [cx, cz] = at(0, inward * 6);
      g.plaster.push(along ? slab(cx - 0.06, H - 0.14, cz - len / 2, cx + 0.06, H, cz + len / 2, wall) : slab(cx - len / 2, H - 0.14, cz - 0.06, cx + len / 2, H, cz + 0.06, wall));
    }
  }
  // The door on the +x wall, in a frame, standing proud of the wainscot rails.
  const dz = doorZ(D);
  g.walnut.push(panel(0.95, 2.1, W - 0.03, 1.05, dz, C.walnut, '-x'));
  wood.push(panel(1.15, 0.08, W - 0.04, 2.14, dz, cTrim, '-x'));
  for (const d of [-0.55, 0.55]) wood.push(panel(0.08, 2.2, W - 0.04, 1.1, dz + d, cTrim, '-x'));
  for (const win of set.windows) {
    const wg = windowGeometry(win, W, D);
    wood.push(...wg.parts);
    if (DETAIL.rich) {
      if (set.curtains) g.drape.push(...wg.curtains);
      g.iron.push(...wg.iron);
    }
  }
  return g;
}

function buildMeshes(g, bounds) {
  const out = new THREE.Group();
  const kinds = { plaster: 'plaster', oak: 'oak', walnut: 'walnut', wool: 'wool', drape: 'drape' };
  for (const [kind, parts] of Object.entries(g)) {
    if (!parts.length) continue;
    const geo = worldUVs(bakeAO(merge(parts), { bounds, ceilY: kind === 'plaster' ? H : null, reach: 0.7 }));
    const mat = kind === 'iron' ? vertexMaterial({ metalness: 0.45, roughness: 0.5 }) : surface(kinds[kind], kind === 'plaster' ? { roughness: 0.95 } : {});
    out.add(new THREE.Mesh(geo, mat));
  }
  return out;
}

// ---------- pictures ----------
// Everything framed on the walls of one room shares a painted atlas and one mesh (one draw call), with the
// frames merged into a second. Each picture: { kind, wall, at, y, w, h }; kind is 'map' (the riding, with its
// name), 'landscape' (a print of the hills) or 'portrait' (a Speaker in oils). Where on each wall: `at` runs
// along the wall (x on the end walls, z on the side walls), `y` is the centre height.
const CELL = 256;
function hashOf(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
function paintMap(g, x0, y0, w, h, seed, name) {
  let r = seed || 1;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.save();
  g.translate(x0, y0);
  g.fillStyle = '#e6d9bd';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(120,90,50,0.08)';
  for (let i = 0; i < 40; i++) g.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 30, 2 + rnd() * 10);
  // Parish boundaries in faint ink, then the river, the roads, and the towns.
  g.strokeStyle = 'rgba(90,70,40,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(rnd() * w, 0);
    let x = rnd() * w;
    for (let y = 0; y <= h; y += h / 6) {
      g.lineTo(x, y);
      x += (rnd() - 0.5) * w * 0.3;
    }
    g.stroke();
  }
  g.strokeStyle = '#5a7fa0';
  g.lineWidth = 3;
  g.beginPath();
  let ry = rnd() * h;
  g.moveTo(0, ry);
  for (let x = 0; x <= w; x += w / 8) {
    ry += (rnd() - 0.5) * h * 0.35;
    g.lineTo(x, Math.max(10, Math.min(h - 10, ry)));
  }
  g.stroke();
  g.strokeStyle = '#8a3a2a';
  g.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(rnd() * w, rnd() * h);
    g.lineTo(rnd() * w, rnd() * h);
    g.stroke();
  }
  g.fillStyle = '#4a3a2a';
  for (let i = 0; i < 5; i++) {
    const cx = 20 + rnd() * (w - 40);
    const cy = 20 + rnd() * (h - 60);
    for (let k = 0; k < 6; k++) g.fillRect(cx + (rnd() - 0.5) * 14, cy + (rnd() - 0.5) * 14, 3, 3);
  }
  // A compass rose and the riding's name on a cartouche.
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(w - 26, 26, 14, 0, Math.PI * 2);
  g.moveTo(w - 26, 8);
  g.lineTo(w - 26, 44);
  g.moveTo(w - 44, 26);
  g.lineTo(w - 8, 26);
  g.stroke();
  g.fillStyle = 'rgba(246,238,220,0.92)';
  g.fillRect(8, h - 34, w - 16, 26);
  g.strokeRect(8, h - 34, w - 16, 26);
  g.fillStyle = '#2b2214';
  g.font = `600 ${Math.round(w * 0.065)}px Newsreader, Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText((name || 'The riding').toUpperCase().slice(0, 26), w / 2, h - 21);
  g.restore();
}
function paintLandscape(g, x0, y0, w, h, seed) {
  let r = seed || 7;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.save();
  g.translate(x0, y0);
  g.fillStyle = '#efe7d6';
  g.fillRect(0, 0, w, h);
  const m = Math.round(w * 0.08);
  const sky = g.createLinearGradient(0, m, 0, h * 0.6);
  sky.addColorStop(0, '#c9c2b0');
  sky.addColorStop(1, '#e3d4b4');
  g.fillStyle = sky;
  g.fillRect(m, m, w - 2 * m, h - 2 * m);
  const hills = [['#8e917c', 0.5], ['#6e7560', 0.62], ['#4e5542', 0.76]];
  for (const [col, base] of hills) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(m, h - m);
    for (let x = m; x <= w - m; x += (w - 2 * m) / 10) g.lineTo(x, h * base + (rnd() - 0.5) * h * 0.1);
    g.lineTo(w - m, h - m);
    g.fill();
  }
  g.fillStyle = '#b8b4a2';
  g.fillRect(m, h * 0.8, w - 2 * m, h * 0.06);
  g.fillStyle = '#2f3528';
  for (let i = 0; i < 9; i++) {
    const tx = m + rnd() * (w - 2 * m);
    const ty = h * (0.84 + rnd() * 0.06);
    g.beginPath();
    g.arc(tx, ty, 3 + rnd() * 4, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
function paintPortrait(g, x0, y0, w, h, seed) {
  let r = seed || 3;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.save();
  g.translate(x0, y0);
  const bg = g.createRadialGradient(w * 0.5, h * 0.4, w * 0.1, w * 0.5, h * 0.5, w * 0.8);
  bg.addColorStop(0, '#5a4630');
  bg.addColorStop(1, '#1e1710');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // Shoulders in black, a white collar, the face and hair, all in the old manner.
  g.fillStyle = '#121010';
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.98, w * 0.46, h * 0.34, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8e2d4';
  g.beginPath();
  g.moveTo(w * 0.4, h * 0.62);
  g.lineTo(w * 0.5, h * 0.74);
  g.lineTo(w * 0.6, h * 0.62);
  g.fill();
  const skin = ['#c9a284', '#a8785a', '#6b4a36', '#d8b89a'][Math.floor(rnd() * 4)];
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.42, w * 0.17, h * 0.15, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(w * 0.45, h * 0.52, w * 0.1, h * 0.08);
  g.fillStyle = rnd() > 0.5 ? '#d8d4cc' : '#3a2c22';
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.33, w * 0.18, h * 0.08, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(w * 0.44, h * 0.44, w * 0.04, h * 0.01);
  g.fillRect(w * 0.52, h * 0.44, w * 0.04, h * 0.01);
  g.fillStyle = '#c9a24a';
  g.fillRect(w * 0.28, h * 0.9, w * 0.44, h * 0.06);
  g.fillStyle = '#2b2214';
  g.font = `600 ${Math.round(w * 0.055)}px Newsreader, Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const from = 1890 + Math.floor(rnd() * 90);
  g.fillText(`SPEAKER ${from}–${from + 3 + Math.floor(rnd() * 8)}`, w / 2, h * 0.93);
  g.restore();
}

function hangPictures(room, pics, { W, D, ridingName }) {
  if (!pics.length) return;
  const n = pics.length;
  const atlas = paintedTexture(CELL * n, CELL * 2, (g, aw, ah) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, aw, ah);
    pics.forEach((p, i) => {
      const seed = hashOf(`${ridingName}|${p.kind}|${i}`);
      // Fit the picture's shape inside its cell, drawing from the top left.
      const aspect = p.w / p.h;
      const pw = aspect >= 0.5 ? CELL : Math.round(CELL * 2 * aspect);
      const ph = aspect >= 0.5 ? Math.round(CELL / aspect) : CELL * 2;
      p.uv = [i / n, (CELL * 2 - ph) / (CELL * 2), (i + pw / CELL) / n, 1];
      if (p.kind === 'map') paintMap(g, i * CELL, 0, pw, ph, seed, ridingName);
      else if (p.kind === 'portrait') paintPortrait(g, i * CELL, 0, pw, ph, seed);
      else paintLandscape(g, i * CELL, 0, pw, ph, seed);
    });
  });
  const facing = { '-z': 0, '+z': Math.PI, '-x': Math.PI / 2, '+x': -Math.PI / 2 };
  const place = (wall, at, out) => (wall === '-z' ? [at, -D + out] : wall === '+z' ? [at, D - out] : wall === '-x' ? [-W + out, at] : [W - out, at]);
  const canvases = [];
  const frames = [];
  for (const p of pics) {
    const rot = facing[p.wall];
    const [x, z] = place(p.wall, p.at, 0.028);
    const geo = new THREE.PlaneGeometry(p.w, p.h);
    const uv = geo.attributes.uv;
    const [u0, v0, u1, v1] = p.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    geo.rotateY(rot);
    geo.translate(x, p.y, z);
    canvases.push(geo);
    const col = p.kind === 'portrait' ? C.gilt : p.kind === 'map' ? C.oakDark : C.walnut;
    const t = p.kind === 'portrait' ? 0.07 : 0.045;
    const [fx, fz] = place(p.wall, p.at, 0.02);
    const parts = [
      box(p.w + 2 * t, t, 0.04, 0, p.y + p.h / 2 + t / 2, 0, col),
      box(p.w + 2 * t, t, 0.04, 0, p.y - p.h / 2 - t / 2, 0, col),
      box(t, p.h, 0.04, -p.w / 2 - t / 2, p.y, 0, col),
      box(t, p.h, 0.04, p.w / 2 + t / 2, p.y, 0, col),
    ];
    const fg = merge(parts);
    fg.rotateY(rot);
    fg.translate(fx, 0, fz);
    frames.push(fg);
  }
  const pic = new THREE.Mesh(merge(canvases), new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false }));
  pic.name = 'pictures';
  room.add(pic);
  room.add(new THREE.Mesh(merge(frames), vertexMaterial({ roughness: 0.5, metalness: 0.2 })));
}

// ---------- the desk ----------
// What a working desk carries: a leather blotter with a memo on it, an in-tray with the day's papers, a
// telephone, a cup, and the pool of the lamp on the wood. `top` is the desk height; the layout says where
// each thing sits (the kit desk runs from the origin toward -x; the walnut desk is centred). Five draw
// calls, so rich rooms only.
const KIT_DESK = { blotter: [-0.42, 0.42], tray: [-1.25, 0.22], phone: [-0.98, 0.56], cup: [-0.14, 0.6], lamp: [-0.5, 0], s: 1 };
const WALNUT_DESK = (s) => ({ blotter: [-0.08 * s, -0.08], tray: [0.55 * s, 0.3], phone: [-0.36 * s, 0.32], cup: [0.5 * s, 0], lamp: [-0.85 * s / 1.2, 0.2], s });
function dressDesk(g, top, L = KIT_DESK) {
  if (!DETAIL.rich) return;
  const { s } = L;
  const black = [];
  const paper = [];
  g.add(new THREE.Mesh(box(0.44 * s, 0.008, 0.32 * s, L.blotter[0], top + 0.004, L.blotter[1], C.blotter), surface('leather', { roughness: 0.6 })));
  paper.push(box(0.21, 0.002, 0.3, L.blotter[0] - 0.02, top + 0.009, L.blotter[1] + 0.01, '#f4efe2', 0.12));
  // The in-tray: a wire frame on short feet, three sheets in it.
  const [tx, tz] = L.tray;
  black.push(box(0.34, 0.01, 0.25, tx, top + 0.02, tz, C.black));
  for (const d of [-1, 1]) {
    black.push(box(0.01, 0.07, 0.25, tx + d * 0.17, top + 0.05, tz, C.black));
    black.push(box(0.34, 0.01, 0.01, tx, top + 0.085, tz + d * 0.12, C.black));
  }
  for (let i = 0; i < 3; i++) paper.push(box(0.21, 0.004, 0.29, tx + (i - 1) * 0.006, top + 0.028 + i * 0.005, tz, i % 2 ? '#efe8d8' : '#f6f1e6', (i - 1) * 0.05));
  // The telephone: a base, a cradle, the handset across it, a dial.
  const [px, pz] = L.phone;
  black.push(box(0.2, 0.05, 0.15, px, top + 0.025, pz, C.black));
  black.push(box(0.16, 0.03, 0.05, px, top + 0.06, pz - 0.03, C.black));
  black.push(cylinder(0.02, 0.02, 0.2, px, top + 0.09, pz - 0.03, C.black, 8, 'x'));
  for (const d of [-1, 1]) black.push(sphere(0.03, px + d * 0.095, top + 0.085, pz - 0.03, C.black, 8));
  black.push(cylinder(0.045, 0.045, 0.012, px, top + 0.052, pz + 0.04, '#d9d2c0', 16));
  black.push(cylinder(0.03, 0.03, 0.004, px, top + 0.06, pz + 0.04, C.black, 12));
  g.add(new THREE.Mesh(merge(black), vertexMaterial({ roughness: 0.4 })));
  g.add(new THREE.Mesh(worldUVs(merge(paper)), surface('paper')));
  // The lamp's pool on the desk, and the cup by the tray.
  const pool = new THREE.Mesh(cylinder(0.34, 0.34, 0.002, L.lamp[0], top + 0.002, L.lamp[1], '#ffd9a0', 24), washMaterial(0.28));
  pool.renderOrder = 2;
  g.add(pool);
  placeModel(g, 'cup-coffee', { pack: 'food', x: L.cup[0], y: top, z: L.cup[1], rotY: 0.6 });
}

// Built props. A steel filing cabinet with four drawers and brass pulls.
function cabinet(x, z, rotY = 0, h = 1.1) {
  const parts = [box(0.5, h, 0.62, 0, h / 2, 0, C.steel, rotY)];
  for (let i = 0; i < 4; i++) {
    const y = h - 0.14 - i * (h / 4);
    parts.push(box(0.44, h / 4 - 0.04, 0.02, 0, y, -0.31, '#7d827c', rotY));
    parts.push(box(0.12, 0.02, 0.03, 0, y + 0.06, -0.33, C.brass, rotY));
  }
  const geo = merge(parts);
  geo.translate(x, 0, z);
  return new THREE.Mesh(geo, vertexMaterial({ metalness: 0.35, roughness: 0.55 }));
}

// Cardboard archive boxes, taped, stacked two high.
function boxes(x, z) {
  const parts = [];
  for (const [dx, y, dz, r] of [[0, 0.17, 0, 0.1], [0.05, 0.51, 0.02, -0.15]]) {
    parts.push(box(0.5, 0.34, 0.38, dx, y, dz, C.card, r));
    parts.push(box(0.08, 0.342, 0.39, dx, y, dz, '#9a7a4e', r));
  }
  const geo = merge(parts);
  geo.translate(x, 0, z);
  return new THREE.Mesh(geo, vertexMaterial({ roughness: 0.95 }));
}

function rug(w, d, color, x = 0, z = -0.1) {
  return new THREE.Mesh(box(w, 0.012, d, x, 0.006, z, color), vertexMaterial({ roughness: 1 }));
}

// A flag in the party colour on a brass pole, furled a little.
function flag(x, z, color) {
  const pole = new THREE.Mesh(merge([cylinder(0.025, 0.025, 2.4, x, 1.2, z, C.brass, 10), cylinder(0.3, 0.3, 0.05, x, 0.025, z, C.brass, 16), cylinder(0.05, 0.02, 0.1, x, 2.45, z, C.brass, 8)]), brass());
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.position.set(x + 0.26, 1.95, z);
  cloth.rotation.y = -0.4;
  const g = new THREE.Group();
  g.add(pole, cloth);
  return g;
}

// A walnut partners' desk for the whips: a top on two pedestals with a modesty panel.
function walnutDesk(bounds, s = 1) {
  const wd = [box(2.2 * s, 0.08, 1.0 * s, 0, 0.72, 0, C.walnut), box(0.7 * s, 0.68, 0.9 * s, -0.7 * s, 0.34, 0, C.walnut), box(0.7 * s, 0.68, 0.9 * s, 0.7 * s, 0.34, 0, C.walnut), box(0.8 * s, 0.5, 0.06, 0, 0.5, -0.4 * s, C.walnut)];
  return new THREE.Mesh(worldUVs(bakeAO(merge(wd), { bounds })), surface('walnut', { roughness: 0.45 }));
}

// A standing lamp: a pole, a drum shade that glows, and a pool of light from the shade.
function floorLamp(scene, group, x, z) {
  group.add(new THREE.Mesh(merge([cylinder(0.02, 0.02, 1.5, x, 0.75, z, C.brass, 8), cylinder(0.16, 0.16, 0.03, x, 0.015, z, C.brass, 12)]), brass({ roughness: 0.4 })));
  group.add(new THREE.Mesh(cylinder(0.17, 0.2, 0.3, x, 1.55, z, '#f6e3b8', 16), glowMaterial()));
  return lamp(scene, { intensity: tuning().look.deskLamp * 0.6, distance: 4, x, y: 1.45, z });
}

function nameplate(group, name, x, y, z) {
  if (!name) return;
  group.add(new THREE.Mesh(box(0.28, 0.065, 0.03, x, y + 0.035, z, C.brass), brass()));
  group.add(texturedPanel(0.26, 0.055, paintNameplate(name), { x, y: y + 0.037, z: z - 0.017, rotY: Math.PI }));
}

const commonDesk = (g, { scaleX = 1.25, scaleZ = 1.15 } = {}) => {
  const desk = placeModel(g, 'desk', { x: 0, z: 0, rotY: Math.PI });
  desk.scale.set(scaleX, 1, scaleZ);
  placeModel(g, 'chairDesk', { x: DESK_SEAT[0], z: DESK_SEAT[1] + 0.05, rotY: Math.PI });
  placeModel(g, 'chairCushion', { x: -0.5, z: -1.0, rotY: 0 });
  placeModel(g, 'chairCushion', { x: 0.5, z: -1.0, rotY: 0 });
  placeModel(g, 'books', { x: -0.5, y: 0.72, z: -0.12, rotY: 0.3 });
  placeModel(g, 'lampRoundTable', { x: -0.62, y: 0.72, z: 0.12 });
  placeModel(g, 'laptop', { x: 0.25, y: 0.72, z: 0.12, rotY: Math.PI });
  dressDesk(g, 0.72);
};
const deskShadows = [{ x: 0, z: 0, sx: 2.4, sz: 1.4 }, { x: DESK_SEAT[0], z: DESK_SEAT[1], sx: 0.9, sz: 0.9 }, { x: -0.5, z: -1.0, sx: 0.9, sz: 0.9 }, { x: 0.5, z: -1.0, sx: 0.9, sz: 0.9 }];

// Oxblood buttoned leather for a kit sofa or chair, in place of its flat 'carpet' upholstery.
const buttonedSwap = () => ({ carpet: surface('buttoned', { vertexColors: false, color: '#5a1e1e' }) });

export const SETS = {
  // Act 1: a shared room. Two desks, one window, a cabinet, last year's boxes, and a strip light.
  1: {
    W: 2.4, D: 2.1, board: 1.7, boardZ: -0.9, tiles: true,
    empty: { pos: [1.5, 1.55, 1.5], look: [-0.9, 0.85, -0.4], drop: 0.6 },
    windows: [{ wall: '-z', at: -0.3, w: 1.3, h: 1.1, y: 1.7 }],
    pictures: [{ kind: 'map', wall: '-z', at: 1.35, y: 1.75, w: 0.75, h: 0.55 }],
    light: { hemi: 0.46, key: 0.5, fill: 0.3, lamp: 0.7, warm: '#e6eaf2' },
    furnish(g, { W, D, scene, ctx }) {
      commonDesk(g, { scaleX: 1.1, scaleZ: 1.05 });
      // The colleague's desk along the far wall, their screen still on.
      placeModel(g, 'desk', { x: -W + 0.6, z: 0.8, rotY: -Math.PI / 2 });
      placeModel(g, 'chairDesk', { x: -W + 1.25, z: 0.8, rotY: -Math.PI / 2 });
      placeModel(g, 'computerScreen', { x: -W + 0.55, y: 0.72, z: 0.8, rotY: Math.PI / 2 });
      placeModel(g, 'books', { x: -W + 0.6, y: 0.72, z: 1.3, rotY: 1.2 });
      g.add(cabinet(-W + 0.35, -D + 0.42, Math.PI));
      placeModel(g, 'plantSmall2', { x: -W + 0.35, y: 1.1, z: -D + 0.42 });
      g.add(boxes(W - 0.45, -D + 0.45));
      placeModel(g, 'coatRackStanding', { x: -W + 0.45, z: D - 0.4 });
      placeModel(g, 'trashcan', { x: 0.8, z: 1.5 });
      // A fluorescent strip on the ceiling: the light nobody chose.
      g.add(new THREE.Mesh(box(1.3, 0.05, 0.3, 0, H - 0.03, 0.2, '#f4f1e6'), glowMaterial({ vertexColors: false, color: '#eef1f6' })));
      return [...deskShadows, { x: -W + 0.6, z: 0.8, sx: 0.9, sz: 1.5 }, { x: -W + 1.25, z: 0.8, sx: 0.8, sz: 0.8 }, { x: -W + 0.35, z: -D + 0.42, sx: 0.6, sz: 0.7 }, { x: W - 0.45, z: -D + 0.45, sx: 0.6, sz: 0.5 }];
    },
  },
  // Act 2: your own room, with your name on the desk.
  2: {
    W: 3, D: 2.5, board: 2.4, boardZ: -0.2, cornice: true, curtains: true,
    empty: { pos: [1.7, 1.6, 1.9], look: [-0.9, 0.85, -0.5], drop: 0.9 },
    windows: [{ wall: '-z', at: 0, w: 2.0, h: 1.25, y: 1.7 }],
    pictures: [{ kind: 'map', wall: '-z', at: 2.1, y: 1.75, w: 0.8, h: 0.6 }, { kind: 'landscape', wall: '+z', at: -0.6, y: 1.7, w: 0.9, h: 0.6 }],
    furnish(g, { W, D, ctx }) {
      commonDesk(g);
      nameplate(g, ctx.playerName, 0.62, 0.72, -0.3);
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: -1.3, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseOpen', { x: -W + 0.26, z: 1.7, rotY: Math.PI / 2 });
      placeModel(g, 'pottedPlant', { x: -W + 0.5, z: -D + 0.5 });
      placeModel(g, 'coatRackStanding', { x: W - 0.5, z: D - 0.45 });
      placeModel(g, 'trashcan', { x: 1.0, z: 0.7 });
      return [...deskShadows, { x: W - 0.3, z: -1.3, sx: 0.8, sz: 2.0 }, { x: -W + 0.3, z: 1.7, sx: 0.7, sz: 1.2 }, { x: -W + 0.5, z: -D + 0.5, sx: 0.7, sz: 0.7 }];
    },
  },
  // Act 3: the annex off the whip's office. The files arrive in cabinets, and there's coffee.
  3: {
    W: 3, D: 2.5, board: 3.0, boardZ: -0.2, cornice: true, curtains: true,
    empty: { pos: [1.7, 1.6, 1.9], look: [-0.9, 0.85, -0.5], drop: 0.9 },
    windows: [{ wall: '-z', at: 0, w: 2.0, h: 1.25, y: 1.7 }],
    pictures: [{ kind: 'map', wall: '-z', at: 2.1, y: 1.75, w: 0.8, h: 0.6 }, { kind: 'landscape', wall: '+z', at: -0.7, y: 1.7, w: 0.9, h: 0.6 }, { kind: 'portrait', wall: '+z', at: 0.6, y: 1.72, w: 0.5, h: 0.65 }],
    furnish(g, { W, D, ctx }) {
      commonDesk(g);
      nameplate(g, ctx.playerName, 0.62, 0.72, -0.3);
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: -1.3, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseOpen', { x: -W + 0.26, z: 1.7, rotY: Math.PI / 2 });
      g.add(cabinet(-W + 0.35, -1.9, -Math.PI / 2), cabinet(-W + 0.35, -1.25, -Math.PI / 2));
      placeModel(g, 'tableCross', { x: W - 0.5, z: 0.5, scale: 0.6 });
      placeModel(g, 'kitchenCoffeeMachine', { x: W - 0.5, y: 0.5, z: 0.5, rotY: -Math.PI / 2 });
      placeModel(g, 'pottedPlant', { x: -W + 0.5, z: -D + 0.5 });
      placeModel(g, 'coatRackStanding', { x: W - 0.5, z: D - 0.45 });
      placeModel(g, 'trashcan', { x: 1.0, z: 0.7 });
      return [...deskShadows, { x: W - 0.3, z: -1.3, sx: 0.8, sz: 2.0 }, { x: -W + 0.3, z: 1.7, sx: 0.7, sz: 1.2 }, { x: -W + 0.35, z: -1.6, sx: 0.8, sz: 1.5 }, { x: W - 0.5, z: 0.5, sx: 0.8, sz: 0.8 }, { x: -W + 0.5, z: -D + 0.5, sx: 0.7, sz: 0.7 }];
    },
  },
  // Act 4: the deputy's room. Walnut, a rug, the flag, and a wall of files.
  4: {
    W: 3.5, D: 2.8, board: 3.0, boardZ: -0.4, cornice: true, curtains: true, wainscot: 'walnut', wall: '#cfc1a8',
    empty: { pos: [2.0, 1.7, 2.2], look: [-1.1, 0.85, -0.6], drop: 1.2 },
    windows: [{ wall: '-z', at: 0, w: 2.4, h: 1.3, y: 1.7 }],
    pictures: [{ kind: 'map', wall: '-z', at: 2.5, y: 1.75, w: 0.9, h: 0.65 }, { kind: 'landscape', wall: '+z', at: -0.8, y: 1.7, w: 1.0, h: 0.65 }, { kind: 'portrait', wall: '+z', at: 0.6, y: 1.72, w: 0.55, h: 0.7 }],
    light: { hemi: 0.3, key: 0.65, fill: 0.25, lamp: 1.15, warm: '#ffe6cf' },
    furnish(g, { W, D, ctx, bounds }) {
      g.add(rug(3.4, 2.4, C.rug));
      g.add(walnutDesk(bounds));
      placeModel(g, 'chairDesk', { x: DESK_SEAT[0], z: DESK_SEAT[1] + 0.05, rotY: Math.PI });
      placeModel(g, 'chairCushion', { x: -0.5, z: -1.0, rotY: 0 });
      placeModel(g, 'chairCushion', { x: 0.5, z: -1.0, rotY: 0 });
      placeModel(g, 'lampRoundTable', { x: -0.85, y: 0.76, z: 0.2 });
      placeModel(g, 'books', { x: -0.55, y: 0.76, z: -0.15, rotY: 0.3 });
      placeModel(g, 'laptop', { x: 0.3, y: 0.76, z: 0.1, rotY: Math.PI });
      dressDesk(g, 0.76, WALNUT_DESK(1.2));
      nameplate(g, ctx.playerName, 0.75, 0.76, -0.35);
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: -1.6, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: 0.4, rotY: -Math.PI / 2 });
      g.add(cabinet(-W + 0.35, -2.1, -Math.PI / 2), cabinet(-W + 0.35, -1.45, -Math.PI / 2), cabinet(-W + 0.35, -0.8, -Math.PI / 2));
      g.add(flag(-W + 1.2, D - 0.6, ctx.playerColor || '#555'));
      placeModel(g, 'loungeChair', { x: -W + 0.9, z: 1.4, rotY: Math.PI / 2 + 0.5, swap: buttonedSwap() });
      placeModel(g, 'pottedPlant', { x: W - 0.5, z: -D + 0.5 });
      placeModel(g, 'coatRackStanding', { x: W - 0.5, z: D - 0.45 });
      return [{ x: 0, z: 0, sx: 2.8, sz: 1.5 }, ...deskShadows.slice(1), { x: W - 0.3, z: -1.6, sx: 0.8, sz: 2.0 }, { x: W - 0.3, z: 0.4, sx: 0.8, sz: 2.0 }, { x: -W + 0.35, z: -1.45, sx: 0.8, sz: 2.1 }, { x: -W + 0.9, z: 1.4, sx: 1.0, sz: 1.0 }, { x: W - 0.5, z: -D + 0.5, sx: 0.7, sz: 0.7 }];
    },
  },
  // Act 5: the chief whip's corner office. Two windows, the whips' table under the board, a sofa for the
  // conversations that don't happen across a desk.
  5: {
    W: 4, D: 3.2, board: 3.4, boardZ: -0.9, cornice: true, curtains: true, wainscot: 'walnut', wall: '#cfc1a8',
    empty: { pos: [2.4, 1.8, 2.6], look: [-1.5, 0.85, -0.8], drop: 1.5 },
    windows: [{ wall: '-z', at: 0.6, w: 2.6, h: 1.4, y: 1.75 }, { wall: '-x', at: 1.9, w: 1.8, h: 1.4, y: 1.75 }],
    pictures: [{ kind: 'map', wall: '-z', at: 3.1, y: 1.8, w: 0.9, h: 0.65 }, { kind: 'portrait', wall: '+z', at: -0.9, y: 1.72, w: 0.55, h: 0.7 }, { kind: 'portrait', wall: '+z', at: 0.5, y: 1.72, w: 0.55, h: 0.7 }],
    light: { hemi: 0.34, key: 0.75, fill: 0.28, lamp: 1.1, warm: '#ffe6cf' },
    furnish(g, { W, D, ctx, bounds, scene, lamps }) {
      g.add(rug(3.8, 2.6, C.rugGreen));
      g.add(walnutDesk(bounds, 1.15));
      placeModel(g, 'chairDesk', { x: DESK_SEAT[0], z: DESK_SEAT[1] + 0.05, rotY: Math.PI });
      placeModel(g, 'chairCushion', { x: -0.5, z: -1.0, rotY: 0 });
      placeModel(g, 'chairCushion', { x: 0.5, z: -1.0, rotY: 0 });
      placeModel(g, 'lampRoundTable', { x: -0.95, y: 0.76, z: 0.2 });
      placeModel(g, 'books', { x: -0.6, y: 0.76, z: -0.15, rotY: 0.3 });
      placeModel(g, 'laptop', { x: 0.3, y: 0.76, z: 0.1, rotY: Math.PI });
      dressDesk(g, 0.76, WALNUT_DESK(1.25));
      nameplate(g, ctx.playerName, 0.85, 0.76, -0.4);
      // The whips' table under the board.
      placeModel(g, 'tableCross', { x: -W + 1.5, z: -0.9, scale: 1.4 });
      placeModel(g, 'chairCushion', { x: -W + 1.5, z: -0.15, rotY: Math.PI });
      placeModel(g, 'chairCushion', { x: -W + 1.5, z: -1.65, rotY: 0 });
      placeModel(g, 'chairCushion', { x: -W + 0.75, z: -0.9, rotY: Math.PI / 2 });
      placeModel(g, 'chairCushion', { x: -W + 2.25, z: -0.9, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: -1.2, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: 0.8, rotY: -Math.PI / 2 });
      // A buttoned-leather chesterfield under the window.
      placeModel(g, 'loungeSofaLong', { x: 1.7, z: -D + 0.82, rotY: 0, swap: buttonedSwap() });
      placeModel(g, 'tableCross', { x: 0.9, z: -D + 0.6, scale: 0.7 });
      placeModel(g, 'plantSmall2', { x: 0.9, y: 0.5, z: -D + 0.6 });
      lamps.push(floorLamp(scene, g, 3.7, -D + 0.45));
      g.add(flag(W - 0.9, -D + 1.6, ctx.playerColor || '#555'));
      placeModel(g, 'tableCross', { x: -2.2, z: D - 0.55, scale: 0.8 });
      placeModel(g, 'kitchenCoffeeMachine', { x: -2.2, y: 0.6, z: D - 0.55, rotY: Math.PI });
      placeModel(g, 'pottedPlant', { x: -W + 0.5, z: -D + 0.5 });
      placeModel(g, 'coatRackStanding', { x: W - 0.5, z: D - 0.45 });
      return [{ x: 0, z: 0, sx: 3.2, sz: 1.7 }, ...deskShadows.slice(1), { x: -W + 1.5, z: -0.9, sx: 2.2, sz: 2.2 }, { x: W - 0.3, z: -1.2, sx: 0.8, sz: 2.0 }, { x: W - 0.3, z: 0.8, sx: 0.8, sz: 2.0 }, { x: 2.6, z: -D + 0.8, sx: 2.0, sz: 1.5 }, { x: -2.2, z: D - 0.55, sx: 0.9, sz: 0.9 }, { x: -W + 0.5, z: -D + 0.5, sx: 0.7, sz: 0.7 }];
    },
  },
  // The whip's office, for the Act 1 reversal: a walnut desk, the flag, the blinds shut.
  whip: {
    W: 3, D: 2.5, board: 3.0, boardZ: -0.2, blinds: 'closed', cornice: true, curtains: true, wainscot: 'walnut', wall: '#cfc1a8',
    windows: [{ wall: '-z', at: 0, w: 2.0, h: 1.25, y: 1.7 }],
    pictures: [{ kind: 'map', wall: '-z', at: 2.1, y: 1.75, w: 0.8, h: 0.6 }, { kind: 'portrait', wall: '+z', at: 0.55, y: 1.72, w: 0.5, h: 0.65 }],
    light: { hemi: 0.26, key: 0.3, fill: 0.25, lamp: 1.4, warm: '#ffe6cf' },
    furnish(g, { W, D, ctx, bounds }) {
      g.add(walnutDesk(bounds));
      placeModel(g, 'chairDesk', { x: DESK_SEAT[0], z: DESK_SEAT[1] + 0.05, rotY: Math.PI });
      placeModel(g, 'chairCushion', { x: -0.5, z: -1.0, rotY: 0 });
      placeModel(g, 'chairCushion', { x: 0.5, z: -1.0, rotY: 0 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: -1.3, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: 0.3, rotY: -Math.PI / 2 });
      placeModel(g, 'lampRoundTable', { x: -0.85, y: 0.76, z: 0.2 });
      dressDesk(g, 0.76, WALNUT_DESK(1.2));
      g.add(flag(-1.4, 1.9, ctx.playerColor || '#555'));
      return [{ x: 0, z: 0, sx: 2.8, sz: 1.5 }, { x: -0.5, z: -1.0, sx: 0.9, sz: 0.9 }, { x: 0.5, z: -1.0, sx: 0.9, sz: 0.9 }, { x: W - 0.3, z: -0.5, sx: 0.8, sz: 3.4 }];
    },
  },
};

export const setFor = (act) => SETS[Math.max(1, Math.min(5, act || 1))];

// Build one whole room (shell, windows, blinds, board, furniture) as a group that can be shown or hidden.
function buildRoom(scene, set, ctx, lawn, boardTex, lamps, fx) {
  const { W, D } = set;
  const bounds = { x0: -W, x1: W, z0: -D, z1: D };
  const room = new THREE.Group();
  room.add(buildMeshes(buildShell(set), bounds));
  for (const win of set.windows) {
    const { at, rot } = windowGeometry(win, W, D);
    const slats = [];
    for (let i = 0; i < Math.floor(win.h / 0.095); i++) {
      const y = win.y + win.h / 2 - 0.05 - i * 0.095;
      const [x, z] = at(0, 0.1);
      slats.push(set.blinds === 'closed' ? box(win.w, 0.094, 0.03, x, y, z, '#d9cfb8', rot) : box(win.w, 0.035, 0.07, x, y, z, C.paper, rot));
    }
    room.add(new THREE.Mesh(merge(slats), vertexMaterial({ roughness: 0.8 })));
    const [px, pz] = at(0, 0.02);
    room.add(texturedPanel(win.w, win.h, lawn, { x: px, y: win.y, z: pz, rotY: rot }));
    // Snow or rain falling just outside the glass, between the painted view and the blinds.
    const [fx0, fz0] = at(0, 0.055);
    const p = createPrecipitation({ w: win.w, h: win.h, d: 0.03, size: 0.028 });
    p.group.position.set(fx0, win.y, fz0);
    p.group.rotation.y = rot;
    room.add(p.group);
    fx.push(p);
  }
  room.add(texturedPanel(set.board, 1.2, boardTex, { x: -W + 0.03, y: 1.75, z: set.boardZ, rotY: Math.PI / 2 }));
  // The riding's map always; the prints and portraits when the room is built rich.
  hangPictures(room, (set.pictures || []).filter((p) => DETAIL.rich || p.kind === 'map').map((p) => ({ ...p })), { W, D, ridingName: ctx.ridingName });
  const spots = set.furnish(room, { W, D, ctx, bounds, scene, lamps });
  room.add(contactShadows(spots, { radius: 0.55 }));
  return room;
}

export function create(ctx) {
  const act = ctx.act || 1;
  const mySet = setFor(act);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1a17');
  scene.environment = ctx.environment || null;
  // Dusk through the window behind the visitors, a cool fill, and the warm pool of the desk lamp.
  const rig = roomLights(scene, { hemi: 0.32, key: 0.7, fill: 0.25, warm: '#ffe6cf', keyPos: [-2, 3, -6], fillPos: [4, 3, 3] });
  const deskLamp = lamp(scene, { intensity: tuning().look.deskLamp, distance: 5, x: -0.6, y: 1.25, z: 0.1 });

  const lawn = paintedTexture(512, 320, paintLawn);
  const boardTex = paintedTexture(512, 256, (g, w, h) => drawBoard(g, w, h, [], 'Coming up'));
  const myLamps = [];
  const fx = [];
  let weather = DEFAULT_WEATHER;
  let weatherKey = null;
  const mine = buildRoom(scene, mySet, ctx, lawn, boardTex, myLamps, fx);
  scene.add(mine);
  // The whip's office only ever appears in Act 1, when the whip calls you in.
  let whipRoom = null;
  const whipSet = SETS.whip;

  // In the shared room a colleague from your cohort works late at the other desk.
  let colleague = null;
  if (act === 1 && ctx.colleague) {
    colleague = createFigure(ctx.colleague.color, ctx.colleague.id, wardrobe(ctx.colleague.id, ctx.colleague.color), ctx.colleague.face);
    colleague.group.position.set(-mySet.W + 1.2, 0, 0.8);
    colleague.group.rotation.y = -Math.PI / 2;
    poseFigure(colleague, 'typing', 1);
    mine.add(colleague.group);
  }

  function light(set, on) {
    const L = { hemi: 0.32, key: 0.7, fill: 0.25, lamp: 1, warm: '#ffe6cf', ...(set.light || {}) };
    // The season sets the daylight left in the window: a brighter, warmer key in June, a cold weak one in
    // January, when the lamps do the work.
    const cold = Math.max(weather.snow * 0.6, weather.dark * 0.5);
    rig.key.intensity = L.key * (1.15 - 0.45 * weather.dark);
    rig.key.color.set(mix('#fff6e8', '#cfd8ee', cold));
    rig.hemi.intensity = L.hemi;
    rig.fill.intensity = L.fill;
    rig.hemi.color.set(mix(L.warm, '#e3e8f2', cold * 0.5));
    deskLamp.intensity = tuning().look.deskLamp * L.lamp;
    for (const l of myLamps) l.visible = on;
  }
  light(mySet, true);

  function dress(asWhip) {
    if (asWhip && !whipRoom) {
      whipRoom = buildRoom(scene, whipSet, ctx, lawn, boardTex, [], fx);
      for (const p of fx) p.setKind(weather.falling);
      scene.add(whipRoom);
    }
    mine.visible = !asWhip;
    if (whipRoom) whipRoom.visible = asWhip;
    light(asWhip ? whipSet : mySet, !asWhip);
  }

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 40);
  const cam = createOfficeCamera(camera, { empty: mySet.empty });

  // The player sits behind the desk (or, in the reversal, in the other visitor chair).
  const player = createFigure(ctx.playerColor || '#555', 'player', wardrobe(ctx.playerId || 'player', ctx.playerColor || '#555'));
  player.setHeadVisible(false);
  scene.add(player.group);
  let deskFigure = null;
  let visitor = null;
  let reversal = false;
  let t = 0;
  // What they're saying, set beside them in the room.
  const speech = createSpeech();

  function seatPlayer(rev) {
    reversal = rev;
    if (rev) {
      player.group.position.set(0.5, 0, -1.0);
      player.group.rotation.y = 0;
    } else {
      player.group.position.set(DESK_SEAT[0], 0, DESK_SEAT[1]);
      player.group.rotation.y = Math.PI;
    }
    poseFigure(player, 'cooperative', 1);
    dress(rev);
  }
  seatPlayer(false);

  const room = {
    name: 'office',
    scene,
    camera,
    act,
    // Show who's here. In the reversal the whip takes the desk chair and the player sits opposite.
    setVisitor(v) {
      if (!v) {
        visitor?.leave(() => {
          visitor?.dispose();
          visitor = null;
        });
        deskFigure && scene.remove(deskFigure.group);
        deskFigure = null;
        seatPlayer(false);
        cam.shot('empty');
        return;
      }
      if (visitor?.mpId === v.mpId || deskFigure?.mpId === v.mpId) {
        room.setMood(v.mood);
        if (v.face) visitor ? visitor.setFace(v.face) : deskFigure.setFace(v.face, { grow: true });
        return;
      }
      visitor?.dispose();
      visitor = null;
      if (deskFigure) scene.remove(deskFigure.group);
      deskFigure = null;
      if (v.reversal) {
        seatPlayer(true);
        const f = createFigure(v.color, v.mpId, wardrobe(v.mpId, v.color), v.face);
        f.group.position.set(DESK_SEAT[0], 0, DESK_SEAT[1]);
        f.group.rotation.y = Math.PI;
        poseFigure(f, v.mood, 1);
        f.mpId = v.mpId;
        scene.add(f.group);
        deskFigure = f;
        speech.attach(f);
        cam.shot('reversal', v.snap);
        return;
      }
      seatPlayer(false);
      visitor = createVisitor(scene, { color: v.color, mpId: v.mpId, path: visitorPath(mySet.W, mySet.D), seat: VISITOR_SEAT, facing: 0, outfit: wardrobe(v.mpId, v.color), face: v.face, faceFrom: v.snap ? null : v.faceFrom });
      visitor.mpId = v.mpId;
      visitor.setMood(v.mood);
      speech.attach(visitor.figure);
      // Someone shown already seated is cut to; someone walking in is followed: the camera dollies from the
      // door view to its place over your shoulder while they cross the room and sit.
      if (v.snap) {
        visitor.sitNow();
        cam.shot('host', true);
      } else if (reducedMotion()) cam.shot('host');
      else cam.dolly('host', tuning().look.feel.dolly);
    },
    // Their current line, or nothing. It shows once they're in the chair.
    setSpeech(text) {
      speech.set(text);
    },
    // How much of a portrait screen is clear above the sheet: the camera frames the visitor in it.
    setClear(f) {
      cam.setClear(f);
    },
    setMood(m) {
      visitor?.setMood(m);
      deskFigure?.setPose(m);
    },
    // The slow push-in when the deal table opens.
    pushIn(on) {
      cam.shot(reversal ? (on ? 'reversalDeal' : 'reversal') : on ? 'hostDeal' : 'host');
    },
    // The time of year, from the sim's calendar: repaints the view, sets what's falling, and tunes the light.
    setWeather(wx) {
      const key = `${wx.season}:${wx.kind}:${wx.snow}:${wx.wet}:${wx.dark}`;
      if (key === weatherKey) return;
      weatherKey = key;
      weather = wx;
      const c = lawn.userData.canvas;
      paintLawn(c.getContext('2d'), c.width, c.height, wx);
      lawn.needsUpdate = true;
      for (const p of fx) p.setKind(wx.falling);
      light(reversal ? whipSet : mySet, !reversal);
    },
    setBoard(rows, title = 'Coming up') {
      const c = boardTex.userData.canvas;
      drawBoard(c.getContext('2d'), c.width, c.height, rows, title);
      boardTex.needsUpdate = true;
    },
    get visitorPhase() {
      return visitor?.phase || (deskFigure ? 'seated' : null);
    },
    update(dt) {
      visitor?.update(dt);
      deskFigure?.update(dt);
      player.update(dt);
      speech.update(dt, visitor ? visitor.phase === 'seated' : !!deskFigure);
      cam.update(dt);
      for (const p of fx) p.update(dt);
      if (colleague) {
        // Typing, mostly: the hands working at the keys (the glances over come with the pose).
        t += dt;
        colleague.hold({ eLx: Math.sin(t * 7) * 0.05, eRx: Math.cos(t * 6) * 0.05, headY: Math.sin(t * 1.1) * 0.03 });
        colleague.update(dt);
      }
    },
    resize(w, h) {
      camera.aspect = w / h;
      cam.fitAspect(camera.aspect, w);
      camera.updateProjectionMatrix();
    },
    dispose() {
      speech.dispose();
      visitor?.dispose();
      scene.traverse((o) => o.userData.cancel?.());
      disposeTree(scene);
    },
  };
  return room;
}
