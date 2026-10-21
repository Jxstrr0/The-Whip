// Falling snow and rain for the rooms with a window on the world: one Points cloud for snow, one set of
// line segments for rain, in a box that wraps vertically. Cosmetic only; nothing here reads the sim.
import * as THREE from 'three';
import { softTex } from './kit3d.js';

// What a room assumes before the sim has said: September, clear, an early dusk.
export const DEFAULT_WEATHER = { season: 'autumn', kind: 'clear', snow: 0, wet: 0, dark: 0.35, temp: 18, falling: null };
// Weather kinds that grey the sky.
export const GREY_SKIES = new Set(['overcast', 'rain', 'snow', 'storm', 'fog']);
const col = new THREE.Color();
export const mix = (a, b, k) => '#' + col.set(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, k))).getHexString();

const SNOW_PER_M2 = 36; // flakes per square metre of frontal area
const RAIN_PER_M2 = 26;

export function createPrecipitation({ w = 2, h = 2, d = 0.1, size = 0.04 } = {}) {
  const group = new THREE.Group();
  const area = w * h;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Snow: slow, swaying, soft round dots.
  const nSnow = Math.max(12, Math.round(area * SNOW_PER_M2));
  const snowPos = new Float32Array(nSnow * 3);
  const snowBase = new Float32Array(nSnow * 2); // x, phase
  const snowSpeed = new Float32Array(nSnow);
  for (let i = 0; i < nSnow; i++) {
    snowPos[i * 3] = rnd(-w / 2, w / 2);
    snowPos[i * 3 + 1] = rnd(-h / 2, h / 2);
    snowPos[i * 3 + 2] = rnd(-d / 2, d / 2);
    snowBase[i * 2] = snowPos[i * 3];
    snowBase[i * 2 + 1] = rnd(0, Math.PI * 2);
    snowSpeed[i] = rnd(0.35, 0.75);
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#f6f8fc', size, alphaMap: softTex(), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  snow.frustumCulled = false;
  snow.visible = false;
  group.add(snow);

  // Rain: fast, faint, slightly slanted streaks.
  const nRain = Math.max(12, Math.round(area * RAIN_PER_M2));
  const rainPos = new Float32Array(nRain * 6);
  const rainLen = new Float32Array(nRain);
  for (let i = 0; i < nRain; i++) {
    const x = rnd(-w / 2, w / 2);
    const y = rnd(-h / 2, h / 2);
    const z = rnd(-d / 2, d / 2);
    rainLen[i] = rnd(0.06, 0.14) * Math.max(0.6, Math.min(2, h / 2));
    rainPos.set([x, y, z, x + rainLen[i] * 0.12, y + rainLen[i], z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c9d4e2', transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }));
  rain.frustumCulled = false;
  rain.visible = false;
  group.add(rain);

  let kind = null;
  let t = 0;
  return {
    group,
    // 'snow', 'storm' (all the flakes, faster), 'rain' or null.
    setKind(next) {
      kind = next;
      snow.visible = next === 'snow' || next === 'storm';
      rain.visible = next === 'rain';
      snowGeo.setDrawRange(0, next === 'storm' ? nSnow : Math.round(nSnow * 0.55));
    },
    update(dt) {
      if (!kind) return;
      t += dt;
      if (kind === 'rain') {
        const p = rainGeo.attributes.position.array;
        const v = 6.5 * dt;
        for (let i = 0; i < nRain; i++) {
          let y = p[i * 6 + 1] - v;
          if (y < -h / 2) y += h;
          p[i * 6 + 1] = y;
          p[i * 6 + 4] = y + rainLen[i];
        }
        rainGeo.attributes.position.needsUpdate = true;
        return;
      }
      const p = snowGeo.attributes.position.array;
      const gust = kind === 'storm' ? 2.2 : 1;
      const sway = Math.min(0.18, w * 0.06);
      for (let i = 0; i < nSnow; i++) {
        let y = p[i * 3 + 1] - snowSpeed[i] * gust * dt;
        if (y < -h / 2) y += h;
        p[i * 3 + 1] = y;
        p[i * 3] = snowBase[i * 2] + Math.sin(t * 1.3 + snowBase[i * 2 + 1]) * sway + (kind === 'storm' ? Math.sin(t * 0.7) * sway * 2 : 0);
      }
      snowGeo.attributes.position.needsUpdate = true;
    },
    dispose() {
      snowGeo.dispose();
      rainGeo.dispose();
      snow.material.dispose();
      rain.material.dispose();
    },
  };
}
