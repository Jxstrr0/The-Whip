// The career: creating the player's MP, acts and (later) graduation, vacancies, offers and endings.
import { data } from './config.js';
import { withRng } from './rng.js';

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
    const pool = rookies.length ? rookies : members.sort((a, b) => a.tenure - b.tenure).slice(0, 3);
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
