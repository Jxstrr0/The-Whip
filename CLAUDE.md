# The Whip: working rules

Read this before doing anything in this repo. It applies to every session, every piece of work.

## This is a flagship game. Do it right.

Kelbo's words: "remember this is a flagship game, let's do this right." The Whip is the studio's flagship, not a prototype or a tech demo. Treat every change as something people will judge Longlight by. In practice that means:

- **Finish things.** A feature is done when it plays well on a phone, not when the code runs. No placeholder text, dead buttons, "TODO" screens or half-wired systems on `main`.
- **Feel matters as much as function.** Camera framing, timing, transitions, sound of the copy, readable type, thumb-sized targets. If a moment is meant to be tense (the division bells, the whip's reversal), it has to feel tense.
- **The sim must be believable.** Votes, rebellions, deals and fallout should make sense to someone who knows how Parliament works. Run whole Parliaments headless and look at the numbers before calling a system done.
- **Writing is a feature.** Dialogue, headlines and UI text should read like a good political drama: specific, dry, varied. No filler lines, no repeated lines in the same scene, no generic "Something happened."
- **Quality over speed.** If a stage needs another pass to be good, give it another pass. Say so in `PROGRESS.md` rather than shipping something thin.
- **Verify, don't assume.** Play it through the real UI at phone size (portrait and landscape) before every merge. No console errors. `tests.html` green. Check the frame rate.
- **Ask when it matters.** When the docs are unclear on something that shapes the player's experience, ask Kelbo instead of guessing. Small calls: decide, then note them in `PROGRESS.md`.

## Sources of truth

- `DESIGN.md` decides what the game is. `HANDOFF.md` decides how it's built. Note any contradiction in `PROGRESS.md`.
- `PROGRESS.md` is the running log for Kelbo, in plain language. Add an entry at the end of every piece of work, newest last.
- `ART-PASS.md` was the plan for the visual pass (V0 to V8, all done). It stays as the record of the look's rules.
- `README.md` is the short public guide: how to play, how to run it locally, the URL switches.
- Where a doc and the code disagree, say so in `PROGRESS.md` and fix the doc. `HANDOFF.md` section 4 (layout) and section 7 (data contracts) are the original plan; the code has grown past them, and `src/` is authoritative where they differ.

## Hard constraints (from HANDOFF.md)

All of these were checked against the code on 2026-10-24 and hold.

- No build step. Plain HTML, CSS and ES modules. No npm, no bundler, no framework. The files in the repo are the files Pages serves.
- Three.js `0.160.0` only, through the import map from `cdn.jsdelivr.net` (in `index.html`, `tests.html` and `tools/lineup.html`). That CDN is the only outside resource. The Newsreader font is self-hosted in `assets/fonts/`; audio is synthesised in WebAudio, so no sound file is fetched.
- Phone-first. Deployed to GitHub Pages from `main` at the repo root (`.nojekyll`). `.github/workflows/pages.yml` publishes every push to `main`; after a merge, check the run went green and the live URL loads.
- Saves in `localStorage` under `whip:` keys (`whip:save:1` to `whip:save:3`, `whip:settings`), always wrapped in try/catch. Only `src/save.js` touches `localStorage`.
- Deterministic sim: no `Math.random` in `src/sim/`; all randomness through the seeded RNG (`src/sim/rng.js`). The renderer may use `Math.random` for cosmetic effects only.
- `src/sim/` never touches the DOM or Three.js. It reads static data through `src/sim/config.js` (`tuning()`, `data()`, `say()`).
- Every tuning number lives in `data/tuning.json`. Dialogue and content are data in `data/*.json`. UI and sim text lives in `data/strings.en.json` (`t()` in `src/ui/text.js`, `say()` in `src/sim/config.js`).
- Fictional names only: country (the Dominion of Caledor, capital Ostrava), parties, provinces, ridings, MPs.
- Every push to `main` is playable with no console errors. Small commits.

## Build plan status

As of 2026-10-24 (the last merge is PR #75):

- **Stages 0 to 9 of `HANDOFF.md` section 8: done and merged.** The four rooms, the five-act career from rookie to Chief Whip, the whip's tools, rival whips, confidence votes and elections, scenarios, shared and daily seeds, saves with three slots and export.
- **The art pass (`ART-PASS.md`, V0 to V8): done and merged.** The Order Paper UI, CC0 props and textures, baked light, Longlight's colours (`--brand*` in `css/style.css`, the sun mark, the loading screen).
- **Round two (Kelbo's twelve picks after the once-over, plus "faces you earn"): done and merged.** Reframed office and riding, the Clerk reads the names, placards, suits, paper pickers, Question Period, an office that grows with rank, the front page, seasons, the bells as a chase, the cold open, the career timeline.
- **Playtest work since then, all merged:** a softer and tidier Order Paper, the aim chip and "Your job here" lines (`src/sim/goals.js`), the Chief Whip's caucus tools (free a vote, expel), stakes at home, "Your row" screens, two readability passes, all text moved to data, the Question Period content pass, bill names in prose (`billName`), the deal or no-deal verdict card, more dialogue (mentor, riding, the office doors), add to home screen and haptics, the "Last time..." resume line and the glossary, the week's vote (sim, part one, `src/sim/bigVote.js`), and the body kit and motion kit for every figure (`src/body.js`, `src/motion.js`).
- **Not started yet:** part two of the week's vote (UI): a count meter by the date bar, Monday's front page leading with the vote, the Clerk marking your names as they're read, a result card. See the "Next" list at the end of that PROGRESS entry.
- **Performance:** Kelbo says it's fine for now (2026-10-24). The chamber sits at 60 draw calls and the office at 44 empty, 56 with a visitor; no trimming is needed. Keep measuring with `?debug=1` when adding to a room, and raise it if a room climbs well past these numbers.
- **Waits on Kelbo:** trying "Add to Home Screen" and the buzz on a real phone; the next batch of playtest notes, which set the order of further work.

Standing guidance that still applies:

- Keep to the Order Paper system and the look the art pass set (`src/look.js`, `src/kit3d.js`, `src/body.js`, `src/figures.js`, `src/motion.js`, `src/models.js`, `src/textures.js`). Kelbo's target phone has headroom, so keep the visual budget up rather than trimming it.
- New scenes get a "Your job here" line from `src/sim/goals.js`. Meeting slots per act come from `slotsForAct` in `src/sim/career.js` (Act n reads `meetings.slotsByAct[n - 1]`).
- Nothing can be spent on yourself: pickers leave you out and the sim refuses self-targeted tools, calls and invitations.

## Where things live

- `index.html`: the game page (canvas, UI root, import map, home-screen metas). `manifest.webmanifest` and `assets/icons/` are the install icons.
- `tests.html`: the browser-run sim tests (see below). `tools/lineup.html`: a dev page showing the figure in every pose.
- `css/style.css`: all UI styling, Order Paper tokens and `--brand*` colours at the top, safe areas, large text and colour-blind classes.
- `data/`: all content and numbers. `tuning.json` (every number, grouped by system), `strings.en.json` (every UI and sim line), `dialogue-lines.json` (office meetings and partings), `caucus.json`, `constituents.json` (riding cases, reporter, president), `question-period.json`, `career.json` (career beats), `headlines.json`, `memoir.json`, `glossary.json`, `cold-open.json`, `hill.json` (the bells chase), `seasons.json`, `bill-templates.json`, `scenarios.json` (the three scenarios), `world.json`, `parties.json`, `party-names.json`, `ridings.json`, `names.json`, `backgrounds.json`, `cliques.json`.
- `src/main.js`: boot, the start menu, the world (renderer, rooms, every UI piece), the URL switches, `?debug=1` tools.
- `src/state.js` (the one state object and `dispatch`), `src/save.js` (slots, migrations, export and import), `src/settings.js`, `src/rooms.js` (one live room at a time), `src/framing.js` (camera aim around the sheet), `src/loadData.js`.
- `src/sim/`: the whole simulation, no DOM, no Three.js. `generate.js` (a Parliament from a seed), `mp.js` (the vote model), `vote.js`, `bills.js`, `pacing.js` (the day loop and what stops you), `meetings.js`, `tools.js`, `count.js`, `rivals.js`, `career.js` and `ranks.js` (Acts 1 to 5), `caucus.js`, `riding.js`, `confidence.js`, `election.js`, `media.js`, `record.js` (endings, floor-crossing), `memoir.js`, `modes.js` (career, scenario, shared, daily; `SAVE_VERSION`), `questionPeriod.js`, `pmb.js`, `lifeEvents.js`, `bigVote.js`, `goals.js`, `stakes.js`, `row.js`, `coldOpen.js`, `calendar.js`, `knowledge.js`, `relationships.js`, `fill.js` (slot filling), `bot.js` (the headless player), `actions.js` (the action table), `config.js`, `rng.js`.
- `src/chamber/`, `src/office/`, `src/riding/`, `src/caucus/`: the four Three.js rooms, each with its scene, camera and figures. `src/chamber/layout.js` is pure seat math.
- `src/body.js`, `src/figures.js`, `src/motion.js`, `src/faces.js`: the shared figure kit (body, instanced crowds, poses and motion, faces you earn). `src/look.js`, `src/kit3d.js`, `src/textures.js`, `src/models.js`, `src/weatherFx.js`, `src/pressPhoto.js`: shared rendering helpers.
- `src/ui/`: the HTML overlays. `agenda.js` (date bar, Continue and Skip, the papers), `countBoard.js`, `talk.js` and `dealTable.js` (office), `caucusUI.js`, `ridingUI.js`, `qpUI.js`, `careerUI.js`, `electionUI.js`, `recordUI.js`, `memoirUI.js`, `frontPage.js`, `coldOpen.js`, `hillMap.js`, `book.js`, `rowSheet.js`, `mpCard.js`, `ledger.js`, `menus.js`, `hud.js`, `picker.js`, `stakes.js`, `gloss.js`, `text.js`.
- `src/audio.js` (WebAudio, no files), `src/haptics.js`.
- `assets/`: fonts, icons, CC0 models and textures (`assets/LICENSES.md` lists the sources).
- `.github/workflows/pages.yml`: the deploy. `.nojekyll`: Pages serves the repo as is.

## How to run the tests

There is no npm and no test runner. Everything runs in a browser over http (ES modules do not load from `file://`).

1. Serve the repo root: `python3 -m http.server 8000` (or `npx serve .`).
2. Open `http://localhost:8000/tests.html`. The page imports the sim modules, plays whole Parliaments with the bot, and prints `N passed, M failed` at the top in about 30 seconds. Failures are red with the message under them. As of 2026-10-24: 132 passed, 0 failed.
3. Open `http://localhost:8000/index.html` at a phone size (390 × 844 portrait, then landscape) with the console open, and play the piece you changed. No console errors.

Headless (what the docs refresh used): Playwright's Chromium against the same local server. The page still needs the CDN for Three.js. Behind an HTTPS-only proxy, launch with `proxy: { server, bypass: '127.0.0.1,localhost' }` and set `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK=1`, or the localhost request is sent through the proxy and the page never loads. Wait until `#summary` no longer reads "Running…".

On the live site, `tests.html` runs the same way at the live URL.

## Working on this repo

- Work on a branch and open a pull request into `main`. Pages publishes `main`, so a bad push breaks the live game.
- Keep pull requests small enough to review on a phone, and end each piece of work with a `PROGRESS.md` entry: what changed, what was checked, what Kelbo should test.
- Explain changes in plain language. Kelbo is a beginner-plus coder who reads mostly on his phone.
