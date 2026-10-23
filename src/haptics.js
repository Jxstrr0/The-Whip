// Haptics: a short buzz on the beats that should be felt, not just seen. Android phones vibrate; iPhones have
// no web API for it and get nothing. Every pattern lives in PATTERNS (milliseconds on, off, on…), the way the
// audio levels live in audio.js. The settings toggle is hidden on phones that can't buzz.
import { getSettings } from './settings.js';

const PATTERNS = {
  bells: [40, 70, 40, 70, 40], // the division bells start
  gavel: [30], // the Speaker's gavel
  deal: [20, 50, 20], // a deal closes at the table
  reversal: [60, 50, 60], // the whip's call: the line has moved
};

export const canBuzz = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function buzz(kind) {
  const pattern = PATTERNS[kind];
  if (!pattern || !canBuzz || !getSettings().haptics) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
