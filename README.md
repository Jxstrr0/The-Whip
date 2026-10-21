# The Whip

A phone-first 3D political career game from Longlight Interactive. You start as a rookie backbench MP in the 120-seat House of Commons of the fictional Dominion of Caledor and spend a political lifetime climbing to Chief Whip: the person who counts votes, enforces the line, and gets the caucus into the chamber when it matters.

**Play it:** https://jxstrr0.github.io/The-Whip/

Best on a phone in portrait. Tap to select, drag to look around, pinch to zoom.

## Status

Early development. See [`PROGRESS.md`](PROGRESS.md) for what's built so far and what to test.

## Docs

| File | What it is |
| --- | --- |
| [`DESIGN.md`](DESIGN.md) | The design doc: what the game is. Source of truth for design. |
| [`HANDOFF.md`](HANDOFF.md) | The build handoff: constraints, specs, data contracts and the stage plan. |
| [`PROGRESS.md`](PROGRESS.md) | The running log of what each build session finished. |

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
| `?seed=TEST-1` | Start a new game from a fixed seed |
| `?debug=1` | FPS counter, seat ids on tap, Parliament hash, `window.whip` in the console |
| `?v=<anything>` | Dodge a cached old version after a push |

More switches arrive with later stages; `HANDOFF.md` section 9 has the full list.

## Tech

Plain HTML, CSS and JavaScript modules, with Three.js `0.160.0` from jsDelivr through an import map. Deployed to GitHub Pages from `main` at the repo root. Saves live in the browser's `localStorage`.

Everything in the game (the country, parties, ridings and MPs) is fictional. The procedures are Canadian.
