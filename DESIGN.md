# The Whip - Design Doc

Longlight Interactive · October 20, 2026 · Version 3.1 (career rewrite + gap fixes)

The Whip is a career game. You start as a rookie backbench MP in a fictional Canadian-style House of Commons and spend a political lifetime climbing to Chief Whip: the person who counts votes, enforces the line, and gets the caucus into the chamber when it matters. The career is open-ended. It takes at least a Parliament and a half to reach the whip's desk, and how long you last after that is up to you, your caucus and your voters.

You play in four rooms: the chamber, where you read the room and run the count; your office, where you meet MPs one on one; your riding, where the people who elected you wait; and the caucus room, where your party decides what it is each week. Every phase of the career asks a different question, and the relationships you build in one phase decide what's possible in the next.

The country, parties, ridings and MPs are fictional. The procedures are Canadian.

---

## 1. Design pillars

1. **A career, not a ladder.** Each act of the career has its own question, its own set piece and its own way to fail. Ranks aren't unlocks; they're new jobs with new people to disappoint.
2. **Relationships have shape.** Every MP is a person with a cohort, a clique, a mentor, ambitions and a memory. The ledger of favors, grudges and promises is the real save file.
3. **Knowing people is the skill.** You start knowing nothing about anyone. What an MP's card shows is what you've learned about them, and the whip's job is to know the caucus better than anyone else.
4. **You are whipped before you whip.** The backbench teaches the whip's dilemma from the receiving end, so when you finally hold the line, you know exactly what you're asking.
5. **Depth from rules, not content.** MPs, ridings, bills, cliques and crises are generated from a seed. Nothing is a hand-written campaign.
6. **Discipline cuts both ways.** Punishing rebels works until caucus turns on you. In a minority Parliament, losing one vote can bring down the government.

**Scope by phase.** Phase 1 is the full career inside the House: chamber, office, riding and caucus room. Phase 2 adds the Senate. Phase 3 adds the Leader's Office and leadership politics.

---

## 2. The world

### The House

A fictional federal Parliament with a Westminster-style House of Commons. The country is **the Dominion of Caledor**. The House has **120 seats**: 60 per side, four rows of 15. It's deliberately small, so a whip can know every member of their caucus by name. Members are elected from single-member ridings by first-past-the-post, with fixed election dates every four years unless a government falls first.

### Parties

Each Parliament has four or five recognized parties plus independents. Four **core parties** are fixed across every game, with names, colors and an ideological home; any fifth party is generated per seed (a green, populist or protest party). Which core party governs, and which is in opposition, is decided by each seed's election result.

| Core party | Home | Color |
| --- | --- | --- |
| National Union | Centre-right: markets, resource economy, rural base | Blue `#2F6DB5` |
| Commonwealth Party | Centre, big tent: urban and suburban base | Red `#C8423B` |
| Labour Democrats | Left: unions, cities, social programs | Orange `#E0A526` |
| Eastern Compact | Regional: the eastern provinces first | Teal `#4FB3BF` |

Roles by election result:

| Role | Typical seats | Where they sit |
| --- | --- | --- |
| Government | 45–70 | Speaker's right, cabinet in the front row |
| Official Opposition | 30–50 | Speaker's left, front rows |
| Third party | 8–18 | Speaker's left, behind the Official Opposition |
| Regional party | 4–14 | Speaker's left, one block of seats |
| Minor party | 0–5 | Back rows, assigned by the Speaker |
| Independents | 0–4 | Back rows near the bar, assigned by the Speaker |

If the government has more members than fit on its side, the overflow sits in the back rows on the opposition side nearest the bar. Majority Parliaments are quiet; **minority Parliaments are the heart of the game**, because every confidence vote needs votes you don't own.

### Minority government rules

- A majority is 61 of 120. A government survives as long as it wins confidence votes: the budget, supply bills, the Throne Speech reply, and anything it declares a matter of confidence.
- Losing a confidence vote triggers an election, or early in a Parliament, a chance for the Opposition to form a government.
- Parties can sign a **confidence-and-supply agreement**: a smaller party pledges support on confidence votes in exchange for policy wins. The terms are explicit, and either side can break them.

---

## 3. The career

You create an MP at the start: party, riding (type and province), age, and a background (local councillor, lawyer, farmer, union organizer, business owner, teacher, veteran). Background sets starting interests, a few relationships and one strength. Then the career runs in five acts.

### Act 1: Rookie

*Question: who are you?*

Your first Parliament. You know nobody, your riding won you by whatever margin the seed gave you, and the whip is already leaning on you. You learn the House by being whipped: the line arrives, the whip's office calls, and you choose, vote by vote, between the party, your riding and your conscience. Every vote is logged, and the whip's office keeps score.

- **What you do:** attend, vote, take House duty, ask the questions the whip gives you, join a committee, and spend Fridays in the riding.
- **Relationships:** your **cohort** (the MPs elected with you, your natural allies and rivals for the rest of your career), a **mentor** who picks you or whom you ask, and your first read of the whip.
- **Set piece:** the first vote where the line and your riding point opposite ways. Toe the line and your riding standing drops; rebel and the whip's office opens a file on you.
- **Graduation:** the whip notices you, either as reliable or as useful trouble. Both get you to Act 2; they get you there with different reputations.
- **Failure:** nobody notices you. You drift, and Act 2 arrives late, if at all.

### Act 2: A name

*Question: what are you known for?*

You have a seat and a reputation forming. This act is about making it stick.

- **What you do:** draw a spot in the private members' bill lottery and run your bill, fight for a riding project, earn Question Period slots, take a committee role, and start trading favors yourself.
- **Relationships:** your **clique** forms around you or you join one (a regional caucus, an ideological wing, or a leadership contender's camp). Your mentor starts spending capital on you. A **rival** from your cohort wants the same things.
- **Set piece:** your private member's bill comes to a vote and needs votes from across the aisle, so you ask opposition MPs for help, and the whip wants to know why you're talking to them.
- **Graduation:** a vacancy opens in the whip's office, and you or your rival gets assistant whip. The whip decides; your mentor and your clique weigh in.
- **Failure:** your rival gets it. You can wait for the next vacancy, change cliques, or take the committee chair you're offered instead.

### Act 3: Assistant Whip

*Question: can you deliver people you don't outrank?*

You answer for one row of about 15 seats, and your row includes your friends.

- **What you do:** keep your row's attendance, carry the line to them, report back to the deputy whip, chase people during the bells, and learn the count board.
- **Relationships:** your row (some of whom you drank with as rookies), the **deputy whip** who grades you, and the **assistant whips of other parties**, who you start trading pairs and gossip with.
- **Set piece:** the first time you have to lean on a friend from your cohort to vote against their riding. How you do it sets your whip style for good.
- **Graduation:** a vote your row carries when it shouldn't have. The deputy whip puts your name forward.
- **Failure:** your row rebels on a vote that mattered. You're moved back to the backbench with a reputation for being soft, or for being a bully.

### Act 4: Deputy Whip

*Question: who do you trust across the aisle?*

You run the count and the pairing register, which means a working relationship with your **opposite number**, the deputy whip of the other big party, who can burn you.

- **What you do:** run the count board for every division, negotiate pairs and the usual channels with the other whips, approve travel and leave, and manage the assistant whips, including the one who wanted your job.
- **Relationships:** your opposite number (a trust axis that can become respect, rivalry or a knife in the back), the **House Leader**, the **leader's office** noticing you for the first time, and your clique now expecting payback.
- **Set piece:** a pairing deal before a confidence vote. Your opposite number can honour it, or show up and vote. You find out which when the bells stop.
- **The temptation:** the leader offers you a way out of the whip track, a parliamentary secretary job or a committee chair, with cabinet hinted at beyond it. Accept and the whip career ends in an epilogue. Decline and the leader remembers you said no.
- **Graduation:** the Chief Whip goes to cabinet, retires, or loses a revolt, and caucus has an opinion about who follows. The leader appoints, but a leader who overrules caucus pays for it.
- **Failure:** a count you got wrong on a vote that mattered. You're kept on as deputy forever, or moved sideways.

### Act 5: Chief Whip

*Question: what kind of whip are you?*

You set the line with the leader. The caucus remembers everything you did to them on the way up.

- **What you do:** set free, whipped or confidence lines with the leader, control committee seats, QP slots, travel, leave and riding projects, recommend expulsions, run caucus discipline, and survive confidence votes in a minority.
- **Relationships:** the **leader** (who can sack you), the **caucus** as a whole (which can revolt), your own **rookies** (you're the mentor now), the other parties' chief whips, and the ones you hurt on the way up.
- **Set piece:** a confidence vote you're three short on, with 48 hours and a caucus that has learned exactly how you operate.
- **Endings:** the whip career ends one of these ways, each with a whip's record on screen:
  - **Retirement.** You choose when. The longer you last, the fuller the record.
  - **Cabinet.** The leader finally offers it and you take it. The whip's career ends; Phase 3 continues it.
  - **The fall.** You lose a confidence vote you had to win, and the leader sacks you.
  - **The revolt.** Caucus turns on you, or on the leader with you beside them.
  - **The riding.** You lose your own seat at an election. Nobody is safe.

### Career rules that hold across acts

- **Open-ended length.** There's no clock. The minimum path to Chief Whip is about a Parliament and a half. After that you play on as long as you hold a seat and a job, and you can retire at any point after Act 2.
- **Age.** Your MP ages. Past sixty-five, retirement pressure rises: health events, a riding association looking for renewal, and younger MPs circling.
- **Cabinet is a real exit.** Offers come in Acts 4 and 5. Taking one ends the whip career with an epilogue. Declining is always allowed and costs nothing; the leader keeps asking.
- **Demotion and comebacks.** Every rank can be lost. A demoted whip can rebuild through the riding and the clique, and the game is as much about the comeback as the climb.
- **Floor-crossing** is allowed, as in Canada. It costs your rank, most of your ledger with your old caucus, and riding standing, but it can save a career in a party that's turned on you. A floor-crosser starts Act 1 again in a new caucus with a reputation that precedes them.
- **Your own skeleton.** Your background seeds one vulnerability of your own: a business debt, an old council vote, a relative on the payroll. Rival whips can dig for it just as you dig for theirs, and a found skeleton is leverage against you until you deal with it.
- **The leader is a person.** Each party leader has a personality (controlling, hands-off, paranoid, loyal) that changes how lines get set, how often they overrule the whip, how they handle a revolt, and what a cabinet offer looks like.
- **Reputation style** emerges from what you do and is visible to every MP: **fixer** (deals), **enforcer** (threats), **conscience** (principled rebel), **operator** (quiet, feared), **loyalist**. Style changes which lines MPs offer you and how your opposite numbers treat you.

---

## 4. Relationships

Relationships are the game's real resource, and six systems give them shape.

- **Cohort.** The MPs elected in the same election as you. Cohorts share a starting rapport, a group chat of sorts (they gossip), and a shared history. They're your first allies, your rivals for the same vacancies, and later, the row you have to whip.
- **Cliques.** Every caucus has three or four: regional caucuses, an ideological wing, a leadership contender's camp, sometimes just a dinner crowd. Clique membership shifts how MPs vote and who they listen to. As whip, cliques are the units you have to count.
- **Mentor arc.** In Act 1 a senior MP takes you on. They open doors and spend capital on you, and they expect loyalty back. In Act 5 you become one, and your rookies' careers become part of your record.
- **Opposite numbers.** The whips of the other parties are persistent characters with a trust axis. Pairing, usual-channels deals and information trade run through them. A whip who burns an opposite number finds pairing impossible for the rest of the Parliament.
- **Life events.** MPs have arcs of their own: ambitions (cabinet, leadership), crises (a scandal, a sick spouse, a bankrupt business), riding troubles, retirements and by-elections. Each event is a moment where showing up for someone builds a bond, and not showing up is remembered.
- **The ledger.** Every favor, promise, threat and secret, both directions, with dates. Promises have due dates. Broken promises spread through cohorts and cliques.

### What you know

Knowledge is earned. A rookie's MP card shows name, party, riding and seat, and nothing else. Each hidden attribute (loyalty, ambition, ideology, interests, clique, mood, attendance habits, life events, secrets) is revealed by a source:

- **Watching votes** reveals loyalty and ideology over time.
- **Meetings** reveal interests, mood and what they actually want.
- **Your mentor** tells you about the MPs they know.
- **Cohort and clique gossip** reveals moods, grudges and who's talking to whom.
- **The whip's office** shares its files with you from Act 3 on, which is the single biggest jump in knowledge in the game.
- **Digging** reveals secrets.

Knowledge decays. An MP you haven't talked to in a year drifts, and your card for them goes stale (shown as faded values). A Chief Whip who stops meeting people loses the caucus without noticing.

### Rival whips

The other parties' whips are actors, not stats. Each has a budget of time and favors per week and uses the same tools you do: poaching your wobbly MPs with pairing offers and cross-aisle favors, leaking to the press, digging for your skeleton, and testing whether your pairs hold. Their style (fixer, enforcer, operator) is generated per seed and visible once you've dealt with them. In a minority, the government whip and the third-party whip are both working your caucus every week.

Rapport with any MP is a number from −100 to 100, but it's only the surface. What an MP will do for you depends on rapport, your ledger, your style, their clique's view of you, and whether you showed up when it mattered.

---

## 5. The rooms

### The chamber

A long rectangular room with a centre aisle, modeled on the Canadian House of Commons. The Speaker's chair sits on a dais at one end, the bar (a brass rod) crosses the floor at the other, and the Clerk's table with the Mace runs down the middle between the two front benches. Each side has four tiered rows of paired desks, with galleries above.

- **Government side** to the Speaker's right, cabinet in the front row across the table from the Leader of the Opposition.
- **Opposition side** to the Speaker's left, the Official Opposition in front, smaller parties behind and beside them, independents in the back rows nearest the bar.
- **Whips' seats:** the Chief Whip at the aisle end of the second row on their side nearest the Speaker, the Deputy Whip beside them, assistant whips one per row. (A design choice modeled on provincial seating plans.)

**How votes look.** The Speaker puts the question; MPs shout yea or nay. If five or more members rise, a **recorded division** is called and the division bells ring: 30 minutes for an unscheduled vote, 15 for a scheduled one (shortened to real seconds in play). That window is the whip's: chase attendance, confirm pairs, work the count. Then the doors close and members vote by **standing**, the yeas row by row while the Clerk reads their names, then the nays, seats lighting up as each name is read (color plus an icon, so yea and nay read without relying on red and green). A tie goes to the Speaker, who by convention votes to keep the question open.

**Camera and style.** Semi-realistic oak, green leather and stone under baked lighting. The default camera looks down the chamber from above the bar toward the Speaker. One finger orbits within limits, pinch zooms, a tap selects an MP, a double-tap on a party block frames it.

### The office

After every sitting day you go to your office. One-on-one meetings happen here, with the MPs you invite and the ones who show up uninvited.

- **The room** has a desk, two visitor chairs, a window onto the lawn, and the **count board**, where tomorrow's votes are tallied by name. It grows with rank: a shared cramped room in Act 1, a corner office with a second meeting table in Act 5.
- **Evening slots.** Two as a rookie, up to five as Chief Whip. Walk-ins appear on the board first, each with a one-line reason.
- **Meetings play in two phases.** **Talk:** the MP sits down with a visible mood (cooperative, guarded, angry, anxious) and you pick from three or four lines per turn over two or three turns. Lines come from their situation, your history and your style. Good reads raise rapport and reveal what they actually need. **Deal:** a table with two columns, *You offer* and *You ask*, where you drag cards in: committee seats, QP slots, travel, riding projects, pairs, leave, pledges, protection. The MP counters, accepts or walks. Agreed deals become ledger promises with due dates.
- **Other actions:** phone calls (half a slot), working the count board directly, and **dig** (staff look into an MP over several evenings).
- **Act 1 twist.** As a rookie, the office is where the whip's office calls *you*. You're on the other side of the desk, and some meetings are you being leaned on.

### The riding

Your constituency office back home. You go on Fridays and during constituency weeks, and leaving Ottawa needs the whip's sign-off when the House is sitting, so the trip is always a small negotiation.

- **The room** is a storefront office on a main street: a desk, a waiting area, a wall of local photos, and the window onto whatever your riding type looks like (a prairie town, a suburb, a downtown block, a northern settlement).
- **Who comes in:** the mayor, a farmer or a plant manager, a union steward, a school board chair, the local reporter, and the **riding association president**, who controls your nomination.
- **What you do:** hear cases and pick which to carry back to Ottawa, hold a town hall (a short talk-phase scene with a crowd mood), announce a project you won, and campaign when an election nears.
- **What it drives:** **riding standing** (your margin at the next election) and the **nomination**, which can be challenged if standing falls or you've voted against the riding too often. A whip who never goes home loses their seat; a backbencher who's always home never gets noticed.

### The caucus room

Every Wednesday morning the party meets behind closed doors. This is where revolts actually happen.

- **The room** is a long table with the leader at the head, the whip and House Leader beside them, and MPs seated by clique, so the room's politics are visible in where people sit.
- **What you do:** listen (learn the room's mood and who's talking to whom), speak (take a stance on the week's line, which costs or earns standing with the leader and the room), whisper to a neighbour, and as whip, read the room through the colors on every seat.
- **What happens:** the line for the week is set, grievances get aired, and when enough of the room is against the leader or the whip, a **revolt** can be called. Caucus can vote to expel a member or, in Phase 3, to review the leader.

---

## 6. The MP model

Every one of the 120 MPs is generated from the seed with these attributes:

| Attribute | Range | What it drives |
| --- | --- | --- |
| Party | One of the parties, or Independent | Default vote line and seat block |
| Riding | Name, province, type (urban, suburban, rural, northern) | What favors matter and who they fear |
| Margin | 1–40 points | How safe their seat is |
| Tenure and cohort | Years, and the election they came in with | Patience, what they're owed, who their friends are |
| Clique | One of the caucus's cliques, or none | Who they listen to; how they vote in groups |
| Loyalty | 0–100 | Chance of following the line |
| Ambition | 0–100 | Appetite for posts; risk they plot |
| Ideology | Two axes, −100 to 100 (economy, social) | Which bills they resist |
| Interests | 1–3 policy areas | Which favors they want |
| Committee | One seat or none | Where they can push or bury bills |
| Attendance | 0–100 | Chance they're in Ottawa and in their seat |
| Relationships | 3–8 friend or rival links, plus mentor and protégé | Who can persuade whom |
| Rapport | −100 to 100 with the player | Gates what they'll accept |
| Mood | Cooperative, guarded, angry, anxious | Changes daily; shapes the talk phase |
| Life events | Active arcs: ambition, crisis, riding trouble, retirement | Moments to show up, or not |
| Secrets | 0–3, hidden | Leverage once uncovered |
| Floor-cross risk | 0–100 | Rises when punished or ignored |

### How an MP decides a vote

```
score = wLine·L + wIdeo·I + wRiding·R + wLedger·D + wPeer·P + wClique·Q + wPressure·X − wCost·C + noise
```

- **L** is the party line (+1, −1, 0 for free) scaled by loyalty.
- **I** is ideological fit with the bill.
- **R** is what the bill does for their riding and interests.
- **D** is the ledger: favors owed count for, grudges against, and a broken promise from you counts double.
- **P** is peer pressure, the average lean of their friends.
- **Q** is their clique's lean.
- **X** is leverage applied, with resentment as a side effect.
- **C** is the voter cost, the bill's unpopularity scaled by how marginal their seat is.

Above the upper threshold they vote with you, below the lower one against, between the two they abstain or find a reason to be away. Attendance is rolled separately: an MP who means to vote with you but isn't in the building is worth nothing.

---

## 7. Core loop

A Parliament runs about four years of sitting weeks, broken by constituency weeks. Each sitting week has a shape:

- **Monday to Thursday: sitting days.** Morning brings the order paper and overnight news. The House has Question Period, debate and the day's votes. The office follows every sitting day.
- **Wednesday morning: caucus.** The line for the week is set, grievances get aired, revolts brew.
- **Friday: the riding.** If the whip lets you go.
- **Constituency weeks** are a week in the riding, with the whip's office still calling.

Each sitting day runs morning → House → office → fallout. Promises come due, grudges form, headlines land, standing moves.

### Pacing

A Parliament has hundreds of sitting days, and most are routine. Routine days **auto-resolve** into a one-line summary; the game only stops you for days that matter: a vote you're not sure of, a walk-in, a life event, a caucus fight, a riding crisis, a rival's move. A sitting week targets about 10 minutes of play, and a "skip to the next thing that matters" button is always available. What counts as "matters" is tuned by act: a rookie is interrupted for their own dilemmas; a Chief Whip is interrupted for the caucus's.

**Bills** come in four kinds: government bills, private members' bills, opposition motions, and supply and budget bills, which are always confidence. Bills pass through first reading, second reading, committee, report stage and third reading. Amendments at committee and report stage are the main currency of riding favors.

---

## 8. Tools by act

| Tool | Where | From act | Effect | Risk |
| --- | --- | --- | --- | --- |
| Vote your way | Chamber | 1 | Toe the line, rebel, or be absent | The whip's file on you |
| Speak | Chamber, caucus | 1 | Take a stance; earn standing or trouble | The room disagrees |
| Riding visit | Riding | 1 | Carry cases home, raise standing | Needs the whip's leave; costs attendance |
| Persuade | Chamber | 1 | Moves MPs who already lean your way | Wastes time on the wrong target |
| Trade a favor | Either | 1 | Speaking time, co-sponsorship, a riding mention | A debt that gets called in |
| Private member's bill | Chamber | 2 | Your signature; needs cross-aisle votes | The whip wants to know who you're talking to |
| Chase attendance | Chamber | 3 | During the bells, pull an MP from the lobby, their office or the airport | Costs the bell period if it fails |
| Pair | Office | 4 | Match your absentee with theirs so neither counts | The opposite number can renege |
| Travel and leave | Office | 4 | Approve or block trips | Blocked MPs show up angry, or not at all |
| Committee seat | Office | 5 | Give or strip | Stripping creates a lasting grudge |
| Question Period slot | Office | 5 | Give or deny camera time | Denied MPs leak to the press |
| Riding project | Office | 5 (government) | A funding announcement in their riding | The press tracks who gets what |
| Threaten nomination | Office | 5 | Their next nomination is in doubt | Raises floor-cross risk |
| Leverage | Office | Any, once found | Use a secret; near-certain compliance | Permanent grudge; leak chance each use |
| Free vote | Caucus | 5 | Release caucus on one bill; loyalty rises | You lose control of the result |
| Expel from caucus | Caucus | 5 (with leader) | The MP sits as an independent | Morale drops; in a minority, you just lost a vote |

**The whip's book** is the list screen behind every room: all 120 MPs, searchable and filterable by party, clique, cohort, riding, lean on tomorrow's vote, and what you know about them, sorted by what's at risk. The chamber is for feel; the book is for work.

**The count board** is the whip's instrument from Act 3 on: each MP firm, leaning, lost or absent for each upcoming vote, with the arithmetic against the number you need.

---

## 9. Consequences

- **Media.** The press gallery reacts to votes, rebellions, walkouts and leaks with generated headlines that move national polling and riding standings.
- **Scandals.** Leaks, broken promises and the use of secrets each roll a detection chance. A caught MP's scandal score rises; a caught whip's standing craters.
- **Pressure from above.** A meter tracks how much the leader's office trusts you. Lost confidence votes and public rebellions push it up; at the top you're replaced. In Phase 3 the Leader's Office becomes a full actor.
- **Elections.** Every four years, or earlier if a minority falls, national polling sets seat totals and each riding is decided by its MP's standing and margin. The House is reseated, roles reassigned, cohorts refreshed, and your own seat is on the line.
- **The whip's record.** Running totals shown at every ending: votes won and lost, confidence votes survived, MPs promoted, MPs expelled, promises kept and broken, rookies mentored, Parliaments served.

**The ledger survives elections.** Promises, grudges and secrets carry into the next Parliament. An MP you expelled in Act 3 can come back as the independent whose vote keeps the government alive in Act 5.

---

## 10. Modes

- **Career.** The main game: a new seed, Act 1, open-ended.
- **Scenarios.** Preset starts that drop you into a moment: deputy whip in a minority three short on a budget vote; a Chief Whip facing a caucus revolt; a rookie whose riding hates the week's line. Short, replayable, and the best way to learn the tools.
- **Shared seeds.** Type a seed to play the same Parliament as a friend and compare records.
- **Daily seed.** One new Parliament a day, same for everyone.

## 11. Tech summary

Plain HTML, CSS and JavaScript modules with Three.js from a pinned CDN build. No build step. One repo (`Jxstrr0/the-whip`) deployed to GitHub Pages from `main`, linked from the Kelbo.Website hub. Phone-first UI, instanced rendering for all 120 MPs, seeded generation, localStorage saves. Full specs and the stage plan are in **The Whip - Code Session Handoff**.

---

## 12. Later phases

- **Phase 2: The Senate.** Bills the House passes go to an appointed upper chamber in its own red room. You lobby senators, and when the Senate amends a bill, you organize the House's response.
- **Phase 3: The Leader's Office.** The pressure meter becomes a full actor with its own agenda, cabinet shuffles and a leadership review caucus can trigger. The cabinet ending continues here, and a Chief Whip can run for leader.

---

## 13. Open questions

- [ ] A remote voting app as a late-game modernization: decide after the stage 4b vertical slice

---

## References

- House of Commons of Canada, [Seating Plan](https://www.ourcommons.ca/members/en/floorplan): rectangular chamber, centre aisle, six rows of 27–30 seats per side, Speaker's chair and the bar, government seated to the Speaker's right, overflow seating and the Speaker's assignment of independents.
- Legislative Assembly of Ontario, [Chamber seating plan](https://ola.org/sites/default/files/common/pdf/chamber-seating-plan-may-27-en.pdf): Chief Government Whip seated in the second row behind the Government House Leader, the basis for the whips' seats in this design.
