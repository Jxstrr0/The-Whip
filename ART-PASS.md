# The Whip: the art pass

The plan for taking the four rooms from whitebox to the look the design doc asks for: **"semi-realistic oak, green leather and stone under baked lighting."** It is written for the next build sessions (Opus 5.5). Read `CLAUDE.md` first; everything there still applies. This file says *what to build, in what order, and how to know each step is done*.

The sim is finished for this slice and is not touched by this pass except where a step says so. The game must stay playable on `main` after every step.

---

**Status (2026-10-21):** V0–V8 are done and merged, one PR each (#11, #13–#19, and the V8 numbers below). What's left for Kelbo: the frame rate on a real phone, and Longlight's colours for the masthead. Section 6 says what comes next.

## 1. Where we are

Diagnosis from playing the live build at phone size (390 × 844 portrait and landscape):

| Area | What's wrong now |
| --- | --- |
| Materials | Every surface is a flat vertex colour under three lights. No grain, no shading variation, no contact shadows. The rooms read as a greybox with colours. |
| Lighting | One point light makes a bright hotspot on the chamber ceiling. The office and caucus are evenly lit and flat. Nothing is "baked". |
| Figures | A capsule and a sphere. No shoulders, neck, hair or collar. Crowds have one skin tone per hash but no other variation, so 120 MPs look like 120 pegs. Moods in the office rely on arm angles that are hard to read at phone size. |
| Framing | The chamber opens on a map view from above the bar, so your own seat means nothing and MPs are 4 px tall. The office "host" shot is mostly window and chair backs. In the riding, the visitor chair's back fills the middle of the frame. The player's own head pokes into the bottom corner in the office and riding. |
| Motion | Hard cuts between rooms. Nobody moves unless a visitor is walking in. The division is the one choreographed moment and it needs more weight. |
| UI | Competent but generic: system sans, grey panels, gold used for everything from the primary button to toasts. Toasts cover the figure you are talking to. |

What's right and must be kept: one renderer, instancing, tiny draw counts (chamber ~16 of 60), rooms disposed on leave, one-thumb sheets, vote icons as well as colour, the stable count board.

## 2. The look

Decide once, then every room follows it. These are the calls; Kelbo can overturn any of them (note it in `PROGRESS.md`).

- **Palette.** One module, `src/look.js`, exports the tokens every room uses: oak (`#6e4a2b` mid, `#8a5f38` light, `#3f2a17` dark), green leather (`#2f5a3c`, `#3a6a48`), stone (`#b9b0a0`, `#8f877a`), brass (`#c9a24a`), paper (`#ece6d6`), baize, cloth. Party colours stay in `data/parties.json` and are never restyled.
- **Light.** Warm key from the windows, cool fill, warm chandeliers. Shading comes from baked vertex ambient occlusion and soft contact shadows, not real-time shadow maps. The rooms should feel like late afternoon in an old building.
- **Figures.** Stylised and faceless, with a readable silhouette: shoulders, a neck, a head with a hair cap, a white collar wedge, a suit in the party colour, a lap when seated. Think boardroom chess pieces, not dolls. No faces: at this polygon and texture budget they fall into the uncanny valley, and expression already lives in pose and in the mood pill in the UI. Variation per MP (skin, hair, suit shade, height) comes from the id hash, so it's stable across sessions and costs nothing.
- **Camera.** The backbench feel: in Acts 1 and 2 the chamber opens from your own seat, low, looking across the aisle. An overview is one tap away. Every other room frames the person you're dealing with in the top 40 % of a portrait screen, above the sheet.
- **The UI is "The Order Paper."** Kelbo picked this over a dark ledger and a broadcast look. Every sheet, card and menu is a piece of printed parliamentary paper laid over the dark room: cream paper, ink, thin ruled lines, letterspaced small caps for section labels, a serif throughout, rubber stamps for outcomes (CARRIED in green ink, DEFEATED in red, ABSENT in grey, each set down with a thump). The green-leather colour of the benches is the one primary action per sheet; brass is for rules and the bells; party colours are ink swatches beside names. Longlight's studio colours (Kelbo is sending them) are reserved for the brand: the menu masthead, the loading mark, the weekly review's header. Nothing on screen should look like a generic phone app panel: no grey glass, no gold-on-charcoal buttons, no native selects. The full spec is in step V3.
- **Motion.** Small, constant and cheap: head turns, a lean to a neighbour, a camera that eases on every state change, a 250 ms fade between rooms. Nothing that needs a skeleton or a physics step.

## 3. Rules for this pass

- All hard constraints in `CLAUDE.md`: no build step, Three.js `0.160.0` only, nothing fetched at runtime from anywhere but the repo and the Three.js CDN. **Real assets are in**: Kelbo wants the four rooms to look stunning, so CC0 models (GLB), CC0 PBR textures (1K JPG) and OFL fonts (woff2) are committed under `assets/` and loaded from there with `GLTFLoader` / `TextureLoader` from `three/addons`. Rules: CC0 or OFL only, with every source and licence listed in `assets/LICENSES.md`; the cold load stays under 10 MB (budget: models 4 MB, textures 3 MB, fonts 0.4 MB); nothing from a site that needs a login; the procedural kit stays as the fallback and for anything bespoke (the Speaker's chair, the Mace, the figures). The shortlist from the asset survey lives in section 7.
- **No real-time shadows, no post-processing passes.** `EffectComposer` costs a full-screen pass per frame on a phone. A vignette is a CSS radial gradient on `#ui`, which is free.
- **Budgets.** Chamber under 60 draw calls, other rooms under 40. Pixel ratio stays capped at 2. Canvas textures at most 1024² and few of them. 30 FPS or better on a mid-range phone; the headless browser's FPS is meaningless (software rendering), so judge frame cost by draw calls, triangle counts and `?debug=1` on a real phone.
- **`src/sim/` is not touched** except in V2 (the own-seat camera reads the player's `seatId` from state, which already exists) and V7 (a routine-day "someone leaves and comes back" event, which is cosmetic and must not change any sim result or the Parliament hash).
- **Verify, don't assume.** Each step ends with: `tests.html` green, no console errors, portrait and landscape screenshots of every screen the step touched (keep them in the scratchpad, not the repo), draw-call count per room logged in the `PROGRESS.md` entry, and a run of the guided week through the real buttons.
- **One PR per step**, merged when its checks pass. A `PROGRESS.md` entry per step in plain language for Kelbo, with before/after notes. Don't start the next step on an unmerged one.
- **Data stays data.** Any new copy (board titles, poster text, photo captions) goes in `data/strings.en.json`. Any new timing or size that someone might want to tune goes in `data/tuning.json` under a `look` key.

## 4. Steps

Do them in this order. Each is one session or less; split a step if it runs long, but merge only halves that pass their checks.

### V0 · Foundation: materials, light, shading

**Files:** new `src/look.js`; `src/kit3d.js`; `src/main.js` (renderer); every `*Scene.js` (swap in the shared helpers, no redesign yet).

1. **Tone mapping.** In `main.js`: `renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0` (tune by eye, keep in `tuning.look.exposure`). Output stays sRGB. Re-check every room: the flat colours will shift and the hotspot will get worse until step 3 fixes the lights.
2. **Tile textures.** `tileTexture(kind, size = 256)` in `kit3d.js` draws a repeating greyscale grain (`wood`, `carpet`, `stone`, `leather`, `cloth`, `paper`) on a canvas, `wrapS = wrapT = RepeatWrapping`. Values stay in 0.75–1.0 so the vertex colour still carries the hue and the texture only adds grain. `vertexMaterial({ map })` multiplies them. For consistent grain density, `box()` and `slab()` scale each face's UVs by that face's world size (`uvScale` option, default 1 unit = 1 repeat). One material per texture kind per room, so draw calls rise by at most four per room.
3. **Lights.** Replace `addSoftLights` with `roomLights(scene, { key, fill, hemi, lamps })` that uses `decay = 2` point lights (physically correct in r160) with sane intensities, and emissive geometry for anything that should look lit (window panes, lamp shades, chandeliers). Kill the chamber ceiling hotspot: three chandeliers (an emissive disc plus a point light each, `distance` 14) instead of one light at 30.
4. **Baked AO.** `bakeAO(geo, { floorY, bounds, strength })` darkens vertex colours by closeness to the floor and to the walls (a cheap analytic occlusion: `1 - strength * max(0, 1 - d / 0.6)` for each of floor and nearest wall). Run it on every merged shell before it becomes a mesh. Corners and the undersides of desks go darker; the room stops floating.
5. **Contact shadows.** `contactShadows(points, { radius, opacity })` returns one `InstancedMesh` of radial-gradient planes 1 cm above the floor, `depthWrite: false`. Under every chair, desk pair, visitor and crowd figure. One draw call per room.
6. **Vignette.** `#ui::after` with a radial gradient from transparent to `rgba(0,0,0,0.35)` at the edges, `pointer-events: none`.

**Done when:** all four rooms render with grain, AO and contact shadows; no ceiling hotspot; chamber ≤ 24 draw calls, others ≤ 16; the colour of a government bench, a desk and a wall in a screenshot is within sight of the palette tokens (no neon, no mud); exposure feels right in both the dark chamber and the bright riding office; screenshots before/after for all four rooms.

### V1 · Figures

**Files:** new `src/figures.js` (shared builder); `src/chamber/mps3d.js`, `src/caucus/caucusFigures.js`, `src/riding/constituents.js` (instanced crowds); `src/office/visitor.js` (the articulated figure).

1. **The seated silhouette**, one function `seatedFigureParts()` returning four geometries: `suit` (torso with shoulders: a capsule scaled 1.35 wide at the top, a lap box, upper arms resting), `skin` (neck cylinder + head sphere), `hair` (a cap: the top 55 % of a slightly larger sphere, with 3 variants: full, receding, none), `shirt` (a white collar wedge and a shirt-front strip). A standing variant for crowds and walkers. Keep the whole figure under 600 triangles.
2. **Four instanced meshes per crowd**, not two: suit, skin, hair, shirt. Suit colour = party colour through `instanceColor`; skin from 8 tones and hair from 6 (black, dark brown, brown, auburn, grey, white) by id hash; suit lightness jittered ±6 %; height 0.94–1.06; a small random lean and head yaw. Shirt has no instance colour. The selection outline becomes a gold rim on the suit part only.
3. **The articulated figure** (`visitor.js`) is rebuilt from the same parts plus forearms, hands (small spheres) and shoes. Re-pose the four moods so they read in a 300 px tall viewport: *cooperative* upright, hands on knees; *guarded* arms genuinely crossed over the chest (the forearms must overlap); *angry* leaning in with both hands flat on the desk edge; *anxious* shoulders in, hands clasped in the lap, head down. The walk-in shortens to 1.4 s and the legs swing from the hip, not the knee.
4. **The player's own figure** uses the player's party colour and hides its head in any over-the-shoulder shot (the shoulder at the frame edge is the point; a skin-coloured blob in the corner isn't).
5. **Idle life**, cheap: every ~2 s one random visible MP turns their head 20° toward a neighbour and back over 0.8 s (update two instance matrices, flag `needsUpdate`). Nothing else moves yet.

**Done when:** at the default chamber camera a head is ≥ 6 px tall on a 390 px wide screen and parties still read as blocks; the four moods are distinguishable in a blind screenshot test at portrait size; chamber ≤ 30 draw calls; the town hall crowd no longer looks like one person copied 28 times.

### V2 · The chamber

**Files:** `src/chamber/scene.js`, `src/chamber/camera.js`, `src/chamber/voteLights.js`, `src/main.js` (top bar buttons), `data/strings.en.json` (already has `btn.myseat`, `btn.overview`).

1. **Your seat is the default view in Acts 1–2** (HANDOFF §5, never built). `camera.js` gains a `home(seat)` mode: position 1.1 m behind and 1.45 m above your seat, looking across the aisle at the opposite front bench; orbit limits become relative to that view (±50° sideways, no looking behind you); pinch zooms 3–14 m. The top bar gets one toggle: **Overview** ↔ **My seat** (the strings exist). "Reset view" is replaced by that toggle. Double-tap party framing works from both. The Book's "fly to MP" uses the overview.
2. **The division choreography.** When the bells ring, the camera eases to a three-quarter overview that shows both sides (so the sweep of lights reads), the hemisphere light dims to 0.8× and every seat lamp pulses slow amber. On the count, each yea/nay lights its lamp and a short vertical glow quad (an additive plane, 0.3 × 0.6 m) above the seat for 0.4 s, then settles to the icon. The result holds until Continue, then the camera returns home. Timings in `tuning.look.division`.
3. **The shell.** Oak wainscot with recessed panel lines (thin dark strips every 1.2 m); carpet grain; stone with block lines; windows as emissive pale-gold panes with dark mullions, each throwing a soft wash on the wall below (a point light, `distance` 6, only on the seven on each side nearest the camera: 14 max, or four wider ones if draw/light cost bites); gallery front rail with posts, and a dozen static spectator figures in grey in the galleries; the Speaker's chair with a taller carved back and a canopy crest; the Clerk's table with a green cloth runner and the Mace resting on brackets; the bar with its two posts and a short brass rail along the bar-end doors.
4. **Row shadows.** One long gradient strip under each row of desks (8 strips) instead of 240 blobs.

**Done when:** a new game opens on your own desk with your neighbours and the aisle in view, and "Overview" shows the whole House; the bells-to-result sequence reads as one piece of theatre in a 15 s screen recording; chamber < 60 draw calls (expected ~45 with window lights); no console errors; `tests.html` green; guided week plays through.

### V3 · The UI: The Order Paper

**Files:** `css/style.css` (rewrite), `src/ui/*.js` (markup classes, custom controls, stamps), `src/main.js` (room fade, top bar), `src/ui/menus.js`, `assets/fonts/`, `data/strings.en.json`.

The system, so every sheet agrees:

- **Paper.** Sheets are cream (`--paper: #f3ead8`, `--paper-shade: #e6dac2` for inset panels, `--ink: #1d1a16`, `--ink-faint: rgba(29,26,22,0.16)` for rules). A faint paper grain via an inline SVG `feTurbulence` data URI at 4 % opacity (inline, so not an external resource). Square-ish corners (4 px), a 2 px top rule in bench green (`--bench: #2f5a3c`) with a 1 px brass hairline under it (`--brass: #b8923a`), and a soft shadow so the paper sits *on* the room, not in it. The sheet handle is a short ink dash.
- **Type.** One serif family for everything (the OFL serif picked in section 7, self-hosted woff2 in regular, italic and bold; `Georgia, "Iowan Old Style", serif` as fallback). Headings 22 px, body 16 px, metadata 12.5 px in letterspaced small caps (`font-variant-caps: all-small-caps; letter-spacing: 0.08em`). Numbers `tabular-nums`. The count board's big tally uses the same serif at 40 px, not a second family.
- **Colour roles.** Ink for text. Bench green for the single primary action per sheet (solid green, cream text). Brass for the bells line, section rules and the "needed" marker on the count bars. Party colours only as ink swatches: a 4 px vertical bar beside an MP's name, a tinted stamp on a party line. Red (`#a8322d`) only for a DEFEATED stamp and a broken promise. Longlight's brand colours on the masthead and brand mark only.
- **Stamps.** Outcomes are rubber stamps: an inline SVG rounded rectangle with the word in caps, rotated −6°, ink at 85 % with a slightly ragged edge (`feTurbulence` displacement at low scale). CARRIED / DEFEATED / ABSENT / PAIRED / DEAL / NO DEAL / LEAVE GRANTED. They thump in: scale 1.25 → 1 over 140 ms with a 60 ms overshoot. Used on the count board result, the meeting toast, the riding case list, the weekly review.
- **Controls.** No native look anywhere a player sees. Buttons: bench-green primary, ink-outlined secondary, both 48 px tall with a 2 px press-down. Selects are custom: a ruled field that opens a paper list sheet. Text inputs are a ruled underline with the label in small caps above. Toggles are ink checkboxes with a tick. The Book's filter chips are small paper tags.
- **Top bar.** No panel. A small cream tag with the masthead "THE WHIP" in small caps, the Book and view-toggle as paper tags, the ☰ as an ink glyph. The seed/hash line stays debug-only.
- **Toasts** are paper slips that slide down from under the top bar (180 ms), hold 4 s, and slide away; two lines max, never over the figure's head.
- **Motion.** Sheets are set down: translateY(24 px) + fade over 180 ms ease-out. Lists fade their rows in with a 20 ms stagger. The bells line pulses brass at 1 Hz. Room switches fade through ink-black over 120 ms out / 250 ms in via a `#fade` div; the first frame of the new room renders before the fade-in.
- **The menu** is a title page: the chamber at the overview behind, orbiting at 2°/s under a 70 % dark gradient; a cream title page with "THE WHIP" as a masthead, a rule, "Dominion of Caledor · House of Commons", the tagline in italic, the new-career form as ruled fields, and the Longlight mark and studio name at the foot in the brand colours.
- **The weekly review** is laid out like a front page: a masthead with the week, two columns in landscape, the stamps for each division, the whip's view as a pull quote.

**Done when:** every sheet screenshot in portrait and landscape; body text contrast ≥ 7:1 on paper; every tappable thing ≥ 44 px; no native control visible in any screenshot; the fonts load from `assets/fonts` with no FOUT longer than one frame (preload links in `index.html`); the room switch never shows a frame of the old room over the new; someone shown the menu and a sheet cold would not guess the engine or the tooling.

### V4 · The office

**Files:** `src/office/officeScene.js`, `src/office/officeCamera.js`, `src/office/visitor.js` (poses only if V1 left gaps).

1. **Framing.** `host`: camera (0.55, 1.45, 1.35) looking at the visitor's head (−0.5, 1.1, −1.0), FOV 50 in landscape; in portrait the head sits ~30 % from the top, above the sheet. The player's shoulder is visible bottom-left on purpose. `hostDeal` pushes in 0.3 m. `empty` shows the room with the door in frame so a walk-in enters from the right place.
2. **The room.** A desk lamp with a warm pool (emissive shade + point light `distance` 3), window blinds (slats as thin boxes) with the lawn repainted: horizon, layered trees, the tower, a sky gradient that changes with the time of day already in state (morning / evening tint); a bookshelf with varied spine heights and colours; papers and a folder on the desk; a framed map on the wall; the count board as a corkboard with pinned cards (the existing `drawBoard`, restyled); a proper door frame; carpet grain and AO from V0.
3. **The reversal**: the whip's office is a different room, not the same one with the chairs swapped. Darker wood, a bigger desk, a flag on a pole behind the chair, two lamps, no window view (blinds closed). `create(ctx)` takes `tier` already; add `variant: 'whip'`.
4. **Tier 2** (Acts 4–5) only needs to still build; don't polish it in this pass.

**Done when:** < 40 draw calls; the visitor's head and both hands are visible in portrait in all four moods; the reversal is recognisable as "their room" in a single screenshot.

### V5 · The riding

**Files:** `src/riding/ridingScene.js`, `src/riding/ridingCamera.js`, `src/riding/constituents.js`.

1. **Framing.** The visitor chair turns to an open three-quarter angle with a lower back (0.45 m) so it stops blocking the shot; camera (0.55, 1.5, −2.0) looking at (0.1, 1.05, −0.1). The reporter stands (with a notebook: a small box in one hand); the association president and constituents sit.
2. **The storefront.** Mullions and a glass door in the +z wall; the riding's name painted backwards on the glass (it's read from outside); a daylight wash into the room from the window (a wide, low-intensity point light); the street repainted per type in two layers (far: skyline or horizon; near: a parked car, a lamp post, a bench, a mailbox) so the four types are unmistakable in one glance; the photo wall with six real compositions drawn on canvas (a ribbon cutting, a rink, a field, a parade, a plant gate, a school); a coffee maker, a plant, a noticeboard with pinned flyers.
3. **The town hall.** The crowd stands on the sidewalk in front of the storefront with the lamp post lit; V1 figures with height variation and contact shadows; when the room's mood is under 35, four of them hold signs (blank boards, the text is in the UI). Mood also shows in posture: leaning in above 60, arms crossed below 40.

**Done when:** < 40 draw calls; screenshots of all four riding types; the visitor reads in portrait; the town hall looks like a place, not a sky.

### V6 · The caucus room

**Files:** `src/caucus/caucusScene.js`, `src/caucus/caucusCamera.js`, `src/caucus/caucusFigures.js`, `src/ui/caucusUI.js` (the listen read only).

1. **Camera** at seated eye height behind your chair (y ≈ 1.75), looking along the table; "Speak" eases to frame the head of the table; drag still pans.
2. **The room.** A green baize runner down the table, water carafes and glasses every third seat, papers squared up; chairs with proper backs from V1's kit; the leader's chair taller with arms; oak panelling to 1.2 m then plaster; a party-colour banner behind the head of the table (the colour from `data/parties.json`) and two portraits; three pendant lamps over the table as emissive discs with warm lights.
3. **The read.** Mood no longer recolours the suit (the room must still read as your party). Instead: a soft coloured glow on the chair back and a small coloured dot above the head, with the dot shape per mood (circle, square, triangle, diamond) so it reads without colour. "Who leans to whom" is shown: for two seconds after Listen the two figures lean toward each other.

**Done when:** < 40 draw calls; the six watched MPs can be found in a screenshot from the UI's text alone; the mood marks read in greyscale.

### V7 · Motion and life

**Files:** the room files touched above; `src/sim/pacing.js` only for a cosmetic hook (see rules).

1. **Chamber.** During a routine sitting day, one MP leaves their seat, walks up the aisle and out, and another comes back, every ~20 s (instanced figures don't walk: swap the seat's instance to hidden and run one articulated walker from `visitor.js`). The Speaker's gavel drops on a result (a 0.3 s rotation of a small box). The Clerk stands during the count.
2. **Everywhere.** A camera micro-ease on every state change (0.3 m push or a 2° tilt), so the picture never snaps. Idle head turns from V1 run in every room.
3. **A 60 s soak** in each room on a phone: FPS must not sag, memory must not climb (watch `performance.memory` where available, and the renderer's `info.memory.geometries` must be flat).

**Done when:** a 30 s screen recording of the chamber on a sitting day has visible life; nothing in the sim changed (the Parliament hash for `TEST-1` is identical before and after).

### V8 · Phone verification and the entry for Kelbo

1. Run the full guided week on a real phone in portrait and landscape with `?debug=1`: log FPS per room, draw calls per room, cold-load size (DevTools network, cache disabled), and memory after switching rooms ten times.
2. Tick HANDOFF stage 1's "smooth on Kelbo's phone" only if Kelbo says so.
3. Write the `PROGRESS.md` entry: before/after for each room in one sentence each, the numbers above, the decisions made in section 2 for Kelbo to confirm or overturn, and a short list of what the art pass deliberately left alone (faces, audio, tier-2 office, real models).

### V8 · Numbers from the headless pass (a real phone still needed)

Measured on the merged V7 build in a headless phone viewport, `?seed=TEST-1`:

| | Draw calls | Triangles | Geometries | Textures |
| --- | --- | --- | --- | --- |
| Chamber (at rest) | 36 | 355k | 41 | 17 |
| Office | 47 | 5k | 46 | 17 |
| Caucus | 22 | 135k | 28 | 22 |
| Riding (desk) | 45 | 5k | 44 | 22 |
| Riding (town hall) | 19 | 83k | 53 | 22 |

Cold load: **1.15 MB** over 87 requests (budget 10 MB). After ten room switches the chamber comes back to the same 41 geometries and 36 draw calls it started with: rooms dispose cleanly. The office and riding sit above the handoff's 40-call guide because each jointed figure is 19 small meshes and the kit props are one call each; their triangle counts are tiny, so the phone frame rate decides whether merging the figures' fixed parts is worth doing.

## 5. Open decisions (for Kelbo)

| Decision | Default used here | Alternative |
| --- | --- | --- |
| Faces | None; silhouette and pose only | Painted eyes/brows on a tiny texture (risk: uncanny at this budget) |
| Real models | CC0 GLB props and textures under `assets/` (section 7), procedural for the bespoke pieces | All procedural, if the committed assets ever push the load past 10 MB |
| Type | One self-hosted OFL serif throughout (the Order Paper) | A system serif stack, if the font files cost more than 400 KB |
| Chamber default view | Your own seat in Acts 1–2 | The overview, as now |
| Time of day | Window tint follows morning / evening in state | Fixed afternoon light |

## 6. After the art pass: build through the end

Kelbo's call (2026-10-21): don't wait for the playtest to start stages 5–9. Order of work from here: V0–V8 of this pass first (the four rooms and the UI are the thing people will judge first), then HANDOFF stages 5, 6, 7, 8, 9 in order, each to its own checks, each keeping the look this pass sets. New screens in stages 5–9 (the ledger, the count board's marks, the record, scenarios, settings) are designed in the Order Paper system from the start, never as a quick panel to restyle later.

## 7. Asset shortlist

From the asset survey of 2026-10-21 (everything below was downloaded and inspected through this container's proxy; sizes are measured). All CC0 unless marked OFL. Every file that ships is listed in `assets/LICENSES.md` with its source URL and licence line.

**Decisions**

- **Figures stay procedural** (V1). The only CC0 rigged characters reachable are Kenney's Mini Characters (painted cartoon faces, 7-joint rig, two skinned meshes each): the wrong look for this game and 240 skinned draw calls for a full House. Quaternius's packs are no longer CC0 (a custom licence since 2026-08) and their downloads were quota-blocked, so they are out regardless.
- **Furniture from Kenney's Furniture Kit 2.0**, retinted. Its GLBs have no textures, only flat `baseColorFactor` materials named `wood`, `woodDark`, `metal`, `carpet`, `lamp`, `plant` and so on, so a loader hook maps each name to a `look.js` token (oak, leather, brass). Scale is about 0.52 of real: multiply by 1.9. Flat-shaded, 60–600 triangles each.
- **Street from KayKit City Builder Bits** (one shared 20 KB gradient atlas; scale about 1:5, multiply by 5). Mailbox, lectern and despatch box don't exist as CC0 GLBs anywhere reachable; they're rectilinear, so the kit builds them.
- **Textures from ambientCG**, re-encoded to 512² JPEG (quality 80) before they go in the repo; the raw 1K files are 0.1–2.4 MB each and never ship. Leather037 and Metal034 have near-flat colour maps, so only their normal/roughness maps ship and the colour comes from the material. There is no green leather on ambientCG: brown leather normals tinted `#2f5a3c`.
- **Type: Fraunces** (OFL, variable optical size and weight, 67 KB regular + 42 KB italic). Public Sans (27 KB) is available if a sans is ever needed, but the Order Paper is one serif.

**Pick list** (about 1.5 MB in total)

| Use | Source | Files | Size |
| --- | --- | --- | --- |
| Office | Kenney Furniture Kit 2.0, `kenney.nl/assets/furniture-kit` (zip `…/440e0608a4-1677580847/kenney_furniture-kit.zip`, 4.9 MB) | desk, chairDesk, loungeChair, bookcaseClosedWide, bookcaseOpen, books, lampRoundTable, pottedPlant, coatRackStanding, computerScreen, laptop, trashcan, paneling | ~160 KB |
| Caucus | Furniture Kit + Kenney Food Kit (`…/83086fa91c-1719418518/kenney_food-kit.zip`) + Kenney Castle Kit (`…/a395102d20-1711543616/kenney_castle-kit.zip`) | tableCross (stretched), chairCushion (instanced), kitchenCoffeeMachine; bottle-oil as a carafe, glass, cup-coffee, cup-saucer (+ 11 KB colormap); flag (+ 7.5 KB colormap) | ~90 KB |
| Chamber | Furniture Kit | paneling tiles for the wainscot, loungeSofa / loungeSofaLong instanced as benches (retinted leather), lampWall sconces, loungeChairRelax as the Speaker's chair; despatch boxes, Mace and bar procedural | ~30 KB |
| Street | KayKit City Builder Bits, `github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits` (fetch via `raw.githubusercontent.com/…/main/addons/kaykit_city_builder_bits/Assets/gltf/<name>.gltf` + `.bin` + `citybits_texture.png`) | streetlight, bench, car_sedan, firehydrant, trash_A, bush; Kenney Fantasy Town `lantern.glb` for an older lamp if wanted | ~125 KB |
| Textures | ambientCG, `ambientcg.com/get?file=<ID>_1K-JPG.zip` | Wood049 (oak), Wood051 (walnut), Leather037 (normal + roughness only, tinted), Fabric033 (baize), Carpet016, Plaster001, Tiles143 (stone blocks), Metal034 (brass, maps only) | ~600 KB at 512² |
| Fonts | Google Fonts (OFL; `raw.githubusercontent.com/google/fonts/main/ofl/fraunces/OFL.txt`) | Fraunces regular + italic woff2, latin subset (fetch the CSS with a Chrome user agent to get woff2 URLs) | 110 KB |

**Gotchas recorded by the survey:** scale differs per pack (Furniture Kit 0.52×, Food Kit 2.4×, KayKit 1:5), so one scale constant per pack in the loader. Kenney's textured GLBs reference `Textures/colormap.png` by relative path and use `KHR_texture_transform` (fine in r160): keep the folder beside the GLB. Google's woff2 URLs change when a font is re-released: fetch once, commit, done. The downloaded packs are in the session scratchpad under `assets-candidates/` for the session that does V1–V6; a later session re-fetches from the URLs above.

## 8. What this pass does not do

Audio (stage 9), the colour-blind setting (stage 9, though the icon shapes here anticipate it), the tier-2 corner office, the whip's count board marks (stage 5), scenarios and the daily seed (stage 9), and any change to the sim's behaviour.
