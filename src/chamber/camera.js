// Chamber camera: one-finger orbit within limits, pinch zoom, tap and double-tap, easing to frame a party block.
import * as THREE from 'three';

const DEG = Math.PI / 180;
export const CAMERA_LIMITS = {
  azimuth: 60 * DEG, // sideways from the default view down the chamber
  polarMin: 30 * DEG, // from vertical
  polarMax: 75 * DEG,
  distMin: 6,
  distMax: 26,
};
const DEFAULT_POS = new THREE.Vector3(0, 9, 19);
const DEFAULT_TARGET = new THREE.Vector3(0, 1.5, -3);
const TAP_MS = 280;
const TAP_MOVE = 10;
const DOUBLE_MS = 320;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function sphericalFrom(pos, target) {
  const off = pos.clone().sub(target);
  const r = off.length();
  return { r, polar: Math.acos(off.y / r), azimuth: Math.atan2(off.x, off.z) };
}

export function createChamberCamera(camera, el) {
  const def = sphericalFrom(DEFAULT_POS, DEFAULT_TARGET);
  const goal = { ...def, target: DEFAULT_TARGET.clone() };
  const cur = { ...def, target: DEFAULT_TARGET.clone() };

  const pointers = new Map();
  let pinchStart = null;
  let down = null;
  let lastTap = null;
  const tapCbs = [];
  const dblCbs = [];

  function ndcOf(e) {
    const r = el.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  function clampGoal() {
    const L = CAMERA_LIMITS;
    goal.azimuth = clamp(goal.azimuth, -L.azimuth, L.azimuth);
    goal.polar = clamp(goal.polar, L.polarMin, L.polarMax);
    goal.r = clamp(goal.r, L.distMin, L.distMax);
  }

  function pinchDist() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onDown(e) {
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers can't be captured; the gesture still works without it.
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    if (pointers.size === 2) {
      pinchStart = { d: pinchDist(), r: goal.r };
      down = null;
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    const p = pointers.get(e.pointerId);
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 2 && pinchStart) {
      const d = pinchDist();
      if (d > 0) goal.r = (pinchStart.r * pinchStart.d) / d;
      clampGoal();
      return;
    }
    if (pointers.size === 1) {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_MOVE) down.moved = true;
      if (down && !down.moved) return;
      const h = el.clientHeight || 800;
      goal.azimuth -= (dx / h) * 2.4;
      goal.polar -= (dy / h) * 2.0;
      clampGoal();
    }
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (down && pointers.size === 0 && !down.moved && performance.now() - down.t < TAP_MS) {
      const ndc = ndcOf(e);
      const now = performance.now();
      if (lastTap && now - lastTap.t < DOUBLE_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
        dblCbs.forEach((cb) => cb(ndc));
        lastTap = null;
      } else {
        tapCbs.forEach((cb) => cb(ndc));
        lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    }
    if (pointers.size === 0) down = null;
  }

  function onWheel(e) {
    e.preventDefault();
    goal.r *= 1 + e.deltaY * 0.001;
    clampGoal();
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  function apply() {
    const r = cur.r;
    const sp = Math.sin(cur.polar);
    camera.position.set(
      cur.target.x + r * sp * Math.sin(cur.azimuth),
      cur.target.y + r * Math.cos(cur.polar),
      cur.target.z + r * sp * Math.cos(cur.azimuth)
    );
    camera.lookAt(cur.target);
  }
  apply();

  return {
    goal,
    onTap: (cb) => tapCbs.push(cb),
    onDoubleTap: (cb) => dblCbs.push(cb),
    update(dt) {
      const k = 1 - Math.exp(-dt * 8);
      cur.r += (goal.r - cur.r) * k;
      cur.polar += (goal.polar - cur.polar) * k;
      cur.azimuth += (goal.azimuth - cur.azimuth) * k;
      cur.target.lerp(goal.target, k);
      apply();
    },
    // Portrait phones see a narrow slice, so widen the lens until about 36 degrees fit across.
    // (Backing the camera off instead would put it outside the walls.)
    fitAspect(aspect) {
      const want = 2 * Math.atan(Math.tan(18 * DEG) / aspect) / DEG;
      camera.fov = clamp(want, 50, 75);
      camera.updateProjectionMatrix();
    },
    reset() {
      Object.assign(goal, { r: def.r, polar: def.polar, azimuth: def.azimuth });
      goal.target.copy(DEFAULT_TARGET);
    },
    // Ease to frame a set of seats (a party block): aim at their centre and pull in to fit them.
    frame(seats) {
      if (!seats.length) return;
      const c = new THREE.Vector3();
      let span = 0;
      for (const s of seats) c.add(new THREE.Vector3(s.x, s.y + 0.8, s.z));
      c.divideScalar(seats.length);
      for (const s of seats) span = Math.max(span, Math.hypot(s.x - c.x, s.z - c.z));
      goal.target.copy(c);
      goal.r = span * 2.2 + 5;
      clampGoal();
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    },
  };
}
