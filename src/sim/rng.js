// Seeded RNG (sfc32 seeded by cyrb128). All game randomness flows through here so a seed replays exactly.

// Hash a seed string into four 32-bit words.
export function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

// A short stable hash of any string, used for the Parliament hash in debug and tests.
export function hashString(str) {
  return cyrb128(str).map((n) => n.toString(16).padStart(8, '0')).join('').slice(0, 16);
}

// Create an RNG from a seed string or a saved 4-word state. Its state can be saved back into the game state.
export function createRng(seedOrState) {
  let [a, b, c, d] = Array.isArray(seedOrState) ? seedOrState : cyrb128(String(seedOrState));
  function next() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  // Warm up so similar seeds diverge quickly.
  if (!Array.isArray(seedOrState)) for (let i = 0; i < 15; i++) next();

  const rng = {
    next,
    float: (lo = 0, hi = 1) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    normal(mean = 0, sd = 1) {
      const u = 1 - next();
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    weighted(items, weightOf) {
      const ws = items.map((it) => Math.max(0, weightOf(it)));
      const total = ws.reduce((s, w) => s + w, 0);
      if (total <= 0) return rng.pick(items);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= ws[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    // A child RNG for a sub-task, so adding draws in one system doesn't reshuffle another.
    fork: (label) => createRng(String(next()) + ':' + label),
    getState: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  };
  return rng;
}

// Run a function with the game's RNG and write the advanced state back, keeping saves deterministic.
export function withRng(state, fn) {
  const rng = createRng(state.rng);
  const out = fn(rng);
  state.rng = rng.getState();
  return out;
}
