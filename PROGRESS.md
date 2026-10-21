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
