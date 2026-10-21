// Which room is live. One renderer, four scenes: only the active one exists; leaving a room disposes it.
export function createRooms({ factories, ctx, onChange }) {
  let name = null;
  let variant = null;
  let room = null;
  let size = [1, 1];
  return {
    get name() {
      return name;
    },
    get room() {
      return room;
    },
    show(next, extra = {}) {
      // A room only rebuilds when its name or its variant (the office by rank) changes.
      if (next === name && room && extra.variant === variant) return room;
      room?.dispose();
      name = next;
      variant = extra.variant;
      room = factories[next].create({ ...ctx, ...extra });
      room.resize(...size);
      onChange?.(name, room);
      return room;
    },
    resize(w, h) {
      size = [w, h];
      room?.resize(w, h);
    },
    // Throw the current room away, so the next show() builds it fresh (used when the menu's preview ends).
    reset() {
      room?.dispose();
      room = null;
      name = null;
    },
  };
}
