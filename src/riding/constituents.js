// Constituent figures with a colour for their role, and the town hall crowd from the shared figure kit.
import * as THREE from 'three';
import { createVisitor } from '../office/visitor.js';
import { contactShadows, vertexMaterial, box, merge, paintedTexture, texturedPanel } from '../kit3d.js';
import { createFigureCrowd, lookFor, shade } from '../figures.js';

export const ROLE_COLORS = {
  mayor: '#1f3a5f',
  farmer: '#6b8e3a',
  plantManager: '#6b6f76',
  unionSteward: '#a8322d',
  schoolBoard: '#6a4c93',
  reporter: '#b08a4e',
  associationPresident: '#c9a24a',
};
// The reporter stays on their feet; everyone else takes the chair.
const STANDS = new Set(['reporter']);

export function createConstituent(scene, { role, id, path, seat, facing }) {
  const v = createVisitor(scene, { color: ROLE_COLORS[role] || '#777', mpId: id, path, seat, facing });
  if (STANDS.has(role)) {
    const setMood = v.setMood;
    v.setMood = () => setMood('standing');
    v.setMood();
  }
  return v;
}

// 20-30 people standing in the street for a town hall, facing the podium: six draw calls plus their shadows.
// Their mood shows in how they stand: leaning in with you, arms back and placards up against you.
export function createCrowd(count, colorFor) {
  const crowd = createFigureCrowd(count, { pose: 'standing' });
  const feet = [];
  const spots = [];
  for (let i = 0; i < count; i++) {
    const id = `crowd-${i}`;
    const look = lookFor(id);
    const row = Math.floor(i / 7);
    const col = i % 7;
    const x = (col - 3) * 0.78 + (row % 2) * 0.38 + look.yaw;
    const z = 4.6 + row * 0.95 + look.lean * 2;
    spots.push({ x, z, look });
    crowd.dress(i, { ...look, suit: shade(colorFor(i), id, 0.1) });
    feet.push({ x, z, sx: 0.9, sz: 0.9 });
  }
  const g = crowd.group;
  g.add(contactShadows(feet, { radius: 0.5 }));
  // Four placards for when the room has turned: hand-lettered cardboard on sticks, held up by the
  // back rows. Each board is its own canvas so the week's slogans can be painted on at the door.
  const placards = PLACARD_SPOTS.map(({ i, dx }, k) => createPlacard(spots[i], dx, k));
  placards.forEach((p) => g.add(p.group));

  function place(mood) {
    const lean = mood > 60 ? 0.08 : mood < 40 ? -0.07 : 0.01;
    spots.forEach((s, i) => crowd.place(i, { x: s.x, z: s.z, rotY: Math.PI, scale: s.look.height, yaw: s.look.yaw * 2, lean: lean + s.look.lean * 0.3 }));
    crowd.commit();
  }
  place(50);

  return {
    group: g,
    // The crowd's mood: pressing in when they're with you, hanging back with placards when not.
    setMood(v) {
      g.position.z = v < 40 ? 0.5 : v > 60 ? -0.35 : 0;
      // The first two boards (one per topic) go up as the room cools; all four once it has turned.
      const up = v < 35 ? 4 : v < 45 ? 2 : 0;
      placards.forEach((p, k) => (p.group.visible = k < up));
      place(v);
    },
    // The week's slogans, already filled in, one per board; a board with nothing to say stays blank.
    setPlacards(lines) {
      placards.forEach((p, k) => p.paint(lines[k] || ''));
    },
    update(dt) {
      crowd.update(dt);
    },
  };
}

// Which crowd spots hold a sign (and in which hand), spread so all four read from the podium in
// portrait; then how each board sits: paper tone, marker colour, a tilt of its own.
const PLACARD_SPOTS = [
  { i: 10, dx: 0.25 },
  { i: 16, dx: 0.3 },
  { i: 24, dx: -0.3 },
  { i: 25, dx: 0.25 },
];
const PLACARD_LOOKS = [
  { paper: '#ece6d6', ink: '#1d1a16', tiltZ: -0.07, turn: 0.12 },
  { paper: '#f3e7c8', ink: '#9b2a22', tiltZ: 0.05, turn: -0.09 },
  { paper: '#e4dcc8', ink: '#1d1a16', tiltZ: -0.03, turn: 0.04 },
  { paper: '#f6efdc', ink: '#24406b', tiltZ: 0.09, turn: -0.15 },
];
const BOARD_W = 0.55;
const BOARD_H = 0.4;

// A board on a stick, pivoting at the hand so the whole sign leans with its holder. The crowd faces
// the podium (-z), so the lettered face turns the same way to meet the camera.
function createPlacard(spot, dx, k) {
  const look = PLACARD_LOOKS[k];
  const group = new THREE.Group();
  group.position.set(spot.x + dx, 1.1, spot.z + 0.05);
  group.rotation.set(0, Math.PI + look.turn, look.tiltZ);
  group.add(new THREE.Mesh(merge([box(0.04, 0.9, 0.04, 0, 0.4, 0, '#6e4a2b'), box(BOARD_W, BOARD_H, 0.03, 0, 0.95, 0, look.paper)]), vertexMaterial({ roughness: 0.9 })));
  const tex = paintedTexture(512, 372, () => {});
  const face = texturedPanel(BOARD_W, BOARD_H, tex, { y: 0.95, z: 0.017 });
  face.material.transparent = true;
  group.add(face);
  let painted = null;
  return {
    group,
    paint(text) {
      if (text === painted) return;
      painted = text;
      paintSlogan(tex.userData.canvas.getContext('2d'), 512, 372, text, look);
      tex.needsUpdate = true;
    },
  };
}

// Marker lettering on cardboard: the words wrapped into as few lines as fit, at the largest size that
// fits, with a strip of tape at the top and the lettering a touch off square.
function paintSlogan(g, w, h, text, look) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = look.paper;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.05)';
  g.fillRect(0, h - 10, w, 10);
  g.fillRect(w - 8, 0, 8, h);
  g.fillStyle = 'rgba(214,196,150,0.75)';
  g.fillRect(w / 2 - 70, -6, 140, 26);
  if (!text) return;
  const pad = 36;
  const { size, lines } = fitLines(g, text.toUpperCase(), w - pad * 2, h - pad * 2);
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(look.tiltZ * 0.4);
  g.font = markerFont(size);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = look.ink;
  const lineH = size * 1.08;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineH;
    // A second, offset pass thickens the strokes the way a felt marker does on its second go.
    g.globalAlpha = 0.55;
    g.fillText(line, 2, y + 1.5);
    g.globalAlpha = 1;
    g.fillText(line, 0, y);
  });
  g.restore();
}

const markerFont = (size) => `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;

// The largest size at which the words, wrapped greedily, fit the board's inside.
function fitLines(g, text, maxW, maxH) {
  const words = text.split(' ');
  for (let size = 104; size >= 36; size -= 4) {
    g.font = markerFont(size);
    const lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (g.measureText(trial).width <= maxW || !line) line = trial;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    if (widest <= maxW && lines.length * size * 1.08 <= maxH) return { size, lines };
  }
  return { size: 36, lines: [text] };
}
