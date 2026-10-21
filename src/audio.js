// Sound. Everything is synthesised in WebAudio, so no audio file is ever fetched: a room tone for each of
// the four rooms, the division bells, the Speaker's gavel and a paper tick on taps. Nothing plays until the
// first tap (browsers insist), nothing here touches game state, and every level lives in LEVELS below.
const LEVELS = {
  bed: 1.0, // all room tones together, before the player's volume
  chamber: { body: 0.4, voices: 0.14 },
  caucus: { body: 0.36, voices: 0.13 },
  office: { tone: 0.14, tick: 0.1 },
  riding: { wind: 0.14, pass: 0.14, bird: 0.08 },
  bells: 0.42,
  gavel: 0.75,
  tap: 0.35,
  cheer: { roar: 0.32, clap: 0.22, whoop: 0.05 },
  fade: 0.9, // seconds to cross from one room's tone to the next
};

export function createAudio({ sound = true, volume = 0.7 } = {}) {
  let ctx = null;
  let master = null;
  let noise = null; // one shared pink-noise buffer
  let bed = null; // { gain, stop } for the room playing now
  let bellTimer = null;
  let wanted = { sound, volume };
  let roomName = null;

  const masterLevel = () => (wanted.sound ? wanted.volume : 0);

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = masterLevel();
    master.connect(ctx.destination);
    noise = pinkNoise(ctx);
    if (roomName) startBed(roomName);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else if (wanted.sound) ctx.resume();
    });
    return ctx;
  }

  // ---- sources ----

  function pinkNoise(ac) {
    const seconds = 3;
    const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
    const d = buf.getChannelData(0);
    // Paul Kellet's pink-noise filter over white noise. Not sim randomness, so Math.random is fine here.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  function noiseSource() {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.start();
    return s;
  }

  // Filtered noise with a slow wobble on its level: the basis of every room tone.
  function layer(out, { type, freq, q = 1, level, lfoHz, depth = 0.4 }) {
    const src = noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(f).connect(g).connect(out);
    const nodes = [src, f, g];
    if (lfoHz) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = lfoHz;
      const lg = ctx.createGain();
      lg.gain.value = level * depth;
      lfo.connect(lg).connect(g.gain);
      lfo.start();
      nodes.push(lfo, lg);
    }
    return { gain: g, nodes };
  }

  function tone(out, { freq, to = freq, type = 'sine', level, attack = 0.005, decay, at = ctx.currentTime }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (to !== freq) o.frequency.exponentialRampToValueAtTime(to, at + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + decay + 0.05);
  }

  function burst(out, { freq, q = 1, type = 'bandpass', level, decay, at = ctx.currentTime }) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    s.connect(f).connect(g).connect(out);
    s.start(at, Math.random() * 2);
    s.stop(at + decay + 0.05);
  }

  // ---- room tones ----

  // Each builder returns { nodes, timers } so the bed can be torn down cleanly.
  const BEDS = {
    chamber(out) {
      const L = LEVELS.chamber;
      const body = layer(out, { type: 'bandpass', freq: 380, q: 0.6, level: L.body, lfoHz: 0.07, depth: 0.35 });
      const voices = layer(out, { type: 'bandpass', freq: 950, q: 2.5, level: L.voices, lfoHz: 0.21, depth: 0.6 });
      // Now and then the benches stir: a swell in the voices that settles again.
      const timers = every(5, 13, () => {
        const t0 = ctx.currentTime;
        voices.gain.gain.cancelScheduledValues(t0);
        voices.gain.gain.setTargetAtTime(L.voices * 2.4, t0, 0.6);
        voices.gain.gain.setTargetAtTime(L.voices, t0 + 1.8, 1.2);
      });
      return { nodes: [...body.nodes, ...voices.nodes], timers, voices };
    },
    caucus(out) {
      const L = LEVELS.caucus;
      const body = layer(out, { type: 'bandpass', freq: 520, q: 0.8, level: L.body, lfoHz: 0.09, depth: 0.3 });
      const voices = layer(out, { type: 'bandpass', freq: 1200, q: 3, level: L.voices, lfoHz: 0.3, depth: 0.5 });
      return { nodes: [...body.nodes, ...voices.nodes], timers: [] };
    },
    office(out) {
      const L = LEVELS.office;
      const room = layer(out, { type: 'lowpass', freq: 260, q: 0.5, level: L.tone, lfoHz: 0.05, depth: 0.2 });
      // A clock on the wall, one tick a second.
      const timers = every(1, 1, () => burst(out, { freq: 2600, q: 4, level: L.tick, decay: 0.035 }));
      return { nodes: room.nodes, timers };
    },
    riding(out) {
      const L = LEVELS.riding;
      const wind = layer(out, { type: 'highpass', freq: 900, q: 0.4, level: L.wind, lfoHz: 0.04, depth: 0.6 });
      const timers = [
        // A car going by somewhere behind the shops.
        ...every(9, 22, () => {
          const t0 = ctx.currentTime;
          const s = noiseSource();
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.Q.value = 1.2;
          f.frequency.setValueAtTime(180, t0);
          f.frequency.linearRampToValueAtTime(520, t0 + 2.2);
          f.frequency.linearRampToValueAtTime(160, t0 + 4.4);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(L.pass, t0 + 2.2);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.6);
          s.connect(f).connect(g).connect(out);
          s.stop(t0 + 4.8);
        }),
        // Two or three birds, not a dawn chorus.
        ...every(3, 8, () => {
          const t0 = ctx.currentTime;
          const n = 2 + Math.floor(Math.random() * 2);
          for (let i = 0; i < n; i++) {
            const f = 2600 + Math.random() * 1400;
            tone(out, { freq: f, to: f * 1.25, level: L.bird, attack: 0.01, decay: 0.09, at: t0 + i * 0.14 });
          }
        }),
      ];
      return { nodes: wind.nodes, timers };
    },
  };

  // Call fn every min..max seconds (random in between) until the timer list is cleared.
  function every(min, max, fn) {
    const timers = [];
    const tick = () => {
      fn();
      timers[0] = setTimeout(tick, (min + Math.random() * (max - min)) * 1000);
    };
    timers[0] = setTimeout(tick, (min + Math.random() * (max - min)) * 500);
    return timers;
  }

  function stopBed(b) {
    if (!b) return;
    const t0 = ctx.currentTime;
    b.gain.gain.setTargetAtTime(0, t0, LEVELS.fade / 3);
    setTimeout(() => {
      for (const t of b.timers) clearTimeout(t);
      for (const n of b.nodes) {
        try {
          n.stop?.();
        } catch {
          // Already stopped.
        }
        n.disconnect();
      }
      b.gain.disconnect();
    }, LEVELS.fade * 1000 + 200);
  }

  function startBed(name) {
    if (!ctx || !BEDS[name]) return;
    stopBed(bed);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    const built = BEDS[name](gain);
    gain.gain.setTargetAtTime(LEVELS.bed, ctx.currentTime, LEVELS.fade / 3);
    bed = { gain, ...built };
  }

  // ---- one-shots ----

  // One ring of an electric bell: a rapid hammer on an inharmonic set of partials.
  function bellRing() {
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = LEVELS.bells;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 5200;
    out.connect(soften).connect(master);
    const base = 1320;
    for (let h = 0; h < 7; h++) {
      const at = t0 + h * 0.055;
      for (const [ratio, lv] of [[1, 1], [2.02, 0.45], [2.76, 0.25], [4.1, 0.12]]) {
        tone(out, { freq: base * ratio, level: lv * 0.5, attack: 0.002, decay: 0.28 + ratio * 0.04, at });
      }
    }
    setTimeout(() => out.disconnect(), 1500);
  }

  function gavel() {
    const t0 = ctx.currentTime;
    for (const d of [0, 0.19]) {
      burst(master, { freq: 1700, q: 1.1, level: LEVELS.gavel, decay: 0.05, at: t0 + d });
      tone(master, { freq: 170, to: 70, level: LEVELS.gavel * 0.6, attack: 0.002, decay: 0.09, at: t0 + d });
    }
  }

  // The benches react to a question: desks thumped in a ragged volley, and the voices swell with it. A hit
  // gets the whole side on its feet; a lob a dutiful few.
  function benches(kind = 'lob') {
    if (!ensure()) return;
    const t0 = ctx.currentTime;
    const big = kind === 'hit';
    const thumps = big ? 11 : kind === 'home' ? 6 : 4;
    for (let i = 0; i < thumps; i++) {
      const at = t0 + 0.1 + i * (big ? 0.13 : 0.17) + Math.random() * 0.05;
      burst(master, { freq: 190, q: 1.4, level: LEVELS.gavel * (big ? 0.42 : 0.3), decay: 0.07, at });
      tone(master, { freq: 95, to: 55, level: LEVELS.gavel * 0.2, attack: 0.003, decay: 0.08, at });
    }
    const v = bed?.voices?.gain.gain;
    if (v) {
      const L = LEVELS.chamber.voices;
      v.cancelScheduledValues(t0);
      v.setTargetAtTime(L * (big ? 4.5 : 2.4), t0, 0.3);
      v.setTargetAtTime(L, t0 + (big ? 2.4 : 1.4), 1.0);
    }
  }

  // A room going up: a swell of voices, a ragged patter of hands, a few whoops over the top. `big` is the
  // declaration; small is a good box coming in.
  function cheer(big = true) {
    if (!ensure()) return;
    const L = LEVELS.cheer;
    const t0 = ctx.currentTime;
    const len = big ? 4.2 : 1.8;
    const s = noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1050;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(L.roar * (big ? 1 : 0.45), t0 + 0.35);
    g.gain.setTargetAtTime(L.roar * (big ? 0.6 : 0.25), t0 + 0.6, 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    s.connect(f).connect(g).connect(master);
    s.stop(t0 + len + 0.1);
    const claps = big ? 46 : 14;
    for (let i = 0; i < claps; i++) burst(master, { freq: 2200 + Math.random() * 900, q: 1.3, level: L.clap * (0.5 + Math.random() * 0.5), decay: 0.035, at: t0 + 0.2 + Math.random() * (len - 0.6) });
    if (!big) return;
    for (let i = 0; i < 5; i++) {
      const at = t0 + 0.3 + Math.random() * 1.6;
      const base = 420 + Math.random() * 260;
      tone(master, { freq: base, to: base * 1.7, type: 'triangle', level: L.whoop, attack: 0.04, decay: 0.45, at });
    }
  }

  function setBells(on) {
    if (on === !!bellTimer) return;
    if (!on) {
      clearInterval(bellTimer);
      bellTimer = null;
      return;
    }
    if (!ensure()) return;
    bellRing();
    bellTimer = setInterval(bellRing, 1100);
  }

  // ---- public ----

  // Audio contexts start suspended until a gesture; the first tap anywhere opens the sound.
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended' && wanted.sound) ctx.resume();
  }
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, unlock, { capture: true, passive: true });

  return {
    // Which room's tone should play. Safe before the first gesture: it starts when sound does.
    room(name) {
      roomName = name;
      if (ctx) startBed(name);
    },
    bells: setBells,
    benches(kind) {
      if (ctx && wanted.sound) benches(kind);
    },
    gavel() {
      if (ctx && wanted.sound) gavel();
    },
    cheer(big) {
      if (ctx && wanted.sound) cheer(big);
    },
    tap() {
      if (ctx && wanted.sound) burst(master, { freq: 3400, q: 1.5, level: LEVELS.tap, decay: 0.03 });
    },
    configure({ sound: s = wanted.sound, volume: v = wanted.volume }) {
      wanted = { sound: s, volume: v };
      if (!ctx) return;
      master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.05);
      if (s && ctx.state === 'suspended') ctx.resume();
    },
    get running() {
      return !!ctx && ctx.state === 'running';
    },
    get bellsOn() {
      return !!bellTimer;
    },
  };
}
