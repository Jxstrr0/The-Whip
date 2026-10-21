// Every player and system action the sim understands, mapped to the sim function that handles it.
export const ACTIONS = {};

// Sim modules add their handlers here, keeping each module's actions next to its logic.
export function registerActions(table) {
  Object.assign(ACTIONS, table);
}
