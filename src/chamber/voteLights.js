// Division lights: each seat lights yea, nay, absent or paired, with an icon so votes read without colour.
import * as THREE from 'three';

export const VOTE_COLORS = { yea: '#2E9E5B', nay: '#C8423B', absent: '#6B6F76', paired: '#FFFFFF', off: '#2a2d33' };
const ICON_Y = 1.85;

// Draw the three icons once into small canvas textures.
function iconTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = kind === 'yea' ? VOTE_COLORS.yea : kind === 'nay' ? VOTE_COLORS.nay : VOTE_COLORS.absent;
  g.beginPath();
  g.arc(32, 32, 29, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  if (kind === 'yea') {
    g.moveTo(17, 33);
    g.lineTo(28, 44);
    g.lineTo(47, 21);
  } else if (kind === 'nay') {
    g.moveTo(20, 20);
    g.lineTo(44, 44);
    g.moveTo(44, 20);
    g.lineTo(20, 44);
  } else {
    g.moveTo(18, 32);
    g.lineTo(46, 32);
  }
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createVoteLights(records) {
  const n = records.length;
  const group = new THREE.Group();
  const lamp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), new THREE.MeshBasicMaterial(), n);
  const icons = {};
  for (const kind of ['yea', 'nay', 'absent']) {
    icons[kind] = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: iconTexture(kind), transparent: true, depthWrite: false }), n);
    icons[kind].count = 0;
    icons[kind].frustumCulled = false;
    group.add(icons[kind]);
  }
  group.add(lamp);
  // A short vertical flash above a seat as it lights: additive, fading over flashFor seconds.
  const flash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 1.0), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), n);
  flash.count = 0;
  flash.frustumCulled = false;
  group.add(flash);
  const flashes = [];
  const flashFor = 0.45;
  const color = new THREE.Color();
  const m = new THREE.Matrix4();
  const byId = new Map(records.map((s, i) => [s.seatId, i]));
  const state = new Array(n).fill('off');
  records.forEach((s, i) => {
    const f = s.side === 'gov' ? 1 : -1;
    m.makeTranslation(s.x + f * 0.55, s.y + 0.77, s.z);
    lamp.setMatrixAt(i, m);
    lamp.setColorAt(i, color.set(VOTE_COLORS.off));
  });
  lamp.instanceMatrix.needsUpdate = true;
  lamp.visible = false;

  let queue = [];
  let timer = 0;
  let step = 0.08;
  let pulse = [];
  let pulseT = 0;
  let onTick = null;
  let onDone = null;
  let showIcons = true;
  let bellsOn = false;
  let bellT = 0;

  function set(seatId, kind) {
    const i = byId.get(seatId);
    if (i == null) return;
    state[i] = kind;
    lamp.setColorAt(i, color.set(VOTE_COLORS[kind] || VOTE_COLORS.off));
    lamp.instanceColor.needsUpdate = true;
  }

  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  function layoutIcons(camera) {
    q.copy(camera.quaternion);
    const counts = { yea: 0, nay: 0, absent: 0 };
    if (showIcons) {
      for (let i = 0; i < n; i++) {
        const k = state[i] === 'paired' ? 'absent' : state[i];
        if (!icons[k]) continue;
        const s = records[i];
        pos.set(s.x, s.y + ICON_Y, s.z);
        m.compose(pos, q, one);
        icons[k].setMatrixAt(counts[k]++, m);
      }
    }
    for (const k of Object.keys(icons)) {
      icons[k].count = counts[k];
      icons[k].instanceMatrix.needsUpdate = true;
    }
  }

  return {
    group,
    get playing() {
      return queue.length > 0;
    },
    reset() {
      queue = [];
      pulse = [];
      for (const s of records) set(s.seatId, 'off');
      lamp.visible = false;
    },
    setIcons(on) {
      showIcons = on;
    },
    // Absent seats go grey and paired ones pulse at once; then the yeas light row by row, then the nays.
    play(result, seatOfMp, { secondsPerSeat = 0.08, tick, done } = {}) {
      this.reset();
      lamp.visible = true;
      step = secondsPerSeat;
      onTick = tick;
      onDone = done;
      for (const id of result.absent) set(seatOfMp(id), 'absent');
      pulse = result.paired.flat().map(seatOfMp).filter(Boolean);
      for (const sid of pulse) set(sid, 'paired');
      pulseT = 0;
      queue = [...result.yeas.map((id) => ['yea', seatOfMp(id)]), ...result.nays.map((id) => ['nay', seatOfMp(id)])];
      this.counts = { yea: 0, nay: 0 };
      timer = 0;
      if (!queue.length) done?.();
    },
    finish() {
      while (queue.length) {
        const [k, sid] = queue.shift();
        set(sid, k);
        this.counts[k]++;
      }
      onTick?.(this.counts);
      const d = onDone;
      onDone = null;
      d?.();
    },
    update(dt, camera) {
      if (queue.length) {
        timer += dt;
        while (timer >= step && queue.length) {
          timer -= step;
          const [k, sid] = queue.shift();
          set(sid, k);
          this.counts[k]++;
          flashes.push({ i: byId.get(sid), k, t: 0 });
          onTick?.(this.counts);
          if (!queue.length) {
            const d = onDone;
            onDone = null;
            d?.();
          }
        }
      }
      if (pulse.length) {
        pulseT += dt;
        const v = 0.5 + 0.5 * Math.cos(pulseT * 6);
        for (const sid of pulse) {
          const i = byId.get(sid);
          lamp.setColorAt(i, color.setRGB(v, v, v));
        }
        lamp.instanceColor.needsUpdate = true;
        if (pulseT > 1.2) {
          for (const sid of pulse) set(sid, 'paired');
          pulse = [];
        }
      }
      if (bellsOn && !queue.length) {
        bellT += dt;
        const v = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(bellT * 3.2));
        color.set('#e0a526').multiplyScalar(v);
        for (let i = 0; i < n; i++) if (state[i] === 'off') lamp.setColorAt(i, color);
        lamp.instanceColor.needsUpdate = true;
      }
      // Flashes rise a little and fade.
      let live = 0;
      for (const f of flashes) {
        f.t += dt;
        if (f.t > flashFor) continue;
        const s = records[f.i];
        const a = 1 - f.t / flashFor;
        pos.set(s.x, s.y + 1.3 + f.t * 0.6, s.z);
        m.compose(pos, q.copy(camera.quaternion), one);
        flash.setMatrixAt(live, m);
        flash.setColorAt(live, color.set(VOTE_COLORS[f.k]).multiplyScalar(a * a));
        live++;
      }
      while (flashes.length && flashes[0].t > flashFor) flashes.shift();
      flash.count = live;
      if (live) {
        flash.instanceMatrix.needsUpdate = true;
        if (flash.instanceColor) flash.instanceColor.needsUpdate = true;
      }
      if (lamp.visible) layoutIcons(camera);
    },
    // The bells are ringing: every unlit seat lamp pulses amber until the count starts.
    bells(on) {
      bellsOn = on;
      bellT = 0;
      if (on) {
        lamp.visible = true;
      } else if (!queue.length && state.every((s) => s === 'off')) {
        for (const s of records) set(s.seatId, 'off');
        lamp.visible = false;
      }
    },
  };
}
