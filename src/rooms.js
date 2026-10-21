// Which room is live. One renderer, four scenes: only the active one exists; leaving a room disposes it.
export function createRooms({ factories, ctx, onChange }) {
  let name = null;
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
      if (next === name && room) return room;
      room?.dispose();
      name = next;
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
