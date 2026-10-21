// The career: creating the player's MP, acts and (later) graduation, vacancies, offers and endings.
import { data } from './config.js';
import { withRng, createRng } from './rng.js';
import { makeBill } from './bills.js';

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

// How the player's own riding and conscience pull on a bill, ignoring the party line.
// A dilemma is a whipped vote where that pull points the other way, hard enough to hurt.
export function dilemmaFor(state, bill, baseScore, tuningPacing) {
  const me = state.mps[state.player.mpId];
  const line = bill.lines[me.party];
  const position = bill.positions[me.party];
  if (line !== 'whipped' || !['yea', 'nay'].includes(position)) return null;
  const { parts } = baseScore(state, me, bill);
  const lineSign = position === 'yea' ? 1 : -1;
  let ridingPull = 0.6 * parts.R - 0.9 * parts.C;
  const conscience = 0.8 * parts.I;
  // The first week's set piece is always a real dilemma: the riding pulls hard against the line.
  const forced = state.player.forceDilemma === bill.id;
  if (forced) ridingPull = -lineSign * Math.max(0.7, Math.abs(ridingPull));
  const pull = ridingPull + (forced ? 0 : conscience);
  if (Math.sign(pull) === lineSign || Math.abs(pull) < tuningPacing.dilemmaThreshold) return null;
  return { line: position, against: position === 'yea' ? 'nay' : 'yea', ridingPull, conscience, strength: Math.abs(pull), ridingSide: Math.abs(ridingPull) >= Math.abs(conscience) };
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
  if (choice === 'rebel') {
    p.whipFile.push({ bill: bill.id, vote: position === 'yea' ? 'nay' : 'yea', line: position, day: state.date.absWeek * 5 + state.date.dayOfWeek - 1 });
    p.actProgress.rebellions++;
    p.actProgress.noticed += T.noticedPerRebellion;
    adjust(whip, T.rebelWhipRapport * (bill.confidence ? 2 : 1));
    if (dilemma) p.ridingStanding = clampP(p.ridingStanding + T.rebelRiding * (dilemma.ridingSide ? 1 : 0.5) + dilemma.strength * 2);
    p.style.conscience++;
  } else if (choice === 'absent') {
    adjust(whip, T.absentWhipRapport);
    if (dilemma) p.ridingStanding = clampP(p.ridingStanding - 1);
  } else {
    adjust(whip, T.toeLineWhipRapport);
    p.actProgress.noticed += T.noticedPerLoyalVote;
    if (dilemma) {
      p.ridingStanding = clampP(p.ridingStanding + T.toeLineRiding - (dilemma.ridingSide ? dilemma.strength * T.dilemmaRidingScale : 0));
      p.style.loyalist++;
    }
  }
}

// Act 1, week one: a mentor, the first dilemma (a bill your riding hates, whipped the other way,
// voted Thursday), the whip calling you in, a Wednesday caucus, a Friday at home.
export function setupFirstWeek(state) {
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
    b.nextVote = 3; // Thursday of week one
    b.scheduled = true;
    p.forceDilemma = b.id;
    break;
  }
  // Who drops by which evening, so the first week shows every kind of meeting.
  p.script = { 2: ['mentorAdvice', 'rebelRecruit'], 3: ['introduction'], 4: ['gossip'] };
  state.flow.forceWatch = true;
  return p.forceDilemma;
}
