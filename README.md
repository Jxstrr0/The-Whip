# The Whip

A phone-first 3D political career game from Longlight Interactive. You start as a rookie backbench MP in the 120-seat House of Commons of the fictional Dominion of Caledor and spend a political lifetime climbing to Chief Whip: the person who counts votes, enforces the line, and gets the caucus into the chamber when it matters.

**Play it:** https://jxstrr0.github.io/The-Whip/

Best on a phone in portrait. Landscape and desktop work too.

## Status

**The Act 1 vertical slice (stage 4b) is playable.** It covers stages 0–4b of the build plan: a start menu, the chamber, the office, the caucus room and the riding, plus a guided first week. After that week the simulation keeps running week to week; elections, the later acts and the whip's tools come in stages 5–9. See [`PROGRESS.md`](PROGRESS.md) for exactly what's built and what to test.

## How to play

- **Start a career** from the menu: pick a name, party, background and the kind of riding you want. The seed decides the Parliament; share it to play the same one as a friend.
- **The agenda bar** at the bottom shows the day. **Continue** goes to the next stop. **⏭** skips ahead to the next thing that needs you. Tap the date to see the news feed.
- **In the chamber**: drag to look around, pinch to zoom, tap an MP for their card, double-tap a party to frame it. When the division bells ring you choose: vote with your party, break with the line, or be somewhere else.
- **In the office**: see the MPs at your door, invite someone from the Book, or make a call. Meetings are a short conversation (read their mood) and then a deal table of what you offer and what you ask. Promises land in the ledger and people remember them.
- **In caucus** (Wednesdays): listen to read the room, speak once, whisper to a neighbour.
- **In the riding** (Fridays, if the whip lets you go): hear cases, face the local reporter, keep your riding association happy, hold a town hall.
- **The Book** lists all 120 MPs, with search, filters and sorting. Each card shows only what you've actually learned about that MP.

The game saves automatically in your browser.

## Docs

| File | What it is |
| --- | --- |
| [`DESIGN.md`](DESIGN.md) | The design doc: what the game is. Source of truth for design. |
| [`HANDOFF.md`](HANDOFF.md) | The build handoff: constraints, specs, data contracts and the stage plan, with finished checks ticked. |
| [`PROGRESS.md`](PROGRESS.md) | The running log of what each build session finished, decisions made, and what needs Kelbo. |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for every build session: the flagship quality bar and the hard constraints. |
| [`ART-PASS.md`](ART-PASS.md) | The visual pass: the look the rooms are going for and the ordered steps to get there. |
| [`tests.html`](tests.html) | Browser-run sim tests. Open it on the live site to run them. |

## Running locally

There's no build step. Serve the repo root with any static file server and open it in a browser:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Opening `index.html` straight from the file system won't work, because browsers block ES modules on `file://`.

## Debug switches

| URL | What it does |
| --- | --- |
| `?seed=TEST-1` | Skip the menu and start a game from a fixed seed (not guided) |
| `?seed=TEST-1&guided=1` | The same, with the guided first week |
| `?party=p2` | With `?seed`, play for a given party (`p1` National Union, `p2` Commonwealth, `p3` Labour Democrats, `p4` Eastern Compact) |
| `?debug=1` | FPS counter, the Parliament hash, tuning sliders for every number in `data/tuning.json`, and `window.whip` in the console (`state`, `dispatch`, the sim modules) |
| `?v=<anything>` | Dodge a cached old version after a push |
| `tests.html` | Run the sim test suite in the browser |

## Code layout

`src/sim/` is the simulation. It's pure JavaScript with no DOM and no Three.js, and all randomness comes from the seeded RNG. `src/chamber/`, `src/office/`, `src/caucus/` and `src/riding/` are the four 3D rooms, and only one exists at a time. `src/ui/` holds the HTML overlays. Game content (names, ridings, bills, dialogue, constituents, caucus lines, headlines, UI text) and every tuning number live in `data/*.json`. `HANDOFF.md` section 4 has the full layout.

## Tech

Plain HTML, CSS and JavaScript modules, with Three.js `0.160.0` from jsDelivr through an import map. Deployed to GitHub Pages from `main` at the repo root: every push to `main` publishes automatically through `.github/workflows/pages.yml` (no build, it uploads the repo as is). Saves live in the browser's `localStorage` under `whip:` keys.

Everything in the game (the country, parties, ridings and MPs) is fictional. The procedures are Canadian.
