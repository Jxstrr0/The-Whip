// The career: creating the player's MP, acts and (later) graduation, vacancies, offers and endings.
import { data, tuning } from './config.js';
import { withRng, createRng } from './rng.js';
import { makeBill } from './bills.js';
import { hooks, log, resolvers, queueStop } from './pacing.js';
import { adjustRapport } from './relationships.js';
import { remember, person } from './memoir.js';

export function blankPlayer(mpId) {
  return {
    mpId,
    act: 1,
    actProgress: { noticed: 0, rebellions: 0, rowVotesCarried: 0 },
    standing: 50,
    caucusSupport: 40,
    leaderTrust: 20,
    mentor: null,
    proteges: [],
    style: { fixer: 0, enforcer: 0, conscience: 0, operator: 0, loyalist: 0 },
    ridingStanding: 55,
    nominationThreat: 0,
    whipFile: [],
    cabinetOffers: 0,
    skeleton: null,
    knowledge: {},
    contact: {},
    pacing: { stopFor: ['ownVote', 'walkIn', 'lifeEvent', 'caucusFight', 'ridingCrisis', 'rivalMove'], autoResolved: 0 },
    whipTrust: {},
    houseTime: 90,
    slots: 2,
    leaveGranted: false,
    background: null,
    record: { votesWon: 0, votesLost: 0, confidenceSurvived: 0, promoted: 0, expelled: 0, promisesKept: 0, promisesBroken: 0, mentored: 0, parliaments: 1 },
  };
}

// The player becomes one of the rookies the election produced in their chosen party, so the seed's
// Parliament is identical whoever you play. Name, age and background are the player's own.
export function createPlayer(state, opts = {}) {
  const D = data();
  const partyId = state.parties[opts.party] ? opts.party : state.house.government;
  return withRng(state, (rng) => {
    const members = Object.values(state.mps).filter((m) => m.party === partyId && m.caucusRole === 'backbencher');
    const rookies = members.filter((m) => m.tenure === 0);
    // Prefer a riding of the type and province the player asked for; fall back gracefully.
    const fit = (list) => list.filter((m) => (!opts.ridingType || m.riding.type === opts.ridingType) && (!opts.province || state.ridings[m.riding.id]?.province === opts.province));
    const byType = (list) => list.filter((m) => !opts.ridingType || m.riding.type === opts.ridingType);
    const pool = [fit(rookies), fit(members), byType(rookies), byType(members), rookies, members.sort((a, b) => a.tenure - b.tenure).slice(0, 3)].find((l) => l.length);
    const m = rng.pick(pool);
    const bg = D.backgrounds.backgrounds.find((b) => b.id === opts.background) || rng.pick(D.backgrounds.backgrounds);
    if (opts.first) m.name.first = opts.first;
    if (opts.last) m.name.last = opts.last;
    if (opts.age) m.age = opts.age;
    m.tenure = 0;
    m.cohort = state.house.parliament;
    m.bio = bg.bio;
    m.interests = [...new Set([bg.interests[0], ...m.interests])].slice(0, 3);
    m.rapport = 0;
    const p = blankPlayer(m.id);
    p.background = bg.id;
    p.mentor = m.mentor;
    p.skeleton = { id: 'x000', kind: bg.skeletons[0].kind, severity: bg.skeletons[0].severity, foundBy: null, dealtWith: false };
    p.ridingStanding += bg.effects.ridingStanding || 0;
    if (bg.effects.ruralStanding && m.riding.type === 'rural') p.ridingStanding += bg.effects.ruralStanding;
    p.ridingBase = p.ridingStanding;
    for (const pid of Object.keys(state.parties)) if (pid !== partyId) p.whipTrust[pid] = 0;
    state.player = p;
    // Everyone starts roughly neutral toward a rookie; the cohort a little warmer.
    for (const o of Object.values(state.mps)) {
      if (o.id === m.id) continue;
      o.rapport = Math.round(rng.normal(0, 4) + (o.cohort === m.cohort ? 8 : 0) + (bg.effects.cohortRapport && o.cohort === m.cohort ? bg.effects.cohortRapport : 0));
    }
    const whip = state.parties[partyId].chiefWhip;
    if (whip && bg.effects.whipRapport) state.mps[whip].rapport += bg.effects.whipRapport;
    return p;
  });
}

// How hard home pulls on a bill: positive toward yea, negative toward nay. Material benefit against what voters will say.
export const homePull = (parts) => 0.6 * parts.R - 0.9 * parts.C;

// How the player's own riding and conscience pull on a bill, ignoring the party line.
// A dilemma is a whipped vote where that pull points the other way, hard enough to hurt.
export function dilemmaFor(state, bill, baseScore, tuningPacing) {
  const me = state.mps[state.player.mpId];
  const line = bill.lines[me.party];
  const position = bill.positions[me.party];
  if (line !== 'whipped' || !['yea', 'nay'].includes(position)) return null;
  const { parts } = baseScore(state, me, bill);
  const lineSign = position === 'yea' ? 1 : -1;
  let ridingPull = homePull(parts);
  const conscience = 0.8 * parts.I;
  // The first week's set piece is always a real dilemma: the riding pulls hard against the line.
  const forced = state.player.forceDilemma === bill.id;
  if (forced) ridingPull = -lineSign * Math.max(0.7, Math.abs(ridingPull));
  const pull = ridingPull + (forced ? 0 : conscience);
  if (Math.sign(pull) === lineSign || Math.abs(pull) < tuningPacing.dilemmaThreshold) return null;
  return { line: position, against: position === 'yea' ? 'nay' : 'yea', ridingPull, conscience, strength: Math.abs(pull), ridingSide: Math.abs(ridingPull) >= Math.abs(conscience) };
}

// What a vote does to the player, before clamping: riding standing, the whip's rapport and how noticed they are.
// The bells sheet and the asks in the office read this too, so what the screen says is what the vote delivers.
export function voteEffects(bill, choice, dilemma, T) {
  const fx = { riding: 0, whip: 0, noticed: 0 };
  if (choice === 'rebel') {
    fx.whip = T.rebelWhipRapport * (bill.confidence ? 2 : 1);
    fx.noticed = T.noticedPerRebellion;
    if (dilemma) fx.riding = T.rebelRiding * (dilemma.ridingSide ? 1 : 0.5) + dilemma.strength * 2;
  } else if (choice === 'absent') {
    fx.whip = T.absentWhipRapport;
    if (dilemma) fx.riding = -1;
  } else {
    fx.whip = T.toeLineWhipRapport;
    fx.noticed = T.noticedPerLoyalVote;
    if (dilemma) fx.riding = T.toeLineRiding - (dilemma.ridingSide ? dilemma.strength * T.dilemmaRidingScale : 0);
  }
  return fx;
}

// The player's vote lands: the whip's office keeps score, the riding notices, and the House notices you.
export function applyPlayerVote(state, bill, choice, dilemma, T) {
  const p = state.player;
  const me = state.mps[p.mpId];
  const whip = state.parties[me.party]?.chiefWhip;
  const position = bill.positions[me.party];
  const adjust = (id, d) => {
    if (id && state.mps[id]) state.mps[id].rapport = Math.max(-100, Math.min(100, state.mps[id].rapport + d));
  };
  const clampP = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const fx = voteEffects(bill, choice, dilemma, T);
  adjust(whip, fx.whip);
  p.actProgress.noticed += fx.noticed;
  if (dilemma) p.ridingStanding = clampP(p.ridingStanding + fx.riding);
  if (choice === 'rebel') {
    p.whipFile.push({ bill: bill.id, vote: position === 'yea' ? 'nay' : 'yea', line: position, day: state.date.absWeek * 5 + state.date.dayOfWeek - 1 });
    p.actProgress.rebellions++;
    p.style.conscience++;
  } else if (choice !== 'absent' && dilemma) p.style.loyalist++;
}

// Act 1, week one: a mentor, the first dilemma (a bill your riding hates, whipped the other way,
// voted Thursday), the whip calling you in, a Wednesday caucus, a Friday at home.
export function setupFirstWeek(state, { week = 0, guided = true } = {}) {
  const p = state.player;
  const me = state.mps[p.mpId];
  if (!p.mentor) {
    const pool = Object.values(state.mps).filter((m) => m.party === me.party && m.tenure >= 7 && !['leader', 'speaker', 'chiefWhip'].includes(m.caucusRole));
    const mentor = pool.sort((a, b) => b.tenure + b.loyalty / 10 - (a.tenure + a.loyalty / 10))[0];
    if (mentor) {
      p.mentor = mentor.id;
      me.mentor = mentor.id;
      mentor.proteges.push(me.id);
      mentor.rapport = Math.max(mentor.rapport, 25);
    }
  }
  const type = me.riding.type;
  const rng = createRng(`${state.seed}:firstWeek`);
  const templates = data()
    .billTemplates.templates.filter((t) => t.kind === 'government' && !t.confidence && Math.abs(t.ridingEffects[type] || 0) >= 0.5)
    .sort((a, b) => Math.abs(b.ridingEffects[type]) - Math.abs(a.ridingEffects[type]));
  for (const t of templates) {
    const b = makeBill(state, rng, t);
    const pos = b.positions[me.party];
    const fits = b.lines[me.party] === 'whipped' && (pos === 'yea' || pos === 'nay') && Math.sign(b.ridingEffects[type]) !== (pos === 'yea' ? 1 : -1);
    if (!fits) {
      delete state.bills[b.id];
      state.billSeq--;
      continue;
    }
    b.visibility = Math.max(b.visibility, 65);
    b.stage = 'second';
    b.nextVote = week * 5 + 3; // Thursday
    b.scheduled = true;
    p.forceDilemma = b.id;
    break;
  }
  if (!guided) return p.forceDilemma;
  // Who drops by which evening, so the first week shows every kind of meeting.
  p.script = { 2: ['mentorAdvice', 'rebelRecruit'], 3: ['introduction'], 4: ['gossip'] };
  state.flow.forceWatch = true;
  return p.forceDilemma;
}

// ---------- acts: being noticed, the rival, the vacancy ----------

// Office evenings by act. The tuning list starts at Act 1, so Act n reads entry n - 1.
export function slotsForAct(act, fallback) {
  return tuning().meetings.slotsByAct?.[act - 1] ?? fallback;
}

// Back on the backbench: the whip's office still knows your name, but the next contest weighs what you do
// from here. Notice earned in the whip's office doesn't pile up into an easier climb each time you fall:
// after a fall you keep part of Act 2's worth (a share from tuning), and the act remembers you fell.
export function startBackbench(p) {
  const C = tuning().career;
  p.actProgress.noticed = Math.min(p.actProgress.noticed, C.noticedForAct2);
  if ((p.highestAct || 1) > 2) {
    p.actProgress.noticed *= C.backbenchNoticedKeep;
    p.fellAt = p.actStart;
  }
}

// In Act 2 after falling from the whip's office (not a first climb, nor a scenario that starts there).
export const fellBack = (p) => p.act === 2 && p.fellAt != null && p.fellAt === p.actStart;

// A fresh row for an assistant whip: the carries that earn Act 4 count from this stint, not an earlier one.
export function startRow(p) {
  p.actProgress.rowVotesCarried = 0;
  p.rowStats = null;
}

const fullName = (m) => `${m.name.first} ${m.name.last}`;
const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
const whipOf = (state) => state.parties[state.mps[state.player.mpId].party]?.chiefWhip;

// The cohort-mate who wants what you want: same party, your election, the most ambitious of them.
export function pickRival(state) {
  const p = state.player;
  const me = state.mps[p.mpId];
  const pool = Object.values(state.mps).filter((m) => m.party === me.party && m.id !== me.id && m.cohort === me.cohort && m.id !== p.mentor && m.caucusRole === 'backbencher');
  // A small caucus may have no other rookie: then the most ambitious backbencher, then anyone not running the party.
  const alt = Object.values(state.mps).filter((m) => m.party === me.party && m.id !== me.id && m.id !== p.mentor && m.caucusRole === 'backbencher');
  const any = Object.values(state.mps).filter((m) => m.party === me.party && m.id !== me.id && m.id !== p.mentor && !['leader', 'chiefWhip', 'speaker', 'houseLeader'].includes(m.caucusRole));
  const r = (pool.length ? pool : alt.length ? alt : any).sort((a, b) => b.ambition - a.ambition)[0];
  return r ? r.id : null;
}

// Act 1 ends when the whip's office has noticed you, as reliable or as useful trouble.
function graduateAct1(state) {
  const C = tuning().career;
  const p = state.player;
  if (p.act !== 1 || state.date.absWeek < C.act1MinWeeks || p.actProgress.noticed < C.noticedForAct2) return null;
  p.act = 2;
  p.actStart = state.date.absWeek;
  p.reputation = p.actProgress.rebellions >= C.usefulTroubleRebellions ? 'usefulTrouble' : 'reliable';
  p.rival = pickRival(state);
  p.slots = slotsForAct(2, p.slots);
  const rival = p.rival ? state.mps[p.rival] : null;
  log(state, `Act 2. The whip's office has you down as ${p.reputation === 'reliable' ? 'reliable' : 'useful trouble'}.${rival ? ` ${fullName(rival)} wants the same things you do.` : ''}`, 'career');
  const M = data().memoir;
  remember(state, 'act2', { sub: p.reputation, people: [person(state, p.rival, M.notes.rival), person(state, whipOf(state), M.notes.whip)], aside: rival ? fill(M.asides.rival, { rival: fullName(rival) }) : '' });
  return { kind: 'career', event: 'act2', important: true, needsChoice: true, reputation: p.reputation, rival: p.rival, text: data().career.act2[p.reputation], rivalText: rival ? fill(data().career.rival, { rival: fullName(rival) }) : '' };
}

// The score the whip weighs: your file, your mentor, your clique, and what you've done since.
export function contestScore(state, choice) {
  const C = tuning().career.contest;
  const p = state.player;
  const me = state.mps[p.mpId];
  const whip = whipOf(state);
  let s = (whip ? state.mps[whip].rapport : 0) * C.whipRapport + p.actProgress.noticed * C.noticed + p.actProgress.rebellions * C.rebellion;
  if (p.mentor) s += (state.mps[p.mentor].rapport / 4 + state.mps[p.mentor].tenure / 2) * C.mentor;
  if (me.clique && state.cliques[me.clique]) {
    const mates = state.cliques[me.clique].members.filter((id) => id !== me.id).map((id) => state.mps[id].rapport);
    if (mates.length) s += (mates.reduce((a, b) => a + b, 0) / mates.length) * C.clique;
  }
  const top = Object.entries(p.style).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top === 'loyalist') s += C.loyalist;
  if (top === 'fixer') s += C.fixer;
  if (me.caucusRole === 'committeeChair') s += C.chair;
  if (choice === 'askMentor' && p.mentor) s += C.askMentor;
  if (choice === 'askClique' && me.clique) s += C.askClique;
  return s;
}

export function rivalScore(state) {
  const C = tuning().career.contest;
  const r = state.mps[state.player.rival];
  if (!r) return -Infinity;
  const whip = whipOf(state);
  return C.rivalBase + r.loyalty * C.rivalLoyalty + r.ambition * C.rivalAmbition + (whip ? (r.relations[whip] || 0) : 0) * C.rivalWhip;
}

// A chair opens in the whip's office: one of the assistant whips moves on, and the whip has two names.
function openVacancy(state, rng) {
  const C = tuning().career;
  const p = state.player;
  if (p.act !== 2 || state.date.absWeek - (p.actStart ?? 0) < C.act2MinWeeks) return null;
  const due = p.vacancyDue != null && state.date.absWeek >= p.vacancyDue;
  if (!due && !rng.chance(C.vacancyOdds)) return null;
  p.vacancyDue = null;
  if (!p.rival || !state.mps[p.rival] || state.mps[p.rival].party !== state.mps[p.mpId].party) p.rival = pickRival(state);
  if (!p.rival) return null;
  const party = state.parties[state.mps[p.mpId].party];
  const outgoingId = party.assistantWhips[0] || null;
  const outgoing = outgoingId ? state.mps[outgoingId] : null;
  if (outgoing) {
    party.assistantWhips = party.assistantWhips.filter((id) => id !== outgoingId);
    outgoing.caucusRole = 'parliamentarySecretary';
  }
  const whip = whipOf(state);
  const ctx = { outgoing: outgoing ? fullName(outgoing) : 'An assistant whip', rival: fullName(state.mps[p.rival]), whip: whip ? fullName(state.mps[whip]) : 'The whip' };
  log(state, `${ctx.outgoing} is leaving the whip's office. You and ${ctx.rival} are both in for the chair.`, 'career');
  const V = data().career.vacancy;
  return { kind: 'career', event: 'vacancy', important: true, needsChoice: true, rival: p.rival, text: fill(V.open, ctx), options: [{ id: 'askMentor', label: V.askMentor, note: V.askMentorNote, enabled: !!p.mentor }, { id: 'askClique', label: V.askClique, note: V.askCliqueNote, enabled: !!state.mps[p.mpId].clique }, { id: 'letItRun', label: V.letItRun, note: V.letItRunNote, enabled: true }] };
}

function decideVacancy(state, rng, choice) {
  const C = tuning().career.contest;
  const V = data().career.vacancy;
  const p = state.player;
  const me = state.mps[p.mpId];
  const whip = whipOf(state);
  const pick = ['askMentor', 'askClique', 'letItRun'].includes(choice) ? choice : 'letItRun';
  if (pick === 'askMentor' && p.mentor) adjustRapport(state, p.mentor, C.mentorCost);
  if (pick === 'askClique' && me.clique) for (const id of state.cliques[me.clique].members) if (id !== me.id) adjustRapport(state, id, C.cliqueCost);
  const mine = contestScore(state, pick) + rng.normal(0, C.noise);
  const theirs = rivalScore(state) + rng.normal(0, C.noise);
  const rival = state.mps[p.rival];
  const ctx = { whip: whip ? fullName(state.mps[whip]) : 'The whip', rival: rival ? fullName(rival) : 'your rival' };
  const party = state.parties[me.party];
  if (mine >= theirs) {
    p.act = 3;
    p.actStart = state.date.absWeek;
    me.caucusRole = 'assistantWhip';
    party.assistantWhips.push(me.id);
    p.slots = slotsForAct(3, p.slots);
    startRow(p);
    if (whip) adjustRapport(state, whip, 5);
    log(state, `The chair is yours. You're an assistant whip, with a row to answer for.`, 'career');
    remember(state, 'act3', { ctx: { whip: ctx.whip, rival: ctx.rival }, people: [person(state, p.rival, data().memoir.notes.lostToYou), person(state, whip, data().memoir.notes.whip)] });
    return { kind: 'career', event: 'act3', important: true, needsChoice: true, text: fill(V.won, ctx) + ' ' + data().career.act3, score: [Math.round(mine), Math.round(theirs)] };
  }
  if (rival) {
    rival.caucusRole = 'assistantWhip';
    party.assistantWhips.push(rival.id);
  }
  log(state, `${ctx.rival} got the chair in the whip's office. 'Next time,' the whip said.`, 'career');
  remember(state, 'vacancyLost', { once: true, ctx: { whip: ctx.whip, rival: ctx.rival }, people: [person(state, p.rival, data().memoir.notes.gotChair), person(state, whip, data().memoir.notes.whip)] });
  return { kind: 'career', event: 'lost', important: true, needsChoice: true, rival: p.rival, text: fill(V.lost, ctx), score: [Math.round(mine), Math.round(theirs)], options: [{ id: 'wait', label: V.wait, note: V.waitNote, enabled: true }, { id: 'changeClique', label: V.changeClique, note: V.changeCliqueNote, enabled: true }, { id: 'committeeChair', label: V.committeeChair, note: V.committeeChairNote, enabled: me.caucusRole !== 'committeeChair' }] };
}

function afterLoss(state, choice) {
  const C = tuning().career;
  const p = state.player;
  const me = state.mps[p.mpId];
  p.rival = pickRival(state);
  p.vacancyDue = state.date.absWeek + C.waitWeeks;
  if (choice === 'changeClique') {
    const best = Object.values(state.cliques)
      .filter((q) => q.party === me.party && q.id !== me.clique)
      .map((q) => ({ q, r: q.members.reduce((a, id) => a + (state.mps[id]?.rapport || 0), 0) / Math.max(1, q.members.length) }))
      .sort((a, b) => b.r - a.r)[0];
    if (best) {
      if (me.clique && state.cliques[me.clique]) state.cliques[me.clique].members = state.cliques[me.clique].members.filter((id) => id !== me.id);
      me.clique = best.q.id;
      best.q.members.push(me.id);
      for (const id of best.q.members) if (id !== me.id) adjustRapport(state, id, 5);
      log(state, `You've moved over to the ${best.q.name}. They'll push for you next time.`, 'career');
    }
  } else if (choice === 'committeeChair') {
    me.caucusRole = 'committeeChair';
    p.standing = Math.min(100, (p.standing || 50) + 5);
    log(state, `You took the committee chair. A title, a staff, and your name still on the whip's list.`, 'career');
    remember(state, 'committeeChair');
  } else {
    log(state, `You'll wait for the next vacancy.`, 'career');
  }
}

hooks.weekend.push((state, rng) => {
  const g = graduateAct1(state);
  if (g) return g;
  return openVacancy(state, rng);
});

// Career stops resolve with the player's pick; some open a second stop straight away.
resolvers.career = (state, p, choice) => {
  if (p.event === 'vacancy') queueStop(state, withRng(state, (rng) => decideVacancy(state, rng, choice)));
  else if (p.event === 'lost') afterLoss(state, choice || 'wait');
  else if (resolvers.careerExtra) resolvers.careerExtra(state, p, choice);
};
