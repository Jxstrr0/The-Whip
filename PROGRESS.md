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
