// The office: where evenings happen. It grows with rank: a shared room in Act 1, your own room in Act 2, the
// annex off the whip's office in Act 3, the deputy's room in Act 4 and the chief whip's corner office in
// Act 5. The whip's own office is built alongside and swapped in for the Act 1 reversal (the whip calls you
// in). Furniture from the Kenney kit, retinted; cabinets, rugs, flags and nameplates built here.
import * as THREE from 'three';
import { box, slab, panel, cylinder, merge, vertexMaterial, glowMaterial, worldUVs, disposeTree, roomLights, lamp, bakeAO, contactShadows, paintedTexture, texturedPanel } from '../kit3d.js';
import { surface } from '../textures.js';
import { placeModel } from '../models.js';
import { tuning } from '../sim/config.js';
import { createOfficeCamera } from './officeCamera.js';
import { createVisitor, createFigure, poseFigure } from './visitor.js';
import { wardrobe } from '../figures.js';
import { createPrecipitation, DEFAULT_WEATHER, GREY_SKIES, mix } from '../weatherFx.js';

const H = 3.2;
const C = { plaster: '#d6ccb8', plasterDark: '#b9ab93', floor: '#5e4b3a', oak: '#6e4a2b', oakDark: '#3f2a17', walnut: '#3b2616', paper: '#ece6d6', brass: '#c9a24a', steel: '#6f746f', card: '#b8956a', rug: '#5b2b2b', rugGreen: '#2f4a3a' };

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
  return { parts, at, rot };
}

function buildShell(set) {
  const { W, D } = set;
  const g = { plaster: [], oak: [], walnut: [], wool: [] };
  g.wool.push(slab(-W, -0.05, -D, W, 0, D, C.floor, 1));
  g.plaster.push(panel(2 * D, H, -W, H / 2, 0, C.plaster, '+x', 1));
  g.plaster.push(panel(2 * D, H, W, H / 2, 0, C.plaster, '-x', 1));
  g.plaster.push(panel(2 * W, H, 0, H / 2, -D, C.plaster, '+z', 1));
  g.plaster.push(panel(2 * W, H, 0, H / 2, D, C.plasterDark, '-z', 1));
  g.plaster.push(panel(2 * W, 2 * D, 0, H, 0, '#e9e2d3', 'down', 1));
  // Oak wainscot to 1.0 m with panel strips, a top rail and a skirting, on every wall. Every layer stands a
  // clear centimetre proud of the one behind it: coplanar faces shimmer on a phone's shallower depth buffer.
  const wain = 1.0;
  for (const [len, x, z, facing] of [[2 * D, -W + 0.01, 0, '+x'], [2 * D, W - 0.01, 0, '-x'], [2 * W, 0, -D + 0.01, '+z'], [2 * W, 0, D - 0.01, '-z']]) {
    const inward = facing === '+x' || facing === '+z' ? 0.01 : -0.01;
    const along = facing === '+x' || facing === '-x';
    const at = (s, out) => (along ? [x + out, z + s] : [x + s, z + out]);
    const [rx, rz] = at(0, inward);
    g.oak.push(panel(len, wain, x, wain / 2, z, C.oak, facing, 1));
    g.oak.push(panel(len, 0.07, rx, wain, rz, C.oakDark, facing));
    g.oak.push(panel(len, 0.1, rx, 0.05, rz, C.oakDark, facing));
    for (let s = -len / 2 + 0.6; s < len / 2; s += 0.9) {
      // No strips behind the door: they would show through it.
      if (facing === '-x' && Math.abs(z + s - doorZ(D)) < 0.6) continue;
      const [sx, sz] = at(s, inward);
      g.oak.push(panel(0.05, wain - 0.25, sx, wain / 2 - 0.02, sz, C.oakDark, facing));
    }
  }
  // The door on the +x wall, in a frame, standing proud of the wainscot rails.
  const dz = doorZ(D);
  g.walnut.push(panel(0.95, 2.1, W - 0.03, 1.05, dz, C.walnut, '-x'));
  g.oak.push(panel(1.15, 0.08, W - 0.04, 2.14, dz, C.oakDark, '-x'));
  for (const d of [-0.55, 0.55]) g.oak.push(panel(0.08, 2.2, W - 0.04, 1.1, dz + d, C.oakDark, '-x'));
  for (const win of set.windows) g.oak.push(...windowGeometry(win, W, D).parts);
  return g;
}

function buildMeshes(g, bounds) {
  const out = new THREE.Group();
  const kinds = { plaster: 'plaster', oak: 'oak', walnut: 'walnut', wool: 'wool' };
  for (const [kind, parts] of Object.entries(g)) {
    if (!parts.length) continue;
    const geo = worldUVs(bakeAO(merge(parts), { bounds, ceilY: kind === 'plaster' ? H : null, reach: 0.7 }));
    out.add(new THREE.Mesh(geo, surface(kinds[kind], kind === 'plaster' ? { roughness: 0.95 } : {})));
  }
  return out;
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
  const pole = new THREE.Mesh(merge([cylinder(0.025, 0.025, 2.4, x, 1.2, z, C.brass, 10), cylinder(0.3, 0.3, 0.05, x, 0.025, z, C.brass, 16), cylinder(0.05, 0.02, 0.1, x, 2.45, z, C.brass, 8)]), vertexMaterial({ metalness: 0.7, roughness: 0.35, envMapIntensity: 1 }));
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
  group.add(new THREE.Mesh(merge([cylinder(0.02, 0.02, 1.5, x, 0.75, z, C.brass, 8), cylinder(0.16, 0.16, 0.03, x, 0.015, z, C.brass, 12)]), vertexMaterial({ metalness: 0.6, roughness: 0.4 })));
  group.add(new THREE.Mesh(cylinder(0.17, 0.2, 0.3, x, 1.55, z, '#f6e3b8', 16), glowMaterial()));
  return lamp(scene, { intensity: tuning().look.deskLamp * 0.6, distance: 4, x, y: 1.45, z });
}

function nameplate(group, name, x, y, z) {
  if (!name) return;
  group.add(new THREE.Mesh(box(0.28, 0.065, 0.03, x, y + 0.035, z, C.brass), vertexMaterial({ metalness: 0.7, roughness: 0.35, envMapIntensity: 1 })));
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
};
const deskShadows = [{ x: 0, z: 0, sx: 2.4, sz: 1.4 }, { x: DESK_SEAT[0], z: DESK_SEAT[1], sx: 0.9, sz: 0.9 }, { x: -0.5, z: -1.0, sx: 0.9, sz: 0.9 }, { x: 0.5, z: -1.0, sx: 0.9, sz: 0.9 }];

export const SETS = {
  // Act 1: a shared room. Two desks, one window, a cabinet, last year's boxes, and a strip light.
  1: {
    W: 2.4, D: 2.1, board: 1.7, boardZ: -0.9,
    empty: { pos: [1.5, 1.55, 1.5], look: [-0.9, 0.85, -0.4], drop: 0.6 },
    windows: [{ wall: '-z', at: -0.3, w: 1.3, h: 1.1, y: 1.7 }],
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
    W: 3, D: 2.5, board: 2.4, boardZ: -0.2,
    empty: { pos: [1.7, 1.6, 1.9], look: [-0.9, 0.85, -0.5], drop: 0.9 },
    windows: [{ wall: '-z', at: 0, w: 2.0, h: 1.25, y: 1.7 }],
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
    W: 3, D: 2.5, board: 3.0, boardZ: -0.2,
    empty: { pos: [1.7, 1.6, 1.9], look: [-0.9, 0.85, -0.5], drop: 0.9 },
    windows: [{ wall: '-z', at: 0, w: 2.0, h: 1.25, y: 1.7 }],
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
    W: 3.5, D: 2.8, board: 3.0, boardZ: -0.4,
    empty: { pos: [2.0, 1.7, 2.2], look: [-1.1, 0.85, -0.6], drop: 1.2 },
    windows: [{ wall: '-z', at: 0, w: 2.4, h: 1.3, y: 1.7 }],
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
      nameplate(g, ctx.playerName, 0.75, 0.76, -0.35);
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: -1.6, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: 0.4, rotY: -Math.PI / 2 });
      g.add(cabinet(-W + 0.35, -2.1, -Math.PI / 2), cabinet(-W + 0.35, -1.45, -Math.PI / 2), cabinet(-W + 0.35, -0.8, -Math.PI / 2));
      g.add(flag(-W + 1.2, D - 0.6, ctx.playerColor || '#555'));
      placeModel(g, 'loungeChair', { x: -W + 0.9, z: 1.4, rotY: Math.PI / 2 + 0.5 });
      placeModel(g, 'pottedPlant', { x: W - 0.5, z: -D + 0.5 });
      placeModel(g, 'coatRackStanding', { x: W - 0.5, z: D - 0.45 });
      return [{ x: 0, z: 0, sx: 2.8, sz: 1.5 }, ...deskShadows.slice(1), { x: W - 0.3, z: -1.6, sx: 0.8, sz: 2.0 }, { x: W - 0.3, z: 0.4, sx: 0.8, sz: 2.0 }, { x: -W + 0.35, z: -1.45, sx: 0.8, sz: 2.1 }, { x: -W + 0.9, z: 1.4, sx: 1.0, sz: 1.0 }, { x: W - 0.5, z: -D + 0.5, sx: 0.7, sz: 0.7 }];
    },
  },
  // Act 5: the chief whip's corner office. Two windows, the whips' table under the board, a sofa for the
  // conversations that don't happen across a desk.
  5: {
    W: 4, D: 3.2, board: 3.4, boardZ: -0.9,
    empty: { pos: [2.4, 1.8, 2.6], look: [-1.5, 0.85, -0.8], drop: 1.5 },
    windows: [{ wall: '-z', at: 0.6, w: 2.6, h: 1.4, y: 1.75 }, { wall: '-x', at: 1.9, w: 1.8, h: 1.4, y: 1.75 }],
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
      nameplate(g, ctx.playerName, 0.85, 0.76, -0.4);
      // The whips' table under the board.
      placeModel(g, 'tableCross', { x: -W + 1.5, z: -0.9, scale: 1.4 });
      placeModel(g, 'chairCushion', { x: -W + 1.5, z: -0.15, rotY: Math.PI });
      placeModel(g, 'chairCushion', { x: -W + 1.5, z: -1.65, rotY: 0 });
      placeModel(g, 'chairCushion', { x: -W + 0.75, z: -0.9, rotY: Math.PI / 2 });
      placeModel(g, 'chairCushion', { x: -W + 2.25, z: -0.9, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: -1.2, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: 0.8, rotY: -Math.PI / 2 });
      placeModel(g, 'loungeSofa', { x: 2.2, z: -D + 0.5, rotY: 0 });
      placeModel(g, 'tableCross', { x: 0.9, z: -D + 0.6, scale: 0.7 });
      placeModel(g, 'plantSmall2', { x: 0.9, y: 0.5, z: -D + 0.6 });
      lamps.push(floorLamp(scene, g, 3.3, -D + 0.5));
      g.add(flag(W - 0.9, -D + 1.6, ctx.playerColor || '#555'));
      placeModel(g, 'tableCross', { x: -2.2, z: D - 0.55, scale: 0.8 });
      placeModel(g, 'kitchenCoffeeMachine', { x: -2.2, y: 0.6, z: D - 0.55, rotY: Math.PI });
      placeModel(g, 'pottedPlant', { x: -W + 0.5, z: -D + 0.5 });
      placeModel(g, 'coatRackStanding', { x: W - 0.5, z: D - 0.45 });
      return [{ x: 0, z: 0, sx: 3.2, sz: 1.7 }, ...deskShadows.slice(1), { x: -W + 1.5, z: -0.9, sx: 2.2, sz: 2.2 }, { x: W - 0.3, z: -1.2, sx: 0.8, sz: 2.0 }, { x: W - 0.3, z: 0.8, sx: 0.8, sz: 2.0 }, { x: 2.2, z: -D + 0.5, sx: 1.9, sz: 0.9 }, { x: -2.2, z: D - 0.55, sx: 0.9, sz: 0.9 }, { x: -W + 0.5, z: -D + 0.5, sx: 0.7, sz: 0.7 }];
    },
  },
  // The whip's office, for the Act 1 reversal: a walnut desk, the flag, the blinds shut.
  whip: {
    W: 3, D: 2.5, board: 3.0, boardZ: -0.2, blinds: 'closed',
    windows: [{ wall: '-z', at: 0, w: 2.0, h: 1.25, y: 1.7 }],
    light: { hemi: 0.26, key: 0.3, fill: 0.25, lamp: 1.4, warm: '#ffe6cf' },
    furnish(g, { W, D, ctx, bounds }) {
      g.add(walnutDesk(bounds));
      placeModel(g, 'chairDesk', { x: DESK_SEAT[0], z: DESK_SEAT[1] + 0.05, rotY: Math.PI });
      placeModel(g, 'chairCushion', { x: -0.5, z: -1.0, rotY: 0 });
      placeModel(g, 'chairCushion', { x: 0.5, z: -1.0, rotY: 0 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: -1.3, rotY: -Math.PI / 2 });
      placeModel(g, 'bookcaseClosedWide', { x: W - 0.26, z: 0.3, rotY: -Math.PI / 2 });
      placeModel(g, 'lampRoundTable', { x: -0.85, y: 0.76, z: 0.2 });
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
    poseFigure(colleague, 'cooperative', 1);
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
        cam.shot('reversal', v.snap);
        return;
      }
      seatPlayer(false);
      visitor = createVisitor(scene, { color: v.color, mpId: v.mpId, path: visitorPath(mySet.W, mySet.D), seat: VISITOR_SEAT, facing: 0, outfit: wardrobe(v.mpId, v.color), face: v.face, faceFrom: v.snap ? null : v.faceFrom });
      visitor.mpId = v.mpId;
      visitor.setMood(v.mood);
      if (v.snap) visitor.sitNow();
      cam.shot('host', v.snap);
    },
    setMood(m) {
      visitor?.setMood(m);
      if (deskFigure) poseFigure(deskFigure, m, 1);
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
      deskFigure?.tick(dt);
      cam.update(dt);
      for (const p of fx) p.update(dt);
      if (colleague) {
        // Typing, mostly; now and then a glance over at whoever's in the chair.
        t += dt;
        colleague.head.rotation.y = Math.sin(t * 0.35) > 0.92 ? -0.9 : Math.sin(t * 1.1) * 0.05;
        colleague.arms[0].el.rotation.x = -1.3 + Math.sin(t * 7) * 0.05;
        colleague.arms[1].el.rotation.x = -1.3 + Math.cos(t * 6) * 0.05;
      }
    },
    resize(w, h) {
      camera.aspect = w / h;
      cam.fitAspect(camera.aspect, w);
      camera.updateProjectionMatrix();
    },
    dispose() {
      visitor?.dispose();
      scene.traverse((o) => o.userData.cancel?.());
      disposeTree(scene);
    },
  };
  return room;
}
