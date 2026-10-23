// The shared look: palette tokens, renderer tone mapping, and the one environment map every room lights from.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Oak, green leather and stone (DESIGN.md). Rooms take their colours from here so they agree with each other.
export const PALETTE = {
  oak: '#6e4a2b',
  oakLight: '#8a5f38',
  oakDark: '#3f2a17',
  leather: '#2f5a3c',
  leatherLight: '#3a6a48',
  baize: '#2e5e3e',
  stone: '#b9b0a0',
  stoneDark: '#8f877a',
  plaster: '#d9d2c0',
  brass: '#c9a24a',
  gold: '#d8b04c',
  paper: '#ece6d6',
  ink: '#1d1a16',
  lampWarm: '#ffd9a0',
  paneWarm: '#f1dfb0',
};

// How much a room builds: `rich` adds the coffered ceiling, the sconces, the extra lamps and the dressing on
// the desks. main.js sets it from the settings (and `?lite=1`) before any room is built; rooms read it as they
// build, so a change rebuilds the current room.
export const DETAIL = { rich: true };

export function setupRenderer(renderer, look) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;
}

// A neutral studio environment, generated once and shared: it gives every surface soft reflected light
// without any image files, which is most of what "baked lighting" looks like on a phone.
let environment = null;
export function sharedEnvironment(renderer) {
  if (environment) return environment;
  const pmrem = new THREE.PMREMGenerator(renderer);
  environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();
  return environment;
}
