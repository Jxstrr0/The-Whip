// How a game starts: a new career from a seed (scenarios, shared seeds and the daily seed come in stage 9).
import { generateParliament } from './generate.js';
import { createRng } from './rng.js';
import { createPlayer, setupFirstWeek } from './career.js';
import { assignSeats } from '../chamber/layout.js';
import { initFlow } from './pacing.js';

export const SAVE_VERSION = 1;

export function reseat(state) {
  const seats = assignSeats(state);
  state.seats = {};
  for (const m of Object.values(state.mps)) m.seatId = null;
  for (const [seatId, mpId] of Object.entries(seats)) {
    state.seats[seatId] = { mpId };
    state.mps[mpId].seatId = seatId;
  }
}

export function newGame({ seed, party, first, last, age, background, ridingType, province, mode = 'career', guided = false } = {}) {
  const parl = generateParliament(seed);
  const state = {
    version: SAVE_VERSION,
    seed,
    mode: { kind: mode, id: null },
    date: { parliament: parl.house.parliament, year: 1, week: 1, dayOfWeek: 1, phase: 'morning', constituencyWeek: false, absWeek: 0 },
    room: 'chamber',
    rng: createRng('game:' + seed).getState(),
    player: null,
    ...parl,
    seats: {},
    bills: {},
    orderPaper: [],
    countBoard: {},
    pairs: [],
    ledger: [],
    meetings: {},
    ridingCases: [],
    pressure: 20,
    log: [],
  };
  reseat(state);
  createPlayer(state, { party, first, last, age, background, ridingType, province });
  state.divisions = {};
  initFlow(state);
  // A career started from the menu gets the guided first week.
  if (guided) setupFirstWeek(state);
  return state;
}
