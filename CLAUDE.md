# The Whip: working rules

Read this before doing anything in this repo. It applies to every session, every stage.

## This is a flagship game. Do it right.

Kelbo's words: "remember this is a flagship game, let's do this right." The Whip is the studio's flagship, not a prototype or a tech demo. Treat every stage as something people will judge Longlight by. In practice that means:

- **Finish things.** A feature is done when it plays well on a phone, not when the code runs. No placeholder text, dead buttons, "TODO" screens or half-wired systems on `main`.
- **Feel matters as much as function.** Camera framing, timing, transitions, sound of the copy, readable type, thumb-sized targets. If a moment is meant to be tense (the division bells, the whip's reversal), it has to feel tense.
- **The sim must be believable.** Votes, rebellions, deals and fallout should make sense to someone who knows how Parliament works. Run whole Parliaments headless and look at the numbers before calling a system done.
- **Writing is a feature.** Dialogue, headlines and UI text should read like a good political drama: specific, dry, varied. No filler lines, no repeated lines in the same scene, no generic "Something happened."
- **Quality over speed.** If a stage needs another pass to be good, give it another pass. Say so in `PROGRESS.md` rather than shipping something thin.
- **Verify, don't assume.** Play it through the real UI at phone size (portrait and landscape) before every merge. No console errors. `tests.html` green. Check the frame rate.
- **Ask when it matters.** When the docs are unclear on something that shapes the player's experience, ask Kelbo instead of guessing. Small calls: decide, then note them in `PROGRESS.md`.

## Sources of truth

- `DESIGN.md` decides what the game is. `HANDOFF.md` decides how it's built. Note any contradiction in `PROGRESS.md`.
- `PROGRESS.md` is the running log for Kelbo, in plain language. Add an entry at the end of every stage.
- `ART-PASS.md` is the plan for the visual pass: the look, the rules, and the steps V0–V8 in order, each with its own done-when checks.

## Hard constraints (from HANDOFF.md)

- No build step. Plain HTML, CSS and ES modules.
- Three.js `0.160.0` only, through the import map from `cdn.jsdelivr.net`. No other external resources.
- Phone-first. Deployed to GitHub Pages from `main` at the repo root (`.nojekyll`). `.github/workflows/pages.yml` publishes every push to `main`; after a merge, check the run went green and the live URL loads.
- Saves in `localStorage` under `whip:` keys, always wrapped in try/catch.
- Deterministic sim: no `Math.random` in `src/sim/`; all randomness through the seeded RNG.
- `src/sim/` never touches the DOM or Three.js.
- Every tuning number lives in `data/tuning.json`. Dialogue and content are data in `data/*.json`.
- Fictional names only: country, parties, ridings, MPs.
- Every push to `main` is playable with no console errors. Small commits.

## Build plan status

Every HANDOFF stage (0–9) and the art pass (`ART-PASS.md`, V0–V8) are done and merged. The build is complete; what comes next is Kelbo's playtest notes, which go at the end of `PROGRESS.md` and set the order of any further work. Keep to the Order Paper system and the look the art pass set (`src/look.js`, `src/kit3d.js`, `src/figures.js`, `src/models.js`, `src/textures.js`). Kelbo's target phone has headroom, so keep the visual budget up rather than trimming it. Longlight's colours are in (`--brand*` in `css/style.css`, the sun mark, the loading screen). Still owed by Kelbo: a phone frame-rate check with `?debug=1`.

Round two (Kelbo's twelve picks from the once-over, in `PROGRESS.md` from "Round two" on): 1 reframe ✔, 2 the Clerk reads names ✔, 3 placards ✔, 4 clothes ✔, 5 paper dropdowns ✔. Next: 7 Question Period, 8 office by rank, 9 front page, 10 seasons, then 12 the bells chase, 13 the cold open, 14 the timeline.
