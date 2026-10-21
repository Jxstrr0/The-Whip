# The Whip - Progress

The running log of what each build session finished, written for Kelbo in plain language. Newest entry at the bottom.

---

## 2026-10-21 · Stage 0: repo and pipeline

**What was built**

- `DESIGN.md` and `HANDOFF.md` committed from the two docs.
- `index.html` with the phone viewport tag, the Three.js `0.160.0` import map, and a full-screen canvas that ignores browser touch gestures so the game can use them.
- A placeholder scene: a slowly turning oak-and-green-leather desk under soft light, with the title underneath.
- `css/style.css` (dark theme, safe-area padding for notched phones), `src/main.js`, `.nojekyll`, `README.md` with the live link, and this file.

**Things to know**

- The repo is named `The-Whip` (capital T and W), so the live URL is **https://jxstrr0.github.io/The-Whip/**, not `/the-whip/` as the handoff says. Use the link in the README so the case matches the repo name.

**What you need to do in GitHub**

1. Open the repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set Source to **Deploy from a branch**, pick **`main`** and **`/ (root)`**, and save.
3. Wait a minute or two, then open the live URL on your phone.

---

## 2026-10-21 · Stage 1: the chamber

**What was built**

- `src/chamber/layout.js`: pure maths for all 120 seats (side, row, seat number, position, facing). Seats `s001`–`s060` are the government side (the Speaker's right), `s061`–`s120` the opposition.
- `src/chamber/scene.js`: the room itself in simple shapes: green carpet, stepped rows, stone walls with tall windows, oak panelling, galleries along both long walls, the Speaker's dais and canopied chair, the Clerk's table with the Mace, and the brass bar.
- `src/chamber/seats.js`: every desk and chair drawn as one batch each (instancing), paired desks, and a pulsing gold ring on the selected seat.
- `src/chamber/camera.js`: one finger orbits (limited to ±60° sideways, 30°–75° from overhead), pinch zooms between 6 and 26 m, double-tap eases in to frame the seats around where you tapped. Mouse drag and wheel work on a computer.
- `src/chamber/picking.js`: a tap finds the seat under your thumb and shows a label with its id, side, row and seat number.
- `src/kit3d.js`: small shared helpers for building rooms out of boxes (not in the handoff's file list; the office, riding and caucus rooms will reuse it).

**Checks**

- Tested in a headless phone browser (Pixel 7 size, portrait and landscape): every on-screen seat was tapped and reported the right id (90 of 90; the other 30 are off the edge of a portrait screen until you turn the camera). Orbit, pinch and double-tap focus all respect the limits. No console errors.
- The whole chamber draws in 6 draw calls (budget is 60).
- **Still for you:** check it feels smooth on your phone with `?debug=1` (FPS counter, bottom left). The pixel ratio is capped at 2.

**Things to know / decisions I made**

- **Row spacing.** The handoff starts row 1 at 2.0 m from the aisle's edge, but four rows at 1.3 m spacing from there would put row 4 outside the 15 m-wide floor. I started row 1 at 1.0 m instead, which keeps the floor size and still clears the aisle. One number in `layout.js` if you want to change it.
- **Default camera outside the room.** The handoff's default camera spot (0, 9, 19) is outside the bar-end wall (the floor ends at 13). The walls and ceiling are one-sided, so you see straight through them from outside; nothing blocks the view.
- **Portrait lens.** On a portrait phone the camera widens its lens (up to 75°) so both sides of the aisle fit, instead of backing further out.

---

## 2026-10-21 · Stage 2: MPs, parties, cohorts and cliques

**What was built**

- `src/sim/rng.js`: the seeded random number generator. Every random thing in the game comes from the seed, so `?seed=TEST-1` is the same Parliament on every phone, every time.
- `src/sim/generate.js`: a whole Parliament from a seed. It holds an election (who governs, seat counts within the handoff's ranges, usually a minority), picks 120 ridings from the riding pool by province, decides which party wins which riding by geography and ideology, and generates every MP (name, age, riding, margin, cohort, loyalty, ambition, ideology, interests, committee, attendance, secrets). It also appoints leaders, House Leaders, whips, cabinet or critics, parliamentary secretaries, committee chairs and the Speaker.
- `src/sim/relationships.js`: cliques (regional caucuses, ideological wings, a leadership contender's camp and social crowds, up to four per caucus), friend and rival links, and mentors for most rookies. It also holds the rules for broken promises spreading through a cohort and clique, and for your reputation style. Those get used from stage 4.
- `src/sim/knowledge.js`: what you know about each MP. A fresh game shows only name, party, riding and seat. Everything else is "Unknown" until you learn it, and goes faded ("stale") after 26 weeks without contact.
- `src/chamber/layout.js` now seats the House: government on the Speaker's right, each party as one block, leaders and cabinet in the front row, the Chief Whip in row 2 behind the House Leader with the Deputy beside them, assistant whips at the ends of rows 1, 3 and 4, and cliques sitting together.
- `src/chamber/mps3d.js`: all MPs drawn in their party colours (two draw calls), with a gold outline on the one you tap. The Speaker sits in the chair.
- `src/ui/mpCard.js`: tap an MP for their card. `src/ui/book.js`: the whip's book, with all 120 MPs, search, filters (party, clique, cohort, riding type) and sorting.
- `src/state.js`, `src/sim/modes.js` (new game), `src/sim/career.js` (the player becomes a rookie in their party), `data/*.json` (names, 172 ridings, parties, cliques, backgrounds, tuning, UI strings), and `tests.html`.

**Checks**

- `tests.html`: 13 of 13 pass. Seed TEST-1 gives the same hash every time and in every browser. All five parties are present. Seat counts match. The whips, cabinet and cliques sit where the spec says. TEST-1 is a minority with no overflow. SEED-17 is a majority with 3 government MPs across the aisle at the bar end. A fresh card shows only the public facts. Knowledge goes stale after 26 weeks.
- In the phone browser, tapping an MP opens their card. The book's search, filters and sort work, and tapping a name flies the camera to that MP's block.

**Things to know / decisions I made**

- **The Speaker is one of the 120 MPs**, usually a senior government member. They leave their desk for the chair, so 119 desks are filled and one stays empty.
- **When the government has fewer than 60 seats**, the opposition can't all fit on its own side. The handoff only covers the reverse case. I used the Canadian practice: the leftover opposition members (smallest parties and independents) sit in the government side's back rows nearest the bar.
- **Party blocks run along the chamber, not across it.** Each party fills seat columns from the Speaker's end, front row to back, so every party is a solid block of colour. The "row 2, seat 1" whip seats are counted from the start of each party's own block.
- **Role titles are public.** The card shows titles like "Chief Whip" or "Minister" from day one, because you need to know who your whip is. All personal attributes start hidden.
- **Unique names.** No two MPs share a first or a last name, so the House is easier to tell apart on a small screen.

---

## 2026-10-21 · Stage 3: votes, divisions and pacing

**What was built**

- `src/sim/bills.js`: the four kinds of business (government bills, private members' bills, opposition motions, supply), and the readings: first reading, second reading, committee (where members add amendments, usually money for their own ridings), report stage (where the opposition moves floor amendments, which sometimes carry in a minority), and third reading. Each party sets a position and decides whether to whip it. Governments bring bills that suit them, and some social bills get free votes. On confidence votes, parties weigh whether an election would suit them. Supply follows a yearly calendar (Throne Speech reply, budget, estimates).
- `src/sim/mp.js`: the decision model from the design doc. Each MP weighs the party line (scaled by loyalty), ideology, what the bill does for their riding, promises and how they feel about the whip and leader, friends, their clique, any pressure, and what it costs them with voters (worse in a marginal seat), plus a little noise. Attendance is rolled separately.
- `src/sim/vote.js`: the Speaker puts the question. If fewer than five members rise against the voices, it's settled on a voice vote. Otherwise there's a recorded division: standing members only, pairs honoured, and a tie goes to the Speaker, who follows the real convention (yes at second reading and report stage, to allow more debate; no on final questions).
- `src/sim/pacing.js`: the day loop (morning, caucus, House, office, fallout, weekend). Routine days settle themselves into one-line summaries. The game stops you only for your own dilemma votes (a whipped vote your riding or conscience pulls against) and confidence votes. **Continue** goes to the next stop of any kind. **⏭ Skip** jumps to the next thing that actually needs you.
- `src/chamber/voteLights.js`: during a division, absent MPs leave their seats, then the yeas light up seat by seat followed by the nays. Each seat shows a check, a cross or a dash, so votes read without colour. Paired seats pulse white.
- `src/ui/countBoard.js`: the bells sheet, with your party's line, how your riding and conscience feel, and three choices: vote with the party, break with the line, or be somewhere else. You have 15 or 30 real seconds; when the doors close, you're in your seat voting with the party. After that comes the live tally by party against the number needed.
- `src/ui/agenda.js`: the bottom bar with the date, latest news, Continue and Skip. Tap the date for the feed. It also shows the morning order paper and a weekly review.
- The whip's book gains an "at risk" sort for the next vote. `?debug=1` now has tuning sliders for every number in `data/tuning.json`.

**Checks**

- `tests.html`: 22 of 22 pass. They cover voice votes, divisions with pairs and absences, the Speaker's tie, a loyalty change flipping a vote, a bill going first → second → report → third → passed with amendments at committee and report, skip only stopping where it should, a lost confidence vote setting the election flag, and three whole Parliaments played headless by a random bot in under a second.
- In the phone browser: skip to a vote, choose, and watch the count. No console errors.

**Things to know / decisions I made**

- **The government counts before confidence votes.** Without that, a minority government kept bringing budgets it would lose and fell in week one. Now, if it's short, it buys a smaller party's support with something for that party's ridings. That's a placeholder for stage 8's real confidence-and-supply deals. Parties that want an election refuse.
- **Divisions are called by parties.** A recorded division happens when a party opposes the question or members feel strongly. A few mild grumblers don't force one. Confidence votes are always recorded.
- **When a Parliament ends** (the government falls or four years pass), the game shows "Parliament is dissolved" and offers a new Parliament. Elections arrive in stage 8.
- **Calendar.** A year is 40 weeks: 31 sitting weeks and 9 constituency weeks, with votes Monday to Thursday. It's one string in `data/tuning.json` if you want a different rhythm.
- **How often you're stopped** depends on how well your riding fits your party: from almost never to about one vote every two weeks. `pacing.dilemmaThreshold` in tuning controls it.

---

## 2026-10-21 · Stage 4: the office and meetings

**What was built**

- `src/rooms.js`: one renderer, one live room at a time. Leaving a room throws it away, so phone memory stays flat. The game switches to the office for evenings and back to the chamber for the House.
- `src/office/`: the office room (desk, two visitor chairs, the count board on the wall showing what's coming up, a window onto the lawn and a Gothic tower, the door, a bookshelf). There's a second, corner-office tier for Acts 4–5. The visitor walks in from the door, round the desk, and sits. Their pose shows their mood: upright (cooperative), arms folded (guarded), leaning forward (angry), small and head down (anxious). The camera sits over your shoulder and pushes in when the deal table opens.
- **The Act 1 reversal**: when you have a dilemma vote in the next few days, the whip's office calls you in. You sit in the visitor's chair, the whip sits behind the desk, and the camera moves to your side.
- `src/sim/meetings.js`: the evening. You have two slots of time as a rookie. Walk-ins knock with a one-line reason: a cohort-mate saying hello, someone wanting a favour, gossip, a complaint, your mentor, or someone recruiting rebels before a vote. You can see them, invite anyone in from the book, make a phone call (half a slot), or end the evening. Walk-ins you ignore remember it.
  - **Talk**: two or three turns, using the dialogue lines in `data/dialogue-lines.json` picked by situation, turn and the visitor's mood. Your choices are warm, direct, listen, push, deflect or give ground, and how well that suits their mood moves rapport. A good read reveals their interests, ambition, clique or loyalty on their card, and shows you what they really want. Gossip reveals things about other MPs. Your mentor tells you about the MPs they know.
  - **Deal**: a "you offer / you ask" table with cards: your vote, a favour owed, your speaking slot, a mention of their riding, co-sponsorship, and what they know. From the whip: a Question Period slot, a committee seat, Friday leave, or a project for your riding. Tap cards in or out and propose. They accept, counter or walk out.
  - Every agreed deal lands in the ledger as dated promises from both sides. Vote promises settle at the division. A broken promise hits that MP and spreads through their cohort and clique, and breaking your word to the whip hurts more. The whip delivers what they promised when it comes due.
- `src/ui/talk.js` and `src/ui/dealTable.js`: the evening board, the talk sheet and the deal table, all one-thumb bottom sheets. A short toast shows how each meeting ended.
- `src/sim/bot.js`: the random bot now plays meetings and deals too.

**Checks**

- `tests.html`: 29 of 29 pass. New ones: the office after a sitting day and on to the next morning; a scripted meeting producing the exact ledger entries; mood changing the lines; meetings revealing card fields; the whip calling you in before a dilemma; a broken promise cooling the cohort and clique; and a whole Parliament played by the bot through meetings.
- In the phone browser: the evening board, a walk-in sitting down, talk turns, the deal, and the reversal scene all work in portrait. No console errors.

**Things to know / decisions I made**

- **When you see the office.** After a day that mattered you always go back to the office. After a routine day you only stop there if someone's at your door or the whip calls. Otherwise Skip would stop every evening.
- **Your own small promises keep themselves.** When they come due, things like your speaking slot or a riding mention are handed over automatically. The promises with teeth are votes, and those are yours to keep or break in the division.
- **Not going when the whip calls** costs you with the whip. So does turning the whip down, but less than taking the deal and then voting the other way.
- **Saves stay small.** Old division roll calls and old meetings collapse to summaries. A whole four-year Parliament saves at about 0.6 MB.

---

## 2026-10-21 · Stage 4b: the vertical slice (Act 1, week one)

**What was built**

- **Start menu** (`src/ui/menus.js`): Continue (if there's a save), or a new career with your first and last name, party (with a one-line description), background (each with a strength), riding type, province, age, and the seed. You become a rookie in that party, in a riding of the type you asked for where one exists.
- **Saving** (`src/save.js`): the game autosaves to the browser after every move (slot 1), and Continue picks it up. Export/import code is there for stage 9's menu. The ☰ button in the top bar shows the seed and goes back to the title.
- **The guided first week** (`setupFirstWeek` in `src/sim/career.js`):
  - **Monday:** first readings, a short note on how things work, and the whip's office calls you in about Thursday's vote. That's the reversal scene.
  - **Tuesday:** a backbencher tries to recruit you into a rebellion, and your mentor drops by.
  - **Wednesday:** caucus.
  - **Thursday:** the dilemma vote, a bill your riding pulls hard against while your party whips the other way. It's chosen fresh for every player.
  - **Friday:** the riding. The whip lets rookies go home in week one.
  - **Weekend:** the review: riding standing, the whip's view of you, rebellions, divisions, and the week's feed.
  - After that the game runs normally: routine days settle themselves and only what matters stops you.
- **The caucus room** (`src/caucus/`, `src/sim/caucus.js`, `src/ui/caucusUI.js`): a long table with the leader at the head, the Chief Whip at the leader's right and the House Leader at the left, everyone seated by clique. You see it from behind your own chair. The leader sets the week's line in their own style (controlling, hands-off, paranoid or loyal), and the unhappiest members air grievances. You get three moves:
  - **Listen**: reads six moods, which turn their seats green, grey, red or amber, and shows who's talking to whom.
  - **Speak** (once): back the line, speak for your riding, or challenge. Each moves the leader's trust, your standing in the room and your riding.
  - **Whisper**: to a neighbour.

  Caucus meets every sitting Wednesday. It only stops you when your own dilemma is the week's question or the room is angry.
- **The riding** (`src/riding/`, `src/sim/riding.js`, `src/ui/ridingUI.js`): a storefront constituency office whose window shows your riding type (prairie town, suburb, downtown, or northern settlement), plus a photo wall and a waiting area.
  - **Visitors:** two constituents with cases you can carry to Ottawa or not, the local reporter (your answer gets quoted and the whip reads it), and the riding association president, whose mood tracks your standing and the nomination.
  - **Town hall:** the camera cuts outside to a crowd of 28, with a crowd-mood bar and questions about the week's bill and a local issue.
  - **Announcement:** if the whip promised you a project, you can announce it at home.

  Leaving Ottawa on a sitting Friday needs the whip's leave. The visit stops you every few weeks or when your standing is low; otherwise Fridays at home are a one-line summary.

**Checks**

- `tests.html`: 33 of 33 pass. New for 4b:
  - The guided week visits morning → office → meeting → caucus → division → riding in order, with the whip calling, and ends at the first-week review for all four parties.
  - The dilemma is always a real one, voted Thursday.
  - Caucus listen, speak and whisper all work.
  - A save round-trips through export and import unchanged.
- In a headless phone browser I played the whole week through the actual buttons from the start menu to the review, as two different parties. No console errors. Portrait and landscape both lay out.

**Things to know / decisions I made**

- **A honeymoon for new governments.** Without it, a minority government sometimes fell in its first two months. Now the smaller parties don't bring a government down in its first 26 weeks. Elections don't exist until stage 8, so a fall currently ends the game with "Parliament is dissolved".
- **The riding camera.** The handoff puts it "behind the desk at (0.4, 1.6, 0.4)", but the desk is at z = −1 and you face +z, so that spot is in front of the desk. I put it behind the desk on the −z side at the same height.
- **Portrait framing.** In portrait the bottom sheet covers about half the screen, so every room's camera aims a little low to keep the people in the visible top half. The sheets scroll rather than grow.
- **Files beyond the handoff's layout:** `src/kit3d.js` (shared room-building helpers), `src/loadData.js`, `src/sim/config.js` (loaded data), `src/sim/actions.js` (the action table behind `dispatch`), `src/sim/bot.js` (the test bot), and `src/ui/text.js` (UI text helpers).

**Kelbo's playtest: to fill in**

The handoff asks for this slice to be played before stage 5, and for your verdict to be recorded here. Things worth noticing as you play:

1. Does the Thursday vote feel like a real dilemma? Is the whip's call on Monday leaning on you the right amount?
2. Are meetings (talk then deal) quick enough on a phone, or do they drag?
3. Caucus: are three moves right? Does "listen" tell you enough?
4. The riding: too many visitors, or too few? Is the town hall worth doing?
5. After week one, does Skip stop you often enough, or too often?

*What worked:* (your notes)

*What didn't:* (your notes)

---

## 2026-10-21 · Deploying to GitHub Pages

**What changed**

- The game is live at **https://jxstrr0.github.io/The-Whip/**. You no longer need the Settings → Pages steps from the stage 0 entry.
- `.github/workflows/pages.yml` publishes the repo root to Pages on every push to `main`. It switched Pages on by itself the first time it ran. There's still no build step: what's in the repo is what's served.
- A small gold "W" tab icon, built into the page, so browsers stop asking for a missing `favicon.ico`.

**Checks**

- On the live site in a headless phone browser: the start menu loads, a guided game opens on Monday of week 1 with the chamber drawn, and `tests.html` passes 33 of 33.

**Fix found while testing the live site**

- During a vote count, the count board was rebuilding itself every few seats, which replaced the "Show result" button each time. A tap that landed during a rebuild could be lost. The board is now built once per vote, and the count only updates the numbers and bars, so its buttons stay put.

---

## 2026-10-21 · Plan alignment check, and the art pass plan

**Checked the build against `HANDOFF.md`**

- Every stage 0–4b check is ticked except two that need you: "smooth on Kelbo's phone" (stage 1) and your playtest verdict (stage 4b). The stage 0 "live URL loads" box is now ticked, since the site is live and shows the game.
- Every planned file for stages 0–4b exists. The missing ones (`tools.js`, `rivals.js`, `lifeEvents.js`, `confidence.js`, `media.js`, `election.js`, `record.js`, `ui/ledger.js`, `ui/careerUI.js`) belong to stages 5–9. Because 4b needed all four rooms, parts of stages 6, 7 and 9 already exist: the start menu, saves, the riding room, the caucus room and the guided first week. Those stages should build on them, not rebuild them.
- Tuning numbers are in `data/tuning.json`, dialogue is data, the yeas and nays light in seat order, the pixel ratio is capped at 2, and only one room lives at a time.

**Two things weren't aligned**

- The menu's "random seed" button used `Math.random` from inside `src/sim/`, which the handoff forbids (the seed may be random; the sim after it may not). It moved to the menu code. The sim folder is clean.
- The handoff (section 5) says that in Acts 1 and 2 the chamber should open from your own seat, low, looking across the aisle, "to make the backbench feel like a seat, not a map". That was never built; the chamber always opens on the overview. It's the first chamber step in the art pass.

**The art pass plan**

`ART-PASS.md` is new. It says what's wrong with the look today (flat colours, no shading, peg figures, a map-view chamber, a riding shot blocked by a chair back, hard cuts), what the rooms are going for (oak, green leather and stone under baked light; faceless figures with real silhouettes; your seat as the default view; serif display type; small constant motion), the rules (no shadows, no post-processing, budgets per room, procedural first), and nine steps in order with a done-when check for each. It also lists the five decisions I made that you can overturn: no faces, no real models, a serif for headings, your own seat as the default view, and window light that follows the time of day.

---

## 2026-10-21 · Art pass V0: light and shading

The first step of `ART-PASS.md`. Nothing in the rooms was redesigned yet; this is the foundation the next steps build on.

**What changed**

- **Tone mapping.** The renderer now uses filmic tone mapping (ACES) with an exposure you can tune. Bright things roll off instead of clipping, so the lit windows and lamps no longer flatten to white.
- **An environment map** (a neutral studio, generated at start, no image files) gives every surface soft reflected light. That's most of what "baked lighting" looks like on a phone.
- **Baked occlusion.** Big surfaces are now subdivided, and vertices near the floor, the walls and the ceiling are darkened, with the undersides of desks and tables darker still. The rooms stop floating.
- **Contact shadows.** A soft dark blob under every desk and chair pair in the chamber, under the office and riding furniture, under every caucus chair and the table, under every figure in the town hall crowd, and under walking visitors (it travels with them). One draw call per room.
- **Lights.** Physically based point lights (decay 2) through a shared `roomLights` / `lamp` helper. The chamber's single ceiling hotspot is gone; it now has three chandeliers (a lit dish on a stem with a brass ring and a warm light each), lit window panes with dark mullions, and daylight from high on one side. The office desk lamp has a lit shade; the caucus room has three lit pendants over the table. Figure materials take the environment light at the same strength as the rooms (the first try left them pastel).
- `src/look.js` holds the palette tokens, the renderer setup and the shared environment. Every look number is in `data/tuning.json` under `look` (exposure, environment strength, occlusion strength, shadow opacity, lamp intensities), so the `?debug=1` sliders can tune them live.

**Checks**

- Guided week played through the real buttons in a headless phone browser: no console errors. `tests.html`: 33 of 33.
- Chamber draw calls: 11 at rest (budget 60; a division adds the seat lamps and icons). Office, caucus and riding: under 20 each (budget 40). `window.whip.renderer.info` (already there in `?debug=1`) gives the exact numbers for later steps.
- Still for you: the frame rate on your phone with `?debug=1`. The headless browser can't measure it.

**Things to know**

- The office and riding camera framing is unchanged and still wrong (the chair back in the riding, the window-and-chairs shot in the office). Those are steps V4 and V5.
- The figures are still the capsule-and-sphere placeholders. That's V1, next.

---

## 2026-10-21 · Art pass V1: figures

**What changed**

- **One figure kit for everyone** (`src/figures.js`). Every person in the game is now the same stylised silhouette: shoulders, a neck, an egg of a head under a hair cap, a collar, a lap when seated, shoes. No faces (at this budget they'd look wrong, and the mood pill in the UI already says how someone feels). Each MP's skin tone, hair colour and style (full, receding, none), height, lean and the way they sit are decided from their id, so they look the same every time you load.
- **Crowds are instanced**: the 120 MPs in the chamber are six draw calls however many there are, same for the caucus table and the town hall crowd. Party colours vary slightly from person to person so a bench isn't one flat block. Every few seconds someone turns their head toward a neighbour and back.
- **The Speaker** is drawn from the same kit, in black, in the chair.
- **The visitor in the office and riding** (`src/office/visitor.js`) is the same silhouette with elbows, knees, hands and shoes on joints. The four moods now read at phone size: *cooperative* sits upright with hands on knees; *guarded* has the arms genuinely folded across the chest; *angry* leans in with both hands forward on the desk; *anxious* draws in, hands clasped in the lap, head down. Walking in is quicker (3.2 m/s) and the legs swing from the hip with a knee bend. A seated visitor breathes and their head drifts a little, so nobody freezes.
- **Your own head is hidden** in the office and riding, because the camera sits where your head would be; a skin-coloured blob in the corner of the frame was never the intent.
- `tools/lineup.html` is a dev page that shows the figure in every pose side by side. It's how the poses were checked, and it's there for the next passes.

**Checks**

- Guided week through the real buttons, headless phone browser: no console errors. `tests.html`: 33 of 33.
- Chamber: 19 draw calls at rest (budget 60).
- In a blind look at the lineup, the four moods are tellable apart from the silhouette alone.

**Things to know**

- The office and riding framing is still the old framing (steps V4 and V5). The figures are better; the shots around them aren't yet.

---

## 2026-10-21 · Art pass V2: the chamber

**What changed**

- **Your own seat is the default view** in Acts 1 and 2, as the handoff asked. The camera sits just above your head, looking across the aisle and a little toward the Speaker. One finger turns your head (not past your shoulders), pinch narrows the lens, and a double-tap on a party block turns you toward it. The top bar's "Reset view" is now **Overview / My seat**: the overview from above the bar is one tap away and back. While the camera is in your seat, your own figure leaves the chair (you can't see yourself from your own eyes).
- **The division is staged.** When the bells ring the room dims a touch, every unlit seat lamp pulses amber, and the camera eases to a three-quarter overview where the sweep of the count reads across both sides. Each seat that lights throws a short vertical flash in its colour. After the result and Continue, the camera comes back to your seat.
- **Real surfaces.** The first CC0 textures from ambientCG are in `assets/textures/` (listed with their licence in `assets/LICENSES.md`): carpet, oak, walnut, stone, plaster, leather and wool, re-encoded to 512² and about 580 KB in total. The colour maps are converted to a greyscale grain so the game's own palette still sets the colour; the normal maps give relief. Texture coordinates are in metres, so grain density is consistent across every surface.
- **The room is dressed.** Stone walls in courses, a dark oak wainscot with panel strips and rails, tall windows with mullions and a warm wash on the wall under each, a plaster ceiling with oak beams, three chandeliers on stems with brass rings, galleries with a railed front, posts, a brass top rail and fourteen people sitting in them, the Speaker's chair with side pillars, a canopy, a crest and a gold finial, a green cloth on the Clerk's table with brass brackets under the Mace. Desks are oak, chairs green leather.

**Checks**

- Guided week through the real buttons in a headless phone browser, portrait and landscape: no console errors. `tests.html`: 33 of 33.
- Chamber: 30 draw calls at rest (budget 60).
- Still for you: how your own seat feels on your phone, and whether the overview should stay one tap away or be the default after Act 2.

**Things to know / decisions I made**

- **The overview is kept for divisions.** The count is theatre and needs both sides in frame; from your seat you'd only see one. So the camera leaves your seat for the vote and comes back.
- **Textures are grain, not colour.** Keeping the hue in the palette means the party colours, the leather and the oak stay exactly the shades the design doc names, and a texture can be swapped without recolouring the game.

---

## 2026-10-21 · Art pass V3: the Order Paper

**What changed**

- **The whole UI is now printed paper.** Every sheet, the count board, the agenda strip, toasts, the Book and the start menu are cream paper with ink text, thin ruled lines, letterspaced small caps for section labels, a bench-green rule with a brass hairline along the top, and a soft shadow so the paper sits on the room instead of in it. The grey glass panels and the gold-on-charcoal buttons are gone.
- **One typeface: Fraunces**, a warm newspaper serif with an optical-size axis, so it reads at 13 px labels and 46 px mastheads alike. It's committed under `assets/fonts/` (OFL, 110 KB for regular and italic) and preloaded, so there's no flash of a fallback font. Nothing is fetched from Google at runtime.
- **Colour has a job now.** Bench green is the single primary action on any sheet. Brass is for rules, the bells and the "needed" marker. Party colours appear only as ink bars beside names. Red is for DEFEATED and a broken promise. Moods are an ink bar on a paper tag, not a coloured pill.
- **Rubber stamps.** Outcomes are stamped: CARRIED in green, DEFEATED in red, with a slightly ragged edge and a thump as they land. The count board uses them; the `stamp()` helper is there for the riding, the ledger and the record in later steps.
- **Motion.** Sheets are set down (a short slide up), toasts slide in as paper slips under the top bar, buttons press down by two pixels, and switching rooms cuts through ink-black and fades back in over a third of a second instead of popping.
- **Controls** are drawn as ruled fields: inputs and selects are an underline with the label in small caps above, with an ink chevron on selects. The dropdown list itself is still the phone's own (a paper list sheet is a later refinement).
- **The start menu** is a title page: the masthead, a rule, the subtitle in small caps, the tagline in italic, the form as ruled fields, and the studio colophon at the foot with a placeholder mark. Longlight's colours go on the mark and masthead when you send them (`--brand` in `css/style.css`).

**Checks**

- Guided week through the real buttons in a headless phone browser, portrait and landscape: no console errors. `tests.html`: 33 of 33.
- Body text is ink on cream (contrast well above 7:1). Every tappable thing is at least 44 px tall.

**Things to know**

- I kept the native dropdown list under the styled select. A fully custom paper list sheet is a small follow-up; the native one works on every phone today.
- The menu's live chamber behind the title page (from the plan) is deferred to V7, when the figures and the room are final.

---

## 2026-10-21 · Art pass V4: the office

**What changed**

- **Real furniture.** The desk, the desk chair, the two visitor chairs, the bookcases, the books, the desk lamp, the laptop, the plant, the coat rack by the door and the bin are models from Kenney's Furniture Kit (CC0, about 290 KB for twenty props, listed in `assets/LICENSES.md`). `src/models.js` loads each once and maps the kit's flat material names (`wood`, `metal`, `carpet`...) to the game's own surfaces, so the desk is the same oak as the chamber benches and the chair seats the same green leather.
- **The room.** Plaster walls with an oak wainscot, panel strips and a skirting; a wool carpet; a framed door with a brass knob; the window with a frame, a sill and half-open blinds, and dusk over the lawn behind it (a dark tower with lit windows, two layers of trees): evenings are when the office happens. The count board is a corkboard with pinned cards. The desk lamp has a lit shade and throws a warm pool.
- **The framing is fixed.** The camera sits over your shoulder with the visitor's head in the top third of a portrait screen, above the sheet; your own shoulder shows at the edge of the frame and your head doesn't. The deal table pushes in a little closer.
- **The whip's office** is a different room for the Act 1 reversal: a big walnut desk, two bookcases, the flag in the party's colour behind the chair, the blinds shut, the daylight down and the lamp up. You sit in the visitor's chair and the whip leans in across the desk.

**Checks**

- Guided week through the real buttons in a headless phone browser: no console errors. `tests.html`: 33 of 33.
- Draw calls: the office is over the handoff's 40 (two jointed figures are 19 small meshes each, plus about 25 props). They're tiny meshes, and the phone frame rate is what matters; V8 measures it, and merging the figures' fixed parts is the lever if it's needed.

**Things to know**

- The visitor still walks in from the door, which takes about two seconds; the whip, in the reversal, is already seated when you arrive.
- The tier-2 corner office (Acts 4–5) still builds but isn't dressed; that comes with stage 7.

---

## 2026-10-21 · Art pass V5: the riding

**What changed**

- **The person is the subject.** The visitor's chair now sits at an open three-quarter angle so you see them, not a chair back; the reporter stays on their feet. The camera looks over your desk with the visitor's head in the top third of a portrait screen.
- **A real storefront.** The glass is glass now: a faint pane with the riding's name and "Constituency office · walk-ins welcome" lettered on it, read from the street (so mirrored from your desk), in an oak frame with mullions, a stall riser, a fascia and a glass door with a brass handle. Daylight comes in through it.
- **A street outside**, in two layers: real props on a pavement with a kerb and a road (two street lights, a bench, a hydrant, a bin, bushes, a parked sedan, from KayKit's City Builder Bits, CC0, 136 KB, listed in `assets/LICENSES.md`), and a painted skyline far behind that changes with the riding type: a downtown block, a suburb with trees, a prairie town with elevators, a northern settlement with spruce.
- **Inside**, the desk and chairs and four waiting chairs from the Kenney kit, a bookcase with a coffee machine on it, a plant by the door, a notice board with local notices, and a wall of six local photos: a ribbon cutting, the rink, a field, a parade, the plant gate, the school.
- **The town hall** happens on the pavement in front of the office, under the street light. The crowd lean in when they're with you, hang back when they're not, and below 35 four of them raise blank placards.

**Checks**

- Guided week through the real buttons in a headless phone browser: no console errors. `tests.html`: 33 of 33.
- The desk shot and the town hall checked in portrait and landscape, at a friendly and a hostile crowd mood.

**Things to know**

- Placards are blank boards on purpose; what the crowd is saying is in the sheet. Lettering them is a later flourish if you want it.
- The street props keep KayKit's own painted colours; the furniture is retinted to the game's palette. Both read as one set under the same light.

---

## 2026-10-21 · Art pass V6: the caucus room

**What changed**

- **The room.** A walnut table with a green baize runner down the middle, papers squared at every place, water carafes and glasses every third seat (from Kenney's Food Kit, CC0, 52 KB, listed in `assets/LICENSES.md`), the kit's chairs round the table drawn as one instanced mesh, the leader in the tall desk chair at the head. Oak wainscot with panel strips to 1.2 m, plaster above, a beamed plaster ceiling, three pendants with brass rings. Behind the head of the table: the party's banner on a brass rod and two portraits in gilt frames.
- **The camera** stands a step behind your own chair at seated eye height, looking along the table past your neighbours' backs; drag still pans along it. Opening **Speak** turns the camera to the head of the table and brings it back a moment after you've spoken.
- **The whip's read, without recolouring people.** Everyone keeps their party colour. The seats you can read carry their mood as a shaped mark above the head (a green circle, a grey square, a red triangle, an amber diamond, so they read without colour) and a matching glow on the floor behind the chair. A brass ring marks your own seat.
- **"Keeps leaning over to"** is now something you see: after you listen, each pair you heard about turns toward each other for a couple of seconds.
- Kit props everywhere now take the right hue per surface (frames oak, seats green leather); before this the chairs came out pale.

**Checks**

- Guided week through the real buttons in a headless phone browser: no console errors. `tests.html`: 33 of 33.
- The room checked in portrait from your seat and in landscape at the head of the table, with moods marked and two pairs leaning.

---

## 2026-10-21 · Art pass V7: motion and life

**What changed**

- **The chamber breathes.** On an ordinary sitting day a member slips out of their seat every twenty seconds or so, walks down to the aisle and out past the bar, and later someone comes back in and sits down. It pauses for the bells and the count. Two Clerks sit at the Speaker's end of the table and stand for the count. The Speaker's gavel lifts and falls when the result is in.
- **The camera settles instead of sitting.** Every state change in the chamber gives the view a tiny nudge that eases back, so the picture never feels frozen; the office, riding and caucus cameras already ease between shots and sway a little.
- **The title page has the House behind it.** The start menu now sits over the real chamber, seated for whichever seed is in the box (change the seed and the House reseats itself), with the camera drifting slowly from side to side. The paper title page stays on top.
- A number for the walkers' rhythm (`look.walkerEvery`) joins `data/tuning.json`.

**Checks**

- A 76-second soak in the chamber while members came and went: geometries flat at 41, draw calls flat at 36, no growth. `tests.html`: 33 of 33. Guided week through the real buttons, headless phone browser: no console errors.
- The Parliament hash for `TEST-1` is unchanged: nothing in the sim moved.

**Things to know**

- The walker is a cosmetic figure; nobody's attendance changes. If a member is out when a vote is called they're simply back in their seat for it.
- The menu preview builds the game's world before you press Start, which is why the first frame of the chamber appears a beat after the title page.

---

## 2026-10-21 · Art pass V8: the numbers, and what the pass changed

The art pass (`ART-PASS.md`) is done: nine steps, nine merged PRs, all on the live site. Before and after, in one line per room:

- **Chamber:** was a flat green map seen from above the bar; now you open in your own seat looking across the aisle, under stone walls and lit windows, with the division staged (bells dim the room, lamps pulse amber, the camera moves to a three-quarter shot, each seat flashes as it's counted), members coming and going, the Clerks standing for the count and the gavel falling on the result.
- **Office:** was a bare box with a window and chair backs; now a wainscoted room with real furniture, a desk lamp's pool, dusk through the blinds, a corkboard, the visitor framed in the top third, and a darker whip's office for the reversal.
- **Riding:** was a chair back in a beige room; now a storefront with your riding's name on the glass, a street outside with props and a skyline per riding type, a photo wall, the visitor framed open, and the town hall on the pavement with placards when the crowd turns.
- **Caucus:** was a grey table and pegs; now a baize-covered table with carafes and papers, kit chairs, a party banner, pendants, moods as shaped marks and floor glows, and pairs that lean together when you listen.
- **People:** were a capsule and a ball; now one shared silhouette with shoulders, hair, collar and hands, varied per person, with readable moods and small idle motion.
- **UI:** was dark glass and gold buttons; now the Order Paper: cream paper, ink, Fraunces, small caps, bench-green actions, brass rules, rubber stamps, a title page over the live House.

**The numbers** (headless phone viewport, `?seed=TEST-1`): cold load 1.15 MB in 87 requests (budget 10 MB). Draw calls at rest: chamber 36, office 47, caucus 22, riding 45, town hall 19. Ten room switches in a row bring the chamber back to the same 41 geometries it started with, so nothing leaks. `tests.html` 33 of 33; the `TEST-1` Parliament hash is the same as before the pass began (`b7c60eaf77c918bc`): the sim was never touched.

**Still yours**

1. **Frame rate on your phone.** Open the live site with `?debug=1` and read the counter bottom-right in each room, portrait and landscape. The headless browser can't measure this. If the office or riding dip, the fix is known (merge each figure's fixed parts into fewer meshes) and small.
2. **Longlight's colours.** Send the photo; they go on the masthead, the mark at the foot of the title page and the weekly review header (`--brand` in `css/style.css`).
3. **The decisions in `ART-PASS.md` section 5**, if you want any overturned: no faces, procedural figures with CC0 props, one serif, your own seat as the default view, dusk light in the office.

**Left alone on purpose:** audio (stage 9), the colour-blind setting (stage 9; the shaped marks and icons already read without colour), the tier-2 corner office (stage 7), lettering on placards, a fully custom dropdown list.

Next: HANDOFF stage 5, the whip's tools, the count board's marks, pairing and rival whips.

---

## 2026-10-21 · Stage 5: whip tools, the count and rival whips

**What was built**

- **The whip's tools** (`src/sim/tools.js`), gated by act exactly as the design doc's table says: *make the case* (act 1), *chase attendance during the bells* (act 3), *pair* and *grant or refuse leave* (act 4), *committee seats*, *Question Period slots*, *riding projects* (government only), *a word about their nomination*, *a free vote* and *expulsion* (act 5, expulsion with the leader behind you), and *leverage* (any act, once you know a secret). Each costs House time or a favour from a weekly budget (90 minutes and 2 favours, in `tuning.tools`), pushes on the member's decision the way the design doc describes, carries its risk (a refused slot can leak, leverage can get out, a nomination threat raises the floor-crossing risk), and lands in the ledger with a line in the feed.
- **The count board's marks** (`src/sim/count.js`). From act 3 the whip's office files mark your caucus every sitting morning: firm, leaning, lost or away for each upcoming vote, against the number needed. Marks go stale after ten sitting days and fall out of the count, so a whip who hasn't checked lately sees "unmarked" and knows to go and find out. The count shows on the morning order paper, on the bells sheet and at your desk in the office.
- **Rival whips** (`src/sim/rivals.js`). Every other party's chief whip has a style (fixer, enforcer or operator, set by the seed) and a weekly budget scaled by caucus size. Each Monday they work your caucus: poach the wobbliest member before a whipped vote, leak to the paper when you've given them something to use, dig for your skeleton (two to six weeks depending on how bad it is), and test whether the pairs you've made with them hold. Everything they do is in the feed and the ledger, so you can see who's working you.
- **The ledger** (`src/ui/ledger.js`): what you owe, what you're owed, pairs, the pressure you've applied, the other whips' moves and settled promises with KEPT and BROKEN stamps. From the ☰ menu, the office, or an MP's card (filtered to them).
- **In the rooms:** the bells sheet lists who isn't in the chamber yet with a *Chase* button (found: they're in their seat; not found: the doors close on you and you vote the line); the office evening shows the count, leave requests to grant or refuse, likely absentees to pair through the biggest other party's whip, and your remaining budget; the MP card offers whichever tools the act allows; the deal table lets you put leave (act 4) and QP slots, committee seats and projects (act 5) on the table yourself.
- `?act=N` starts a debug game in a later act, so the tools can be tried without playing three Parliaments first.

**Checks** (HANDOFF stage 5, all five)

- Each tool flips at least one MP in a set scenario: persuade, chase, pair, leave, leverage, nomination threat, riding project, QP slot, free vote and expulsion all have a test. Gating by act has a test.
- Every favour, promise, pair and threat shows in the ledger from both sides (yours and the rival whips').
- The count board's prediction matched the division exactly (48–69) when every mark was current, within the two-vote allowance.
- Rival whips act every week: in a ten-week scenario a poach, a leak and a pair test all happened and all reached the feed.
- `tests.html`: 43 of 43. The guided first week still plays through the real buttons with no console errors; an act-4 and an act-5 game walked to the office, the ledger and the bells with no console errors.

**Things to know / decisions I made**

- **Nudges, not mind control.** Tools add to the "pressure" term of the decision model (the design doc's X), so a member who is far gone stays gone unless you use leverage or a nomination threat, which are weighted to flip anyone and cost accordingly.
- **The prediction uses the marks' direction at full weight** and shows "leaning" separately as the uncertainty. That keeps the arithmetic honest when the marks are fresh and makes stale marks the thing to worry about.
- **Rival moves are visible but don't stop you yet.** `rivalMove` is in the pacing stop list; wiring a stop for the big ones (a found skeleton, a broken pair before a confidence vote) belongs with stage 8's consequences.
- **The first week is a honeymoon:** rivals don't work a rookie in week one, so the guided week is unchanged.
- Files beyond the handoff's layout: `src/sim/count.js` (the marks and the prediction; the handoff had them inside the count board UI).

---

## 2026-10-21 · Stage 6: the career, Acts 1 and 2

**What was built**

- **Being noticed ends Act 1.** The whip's office keeps a tally of what gets you noticed (votes, caucus, meetings, now your own bill). Past the threshold, after a few weeks, Act 2 arrives as a page: *reliable* if you toed the line, *useful trouble* if you've rebelled three times. Nobody notices a quiet member, and Act 2 arrives late, or not at all, exactly as the design doc says.
- **The rival.** When Act 2 opens, the most ambitious member of your cohort in your party is named as the one who wants what you want. A small caucus may have no other rookie, so it falls back to the most ambitious backbencher.
- **The private members' lottery.** In Act 2 your name comes up: three bills that suit your interests and your riding, one to choose. It's scheduled four weeks out, your own side gets a free vote, and the week before, you can ask two opposition members who are close to supporting it. Then the whip stops you in the lobby and asks why you've been across the aisle: explain yourself (the whip cools) or drop it (the asks are withdrawn, the bill probably dies). The vote is a stop of its own, and a bill that passes makes your name.
- **The vacancy contest.** After ten weeks in Act 2, when a chair opens in the whip's office, the whip weighs two names: yours and the rival's. You can ask your mentor to speak for you (they spend their capital on you and expect it back), ask your clique to weigh in as a bloc (it costs you with each of them), or let the record speak. Win, and you're an assistant whip with a row: Act 3. Lose, and you choose: wait for the next vacancy, change cliques, or take the committee chair the office is offering.
- **Life events** (`src/sim/lifeEvents.js`). MPs' lives move: an ambition, a crisis, trouble in the riding, a retirement in the air. When it happens to someone close to you, you're asked to show up (an evening of yours, and they won't forget), send a note, or let it pass (they notice). Crises dent attendance; riding trouble eats margins.
- **The career sheet** (`src/ui/careerUI.js`): every career moment as a page with its choices and, where it matters, a stamp (ACT 2, ACT 3, PASSED OVER). The weekly review now says which act you're in and how thick the whip's file is.
- **Under the hood:** stops raised by the morning, fallout and weekend hooks were being dropped by the day loop (a stage 3 gap that nothing used until now). They're queued and shown before the day goes on, and a resolver can chain a second stop (the asks, then the whip's question; the vacancy, then its verdict).

**Checks** (HANDOFF stage 6, all five)

- A new player in any of the four parties starts in Act 1 with a mentor, a cohort and a whipped dilemma vote.
- Rebelling and toeing the line move the whip's file, riding standing and the whip's rapport in opposite directions.
- Friday leave is refused when the whip is cross and granted leave opens the riding.
- A private member's bill was drawn, chosen, asked for across the aisle (twice), questioned by the whip and voted on, headless.
- Act 1 → Act 2 by being noticed, with both reputations and the unnoticed drift; Act 2 ends in a contest that can be won (assistant whip) or lost (committee chair taken, next vacancy queued).
- `tests.html`: 50 of 50. The guided first week plays through the real buttons with no console errors. A forced run through Act 2, the lottery, the asks, the whip's question and the vacancy was screenshotted at every stop.

**Things to know / decisions I made**

- **The contest is a reckoning you can read:** the sheet shows both scores after the fact, so a loss teaches you what the whip weighed (rapport, the file, your mentor, your clique, your style, rebellions).
- **The committee chair isn't a dead end:** it adds to your next contest score and the next vacancy is queued ten weeks out.
- **By-elections and retirements as departures** come with stage 8's elections; for now a retirement is a life event with text.
- Files beyond the handoff's layout: `src/sim/pmb.js` (the lottery and the player's bill) and `data/career.json` (the career texts).

---

## 2026-10-21 · Stage 7: the career, Acts 3 to 5, and the caucus room

**What was built**

- **Act 3, the row** (`src/sim/ranks.js`). As assistant whip you answer for the fifteen members seated along your row. Every whipped division grades the row: held it when someone was at risk, and the deputy notices; lose three of them on a vote that mattered, and the deputy draws a conclusion. The whip's office opens its files on your own caucus the day you arrive (loyalty, attendance, clique, ideology all known). The set piece is a friend from your cohort whose riding hates the week's bill: ask them as a friend (a small nudge, a warmer friend, a fixer's reputation), lean on them (they vote the line, they don't forget, an enforcer's reputation), or let them vote their riding (a conscience, and the deputy sees the gap). Three carried votes over ten weeks make you deputy whip; a row that goes its own way sends you back to the backbench as *soft* or a *bully*, by your reputation.
- **Act 4, the deputy.** Every Monday the count is recorded against you; a government or confidence vote you had as safe that is lost is a wrong count, and one is enough to move you sideways to assistant whip. Before a confidence vote your opposite number offers a pair for your likeliest absentee: take it (one fewer to chase, one more thing that can break) or chase attendance. In week six the leader offers a parliamentary secretary's car and staff: take it and the career ends (the *exit* ending), decline and the leader remembers. After twelve weeks the chief whip's chair can open; you get it if the caucus wants you (support 55) or the leader insists (trust 60, and pays for overruling the room); otherwise someone else does and you wait.
- **Act 5, the Chief Whip.** Each Monday you set the line with the leader: whip it, a free vote (loyalty up, trust by the leader's temper), or a matter of confidence on a government bill (everyone comes home; lose and the government falls). The fall is yours: the leader asks for your resignation and you retire (the *fall* ending) or go back to the backbench and start the climb again.
- **Cabinet offers** from Act 4, more often the more the leader trusts you, each with a portfolio. Decline at no cost and they keep coming; accept and the career ends with the *cabinet* epilogue and the record.
- **Revolts in the caucus room** (`src/sim/caucus.js`). A hot room (grievances past a threshold) can turn on the leader, or on you if you hold the chair and the room doesn't want you. The ringleader stands up; you back the leader, join, or sit still, and it resolves when the room empties: the leader falls and a front-bencher takes over (the new leader remembers who stood up), or it fails and the leader writes names down. A revolt against the whip that carries puts you back on the backbench, or out (the *revolt* ending).
- **The record and the endings** (`src/sim/record.js`, `src/ui/recordUI.js`). Retirement from the menu from Act 2, after a confirm. The record page is the last sheet of the Order Paper: name, riding, party, the ending stamped (RETIRED, CABINET, RESIGNED, OVERTHROWN, LEFT THE WHIP'S OFFICE), the epilogue, the highest rank and act, the reputation, weeks, Parliaments, votes won and lost, confidence votes survived, members promoted and expelled, promises kept and broken, rookies mentored. An ending is a stop nothing moves past, and it survives a save.
- **Crossing the floor** from the menu (Act 2 on, pick a bench, confirm). You're reseated with the new caucus as a rookie in Act 1 with your reputation and highest rank remembered; every open promise with the old caucus is broken, their rapport collapses, their whip's trust is gone, and the riding takes it badly.

**Checks** (HANDOFF stage 7, all five)

- Act 3 → 4 by carrying the row, Act 4 → 5 by the chair; demotion from 3 (soft or bully) and from 4 (the wrong count); the exit, the fall, the revolt, cabinet and retirement endings all reachable in tests.
- A revolt against the leader replaced the leader; a revolt against the whip put the player on the backbench.
- Cabinet declined at no cost, offered again with another portfolio, accepted into the ending with a record.
- Crossed from the government to the opposition: Act 1, reputation kept, ledger burned, rapport and standing hit, struck off the old whips' list.
- Retirement refused in Act 1, allowed in Act 2, with the record and an epilogue.
- `tests.html`: 57 of 57. The row set piece, a revolt in the caucus room, setting the line, a cabinet offer, the menu and the record page were walked through the real buttons at phone size with no console errors.

**Things to know / decisions I made**

- **The row is a seating fact:** your fifteen are the party members on your row of your side, so the chamber shows who you answer for. A party too small for a row uses its first fifteen seats.
- **Failure is quick and recovery is slow,** on purpose: one wrong count or one lost row costs the job, graduation takes weeks. Both are in `data/tuning.json` under `ranks`.
- **The fall and dissolution:** a lost confidence vote in Act 5 asks for your resignation first, then Parliament dissolves as before. Elections are stage 8.
- **Revolts don't change the leader's party line mid-week;** the new leader's temper is rolled, and the next Monday's line comes from them.
- Files beyond the handoff's layout: `src/sim/ranks.js` (Acts 3–5), `src/sim/record.js` (endings, retirement, floor-crossing), `src/ui/recordUI.js`.

---

## 2026-10-21 · Stage 8: confidence, consequences and elections

**What was built**

- **The press gallery** (`src/sim/media.js`, `data/headlines.json`). Every sitting day with a recorded vote gets one headline from one of ten fictional papers, for the story that mattered most: a government falling, a confidence vote survived, a government bill defeated, your own rebellion, a rebellion in any caucus, a close vote, a bill passed. Quiet days sometimes get a routine line. Headlines move the government's national polling (a fall costs most), your rebellions and toed lines move your standing at home, and the last thirty headlines ride along in the save for the weekly review and the HUD ticker. Members whose secrets get used, by you or a rival, carry a scandal score that fades over the weeks.
- **Confidence and supply** (`src/sim/confidence.js`). A minority government looks for a partner on Mondays: the party nearest it in outlook that doesn't want an election. The deal names a category (energy, housing, health and so on) and a term; while it holds, the partner is whipped YEA on confidence votes. Either side can break it when its appetite for an election grows, and the House is told either way. The deal is in the weekly log and shapes the count on confidence days.
- **The pressure meter.** From Act 3 the leader's office keeps score against you: a confidence vote lost on your watch, each of your own members who rebels, your own rebellions. It eases over the weekend. If it tops out you are moved out of the whip's office (a stop with its own sheet and a REPLACED stamp); below Act 3 it's a warning. The weekly review shows the meter from Act 3, red when it's past 70.
- **Falling, and what comes after** (`src/sim/election.js`, `src/ui/electionUI.js`). A government that loses the confidence of the House in its first half-year hands over: the Governor General sends for the opposition, the benches swap, cabinet and whips are re-roled, the House is reseated, government bills are dropped and the Parliament goes on. Later than that, or at the fixed date, the writ drops: a sheet with your riding's history and three ways to spend the campaign (doors at home for standing; the leader's bus for trust and caucus support at a cost at home; let the association run it). Then **election night**: your riding stamped HELD or LOST with the margin, the new government and whether it's a minority, every party's seats before and after with arrows, how many of your cohort lost, how many new members take their seats. One button takes your seat in the next Parliament.
- **The new House.** Seat totals follow national polling with noise; each riding is decided by its member's margin, their party's swing, scandal and (for you) standing at home. Retirements open ridings; losing parties give up their thinnest seats; newcomers are generated with fresh names and a new cohort number, survivors are four years older with their new margins. Leaders stay; cabinets, whips, committees, cliques, mentors and relationships are rebuilt; polling resets to the result. Your rank, act, record and ledger carry over, and every member who left is kept as an alumnus so the ledger still names them (marked *gone*). A new Parliament opens with a fresh Order Paper, week 1, year 1.
- **Endings.** Lose the riding and the career ends with the *defeated* epilogue and the record. Let your nomination threat run high with standing at home low and the association deselects you before the writ: the *nomination* ending. Both arrive on the election-night sheet.

**Checks** (HANDOFF stage 8, all three)

- A minority government fell on a lost confidence vote after the handover window and the writ dropped; the same fall in week 4 handed over to the opposition without an election, same Parliament, reseated.
- The bot played a full four-year Parliament (160 weeks) into the campaign, election night and into week 2 of the next Parliament with no errors, a second time with the riding lost (the bot ignores its riding, and in one run was deselected instead). Forced cases: the riding lost on a margin of 1 with a scandal, and deselection before the writ.
- After a wave election the leading party formed the government, blocks and seats were new (49 rookies in cohort 25, every survivor four years older), every party had a leader and a whip, cliques were rebuilt around sitting members, the player kept their rank, and the ledger entry from the old Parliament survived with its counterparty remembered as an alumnus.
- `tests.html`: 62 of 62. The writ, election night, the first morning of the 25th Parliament, a handover and the pressure line in the weekly review were walked through the real buttons at phone size, portrait and landscape, with no console errors.

**Things to know / decisions I made**

- **An old bug surfaced while testing:** when a talk turn's four options happened to have neither a *listen* nor a *concede* line, the fix-up for one overwrote the other, so a meeting could offer no way to listen. Fixed in `src/sim/meetings.js`; the test loops that depended on it are bounded now so a data gap fails instead of freezing the page.
- **The press knows on the night** whether a fall means an election or a handover (the check is deterministic), so the headline reads right either way.
- **Campaigns are one choice, not a mini-game.** Five weeks of campaign are a sheet and a consequence. The numbers (standing, trust, support) are in `data/tuning.json` under `election.campaign`.
- **Handover window** is 26 weeks (`confidence.handoverWeeks`); agreements last 60 weeks; the pressure meter replaces you at 100. All in `data/tuning.json` under `confidence`, `media` and `election`.
- **Kelbo's note on the target phone:** it has headroom, so the stage 9 performance pass keeps the visual budget up rather than trimming figures, shadows or textures.

## 2026-10-21 · Stage 9: modes and polish

The last HANDOFF stage. The game now has a title page worth landing on, three ways in besides a career, saves that survive anything, sound, settings, and a measured performance budget. With this merged, every stage in `HANDOFF.md` and `ART-PASS.md` is done.

**What was built**

- **Three scenarios** (`src/sim/modes.js`, `data/scenarios.json`). *Three short*: Act 4, deputy whip in a minority, the party that was propping the government up walked out on Friday and the confidence bill on Thursday is three votes short, with two of ours away. Four days to find them with the tools you have (persuade, chase at the bells, pairs and leave). *The room turns*: Act 5, Chief Whip, a Wednesday caucus in open revolt; hold the room or lose the leader. *Home truths*: Act 1, a rookie whose riding hates the Monday bill. Each opens on a brief (a brass-ruled paragraph on the morning sheet) and closes on a verdict with its own stamp on the weekly review or, if the government falls first, on the dissolution sheet. The headless bot loses *Three short* on its own, which is right: it's a whip's squeeze, not a free week.
- **Shared seed and daily seed.** The title page takes a seed from a friend (same seed, same Parliament, same week, proven by the Parliament hash) and offers today's Parliament, one per calendar day, the same for everyone. Both play as careers in whatever slot you pick.
- **Three save slots, export and import** (`src/save.js`). Every game lives in a slot and autosaves there; the title page shows who's in each slot, their act and week, and offers Load, Export (to the clipboard, or into a text box if the clipboard is refused) and Delete with a confirm. Paste an export into the Import box to carry a game between phones. Saves are versioned (now 2); older saves migrate on load, and anything that isn't a save is refused with a plain message.
- **The guided first week** reads as one. Besides the walkthrough notes from Stage 4b, the evening sheet, the division sheet and the Friday riding visit each carry a short hint in week 1 of a new career (not in scenarios). A naive walker that only ever presses the most obvious button gets through the first week with zero stalls on three seeds.
- **Sound** (`src/audio.js`). Everything is synthesised in WebAudio, so no audio file is ever downloaded: a room tone for each room (the chamber's benches with the odd swell, the smaller caucus room, the office with a clock ticking, the riding's wind with a car going by and the odd bird), the division bells (an electric bell, hammered, every 1.1 s while the doors are open), the Speaker's gavel (two knocks) and a paper tick on every button. It starts on the first tap, follows room changes, pauses when the tab is hidden and never reads game state. Levels live in one table at the top of the file.
- **Settings** (`src/settings.js`, the Settings sheet from the title page and the game menu). Sound on/off, volume, **colour-blind party colours** (the Okabe-Ito palette from `data/parties.json`, plus blue/vermilion for the yea/nay marks; the room you're in redraws at once) and **larger text** (the whole Order Paper layer scales up by 12%). Stored under `whip:settings`, bad values ignored.
- **Performance pass, visuals kept.** Nothing was trimmed. Measured instead: cold load is 1.4 MB of our own files (106 requests: 529 KB of code, 472 KB of textures, 229 KB of data, 108 KB of fonts) plus Three.js from the CDN, which the browser caches. Cycling office → caucus → riding → chamber four times leaves the renderer at exactly the same geometry, texture and program counts each lap (41 / 19 / 15), so leaving a room frees it. Draw calls per room: office 47, riding 45, chamber 36, caucus 23.

**Checks** (HANDOFF stage 9, all four)

- A save survives closing and reopening the browser: a new career in slot 2 was played one stop in, the tab was closed, a fresh tab showed *Continue · Week 1, Year 1 · Career* and resumed on the same seed, day and stop.
- A new player finishes the first week without help: the naive walker reached week 2 with zero stalls on three seeds, hints showing at the office, the bells and the riding.
- Cold load under 10 MB; switching rooms frees the previous scene: see the numbers above.
- Three scenarios, shared-seed entry and the daily seed all start correctly: each scenario opens on the right act, role, week, bill and count and settles to a verdict; the same seed twice gives the same Parliament hash; the daily seed changes only with the calendar day. `tests.html`: 69 of 69. Title page, settings sheet, scenario brief and verdict, and the saves list were checked at phone size in portrait and landscape with no console errors.

**Things to know / decisions I made**

- **"Ottawa" slipped into four lines** (two riding buttons, one hint, one whip's note). Renamed to the game's capital, Ostrava, which the content has used since Stage 4. Ostrava is also a real city in Czechia; if that bothers you, it's one name in `data/world.json` and a handful of content lines.
- **Sound can't be heard in the headless checks**, so it was rendered offline and measured: room tones sit between -30 and -36 dBFS, bells peak at 0.31, the gavel at 0.35, nothing clips. Worth a listen on the phone; the table at the top of `src/audio.js` is the place to turn anything up or down.
- **Larger text uses CSS `zoom` on the UI layer**, which every current phone browser supports. The rooms behind don't scale.
- **The colour-blind palette** is the Okabe-Ito set: blue, vermilion, yellow, bluish green, reddish purple for a fifth party, grey for independents. The paper's own green stays as it is.
- **Still owed by you:** the phone frame-rate check with `?debug=1`, a listen to the sound, and Longlight's colours for `--brand`.

## 2026-10-21 · Longlight's colours

Kelbo sent the studio mark: the sun on the horizon, in purple, near-black, terracotta and warm off-white.

**What was built**

- **Brand tokens** in `css/style.css`: `--brand` (purple #6c46b5), `--brand-2` (the brighter horizon purple #7b3fc4), `--brand-ink` (#141413), `--brand-sun` (#d97757) and `--brand-paper` (#e1ded5), sampled from the icons.
- **The mark** replaces the placeholder "W": one SVG (`longlightMark` in `src/ui/text.js`) on the title page colophon, as the browser tab icon, and on the loading screen.
- **A loading screen.** Until now the page was black until the data and Three.js arrived, which on a phone's first visit is a second or two. Now it is plain HTML in `index.html`, so it shows before any script runs: the studio's dark field, the sun easing up over its horizon, *Longlight Interactive* in small caps. It fades once the title page (or a `?seed=` game) is up, and on a fatal error it gets out of the way of the message.
- **The masthead tag** ("THE WHIP" at the top left in play) carries a purple left rule in place of the green.

**Things to know / decisions I made**

- The brand stays at the studio's touchpoints: loading, the mark, the masthead rule, the tab icon. The Order Paper keeps its own green, brass and paper; purple across the sheets would fight the look the art pass set. If you'd like more of it (the title page's top rule, the primary buttons), it's one token each.
- `tests.html`: 69 of 69. Title page, colophon, masthead and the loading screen checked at phone size with no console errors.

## 2026-10-21 · Round two, 1 of 12: the office and the riding reframed

Kelbo's once-over picked twelve things. This is the first: the two rooms where a person sits across from you now keep that person in the clear part of the screen, whichever way the phone is held.

**What was built**

- **A shared framing helper** (`src/framing.js`). Every room sheet covers part of the screen: the lower half in portrait, the right-hand 46% in landscape. The office, riding and caucus cameras already aimed down in portrait; now they also turn right in landscape, so the person you're dealing with sits in the middle of the clear left half instead of behind the paper.
- **The riding desk shot is less steep.** The visitor's head and shoulders sit in the band between the masthead and the sheet; before, the chair back and your own arm filled the frame and the head ran under the masthead.
- **The riding's name on the glass** is a smaller two-line sign to the right of the visitor (where it isn't hidden by their head), low enough to clear the masthead in portrait. Long riding names drop to a smaller face rather than running off the pane.

**Things to know / decisions I made**

- The turn is a small rotation of the look direction, not a lens shift, so verticals stay straight and the shots in each scene file are untouched.
- The chamber keeps its own camera (it has orbit and focus moves of its own); the division sheet in landscape is a separate question.
- `tests.html`: 69 of 69. Checked in portrait and landscape at phone size with a visitor seated in the office and in the riding, and the caucus in landscape; no console errors.

## 2026-10-21 · Round two, 2 of 12: the Clerk reads the names

**What was built**

- **The roll on the count board.** During a recorded division the board already said "The Clerk reads the names"; now it does. As each seat lights, that member's name slides onto a strip under the tally, the newest at the right and darkest, the last three fading behind it. Each carries its ✔ or ✖. Names from your own caucus are bold; your own is underlined in brass, so you can see yourself counted.
- **The vote lights pass the member through.** `voteLights.play` keeps each member's id in its queue and hands it to the board on every tick, with the count. Nothing in the sim changed.

**Things to know / decisions I made**

- Surnames only, with no honorifics: the sim doesn't carry a form of address, and the Clerk's roll in the real House is names, not titles. The strip appends one span and drops the oldest rather than redrawing, so the names already read stay still.
- At the tuned 0.08 s a seat the strip runs quickly; that's the point, the count moving under you. "Show result" still jumps to the end.
- `tests.html`: 69 of 69. Checked at phone size in portrait and landscape through a real division; no console errors.

## 2026-10-21 · Round two, 3 of 12: slogans on the town hall placards

**What was built**

- The four blank boards at the back of the town hall crowd now say something. Each is painted on its own canvas in marker lettering on cardboard (black, red and blue markers, four paper tones, a strip of tape at the top, each board tilted a little differently in the holder's hand), wrapped and sized to fit the board.
- What they say comes from the week: the bill topic's slogan and the local issue's slogan go up first, then their second lines, then the standing grievances ("WE VOTED FOR YOU", "{town} FIRST", "LISTEN TO {riding}"…) if there are boards left. Every town hall topic has two slogans in `data/constituents.json` under `townHall.placards`, with the bill's title, the town, the whip's name and so on filled in the same way the questions are.
- The boards go up with the mood: the two topic boards once the crowd cools (below 45), all four once the room has turned (below 35), none while they're with you.
- The sign-holders moved to the back rows and are spread so all four read from the podium in portrait as well as landscape.

**Things to know / decisions I made**

- Choosing the slogans is sim logic (`townHallPlacards` in `src/sim/riding.js`, deterministic, no DOM), so the main loop just hands the filled strings to the room. A new test checks four boards, no `{placeholder}` left over, no two boards alike, and that the bill's title lands on the board.
- The lettering is a heavy system sans rather than a loaded font, so the boards paint instantly and need no new resource.

## 2026-10-21 · Round two, 4 of 12: suits, ties and lapel pins

**What was built**

- Every figure now has a tie (knot and a blade that narrows toward it) and a small lapel pin, in the instanced crowds and on the articulated office figure alike. A `wardrobe(id, partyColour)` helper in `src/figures.js` decides what someone wears from who they are, so it's the same across sessions.
- Up close (the caucus table, the office, the chamber walkers) suits come from eight real suit colours: charcoal, navy, grey, brown, black, dark green, slate, plum. The party shows in the tie (two in three wear the party's; the rest navy, burgundy, charcoal, silver, forest or brown) and in the pin, which every member wears.
- On the benches the suit keeps the party colour so the House still reads from your seat; there the tie goes neutral and the pin stays the party's.
- In the riding, the mayor and the plant manager come in a tie of their own; the riding association president wears the party tie and the pin. Farmers, stewards, reporters and the town hall crowd don't.
- The player's own figure (seen from behind in the office and the riding) wears a real suit with the party tie and pin.

**Things to know / decisions I made**

- The caucus used to recolour every suit to the party colour in `read`; now it dresses each seat with the wardrobe for that party, so the room is varied suits with party ties, and the mood marks and glow are unchanged.
- Staff keep plain suits with no tie or pin: the Speaker, clerks, and the gallery. Two more instanced parts per crowd (tie, pin), so a full House is eight draw calls instead of six.

## 2026-10-21 · Round two, 5 of 12: paper pickers

**What was built**

- The four dropdowns on the new-career form (party, background, riding, province) and the five filters in the whip's book (party, clique, cohort, riding type, sort) no longer open the phone's own picker wheel. They open an Order Paper list: a sheet that slides up from the bottom in portrait, or sits centred in landscape, with the current choice in bold and ticked in bench green, one tap to choose, the ✕, a tap outside or Escape to leave it as it was.
- The field itself still looks like the underlined field it replaces (same type, same chevron), so the form is unchanged at a glance; what changed is what happens when you tap.
- Where it helps, a row carries a second line: each background shows its strength under its name ("Lawyer · Reads a room and a bill").
- In the book, the sort rows drop the "Sort:" prefix inside the list, since the sheet's heading already says what it is.

**Things to know / decisions I made**

- One small module, `src/ui/picker.js`, does it for both screens. It renders a button over a hidden input that carries the value under the field's name and fires `change` on a pick, so the form code that read `.value` and listened to `onchange` (the party blurb, for one) didn't have to change.
- The list sits above every other sheet, the title page's settings included, and it tears itself down on close, so nothing lingers in the page between opens.
- The guided first week, the saves list and the mode buttons still use the custom controls they had; nothing native remains on the title page but the two name fields and the shared-seed box, which are text and should be.

## 2026-10-21 · Round two, 7 of 12: Question Period

**What was built**

- Question Period is a scene you play, not a line in the log. On a sitting day your slot comes round (the guided first week puts it on the Tuesday, so everyone sees one early; after that it's the rota, about one every two or three weeks as a backbencher, rarer once you're in the whip's office) and the House stops before the day's votes with the Speaker calling your riding.
- Three beats. You stand and choose how to ask: **keep to the line** (the question the party wrote), **press the minister** (a question with an edge), or **name the thing at home** (off the sheet: the case you carried from the riding, or one of the riding's standing complaints). Each button shows the actual question. Then the minister answers, from their mood that day (cooperative, guarded, angry, anxious), and the benches react; then the gallery's verdict as a stamp (A lob, Parried, A hit, On the record), a line on what the press made of it, and the ruled table of what it moved.
- What it moves: the whip's opinion of you, how noticed you are (which is what gets you out of Act 1), riding standing, and on a hit against the government, their polling. A lob pleases the whip and nobody else. Pressing the minister is a gamble on their mood: a hit gets the gallery's phones out and a headline; a parry gets you a note in the whip's file and not much else. Naming the riding costs you a little with the whip and buys a lot at home, and the riding paper writes it up. Government and opposition members get different effects: an opposition hit is what the whip wants; a government backbencher landing one on their own minister is noticed for the wrong reasons.
- The chamber plays it. The camera comes out of your seat to a shot from across the aisle: you on your feet at your place (an articulated figure, shifting their weight, one hand making the point), then the minister rising at theirs while you sit, then the wide shot of the House for the reaction and the gavel. The benches are heard: a volley of desk-thumps and a swell of the voices, ragged for a lob, the whole side for a hit.
- A Question Period slot the whip's office promised you in a deal now comes due in the House ("The whip's office put you down for this one") instead of being cashed silently in the office, and the riding notices the favour.
- Twelve new headlines (the hit, the parry, the lob, the riding), the Speaker's calls, thirty questions, thirty-two answers, bench and gallery lines, and sixteen riding issues by riding type, all in `data/question-period.json`; the numbers in `data/tuning.json` under `questionPeriod`.

**Things to know / decisions I made**

- The sim hook sits between caucus and the day's votes (`hooks.questionPeriod` in `pacing.js`), once a day. The bot and a skipped stop ask the party's question, so headless Parliaments still run and the count stays believable (about one question every three to five weeks over a whole Parliament, as the whip's office cuts your slots in Acts 3+).
- An off-script question marks a carried riding case as raised in the House, so it isn't asked twice; when there's no case, a riding-type issue stands in ("the winter road season", "the rent"). The minister for an off-script question is whoever holds that interest in cabinet, not the bill's sponsor.
- The question comes before any division, so the "Noticed" it earns counts toward Act 2 the same week. Saves from before this change load unchanged: a player without a `lastQp` is simply due.
- Four new tests (the guided-week slot, each framing's effects for both sides, the promised slot, every line and headline filling).

## 2026-10-21 · Round two, 8 of 12: An office that grows with rank

**What was built**

- The office is five rooms now, one per Act, and a promotion is something you walk into. **Act 1, the shared room:** cramped, two desks, a fluorescent tube, one window, a filing cabinet, the last member's boxes still in the corner, and your deskmate working late at the other desk (a real figure, the first-term member of your party the sim seats you with, glancing over now and then). **Act 2, your own office:** one door, one desk with your nameplate on it, a window, an empty bookcase, a coat rack. **Act 3, the whip's annex:** the same room with two steel cabinets of your row's files along the wall and a coffee machine on a side table. **Act 4, the deputy's office:** bigger, walnut desk, a rug, the party's flag in the corner, a wall-sized board, three cabinets, a lounge chair for the ones who'd rather not sit across a desk. **Act 5, the chief whip's corner office:** two windows, the whips' table under the board with four chairs, a sofa and coffee table, a floor lamp, the flag.
- Each room has its own light (cold tube in the shared room, warm lamp pools and darker walls as you rise) and its own empty-room shot, framed from inside its door, so the five rooms look like five rooms and not one desk from the same angle.
- The sheet's heading names the room ("The shared room · evening" … "The chief whip's office · evening"), and the first evening you spend at a new rank the log describes it, once ("Your own door, with your name on it. …").
- The reversal in Act 1 still takes you to the whip's own office (blinds, walnut, the flag), whatever Act you've reached.

**Things to know / decisions I made**

- The room rebuilds when the Act changes (`rooms.show` now watches a `variant`), so a promotion mid-career swaps the set the next time you're in the office; nothing else is rebuilt. Draw calls stay under 80 in every set.
- Old saves work: a save from before this change logs the room line once on its next office evening and carries on.
- The deskmate is chosen deterministically (lowest id among your party's first-term members, you excepted), so the same seed always gives the same colleague. They're only in the Act 1 set.
- The whip's office for the reversal is built lazily, the first time it's needed, so Acts 2–5 never pay for it.
- The old `tier` extra went away; the office takes `act` now. One new test: the first evening at each rank logs the line once, and every Act has a room, a line and a title.

## 2026-10-21 · Round two, 9 of 12: The weekly front page

**What was built**

- The week's review is a newspaper now. At the weekend the sheet is the front page of one of Ostrava's papers: the ears (Weekend edition · Week 7, Year 1), the masthead in heavy type between rules (whichever paper ran the week's biggest story: *The Ostrava Ledger*, *Westmark Herald*, *Caledor Press Wire* …), and a dateline with the national polls as a ticker (NU 36 · CP 36 · LD 13 …).
- **The lead story** is the week's biggest headline from the press gallery, chosen by weight (a confidence vote beats a defeat beats your own rebellion beats a walkout beats a backbench revolt beats a Question Period hit beats a leak …), with a new second line under it, the *deck*, a dry sentence or two in the paper's voice ("The whip's office declined to comment, which in that office is a comment."), and a byline. Every event that makes a headline now has two or three decks to draw from.
- **Your photograph** runs beside the lead when the story is yours: a rebellion, a line toed against the riding, a town hall, a Question Period, an absence. It's the game's own figure of you in your own suit, tie and pin, rendered once off screen in three-quarter view and screened into newsprint halftone (ink dots on a tilted lattice over cream), with a caption ("The member for Prentiss–Long Lake, photographed before the division."). Rendered on demand and kept, so it costs one frame once per career.
- **Below the fold:** *Elsewhere in the press*, the week's other headlines with their papers; *By the numbers*, the same riding standing, whip's view, rebellions and divisions as before; *The polls*, a line chart of national polling over the last twelve weeks in the party colours, with each party's figure down the right edge (the first weekend shows a single reading and says a line needs a second week); and *The week in brief*, the log in small type, oldest first, which is how a week reads.
- A week that made no news still gets a paper: seven quiet headlines ("Parliament sits, talks, adjourns") with decks to match, chosen by the week number so they rotate without touching the dice.
- Two kinds of story that had headlines written but never fired now do: a packed town hall at home makes the paper about half the time, and a rival whip's leak about your caucus reaches the front page about a third of the time.

**Things to know / decisions I made**

- The sim keeps a weekly poll history (`state.pollHistory`, 52 weeks) from the weekend hook; the chart draws the last twelve. Old saves start the history at their next weekend and the chart grows from there.
- The front page is pure data from the sim: the week's press entries (sorted by `FRONT_PRIORITY` in `media.js`), the polls, and the same summary as before; `src/ui/frontPage.js` lays it out and `src/pressPhoto.js` makes the photograph. The sim never sees the photo.
- Press entries now carry a `deck` and a `you` flag. Decks, bylines, captions and the quiet headlines live in `data/headlines.json`; the four new numbers (`pollHistoryWeeks`, `chartWeeks`, `townHallPress`, `leakPress`) in `data/tuning.json` under `media`.
- Checked over a 48-week headless Parliament: every week has a lead, no placeholders left unfilled, a quarter of weeks quiet, the rest led by confidence votes, bills, revolts and leaks in a believable mix. Leaks were leading too often at first (one week in four), so they're rarer now and rank below a revolt.
- One new test: the first week's page, the poll history, a quiet week's lead without a dice roll, every deck using only keys a headline can fill, and the photo flag following the player.

## 2026-10-21 · Round two, 10 of 12: Seasons

**What was built**

- **A calendar.** A Parliament's year now runs September to June, ten months of four sitting weeks. The bar reads "Monday 1 September · Week 1, Year 1" instead of a bare week number, and the year turns through autumn, winter (from December), spring (from March) and summer (June).
- **Weather, every week.** Each week has its own weather: clear, overcast, rain, fog, snow, and in deep winter the odd blizzard, with a temperature to match (about 18° in September, −10° in January, 22° in June). Snow arrives in late autumn, lies all winter and melts over four weeks in March.
- **The office window** shows it. The painted view over the lawn changes with the year: a long gold dusk in September with the maples turning, first snow on the trees in November, bare boughs under snow and the lawn white with blue shadows by five o'clock in January, a brown wet thaw in March, a green lawn and a late bright evening in June. Snow or rain falls past the glass, rain runs down the pane, fog greys it out, and the room's light goes cold and weak in winter and warm in June. Every office, shared room to chief whip's corner, gets it.
- **The riding** shows it. The street outside the constituency office is white in winter, with banks along the kerbs and a grey packed road, and the pavement shines when it's wet. Snow and rain fall over the street and the town hall.
- **Coats on the town hall crowd.** In cool or wet weeks the crowd wears wool coats in dark, ordinary colours; in the cold, two in three wear a toque. In September and June it's shirtsleeves and suits.
- **The chamber light.** On a clear day, shafts of sun fall from the high windows across the government benches: gold in autumn, thin and blue in January, strong and warm in June. On a grey day there are none and the panes go pale; in a blizzard the room is at its dimmest.
- **The morning log** marks the turns: the first Monday of each season gets a line ("Winter. The light is gone by half past four and the office window shows nothing but your own reflection."), as do the first snow and a blizzard ("Snow all night and still falling. The buses are off, the galleries are empty, and Monday's count has a new column: stranded."). Three lines per season, rotating by year, so a four-year Parliament doesn't repeat itself back to back.
- **The weekend paper** carries the weather in its ears ("BLIZZARD · −18°") and its date ("6 January · Year 1").

**Things to know / decisions I made**

- The weather is cosmetic by design: it changes nothing in the sim. It's worked out from the seed and the week number with its own hash, never the game's dice, so it's the same every time for a seed and drawing it never changes a vote or a deal. (Making a blizzard thin the House on a division day is a natural next step if you want weather to bite; I held off because it touches the count.)
- The caucus room has no windows, so it doesn't change with the seasons.
- On a phone held upright the paper's ears are too narrow for three items, so "Weekend edition" gives way and the ears show the weather and the date. The date dropped its "Weekend of" prefix for the same reason.
- The calendar lives in `src/sim/calendar.js`; months, season starts, monthly highs, first snow, thaw length and each season's weather mix are in `data/tuning.json` under `calendar`; the season lines are in `data/seasons.json`. The falling snow and rain are one shared piece (`src/weatherFx.js`) used by the office and the riding.
- Three new tests: the calendar's dates, weather that is deterministic and fits its season without touching the dice, and the winter line logged exactly once.

## 2026-10-21 · Round two, 12 (tenth of twelve): The bells as a chase

**What was built**

- **A map of the Hill on the bells sheet.** From Act 3, when the division bells ring on a whipped vote, the sheet shows an ink plan of Parliament Hill: the Centre Block with the chamber and the lobbies behind it, the Halden Block and the Ferrier Building across the street, and the road out to the airport. Members of every party walk in to vote as the clock runs.
- **Our absent members, where they are.** Each of ours who isn't in the building is a pip in their party colour, placed where the whip's office has them: "in the barber's chair downstairs", "on a long call in the Ferrier Building", "at the gate with boarding called". Each pip shows the round trip in seconds. If more than six are missing, the rest are "not answering" and can't be fetched.
- **A real clock.** The bells run 30 seconds (15 for a scheduled vote) with a draining bar under the heading. The bar and the bell line turn red for the last five seconds. When the clock hits zero the doors close and you vote with your party, as before.
- **Staff to send.** Tap a pip to send someone. A staffer's dot walks the route out and back in real time; a member who was found follows them in and takes a seat on the floor of the House, and the count updates. A member who wasn't there leaves the staffer coming back alone and the pip marked "not found". Trips that can no longer beat the doors grey out as "too far now".
- **Staff grow with rank.** One runner as a junior whip (Act 3), two as deputy (Act 4), three as chief whip (Act 5). The staff dots beside the heading show who's free.
- **The record.** Each fetch goes in the ledger with its line, and when the doors close the log gets one line for the whole chase ("You sent for three during the bells on the Border Security Enhancement Act; two made it in.").

**Things to know / decisions I made**

- Who is away is worked out from the seed, the bill and the stage with its own hash, never the game's dice, so opening the bells changes nothing else. That list *is* our side's attendance for that division: anyone away and not fetched misses the vote, everyone else is in the building.
- The outcome of a fetch is settled the moment the staffer leaves, but only shown when they get back. The log and ledger lines are written when the doors close, so the date bar doesn't spoil a result mid-run.
- A failed fetch now costs that runner's time, not the whole bells. DESIGN.md says a failed chase "costs the bell period"; with one runner at Act 3 a miss on a long trip still does exactly that, but later a chief whip with three runners can recover. Each send still costs 10 minutes of House time, as before.
- The odds and trips: the lobbies are close and nearly certain (about 5 seconds, 95%), the offices middling (about 11 seconds, 75%), the airport a long shot (about 21 seconds, 50%). Members with leave granted are mostly at the airport. Paired members are left off the map: their pair holds them out.
- During the bells the count line agrees with the map: members away are counted "away" whatever the book said, and a member the book had away who is actually in the building is counted with us or lost by how they'll vote.
- Over a headless Parliament, a whipped division has about two of ours away on average and six at most; about half are in the lobbies, two in five in the offices, one in eight at the airport. Trips run 4 to 23 seconds.
- The two office buildings are fictional names. The map's text is in `data/strings.en.json` under `hill.*`, the places and lines in `data/hill.json`, and the numbers in `data/tuning.json` under `tools.chase`. The drawing is `src/ui/hillMap.js`; the sim side is the "bells" section of `src/sim/tools.js`.
- Two new tests (the seeded away list, the clock and staff limits, the count rising after a fetch, the ledger and log on close; every Hill line filling with a spot on the map for each place) and the old chase test rewritten for the map.

## 2026-10-21 · Round two, 13 (eleventh of twelve): The cold open

**What was built**

- **A new career starts on election night.** Before the guided first week, you're outside your campaign office in your own riding after dark. The street is lit by the lamps and the open door, there's bunting in your party's colour, lawn signs with your name, and a crowd of supporters holding placards ("FUNG", "NU · Fung", "Vote Fung").
- **The count comes in poll by poll.** An Order Paper sheet shows the polls reporting and the time. You and three rivals each get a row with votes that count up and a share bar. The rows change places when the lead changes hands. Under them sits a line of commentary that never repeats in a night ("The first polls are in from Ravensworth, and they are not yours…"). A bar of the House fills in nationally, with the line for a majority marked, and the broadcaster calls the government partway through.
- **The crowd rides the lead.** The supporters' mood follows your margin. They cheer when the lead comes your way and roar at the end, with sound to match.
- **The declaration.** The returning officer reads the result at the local hall, and an ELECTED stamp comes down over your majority and the shape of the country ("A minority National Union government, 60 of 120 seats"). "Skip to the result" jumps straight here.
- **Opening day.** "To the Hill" cuts to the chamber. The camera walks you in through the doors at the bar, down the aisle on your side past the Clerks' table with your eyes on the Speaker's chair, then over the desks and down into your own seat. While you walk, the lines come up one at a time: the door, the Speaker in the chair, where your seat is, your mentor catching your eye. When you sit, the benches thump their desks. "Begin the first week" takes you to Monday morning, as before.
- **It's on the record.** The night logs one line ("Election night in Ravensworth–Mill Creek: elected by 10,949 votes. A minority National Union government."). The career timeline (pitch 14) can start from it.

**Things to know / decisions I made**

- The night is built from the Parliament the game already generated. Your share comes from your riding's margin, the runner-up finishes exactly that margin behind, and the national seats end on the real House. It runs on its own seeded stream, so the cold open changes nothing else about the game: the same seed gives the same Parliament with or without it.
- A close seat (under 9 points) always starts behind and turns during the night, which is where the tension is. A safe seat leads from the first box. Over 240 headless nights the margins ran from 421 to 11,517 votes, and no line repeated within a night.
- Rivals are the parties that run strongest in your riding (region and riding type, then national polls). Rival and returning-officer names come from the same name pools as the MPs and never clash with a sitting member.
- The cold open plays for every new career from the menu. Scenarios, the daily seed and shared seeds skip it. "Straight to Monday" on the result skips the walk. Reloading mid-night restarts the count.
- The walk's clock starts on the first frame drawn in the chamber, and a single slow frame only nudges it on, so a hitch on the room swap doesn't skip the walk. The walk takes 15 seconds. "Take your seat" cuts to the end.
- On a phone the caption sheet covers part of the view. In portrait the walk looks a little lower, so the benches sit above the sheet. In landscape it turns its gaze into the clear left half, the same way the office and the riding do, so the Speaker's chair isn't behind the paper. In landscape the walk sheet runs the full height of the screen, and older lines scroll up as new ones arrive.
- The agenda bar and top bar are hidden for the cold open. The night's log line doesn't toast over the walk.
- The broadcaster ("Dominion Broadcasting") and the halls are fictional. The text is in `data/cold-open.json` and `data/strings.en.json` (`coldOpen.*`), and the timings and vote ranges are in `data/tuning.json` under `coldOpen`. The sim is `src/sim/coldOpen.js`, the sheet is `src/ui/coldOpen.js`, the night street is in `src/riding/ridingScene.js` and the walk is in `src/chamber/camera.js`. `?coldopen=1` with a seed starts on it for testing.
- Two new tests: the night is deterministic, ends on your margin and the real House, never repeats a line, and every close seat turns; a new career goes count, walk, Monday (or count, Monday when skipped) without touching the RNG.

## 2026-10-21 · Round two, 14 (last of twelve): Your career as a timeline

**What was built**

- **The record is now a memoir.** "Your record" in the ☰ menu opens your career as a timeline you scroll through: a double rule down the left of the page, a dot for each moment, and a chapter heading each time your act or rank changes ("Act 3 · Assistant Whip"). A stamped rule marks each new Parliament. Moments rise off the page as you scroll to them. With reduce-motion on they're simply there.
- **Each moment is a slip of paper.** It has the date ("Monday 8 February, Year 1"), what kind of moment it was (Election night, Confidence, Your bill, Promoted, Against the line…), a title, and a few sentences in the game's voice. Underneath are **the people in it**, as chips in their party's colour with what they were to you: "ran second, 11,403 votes", "your mentor", "the whip", "voted with you", "wasn't in the House", "got the chair", "lost the chair to you". Tap a member still in the House and their card opens over the memoir. Members who have left keep their name, on a dashed chip.
- **What goes in.** Election night (with your rival and your mentor); being sworn in; the whip's first call (taken, refused, or missed); the first time you broke the line (with the whip and anyone who stood with you); your private member's bill going in, then passing or dying, with each member you asked across the aisle and how they voted; being noticed for Act 2 and your rival; winning the chair in the whip's office, or being passed over the first time; leaning on a friend; promotions to deputy and chief whip; every demotion and why; the temptation and cabinet offers you turned down; the first time you broke your word; your first question in Question Period; each general election; crossing the floor; caucus revolts; a colleague's bad month you showed up for (or didn't); and the ending.
- **Confidence votes go in when they mattered.** That means the first one, a close one (six or fewer), one that brought a government down, one your own side's rebels or absentees could have turned, one you fetched members in for, or one where you crossed your line. They come with the margin in words ("three short", "by nine") and the names that decided it: "Olaf Corrigan broke from the line. Two of your own weren't in the House, Alasdair Johal and Bernadette Kapoor among them."
- **The last page.** When a career ends, the record page now runs: the stamp and epilogue, four numbers, the whole memoir under "The moments", the full tally under "By the numbers", then "A new career".

**Things to know / decisions I made**

- Lines are dealt from a shuffled deck for each kind of moment, so the same line isn't used twice until the rest have been. The deck is seeded by the game's seed, never the game's RNG. Writing the memoir changes nothing about how the game plays: a test plays the same career with and without it and gets the same game.
- On the first run every confidence vote went in, and in a long career they were most of the book, mostly "the government held by 28". Losing the chair in the whip's office, which can happen many times, and every caucus revolt (most fizzle) filled pages the same way. Now losing the chair goes in once. A revolt goes in if it's the first, if it won, or if you took a side. Over twelve headless careers of up to four years that took the memoir from 52 moments a career to 26, with at most 34. That's with a bot that breaks the line a quarter of the time; a real player's book will be tighter. A memoir is capped at 160 moments, dropping a colleague's bad month first.
- Each moment keeps a name and party for everyone in it, as well as their id, because members retire and lose seats. The chip still reads right years later.
- A save from before this has no memoir. It starts one from the day you load it, and the page says so in italics at the top.
- In landscape the memoir and record run the full height of the screen beside the scene, since a short screen needs every line. In portrait they sit above the agenda bar like the ledger.
- Found on the way: the record page said "rep.replaced" as your reputation if you'd been removed from the whip's office after a government fell. It now reads "Replaced in the whip's office".
- Two wordings fixed after reading whole memoirs: "You had the government on X and lost it" read wrong for a 30-vote loss, and "you knew every one of them by name" read wrong at 52.
- The text is in `data/memoir.json`, the labels in `data/strings.en.json` (`memoir.*`), and the numbers in `data/tuning.json` under `memoir`. The sim is `src/sim/memoir.js`, called from the places those moments happen; the page is `src/ui/memoirUI.js`, and `src/ui/recordUI.js` uses it for the ending.
- Three new tests: the memoir has the key moments with their people, is the same for the same seed and doesn't move the game; confidence votes are written down selectively; an old save starts a memoir and says where, and the cap drops small moments first.

That's all twelve of Round two. What comes next is Kelbo's playtest notes; the phone frame-rate check with `?debug=1` is still owed.

## 2026-10-21 · Round two, 11: Faces you earn

Kelbo picked this one after the twelve were done. It ties "knowing people is the skill" into the art: you can see who you know.

**What was built**

- **Strangers are faceless.** Every MP you've never spoken to has a blank face in every room: hair, skin and suit, but no eyes, no nose. That's most of the House when you arrive.
- **One conversation gives them a face.** The first time you talk to someone (an office meeting, a call, a word at caucus), they get eyes, a nose and brows.
- **A second gives them the feature.** That's the thing you'd pick them out by across the floor: round glasses, square glasses, half-moon readers, heavy brows, earrings, a beard or a moustache.
- **Knowing them well gives the keepsake.** After four talks, and once you know six things about them, they get something personal: a bow tie, a pocket square, a flower in the lapel, or a bold tie in their own colour.
- **Each face is that member's own.** The same MP always gets the same feature, frame colour and keepsake, so once you've learned a face it stays theirs for the whole career.
- **In the office, the face comes into focus.** A visitor walks in looking as you knew them before tonight. When they sit down and the conversation starts, the new parts grow in. Something you learn mid-meeting can bring the keepsake in the same way.
- **By the later acts your side of the House looks different.** In the headless runs, after four years the bot's own caucus was about 14% faceless, 23% with a face, 32% with a feature and 30% with a keepsake. The opposition was 66% faceless and never got a keepsake. Your caucus is a room of people; the other side is still a crowd.

**Things to know / decisions I made**

- The face is drawn wherever MPs are: the chamber benches, the walkers and the member on their feet, the caucus table, the office visitor, the colleague at the other desk, the whip at the desk in the reversal, and your photo on the front page (always a full face; it's you).
- Votes and the whip's office reveal a lot about many MPs at once, so what you know about someone can't be what gives them a face, or half the House would have one without a word spoken. Faces come from talking to people. Knowledge only matters for the last step.
- Beards and moustaches only go on members whose first name is on a short list in `data/names.json` (`whiskers`). Everyone else draws from glasses, brows and earrings. That stops the game putting a beard on a figure at random.
- The hair was drawn as a cap over the whole head, which would have covered a face. It's now a hairline that leaves the face open and covers the crown, sides and back. Seen from behind or across the chamber it reads the same as before.
- The numbers are in `data/tuning.json` under `faces` (talks for the feature, talks and things known for the keepsake). How well you know someone is `familiarity()` in `src/sim/knowledge.js`, which counts your conversations in `player.talks`. A save from before this treats anyone you've had contact with as one talk.
- The face parts are in `src/faces.js`. The crowds in `src/figures.js` draw each kind of part as one instanced mesh that's switched off when nobody in the room wears it, so a room of strangers costs no extra draw calls.
- Counting talks changes nothing about how the game plays: same seed, same Parliament. Two new tests check the tiers, the old-save rule and that faces don't move the game; that a face is the same every time; and that each tier only adds parts.

## 2026-10-21 · A softer Order Paper

Kelbo asked for the UI to look less "AI-made" and a bit softer. It's still the Order Paper (paper, serif, green and brass), with the edges taken off.

**What changed**

- **Labels stopped shouting.** Section heads, field labels and buttons were in spaced small capitals. They're now in ordinary sentence case, and section heads are a quiet italic ("What you know", "At your door") over a light rule.
- **Buttons are soft paper.** Rounded corners, a pale fill, a hairline edge and a gentle shadow, and they press in slightly when tapped. The main action is still the green button, now with a soft green shadow. The top-bar tags are rounded the same way, and the masthead's purple bar became a small purple dot.
- **Sheets and cards are rounded.** The sheets that rise from the bottom have rounded top corners (the left corners in landscape) and a soft shadow instead of the green-and-brass rule. The start card lost its stripe and its heavy title rule.
- **No hard bars.** The brass and party-colour bars down the left of notes, quotes, counts and names became tinted rounded panels, pill-shaped colour marks or small dots. Badges and progress bars are pills. Lines between rows are much lighter.
- **No debug type.** The import box was in a typewriter face; it's now the same serif as everything else. The skip button's ⏭ emoji is a drawn double chevron. The only monospace left is the seed readout and tuning panel you see with `?debug=1`.

**Things to know / decisions I made**

- Three places keep their capitals on purpose, because that's what the real thing looks like: the stamps (PASSED, DEFEATED), the newspaper's front page, and the game's title on the start card.
- The new shared values are at the top of `css/style.css` (`--r-sm/md/lg` for corners, `--line`, `--fill`, `--lift`, `--float`), so the softness can be turned up or down in one place.
- Only styles changed (plus the skip icon); nothing about how the game plays. Checked at phone size in portrait and landscape: the start menu, the office, an MP card and the division sheet.

## 2026-10-21 · Tidier sheets, nothing hidden under the bar

Kelbo sent a phone shot of the "A pair before a confidence vote" sheet. The date bar at the bottom had wrapped onto two lines and covered the foot of the sheet, a grey Continue button sat there doing nothing, and the hint under the second choice was too faint to read. The ask was for less overlap and easier reading.

**What changed**

- **Nothing sits under the bar any more.** Sheets used to stop at a fixed height above the bottom bar. The bar now reports its real height (long dates, bigger text, the phone's safe area), and every sheet stops exactly above it.
- **The date fits on one line.** The bar reads "Monday 15 October · Week 7", with the latest line from the day underneath. Tapping it opens the day's feed, which keeps the full date, year included, as its heading.
- **No dead buttons.** While a sheet is waiting for you to choose, Continue and Skip step aside instead of sitting greyed out. They come back as soon as there's nothing to choose.
- **Easier to read.** The hint under each choice is larger and in a darker brass that reads clearly on paper. The party-colour bars beside card titles and in the book are now small dots.
- **Landscape side sheets run full height.** In landscape the bar keeps to the left under the room, and the sheet on the right runs from the top bar to the bottom of the screen, so both choices are in view and nothing is squeezed.

**Things to know**

- Only layout, styles and the bar's wording changed. Nothing about how the game plays.
- Checked at phone size in portrait and landscape: the morning order paper, the office, the division, the weekend paper, a career choice, the caucus, the riding and an MP card. No sheet overlaps the bar. `tests.html` shows 88 passed, 0 failed, with no console errors.

## 2026-10-21 · No spending your own time on yourself

Kelbo asked if we could stop the player spending time on themselves by accident. The MP card already hid every action when you opened your own card, but one hole was left. The office's **Call** button opens the book so you can choose someone, and you were in that list too. Picking yourself spent half an evening slot phoning your own number ("You phoned … They sounded …"). Picking yourself after **Invite** did nothing at all, so the tap was dead.

**What changed**

- **The book leaves you out when it's choosing someone.** Opened from Invite or Call, it lists everyone but you, and the count reads "119 of 119 members". Opened as the plain book, it still shows you with the "You" badge.
- **The game refuses as well.** A phone call, an invitation or any whip's tool aimed at you is turned down before it spends anything: no evening slot, no House time, no favour. So even if a future screen offers you by mistake, nothing is lost.
- A new test in `tests.html` tries every office tool, a call and an invitation on yourself and checks that none of them spend anything.

## 2026-10-21 · "Your riding" when the whip pays you

Kelbo noticed that in a deal with your own whip, the card the whip offers you read "A mention of their riding", as if the mention were for the whip's riding and not yours. A card's wording now depends on which way it goes. When it comes to you, it says **your** riding ("A mention of your riding", "A project for your riding"). When you give it away, it says **their** riding. This holds on the deal table, on a counter-offer, in the line that sums up a meeting, and in the ledger. It also fixed the reverse case: once you hold the whip's cards, a riding project you offered another MP used to read "A project for your riding". A new test checks both directions. `tests.html`: 90 passed, 0 failed.
