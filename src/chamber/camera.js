// Chamber camera with two views. Overview: an orbit above the bar within limits, pinch to zoom, double-tap to
// frame a party block. Home: your own seat, a fixed viewpoint looking across the aisle; drag turns your head,
// pinch narrows the lens. Acts 1 and 2 open at home, so the backbench feels like a seat, not a map.
import * as THREE from 'three';

const DEG = Math.PI / 180;
export const CAMERA_LIMITS = {
  azimuth: 60 * DEG, // sideways from the default view down the chamber
  polarMin: 30 * DEG, // from vertical
  polarMax: 75 * DEG,
  distMin: 6,
  distMax: 26,
  homeYaw: 75 * DEG, // how far you can turn your head either way from your seat
  homePitch: [-0.5, 0.3],
  homeZoom: [0.8, 1.7],
};
const DEFAULT_POS = new THREE.Vector3(0, 9, 19);
const DEFAULT_TARGET = new THREE.Vector3(0, 1.5, -3);
// The three-quarter shot for a division, where the sweep of lights across both sides reads.
const DIVISION_SHOT = { r: 19, polar: 66 * DEG, azimuth: 18 * DEG, target: new THREE.Vector3(0, 1.2, -2) };
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
  // Home view state: where your head is, which way it's turned, how narrow the lens is.
  const home = { pos: new THREE.Vector3(0, 1.5, 0), yaw0: 0, yaw: 0, pitch: -0.1, zoom: 1, gYaw: 0, gPitch: -0.1, gZoom: 1, set: false };
  let mode = 'overview';
  let baseFov = 60;
  let homeFov = 62;
  let aimDrop = 0;
  let lastAspect = 1;

  const pointers = new Map();
  let pinchStart = null;
  let down = null;
  let lastTap = null;
  const tapCbs = [];
  const dblCbs = [];
  const modeCbs = [];

  function ndcOf(e) {
    const r = el.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  function clampGoal() {
    const L = CAMERA_LIMITS;
    goal.azimuth = clamp(goal.azimuth, -L.azimuth, L.azimuth);
    goal.polar = clamp(goal.polar, L.polarMin, L.polarMax);
    goal.r = clamp(goal.r, L.distMin, L.distMax);
    home.gYaw = clamp(home.gYaw, home.yaw0 - L.homeYaw, home.yaw0 + L.homeYaw);
    home.gPitch = clamp(home.gPitch, L.homePitch[0], L.homePitch[1]);
    home.gZoom = clamp(home.gZoom, L.homeZoom[0], L.homeZoom[1]);
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
      pinchStart = { d: pinchDist(), r: goal.r, zoom: home.gZoom };
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
      if (d > 0) {
        if (mode === 'home') home.gZoom = (pinchStart.zoom * d) / pinchStart.d;
        else goal.r = (pinchStart.r * pinchStart.d) / d;
      }
      clampGoal();
      return;
    }
    if (pointers.size === 1) {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_MOVE) down.moved = true;
      if (down && !down.moved) return;
      const h = el.clientHeight || 800;
      if (mode === 'home') {
        home.gYaw += (dx / h) * 1.8;
        home.gPitch += (dy / h) * 1.2;
      } else {
        goal.azimuth -= (dx / h) * 2.4;
        goal.polar -= (dy / h) * 2.0;
      }
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
    if (mode === 'home') home.gZoom *= 1 - e.deltaY * 0.001;
    else goal.r *= 1 + e.deltaY * 0.001;
    clampGoal();
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  const look = new THREE.Vector3();
  function apply() {
    if (mode === 'home') {
      camera.position.copy(home.pos);
      const cp = Math.cos(home.pitch - aimDrop);
      look.set(home.pos.x + Math.sin(home.yaw) * cp, home.pos.y + Math.sin(home.pitch - aimDrop), home.pos.z + Math.cos(home.yaw) * cp);
      camera.lookAt(look);
      camera.fov = homeFov / home.zoom;
    } else {
      const r = cur.r;
      const sp = Math.sin(cur.polar);
      camera.position.set(
        cur.target.x + r * sp * Math.sin(cur.azimuth),
        cur.target.y + r * Math.cos(cur.polar),
        cur.target.z + r * sp * Math.cos(cur.azimuth)
      );
      camera.lookAt(cur.target);
      camera.fov = baseFov;
    }
    camera.updateProjectionMatrix();
  }
  apply();

  function setMode(m) {
    if (m === 'home' && !home.set) m = 'overview';
    if (m === mode) return;
    mode = m;
    if (mode === 'home') {
      home.gYaw = home.yaw0;
      home.gPitch = -0.1;
      home.gZoom = 1;
      // Start the head turn from where you were looking, so switching views isn't a snap.
      home.yaw = home.yaw0;
      home.pitch = -0.1;
      home.zoom = 1;
    }
    modeCbs.forEach((cb) => cb(mode));
  }

  let auto = false;
  let autoT = 0;

  return {
    goal,
    get mode() {
      return mode;
    },
    // A tiny impulse on a state change, so the picture settles rather than sits.
    nudge() {
      const k = (Math.random() - 0.5) * 0.05;
      if (mode === 'home') home.yaw += k;
      else cur.azimuth += k;
    },
    // The title page: the overview drifting slowly from side to side.
    autoOrbit(on) {
      auto = on;
      if (on) {
        setMode('overview');
        // Low enough to stay under the ceiling in landscape, looking down the chamber at the Speaker.
        goal.r = 16;
        goal.polar = 70 * DEG;
        goal.target.set(0, 1.5, -3);
      }
    },
    onTap: (cb) => tapCbs.push(cb),
    onDoubleTap: (cb) => dblCbs.push(cb),
    onModeChange: (cb) => modeCbs.push(cb),
    setMode,
    // Your seat: the camera sits just above and behind your own head, facing across the aisle and a little
    // toward the Speaker. The seat record gives the position and which side you're on.
    setHome(seat) {
      const toAisle = seat.x < 0 ? 1 : -1;
      home.pos.set(seat.x - toAisle * 0.3, seat.y + 1.55, seat.z);
      home.yaw0 = Math.atan2(toAisle, -0.5);
      home.set = true;
      if (mode === 'home') {
        home.gYaw = home.yaw = home.yaw0;
      }
    },
    update(dt) {
      if (auto) {
        autoT += dt;
        goal.azimuth = Math.sin(autoT * 0.1) * 0.55;
      }
      const k = 1 - Math.exp(-dt * 8);
      cur.r += (goal.r - cur.r) * k;
      cur.polar += (goal.polar - cur.polar) * k;
      cur.azimuth += (goal.azimuth - cur.azimuth) * k;
      cur.target.lerp(goal.target, k);
      const kh = 1 - Math.exp(-dt * 6);
      home.yaw += (home.gYaw - home.yaw) * kh;
      home.pitch += (home.gPitch - home.pitch) * kh;
      home.zoom += (home.gZoom - home.zoom) * kh;
      apply();
    },
    // Portrait phones see a narrow slice, so widen the lens until about 36 degrees fit across.
    // (Backing the camera off instead would put it outside the walls.) At home, aim a little lower in
    // portrait so the people across the aisle sit above the bottom sheet.
    fitAspect(aspect) {
      lastAspect = aspect;
      baseFov = clamp(2 * Math.atan(Math.tan(18 * DEG) / aspect) / DEG, 50, 75);
      homeFov = clamp(2 * Math.atan(Math.tan(21 * DEG) / aspect) / DEG, 48, 80);
      aimDrop = aspect < 1 ? 0.2 : 0;
      apply();
    },
    reset() {
      if (mode === 'home') {
        home.gYaw = home.yaw0;
        home.gPitch = -0.1;
        home.gZoom = 1;
        return;
      }
      Object.assign(goal, { r: def.r, polar: def.polar, azimuth: def.azimuth });
      goal.target.copy(DEFAULT_TARGET);
    },
    // Question Period: an overview shot from across the aisle on one member on their feet, aimed below them
    // so they sit in the part of the screen the sheet leaves clear (the top band in portrait).
    shot(seat) {
      const portrait = lastAspect < 1;
      goal.azimuth = (seat.x < 0 ? 1 : -1) * 52 * DEG;
      goal.polar = 48 * DEG;
      goal.r = portrait ? 7.5 : 5.5;
      // The sheet covers the lower half in portrait and the right half in landscape, so aim well below the
      // member in portrait (they stand in the band under the masthead) and to their right in landscape
      // (they stand in the clear left half, hips at the centre of the frame).
      const side = portrait ? 0 : 2.3;
      goal.target.set(seat.x + Math.cos(goal.azimuth) * side, seat.y + (portrait ? -1.8 : 0.7), seat.z - Math.sin(goal.azimuth) * side);
      clampGoal();
    },
    // The overview shot for a division, and back to the default afterwards.
    divisionShot(on) {
      if (on) {
        Object.assign(goal, { r: DIVISION_SHOT.r, polar: DIVISION_SHOT.polar, azimuth: DIVISION_SHOT.azimuth });
        goal.target.copy(DIVISION_SHOT.target);
      } else {
        Object.assign(goal, { r: def.r, polar: def.polar, azimuth: def.azimuth });
        goal.target.copy(DEFAULT_TARGET);
      }
    },
    // Ease to frame a set of seats (a party block). From the overview: aim at their centre and pull in to fit
    // them. From your seat: turn your head toward them and narrow the lens.
    frame(seats) {
      if (!seats.length) return;
      const c = new THREE.Vector3();
      let span = 0;
      for (const s of seats) c.add(new THREE.Vector3(s.x, s.y + 0.8, s.z));
      c.divideScalar(seats.length);
      for (const s of seats) span = Math.max(span, Math.hypot(s.x - c.x, s.z - c.z));
      if (mode === 'home') {
        const dx = c.x - home.pos.x;
        const dz = c.z - home.pos.z;
        const flat = Math.hypot(dx, dz);
        home.gYaw = Math.atan2(dx, dz);
        home.gPitch = Math.atan2(c.y - home.pos.y, flat) + aimDrop;
        home.gZoom = clamp(flat / (span * 2.5 + 5), 1, CAMERA_LIMITS.homeZoom[1]);
        clampGoal();
        return;
      }
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
