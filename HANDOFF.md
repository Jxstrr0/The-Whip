# The Whip - Code Session Handoff

Longlight Interactive · October 20, 2026 · Version 3.1 (career rewrite + gap fixes)

This file tells a Claude Code session how to build The Whip. What the game *is* lives in `DESIGN.md`. This file covers how: constraints, setup, conventions, geometry specs for all four rooms, data contracts, the stage plan, testing, build advice and kickoff prompts.

---

## 1. Mission

You are building The Whip, a phone-first 3D political career game set in a fictional Canadian-style House of Commons, as a static site deployed to GitHub Pages from the repo `Jxstrr0/the-whip`.

**Read first, every session**

1. `DESIGN.md`: the design doc. Source of truth for what the game is.
2. `HANDOFF.md`: this file. How to build it.
3. `PROGRESS.md`: the running log of what earlier sessions finished. Create it in stage 0 if it doesn't exist.

**The game in one paragraph.** The player is a rookie MP in a 120-seat House who spends an open-ended career climbing five acts from backbencher to Chief Whip of any party. Four 3D rooms are the whole interface: the chamber (tap MPs, run the count during standing votes), the whip's office (one-on-one meetings: a talk phase with dialogue choices, then a deal table), the riding (constituents, the local press, the nomination), and the caucus room (the weekly party meeting where lines are set and revolts happen). Relationships (cohorts, cliques, mentors, opposite numbers, life events) and a persistent ledger of promises and grudges drive everything. Minority Parliaments and confidence votes give the game its stakes.

**Who you're working for.** Kelbo runs Longlight Interactive, has beginner-plus coding knowledge, and mostly tests on his phone. Explain choices in plain language in `PROGRESS.md`, and keep every stage playable at its live URL.

---

## 2. Hard constraints

These hold for every stage. If a task seems to need breaking one, stop and ask Kelbo.

1. **No build step.** Plain HTML, CSS and ES modules. No bundler, no TypeScript compile, no framework. The files in the repo are the files Pages serves.
2. **Three.js pinned.** Load `three@0.160.0` and its addons through an import map from `https://cdn.jsdelivr.net/npm/`. Never a bare, ranged or `@latest` version.
3. **Only that CDN.** No other external scripts, fonts, images or network calls. Every asset lives in the repo.
4. **Phone-first.** Portrait phone first, landscape second, touch as the primary input. Desktop mouse is a bonus.
5. **Static hosting.** GitHub Pages from `main` at the repo root, with a `.nojekyll` file. No server, no accounts, no online features.
6. **Saves in the browser.** All persistence in `localStorage` under keys prefixed `whip:`, wrapped in try/catch so the game runs even if storage fails.
7. **Deterministic sim.** All game randomness comes from the seeded RNG in `src/sim/rng.js`. Never call `Math.random()` in sim code; the renderer may use it for cosmetic effects only.
8. **Fictional everything.** No real country, party, politician, riding or event appears. Procedures are Canadian; names are invented.
9. **Sim and render stay separate.** `src/sim/` never touches the DOM or Three.js. The renderer and UI read game state and send player actions to the sim.
10. **Every push is playable.** Each push to `main` must load and run at the live URL with no console errors.

---

## 3. Stage 0 setup

Stage 0 gets an empty page live at `https://jxstrr0.github.io/the-whip/`. A few steps happen in the GitHub app, not in the Code session.

**Kelbo, before the session**

1. Create the repo `the-whip` under Jxstrr0 with a README. Public or private both work for Pages on GitHub Pro.
2. Start a Claude Code session on the repo and attach `The Whip - Design Doc.md` and this file.

**Claude Code, in the session**

1. Commit the two files as `DESIGN.md` and `HANDOFF.md`.
2. Create `index.html`, `css/style.css`, `src/main.js`, `.nojekyll`, `PROGRESS.md`, and a `README.md` holding the live link.
3. In `index.html`, add the viewport tag and import map below, a full-screen `<canvas>` with `touch-action: none`, and a Three.js placeholder (a slowly rotating desk-shaped box under soft light).
4. Commit and push to `main`.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>
```

**Kelbo, after the push**

1. In the repo, go to Settings, then Pages. Under Build and deployment, set Source to "Deploy from a branch", pick `main` and `/ (root)`, and save.
2. Wait a minute or two, then open the live URL on your phone.

**Hub link.** Adding a card to the Kelbo.Website repo is a separate change in that repo. Do it in a short session there, matching the existing game cards.

---

## 4. Code conventions and repo layout

Keep files small and single-purpose, and put every file where this layout says. Create files only when their stage needs them.

```text
the-whip/
  index.html            canvas, import map, UI root
  tests.html            browser-run sim checks
  .nojekyll
  DESIGN.md  HANDOFF.md  PROGRESS.md  README.md
  css/style.css         UI overlays, safe-area padding, dark theme
  src/
    main.js             boot: load save or new game, start loop
    state.js            the single game-state object + dispatch(action)
    save.js             localStorage read/write, schema version, export/import
    rooms.js            which room is active; transitions between scenes
    chamber/
      scene.js          renderer, lights, chamber shell, Speaker's dais, table, bar
      layout.js         pure math: seat positions from the geometry spec
      seats.js          instanced desks and chairs
      mps3d.js          instanced MP figures, outline on select
      camera.js         orbit limits, pinch zoom, focus on a party block
      picking.js        raycast tap -> seat index -> MP id
      voteLights.js     per-seat color during divisions
    office/
      officeScene.js    the office room, desk, chairs, count board, window; two tiers
      officeCamera.js   fixed over-the-shoulder camera, small eases
      visitor.js        the visiting MP figure: enter, sit, leave, mood pose
    riding/
      ridingScene.js    the constituency office; window variant per riding type
      ridingCamera.js   fixed camera, small eases
      constituents.js   visitor figures for constituents and local press
    caucus/
      caucusScene.js    the caucus room: long table, seating by clique
      caucusCamera.js   from the player's seat; pan along the table
      caucusFigures.js  instanced seated MPs, mood colors for the whip's read
    sim/
      rng.js            seeded RNG (sfc32)
      generate.js       Parliament from a seed: parties, ridings, MPs, cohorts, cliques
      mp.js             the MP decision model
      relationships.js  rapport, cohorts, cliques, mentor arc, opposite numbers, reputation style
      knowledge.js      what the player knows about each MP; reveal sources; decay
      rivals.js         rival whip AI: weekly budgets, poaching, leaks, digs, pair tests
      pacing.js         which days stop the player; auto-resolve of routine days
      lifeEvents.js     MP arcs: ambition, crisis, riding trouble, retirement, by-elections
      bills.js          bill kinds, stages, templates, amendments, PMB lottery
      vote.js           voice vote, division bells, standing count, pairing, ties
      tools.js          chamber and office tools, gated by act
      meetings.js       talk phase lines, deal table rules, outcomes
      riding.js         riding standing, cases, town halls, nomination
      caucus.js         caucus meeting: mood, speaking, whispers, revolts, expulsion
      career.js         acts, graduation checks, vacancies, cabinet offers, demotion, floor-crossing, retirement
      confidence.js     confidence votes, agreements, government falls
      media.js  election.js  record.js  modes.js
    ui/
      hud.js  mpCard.js  book.js  countBoard.js  agenda.js  ledger.js
      talk.js  dealTable.js  caucusUI.js  ridingUI.js  careerUI.js  menus.js
  data/                 name pools, ridings, bill templates, dialogue lines, cliques, backgrounds, scenarios, tuning.json (JSON)
  assets/               models (.glb), textures, audio
```

**Conventions**

- **Modules.** ES modules with named exports, one concept per file, files under about 300 lines.
- **State.** One plain-object game state in `state.js`. Changes go only through `dispatch(action)`, so saving is just serializing that object.
- **Pure sim.** Sim functions take state plus inputs and return results. No hidden globals, so they're testable from the console and from `tests.html`.
- **One renderer, four scenes.** `rooms.js` owns the active scene. Each room folder exports `create(state)`, `update(state, dt)` and `dispose()`. Only one scene is live at a time; the others are built on demand and disposed when left, so phone memory stays flat.
- **IDs, not references.** MPs, parties, bills, seats, meetings and cliques refer to each other by id strings (`m042`, `p2`, `b017`, `s213`, `k009`, `q3`), never by object references, so saves stay plain JSON.
- **Names.** camelCase for variables and functions, PascalCase for classes, kebab-case for data files.
- **Comments.** Each file starts with a one-line comment saying what it's for. Comment the why, not the what.
- **Tuning lives in data.** Every weight, threshold, budget and timer goes in `data/tuning.json`, never as a literal in sim code, and `?debug=1` exposes sliders for them.
- **Dialogue is data.** Lines are templates in `data/dialogue-lines.json` with slots (`{riding}`, `{bill}`, `{mentor}`) and tags (mood, style, situation, act). The talk phase filters by tags and fills slots. Budget about 150 lines per act. There's no runtime AI on Pages.
- **Commits.** Small commits with plain messages, for example "Stage 1: seat layout math".

---

## 5. Chamber geometry spec

A rectangular chamber with a centre aisle, the Speaker at one end and the bar at the other, four tiered rows of 15 seats on each side. One unit equals one meter. These are starting values to tune by eye.

**Coordinates.** The origin is the floor at the centre of the chamber. +y is up. The Speaker's chair is at −z, the bar at +z. The Speaker faces +z, so the **Speaker's right is −x: the government side is x < 0, the opposition side is x > 0.** The default camera sits above the bar looking toward the Speaker, which puts the government on the viewer's left.

| Element | Value |
| --- | --- |
| Chamber floor | 26 m long (z) × 15 m wide (x) |
| Centre aisle | 4 m wide, along z |
| Rows per side | 4, parallel to the aisle |
| Row pitch | 1.3 m outward from the aisle, starting 2.0 m from the aisle's edge |
| Row rise | 0.25 m per row |
| Seats per row | 15, pitch 1.1 m along z, centered on z = 0 |
| Desks | Paired: one desk per two seats, with a lid and two microphones |
| Speaker's dais | At z = −11, 0.6 m high, 4 m wide; chair centered |
| Clerk's table | 4 m × 1.5 m on the aisle, from z = −7.5 to z = −3.5; the Mace on top |
| The bar | Brass rod across the aisle at z = +11 |
| Galleries | Along both long walls, floor at y = 5, 3 m deep |
| Ceiling | 10 m |

**Seat layout algorithm** (`chamber/layout.js`, pure math, no Three.js)

1. Build 120 seat records: side (`gov` for x < 0, `opp` for x > 0), row 1–4 (row 1 nearest the aisle), index 1–15 (index 1 nearest the Speaker).
2. Assign parties from game state. Government fills the gov side front to back, cabinet in row 1 nearest the Speaker. If the government has more than 60 seats, overflow fills the opp side's back rows from the bar end.
3. On the opposition side: Official Opposition fills from row 1 nearest the Speaker, then the third party, then the regional party, then minor parties, then independents, each party as one contiguous block. Independents end up in the back rows nearest the bar.
4. **Whip seats.** Each party's Chief Whip takes row 2, index 1 (aisle-side second row, nearest the Speaker). The Deputy Whip takes row 2, index 2. Assistant whips take index 1 of rows 3 and 4, plus index 2 of row 1 for the front row.
5. Within a party block, seat MPs by clique so cliques sit together, which makes the chamber readable at a glance.
6. Return `{seatId, side, row, index, x, y, z, rotationY}`, every seat facing the aisle.

**MP figures.** A seated figure about 1.3 m tall from an instanced capsule torso and an instanced sphere head: two draw calls for all 120. Desks and chairs are one instanced mesh each.

**Camera** (`chamber/camera.js`)

- Default position (0, 9, 19), looking at (0, 1.5, −3).
- One-finger drag orbits, limited to ±60° sideways and 30° to 75° from vertical. Pinch zooms between 6 and 26 m. No panning.
- A tap selects an MP. A double-tap on a party block eases the camera to frame it.
- In Act 1 and 2 the default camera starts from the player's own seat (a low angle looking across the aisle), to make the backbench feel like a seat, not a map.

**Division animation** (`chamber/voteLights.js`). The yeas light up row by row, Speaker's end first, about 0.08 s per seat, then the nays. The count board in the HUD ticks up in step. Absent seats stay grey; paired seats pulse once in white. Every lit seat also shows a small icon (check for yea, cross for nay, dash for absent) so votes read without color.

**Colors (placeholders until the art pass)**

| Use | Color |
| --- | --- |
| Vote: yea | `#2E9E5B` |
| Vote: nay | `#C8423B` |
| Absent | `#6B6F76` |
| Paired | `#FFFFFF` (pulse) |
| National Union | `#2F6DB5` |
| Commonwealth Party | `#C8423B` |
| Labour Democrats | `#E0A526` |
| Eastern Compact | `#4FB3BF` |
| Generated fifth party | `#8E6BBF` |
| Independents | `#9AA0A6` |

---

## 6. Office, riding and caucus room specs

Three smaller rooms share one approach: a fixed camera, a seated or standing visitor, and a bottom-sheet UI that works with one thumb in portrait. Same units as the chamber.

### The office

| Element | Value |
| --- | --- |
| Room | 6 m (x) × 5 m (z), 3.2 m ceiling |
| Desk | 1.8 m × 0.9 m, centered at z = 0, the player's chair behind it at z = +0.9 |
| Visitor chairs | Two, at z = −1.0, x = −0.5 and +0.5, facing the desk |
| Count board | Whiteboard 2.4 m × 1.2 m on the −x wall, bottom edge 1.0 m up |
| Window | On the −z wall behind the visitors, 2.0 m wide, a flat painted view of the lawn |
| Door | On the +x wall near z = +2 |

- **Camera** (`office/officeCamera.js`): fixed over the player's shoulder at (0.6, 1.6, 1.9), looking at the visitor chair. A slow push-in when the deal table opens, a settle when the visitor sits. No orbit.
- **Visitor** (`office/visitor.js`): enters through the door, walks to the chair and sits, about 2 s. Mood sets the pose: upright (cooperative), arms folded (guarded), forward and tense (angry), small and still (anxious). Stands and leaves on accept, decline or walk-out.
- **Two tiers:** a plain shared room (Acts 1–3) and a corner office with a second meeting table and a larger board (Acts 4–5).
- **Act 1 reversal:** when the whip's office calls the rookie in, the camera moves to the visitor's side of the desk and the whip sits behind it.

### The riding office

| Element | Value |
| --- | --- |
| Room | 7 m (x) × 5 m (z), 3.0 m ceiling, a storefront |
| Desk | 1.6 m × 0.8 m at z = −1.0, the player's chair behind it facing +z |
| Waiting area | Four chairs along the +x wall; up to three waiting figures visible |
| Front window | The whole +z wall is glass; a flat painted street scene chosen by riding type (prairie town, suburb, downtown, northern) |
| Photo wall | On the −x wall, a grid of local photos (flat textures) |

- **Camera** (`riding/ridingCamera.js`): fixed behind the desk at (0.4, 1.6, 0.4) looking toward the visitor chair at z = +0.2. For a town hall, the camera cuts to a stand-up position facing a crowd of 20–30 instanced figures in the street scene.
- **Constituents** (`riding/constituents.js`): visitor figures with a role badge (mayor, farmer, plant manager, union steward, school board chair, reporter, riding association president). Same enter-sit-leave animation as the office.
- **UI** (`ui/ridingUI.js`): a case list (carry back to Ottawa or not), a town-hall talk sheet with a crowd mood bar, an announce action, and the riding standing readout.

### The caucus room

| Element | Value |
| --- | --- |
| Room | 20 m (z) × 10 m (x), 4 m ceiling |
| Table | 14 m × 2 m along z, centered |
| Seats | Up to 170 seats: 60 at the table (30 per side), the rest in four rows of chairs along the walls, all facing the table |
| Head of table | At z = −7: leader centered, Chief Whip at the leader's right, House Leader at the left |

- **Seating** (`caucus/caucusScene.js`): MPs seated by clique, each clique a contiguous block; the player's seat moves closer to the head with rank.
- **Figures** (`caucus/caucusFigures.js`): instanced seated figures. In the whip's read mode, each figure tints by mood (cooperative green, guarded grey, angry red, anxious amber).
- **Camera** (`caucus/caucusCamera.js`): from the player's seat, looking along the table; one-finger drag pans along the table within limits, no orbit.
- **UI** (`ui/caucusUI.js`): listen (reveals mood and who's whispering to whom), speak (a stance sheet with three options), whisper (pick a neighbour), and the revolt sheet when a revolt is called.

---

## 7. Data contracts

All game data is plain JSON keyed by id strings, so the whole game state saves with one `JSON.stringify`. Add fields as stages need them, but never rename or remove one without bumping the save version.

**MP**

```json
{
  "id": "m042",
  "name": { "first": "Dana", "last": "Thorsby" },
  "age": 51,
  "party": "p1",
  "caucusRole": "backbencher",
  "riding": { "id": "r117", "name": "Red Deer Hills", "province": "Westmark", "type": "rural" },
  "margin": 6,
  "cohort": 1,
  "tenure": 7,
  "clique": "q3",
  "seatId": "s213",
  "loyalty": 72,
  "ambition": 40,
  "ideology": { "economy": -20, "social": 35 },
  "interests": ["agriculture", "roads"],
  "committee": "c05",
  "attendance": 80,
  "relations": { "m118": 30, "m307": -55 },
  "mentor": "m003",
  "proteges": [],
  "rapport": 10,
  "mood": "guarded",
  "lifeEvents": [{ "id": "e21", "kind": "crisis", "stage": 1, "resolvedBy": null }],
  "secrets": [{ "id": "x09", "severity": 2, "known": false }],
  "floorCrossRisk": 5,
  "scandal": 0,
  "bio": "Former county reeve."
}
```

Hidden attributes stay in the MP record; what the player sees is governed by the knowledge map below.

**Knowledge map** (in player state)

```json
"knowledge": {
  "m042": { "loyalty": { "known": true, "asOf": 12, "stale": false }, "ideology": { "known": false }, "clique": { "known": true, "asOf": 4, "stale": true }, "mood": { "known": true, "asOf": 20, "stale": false }, "secrets": { "known": false } }
}
```

`asOf` is the game week it was learned. A field goes `stale` after a tuned number of weeks without contact; stale values render faded on the card. From Act 3 on, the whip's office shares its files and fills most fields for the player's own caucus.

`caucusRole` is one of `backbencher`, `assistantWhip`, `deputyWhip`, `chiefWhip`, `houseLeader`, `parliamentarySecretary`, `committeeChair`, `cabinet`, `shadowCabinet`, `leader`. `cohort` is the election number they came in with. `lifeEvents[].kind` is `ambition`, `crisis`, `ridingTrouble`, `retirement` or `byElection`; `resolvedBy` records who showed up.

**Party**

```json
{
  "id": "p1",
  "name": "National Union",
  "short": "NU",
  "color": "#C8423B",
  "role": "government",
  "seats": 56,
  "leader": "m003",
  "leaderPersonality": "controlling",
  "houseLeader": "m009",
  "chiefWhip": "m017",
  "deputyWhip": "m041",
  "assistantWhips": ["m052", "m088", "m120", "m131"],
  "cliques": ["q1", "q2", "q3"],
  "morale": 60,
  "leaderTrust": { "m042": 20 },
  "agreements": [{ "with": "p3", "kind": "confidenceAndSupply", "terms": ["b021", "b034"], "until": { "year": 3, "week": 10 } }],
  "whipAI": { "style": "fixer", "weeklyBudget": { "time": 60, "favors": 3 }, "targets": ["m042"], "digging": null }
}
```

`leaderPersonality` is `controlling`, `handsOff`, `paranoid` or `loyal`. `whipAI` drives `sim/rivals.js` for every party the player isn't whipping.

**Clique**

```json
{ "id": "q3", "party": "p1", "kind": "regional", "name": "Prairie caucus", "members": ["m042", "m051"], "lean": 10, "leader": "m051" }
```

`kind` is `regional`, `wing`, `camp` (a leadership contender's) or `social`.

**Bill**

```json
{
  "id": "b017",
  "title": "Rural Roads Fund Act",
  "kind": "government",
  "confidence": false,
  "sponsor": "m009",
  "category": "regional",
  "axis": "economy",
  "position": 25,
  "visibility": 60,
  "beneficiaryRidings": ["r117", "r122"],
  "stage": "second",
  "lines": { "p1": "whipped", "p2": "whipped", "p3": "free", "p4": "whipped" },
  "positions": { "p1": "yea", "p2": "nay", "p4": "nay" },
  "amendments": [],
  "results": []
}
```

`kind` is `government`, `privateMember`, `oppositionMotion` or `supply`. A player's private member's bill has `sponsor` set to the player's MP id. `stage` is `first`, `second`, `committee`, `report`, `third`.

**Meeting**

```json
{
  "id": "k009",
  "room": "office",
  "mpId": "m042",
  "day": { "year": 1, "week": 4, "dayOfWeek": 2 },
  "walkIn": true,
  "reason": "committeeSeat",
  "talk": { "turns": [{ "mpLine": "l220", "choice": "l221", "rapportDelta": 5 }], "moodAfter": "cooperative" },
  "deal": { "offers": ["committeeSeat:c05"], "asks": ["vote:b017:yea"], "counter": null, "result": "accepted" }
}
```

`room` is `office`, `riding` or `caucus`. Riding meetings use a constituent id in `mpId`'s place and a `case` field instead of `deal`.

**Player**

```json
{
  "mpId": "m042",
  "act": 1,
  "actProgress": { "noticed": 0, "rebellions": 1, "rowVotesCarried": 0 },
  "standing": 50,
  "caucusSupport": 40,
  "leaderTrust": 20,
  "mentor": "m003",
  "proteges": [],
  "style": { "fixer": 2, "enforcer": 0, "conscience": 3, "operator": 0, "loyalist": 1 },
  "ridingStanding": 55,
  "nominationThreat": 0,
  "whipFile": [{ "bill": "b004", "vote": "nay", "line": "yea" }],
  "cabinetOffers": 0,
  "skeleton": { "id": "x00", "kind": "businessDebt", "severity": 2, "foundBy": null, "dealtWith": false },
  "knowledge": {},
  "pacing": { "stopFor": ["ownVote", "walkIn", "lifeEvent", "caucusFight"], "autoResolved": 0 },
  "whipTrust": { "p2": 0, "p3": 10 },
  "houseTime": 90,
  "slots": 2,
  "leaveGranted": true,
  "record": { "votesWon": 0, "votesLost": 0, "confidenceSurvived": 0, "promoted": 0, "expelled": 0, "promisesKept": 0, "promisesBroken": 0, "mentored": 0, "parliaments": 1 }
}
```

`whipFile` is the whip's office record of the player's votes against the line (Acts 1–2). `whipTrust` is the trust axis with each other party's whip office. `style` tallies choices; the highest value is the visible reputation.

**Game state (top level)**

```json
{
  "version": 1,
  "seed": "CALEDOR-7781",
  "date": { "parliament": 1, "year": 1, "week": 4, "dayOfWeek": 2, "phase": "house", "constituencyWeek": false },
  "room": "chamber",
  "player": {},
  "house": { "seats": 120, "government": "p1", "minority": true, "speaker": "m091" },
  "parties": { "p1": {} },
  "cliques": { "q1": {} },
  "mps": { "m001": {} },
  "seats": { "s001": { "mpId": "m001" } },
  "bills": { "b001": {} },
  "orderPaper": ["b017", "b018"],
  "countBoard": { "b017": { "m042": "firm", "m118": "leaning" } },
  "pairs": [{ "bill": "b017", "a": "m044", "b": "m201" }],
  "ledger": [{ "from": "m042", "to": "m118", "kind": "promise", "what": "qpSlot", "dueWeek": 6, "settled": false }],
  "meetings": { "k009": {} },
  "ridingCases": [{ "id": "rc3", "from": "mayor", "what": "bridge", "carried": false }],
  "pressure": 20,
  "polling": { "p1": 34, "p2": 31, "p3": 18, "p4": 9, "p5": 4 },
  "log": []
}
```

`date.phase` is `morning`, `caucus`, `house`, `office`, `riding` or `fallout`. `room` is `chamber`, `office`, `riding` or `caucus`. A top-level `"mode": { "kind": "career" | "scenario" | "daily", "id": null }` records how the game was started.

**Save format.** Store the game state under `whip:save:<slot>` with three slots, plus `whip:settings`. Export is the state as base64 JSON for copy and paste. On load, if `version` is older than current, run migrations in `save.js`; never discard a save.

---

## 8. Stage plan

Build one stage per session, in order. A stage is done only when every check under it passes at the live URL on a phone. Stages 6 and 7 are the career itself; don't rush them.

**Stage 0: Repo and pipeline.** Follow section 3.

- [ ] The live URL loads on a phone and shows the placeholder
- [x] `DESIGN.md`, `HANDOFF.md` and `PROGRESS.md` are in the repo

**Stage 1: The chamber.** Write `layout.js` from section 5, then `scene.js`, `seats.js`, `camera.js` and `picking.js`. Simple primitives for the shell, dais, table, Mace, bar and galleries. Tapping a seat shows a label with its seat id, side, row and index.

- [x] 120 seats render as instanced meshes, 60 per side, four rows each
- [x] Orbit, pinch zoom and double-tap focus work by touch within the limits
- [x] Tapping any seat reports the right seat id
- [ ] Smooth on Kelbo's phone; renderer pixel ratio capped at 2

**Stage 2: MPs, parties, cohorts and cliques.** Write `rng.js`, `generate.js` and `relationships.js`, add `data/` name pools, ridings and clique templates, build `mps3d.js` and `ui/mpCard.js`. Party blocks follow section 5, including overflow, whips' seats and clique grouping.

- [x] Seed `TEST-1` produces the same 120 MPs, cohorts and cliques on every load, with the four core parties present and a generated fifth party
- [x] A minority Parliament seats correctly; a majority seed shows overflow
- [x] The card shows only what the knowledge map says is known; a fresh game shows name, party, riding and seat
- [x] `ui/book.js` lists all 120 MPs with search, filters (party, clique, cohort, riding type) and sort, usable with one thumb

**Stage 3: Votes, divisions and pacing.** Write `bills.js`, `mp.js` (the decision model from `DESIGN.md`), `vote.js`, `voteLights.js`, `pacing.js`, `ui/agenda.js` and `ui/countBoard.js`, plus `data/tuning.json`. A division runs the bells (shortened to real seconds), then the standing count animation. Routine days auto-resolve into a summary line. **By the end of this stage the sim must play a full Parliament headless from `tests.html`.**

- [x] Voice votes resolve without a division when nobody objects
- [x] Divisions count standing members only, honour pairs, and send ties to the Speaker
- [x] Changing an MP's loyalty or clique lean in the console visibly changes their vote
- [x] Bills move through all five stages, with amendments at committee and report
- [x] Routine days auto-resolve; the game stops only for days that matter, and "skip to the next thing that matters" works
- [x] `tests.html` can run a whole Parliament headless with a random bot player and no errors
- [x] Vote lights carry icons as well as color

**Stage 4: The office and meetings.** Write `rooms.js`, `office/`, `sim/meetings.js`, `ui/talk.js` and `ui/dealTable.js`, plus `data/dialogue-lines.json`. Add the evening phase with slots, walk-ins and phone calls, and the Act 1 reversal (the whip calls you in).

- [x] After a sitting day, the game moves to the office and back to the next morning
- [x] A meeting plays talk then deal, and the result lands in the ledger
- [x] Mood changes the visitor's pose and the available lines
- [x] Meetings reveal fields in the knowledge map, and the card updates
- [x] The reversal scene plays when the whip's office calls the player in
- [x] Everything works one-handed in portrait

**Stage 4b: Vertical slice.** Before stage 5, make Act 1's first week playable end to end across all four rooms with placeholder art: a dilemma vote, a whip's-office reversal meeting, a Friday in the riding, a Wednesday caucus. Kelbo plays it and decides what's fun before the career is built out.

- [x] A new player can play one full week of Act 1 from the start menu to the weekend summary
- [ ] `PROGRESS.md` records what Kelbo said worked and what didn't

**Stage 5: Whip tools, the count and rival whips.** Write `tools.js`, `rivals.js` and `ui/ledger.js`. Add the chamber tools, pairing, the attendance chase during bells, act gating, the count board's firm/leaning/lost marks, and rival whip AI with weekly budgets.

- [ ] Each tool can flip at least one MP in a set scenario
- [ ] Tools are gated by act as in `DESIGN.md` section 8
- [ ] Every favor, promise and threat shows in the ledger from both sides
- [ ] The count board's prediction matches the division result within two votes when all marks are current
- [ ] Rival whips act every week: at least one poach, one leak and one pair test are observable in a scenario

**Stage 6: The career, Acts 1 and 2, and the riding.** Write `career.js` (acts, graduation checks, vacancies, rivals), `riding.js`, `riding/`, `ui/ridingUI.js`, `ui/careerUI.js`, `lifeEvents.js`, and the start-game menu (party, riding type, province, age, background). Add the whip's file, the mentor pick, the cohort, the player's skeleton, the private members' bill lottery, Friday riding visits with the whip's leave, town halls and the nomination.

- [ ] A new player starts in Act 1 in any party, gets a mentor and a cohort, and is whipped on a real dilemma vote
- [ ] Rebelling and toeing the line both change the whip's file, riding standing and standing with the whip
- [ ] The riding room works: cases, a town hall, an announcement, and leave that must be granted while the House sits
- [ ] A private member's bill can be drawn, run and voted on
- [ ] Act 1 graduates to Act 2 by being noticed, and Act 2 ends with a vacancy contest against a rival

**Stage 7: The career, Acts 3 to 5, and the caucus room.** Extend `career.js` (assistant and deputy whip duties, opposite numbers, cabinet offers, demotion, floor-crossing, retirement, endings), write `caucus.js`, `caucus/`, `ui/caucusUI.js` and `record.js`. Add the weekly caucus meeting, revolts, expulsions, leader personalities, the Act 3 friend set piece, the Act 4 pairing set piece, knowledge sharing from the whip's office at Act 3, and the whip's record screen.

- [ ] A player can rise from Act 3 to Chief Whip, with each act's graduation and failure both reachable
- [ ] Caucus meets every Wednesday; listen, speak and whisper work; a revolt can be called and resolved
- [ ] A cabinet offer can be accepted (career ends with an epilogue and record) or declined at no cost, and offers keep coming
- [ ] Floor-crossing resets the player to Act 1 in the new caucus with reputation carried over
- [ ] Retirement is available from Act 2 and shows the whip's record

**Stage 8: Confidence, consequences and elections.** Write `confidence.js`, `media.js` and `election.js`. Add confidence votes, confidence-and-supply agreements, a government falling, headlines, scandal scores, the pressure meter, fixed-date elections, reseating, new cohorts and ledger carryover.

- [ ] A minority government can fall on a lost confidence vote and trigger an election
- [ ] A full four-year Parliament and its election play through without errors, and the player's riding can be lost
- [ ] Party blocks, roles and cohorts update after an election; the ledger carries over

**Stage 9: Modes and polish.** Write `modes.js` (scenarios, shared seeds, daily seed), `save.js` with slots and export, a guided first-week tutorial that is Act 1's first week, audio (chamber murmur, division bells, Speaker's gavel, office and riding ambience, caucus room murmur), a settings menu with a color-blind option, and a performance pass across all four rooms.

- [ ] A save survives closing and reopening the browser
- [ ] A new player finishes the first week without help
- [ ] Cold load under 10 MB; switching rooms frees the previous scene
- [ ] Three scenarios, shared-seed entry and the daily seed all start correctly

---

## 9. Testing and debug tools

No test framework and no build step, so testing runs in the browser: URL switches for debugging, and `tests.html` for sim checks.

**URL switches**

| Switch | What it does |
| --- | --- |
| `?seed=TEST-1` | Starts a new game from a fixed seed |
| `?debug=1` | FPS counter (`three/addons/libs/stats.module.js`), seat ids on tap, a hash of the generated Parliament, and `window.whip` exposing `state`, `dispatch` and the sim modules |
| `?scenario=<name>` | Loads a preset state from `data/scenarios/`, for example a confidence vote three short in Act 5, or the Act 3 friend dilemma |
| `?room=office`, `?room=riding`, `?room=caucus` | Boots straight into that room with test visitors |
| `?act=N` | Starts a new game already at act N with a plausible history |

**`tests.html`.** A plain page that imports the sim modules and runs assertions, listing pass or fail on screen. Add checks with each stage:

- The same seed gives the same Parliament hash, including cohorts and cliques.
- Seat counts per party equal the party seat totals, whips sit where section 5 says, and cliques are contiguous.
- A division with pairs counts correctly, and a tie goes to the Speaker.
- A meeting with a scripted choice sequence produces the expected ledger entry.
- Each act's graduation condition fires from a scripted state, and each failure condition does too.
- A broken promise lowers rapport across the MP's cohort and clique.
- A lost confidence vote in a minority sets the election flag.
- A save round-trips through export and import unchanged.
- The bot player completes a Parliament in under a minute with no exceptions.
- Knowledge fields go stale after the tuned number of weeks without contact.

**Testing on the phone**

- Pages takes about a minute to update after a push. Add `?v=<short commit hash>` to the URL to dodge a cached old version.
- Every stage gets a check in both portrait and landscape.
- Test tap targets with a thumb: nothing smaller than 44 px.

---

## 10. Open decisions and defaults

Until Kelbo decides, use these defaults and keep each one a one-line change.

| Decision | Default to use | Where it lives |
| --- | --- | --- |
| Country name | Dominion of Caledor (decided) | `data/world.json` |
| Seat count | 120, 60 a side, 4 rows of 15 (decided) | `data/world.json` |
| Party names and colors | Four fixed core parties (National Union blue, Commonwealth Party red, Labour Democrats orange, Eastern Compact teal) + a generated fifth party per seed (decided) | `data/parties.json`, `data/party-names.json` |
| Title | The Whip (decided) | one constant in `main.js` |
| UI language | English only (decided); UI strings still live in `data/strings.en.json` | `data/` |
| Declining a cabinet offer | No cost; offers keep coming | `sim/career.js` |
| Running for leader | Phase 3 only (decided) | n/a |
| Division bells in play | 30 s unscheduled, 15 s scheduled, real time | `sim/vote.js` |
| Riding visits | Fridays and constituency weeks; leave needed while the House sits | `sim/riding.js` |
| Retirement age pressure | Starts at 65 (Kelbo will tune later) | `sim/career.js` |
| Office tiers | Two | `office/officeScene.js` |
| Art assets | Primitives until the art pass; real GLB models later | `assets/` |
| Whips' seats | Row 2, index 1 and 2; assistant whips at index 1 of rows 3–4 and index 2 of row 1 | `chamber/layout.js` |
| Knowledge staleness | 26 weeks without contact | `data/tuning.json` |
| Rival whip budgets | 45 minutes and 2 favors per week; scales with party size | `data/tuning.json` |
| Pacing stops | Own vote, walk-in, life event, caucus fight, riding crisis, rival move | `sim/pacing.js` |
| Scenarios at launch | Three: minority budget vote, caucus revolt, rookie riding dilemma | `data/scenarios/` |

---

## 11. Build advice

- **The sim is the game.** The four rooms are the skin. Keep the headless bot run in `tests.html` green from stage 3 on; if the career isn't fun in text, 3D won't save it.
- **Go vertical once.** Stage 4b exists so Kelbo plays Act 1's first week before Acts 3 to 5 are built. Change the design doc if the slice says to.
- **Expect stages 4 to 7 to take two or three sessions each.** Split a stage if a session runs long; a half-stage that passes its checks is better than a whole stage that doesn't.
- **Branch per stage, merge to `main` when checks pass.** Pages serves `main`, so a bad push breaks the live game.
- **Mobile 3D specifics.** No real-time shadows (bake them). Nameplates and labels through the CSS2DRenderer addon, not 3D text. Pointer events with `preventDefault`. `100dvh` instead of `100vh` for iOS Safari. Raycast against instanced meshes using `instanceId`. Dispose geometries and materials when leaving a room.
- **Performance budget per room.** Chamber under 60 draw calls; office, riding and caucus under 40 each. Check `?debug=1` on the phone every stage.
- **Keep assets tiny.** Procedural geometry and flat painted textures first; a few small CC0 GLB props later. Never add an asset you can't justify under the 10 MB load budget.
- **When the docs disagree, the design doc wins** on what the game is, and this file wins on how it's built. Note any contradiction in `PROGRESS.md` for Kelbo.

## 12. End of session

Before you finish a session:

1. Run `tests.html` and the stage's done-when checks at the live URL.
2. Append to `PROGRESS.md`: the date, the stage, what was built, what was skipped and why, and anything Kelbo needs to decide, in plain language.
3. Tick the stage's checks in `HANDOFF.md`.
4. Push to `main` and confirm the live URL loads with no console errors.
5. End with a short summary for Kelbo: what to test on the phone, in three to five lines.

---

## 13. Kickoff prompts

Paste the matching prompt at the start of each session.

**Stage 0**

```text
Read DESIGN.md and HANDOFF.md. Do stage 0 of The Whip exactly as HANDOFF.md section 3 says.
Create PROGRESS.md. Push to main when the done-when checks pass, then tell me which GitHub
settings I still need to change myself.
```

**Stages 1 to 9**

```text
Read DESIGN.md, HANDOFF.md and PROGRESS.md. Build stage N of The Whip as HANDOFF.md
section 8 describes, following the specs in sections 5 to 7, the constraints in section 2 and the
build advice in section 11. Stay inside the repo layout in section 4. Add the stage's tests to tests.html. When every
done-when check for stage N passes at the live URL, do the end-of-session steps in section 12.
If something in the docs is unclear or contradicts itself, stop and ask me before guessing.
```

**A fix or a small change**

```text
Read PROGRESS.md and the files involved. Fix the following without changing anything else:
[describe what's wrong and what you expected]. Push to main and tell me what to retest.
```
