// The single game-state object and dispatch(action): the only way game state changes.
import { ACTIONS } from './sim/actions.js';

let state = null;
const listeners = new Set();

export function getState() {
  return state;
}

// Replace the whole state (new game, load, scenario).
export function setState(next) {
  state = next;
  for (const fn of listeners) fn(state, { type: 'setState' });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function dispatch(action) {
  const handler = ACTIONS[action.type];
  if (!handler) throw new Error(`Unknown action: ${action.type}`);
  const result = handler(state, action);
  for (const fn of listeners) fn(state, action, result);
  return result;
}
