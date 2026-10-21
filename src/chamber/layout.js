// Pure math for the chamber: seat positions from the geometry spec (HANDOFF section 5). No Three.js here.

// One unit is one metre. Origin is the floor at the chamber centre, Speaker at -z, bar at +z.
export const GEOMETRY = {
  floorLength: 26,
  floorWidth: 15,
  aisleWidth: 4,
  rows: 4,
  seatsPerRow: 15,
  // The handoff starts row 1 at 2.0 m from the aisle edge, but four rows from there would put row 4
  // outside a 15 m floor. 0.85 m still clears the aisle with the front desks, and the 1.4 m pitch leaves
  // a gangway behind each row's chairs that a member can walk along to the end of the bench.
  rowStart: 0.85,
  rowPitch: 1.4,
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

// The way out for a member leaving their seat, as [x, y, z] points (reversed for the way back in): into the
// gap beside the chair, along the gangway behind the row to the nearer end of the bench, down the steps,
// up the aisle and round the end of the bar to the doors. Nobody walks through a desk. Null for the front
// bench (they stay for the business) and the back row, whose gangway is the wall.
export function walkerPath(s, out = true) {
  const g = GEOMETRY;
  if (s.row < 2 || s.row >= g.rows) return null;
  const side = s.side === 'gov' ? -1 : 1;
  const x = (d) => side * d;
  const d = Math.abs(s.x);
  const dir = s.z >= 0 ? 1 : -1;
  const gap = s.z + (dir * g.seatPitch) / 2;
  const end = dir * ((g.seatsPerRow / 2) * g.seatPitch + 0.4);
  const aisle = g.aisleWidth / 2 - 0.7;
  const L = g.floorLength / 2;
  const pts = [
    [s.x, s.y, gap],
    [x(d + 0.45), s.y, gap],
    [x(d + 0.45), s.y, end],
  ];
  for (let row = s.row; row >= 2; row--) {
    const riser = Math.abs(seatX(s.side, row)) - 0.85;
    pts.push([x(riser + 0.2), rowFloorY(row), end], [x(riser - 0.2), rowFloorY(row - 1), end]);
  }
  pts.push(
    [x(aisle), 0, end],
    [x(aisle), 0, g.barZ - 1.5],
    [x(g.aisleWidth / 2 + 0.5), 0, g.barZ - 0.6],
    [x(g.aisleWidth / 2 + 0.5), 0, g.barZ + 0.6],
    [x(0.4), 0, L - 0.4],
    [x(0.3), 0, L + 0.6],
  );
  return out ? pts : pts.reverse();
}

// Desks are paired: seats 1-2, 3-4 ... share a desk, seat 15 has its own.
// Returns the offset along z that pulls a seat's half-desk toward its partner.
export function deskPairOffset(index) {
  if (index === GEOMETRY.seatsPerRow && index % 2 === 1) return 0;
  return index % 2 === 1 ? 0.05 : -0.05;
}

// Fill order on a side: seat column by seat column from the Speaker's end, front row to back in each,
// so every party sits as one block along the chamber and the smaller parties end up toward the bar.
function sideOrder(seats, side) {
  return seats.filter((s) => s.side === side).sort((a, b) => a.index - b.index || a.row - b.row);
}

// The far end first: back rows nearest the bar. Overflow members (and independents) sit here.
function barEndOrder(seats) {
  return [...seats].sort((a, b) => b.index - a.index || b.row - a.row);
}

const ROLE_ORDER = { cabinet: 0, shadowCabinet: 0, parliamentarySecretary: 1 };

// Place one party in its seats: role holders in their fixed seats, everyone else grouped by clique.
// `primary` is the party's main block (role seats come from it); `extra` is overflow on the far side.
function placeParty(party, members, primary, extra, cliques) {
  const out = new Map();
  const used = new Set();
  const byRow = (r) => primary.filter((s) => s.row === r).sort((a, b) => a.index - b.index);
  const put = (seat, mpId) => {
    if (!seat || !mpId || used.has(seat.seatId) || [...out.values()].includes(mpId)) return false;
    out.set(seat.seatId, mpId);
    used.add(seat.seatId);
    return true;
  };
  const aw = party.assistantWhips || [];
  const front = [];
  if (party.houseLeader) front.push(party.houseLeader);
  if (aw.length >= 3) front.push(aw[0]);
  if (party.leader) front.push(party.leader);
  members
    .filter((m) => m.caucusRole in ROLE_ORDER)
    .sort((a, b) => ROLE_ORDER[a.caucusRole] - ROLE_ORDER[b.caucusRole] || b.tenure - a.tenure)
    .forEach((m) => front.push(m.id));
  const r1 = byRow(1);
  const r2 = byRow(2);
  put(r2[0], party.chiefWhip);
  put(r2[1], party.deputyWhip);
  const backAw = aw.length >= 3 ? [aw[1], aw[2]] : aw.slice(0, 1);
  put(byRow(3)[0], backAw[0]);
  put(byRow(4)[0], backAw[1]);
  const spill = [];
  front.forEach((id, i) => {
    if (!put(r1[i], id)) spill.push(id);
  });
  // Front-benchers who don't fit in row 1 take row 2 next, before the backbench fills in.
  for (const id of spill) {
    const seat = r2.find((s) => !used.has(s.seatId)) || primary.find((s) => !used.has(s.seatId));
    put(seat, id);
  }
  const placed = new Set(out.values());
  const cliqueSize = (q) => (q ? cliques[q]?.members.length ?? 0 : -1);
  const rest = members
    .filter((m) => !placed.has(m.id))
    .sort((a, b) => cliqueSize(b.clique) - cliqueSize(a.clique) || String(a.clique).localeCompare(String(b.clique)) || b.tenure - a.tenure || a.id.localeCompare(b.id));
  const free = [...primary, ...extra].filter((s) => !used.has(s.seatId));
  rest.forEach((m, i) => free[i] && put(free[i], m.id));
  return out;
}

// Seat the whole House (HANDOFF section 5 steps 2-5). Returns seatId -> mpId; the Speaker has no desk.
export function assignSeats(state) {
  const seats = buildSeats();
  const gov = state.house.government;
  const mps = Object.values(state.mps).filter((m) => m.caucusRole !== 'speaker');
  const partyMembers = (pid) => mps.filter((m) => m.party === pid);
  const govSide = sideOrder(seats, 'gov');
  const oppSide = sideOrder(seats, 'opp');
  const result = {};

  // Government: front to back from the Speaker's end; more than 60 overflow to the opposition back rows at the bar.
  const govMembers = partyMembers(gov);
  const govPrimary = govSide.slice(0, Math.min(60, govMembers.length));
  const govOverflow = barEndOrder(oppSide).slice(0, Math.max(0, govMembers.length - 60));
  const taken = new Set([...govPrimary, ...govOverflow].map((s) => s.seatId));
  for (const [seatId, mpId] of placeParty(state.parties[gov], govMembers, govPrimary, govOverflow, state.cliques)) result[seatId] = mpId;

  // Opposition parties in order, each one contiguous block. When the opposition side is full,
  // the rest sit in the government side's free back rows nearest the bar.
  const ROLE_SEQ = ['opposition', 'third', 'regional', 'minor'];
  const oppParties = Object.values(state.parties)
    .filter((p) => p.id !== gov)
    .sort((a, b) => ROLE_SEQ.indexOf(a.role) - ROLE_SEQ.indexOf(b.role));
  // Reversed so the last in line (independents) get the seats nearest the bar.
  const queue = [...oppSide.filter((s) => !taken.has(s.seatId)), ...barEndOrder(govSide.filter((s) => !taken.has(s.seatId))).reverse()];
  let at = 0;
  for (const p of oppParties) {
    const members = partyMembers(p.id);
    const block = queue.slice(at, at + members.length);
    at += members.length;
    // A party split across the aisle keeps its leader and whips in whichever part is bigger.
    const sides = ['gov', 'opp'].map((side) => block.filter((s) => s.side === side));
    const [primary, extra] = sides[0].length > sides[1].length ? sides : [sides[1], sides[0]];
    for (const [seatId, mpId] of placeParty(p, members, primary, extra, state.cliques)) result[seatId] = mpId;
  }
  const inds = partyMembers('ind').sort((a, b) => a.id.localeCompare(b.id));
  for (const m of inds) result[queue[at++].seatId] = m.id;
  return result;
}
