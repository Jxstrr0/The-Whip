// Pure math for the chamber: seat positions from the geometry spec (HANDOFF section 5). No Three.js here.

// One unit is one metre. Origin is the floor at the chamber centre, Speaker at -z, bar at +z.
export const GEOMETRY = {
  floorLength: 26,
  floorWidth: 15,
  aisleWidth: 4,
  rows: 4,
  seatsPerRow: 15,
  // The handoff starts row 1 at 2.0 m from the aisle edge, but four rows at 1.3 m pitch from there
  // would put row 4 outside a 15 m floor. 1.0 m keeps the floor width and still clears the aisle.
  rowStart: 1.0,
  rowPitch: 1.3,
  rowRise: 0.25,
  seatPitch: 1.1,
  dais: { z: -11, height: 0.6, width: 4 },
  clerkTable: { zFrom: -7.5, zTo: -3.5, width: 1.5, height: 0.8 },
  barZ: 11,
  gallery: { y: 5, depth: 3 },
  ceiling: 10,
};

// Seat ids run s001-s060 on the government side and s061-s120 on the opposition side,
// row by row from the aisle out, each row from the Speaker's end to the bar.
export function seatId(side, row, index) {
  const n = (side === 'gov' ? 0 : 60) + (row - 1) * GEOMETRY.seatsPerRow + index;
  return 's' + String(n).padStart(3, '0');
}

export function seatX(side, row) {
  const g = GEOMETRY;
  const dist = g.aisleWidth / 2 + g.rowStart + (row - 1) * g.rowPitch;
  return side === 'gov' ? -dist : dist;
}

export function seatZ(index) {
  const g = GEOMETRY;
  return (index - (g.seatsPerRow + 1) / 2) * g.seatPitch;
}

export function rowFloorY(row) {
  return (row - 1) * GEOMETRY.rowRise;
}

// All 120 seats as plain records. Government is the Speaker's right, which is -x.
export function buildSeats() {
  const seats = [];
  for (const side of ['gov', 'opp']) {
    for (let row = 1; row <= GEOMETRY.rows; row++) {
      for (let index = 1; index <= GEOMETRY.seatsPerRow; index++) {
        seats.push({
          seatId: seatId(side, row, index),
          side,
          row,
          index,
          x: seatX(side, row),
          y: rowFloorY(row),
          z: seatZ(index),
          // Every seat faces the aisle: +x on the government side, -x on the opposition side.
          rotationY: side === 'gov' ? Math.PI / 2 : -Math.PI / 2,
        });
      }
    }
  }
  return seats;
}

// Desks are paired: seats 1-2, 3-4 ... share a desk, seat 15 has its own.
// Returns the offset along z that pulls a seat's half-desk toward its partner.
export function deskPairOffset(index) {
  if (index === GEOMETRY.seatsPerRow && index % 2 === 1) return 0;
  return index % 2 === 1 ? 0.05 : -0.05;
}
