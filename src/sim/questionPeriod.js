// Question Period: the one place a backbencher gets the cameras. A slot comes round on the rota, or the whip
// delivers one they promised. You stand, choose how to frame the question, the minister answers, the gallery
// reacts. The whip, the riding and the press each notice a different way of asking.
import { data, tuning } from './config.js';
import { withRng } from './rng.js';
import { registerActions } from './actions.js';
import { hooks, resolvers, log, isSittingWeek } from './pacing.js';
import { adjustRapport, addStyle } from './relationships.js';
import { headline } from './media.js';
import { ridingVars } from './riding.js';

export const FRAMINGS = ['soft', 'pointed', 'offScript'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullName = (m) => (m ? `${m.name.first} ${m.name.last}` : '');
const absDay = (state) => state.date.absWeek * 5 + state.date.dayOfWeek;

// Which side of the House you ask from. Independents and third parties ask like the opposition.
export function sideOf(state) {
  return state.mps[state.player.mpId].party === state.house.government ? 'government' : 'opposition';
}

// The slots: {bill}, {issue} and {minister} on top of the riding's own words.
export function qpVars(state, qp = state.questionPeriod) {
  const minister = qp ? state.mps[qp.ministerId] : null;
  return { ...ridingVars(state), bill: qp?.bill || 'the bill', issue: qp?.local?.issue || 'the file', minister: fullName(minister) || 'the minister' };
}

export function fillQp(state, text, qp) {
  const vars = qpVars(state, qp);
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// A sentence can't open with "the rent"; the data keeps issues lower-case so they read mid-sentence.
export function capFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The minister who answers: a cabinet member with the interest, else any minister, else the Prime Minister.
function ministerFor(state, interest, sponsor) {
  const gov = state.house.government;
  if (sponsor && state.mps[sponsor]?.caucusRole === 'cabinet') return sponsor;
  const cab = Object.values(state.mps).filter((m) => m.party === gov && m.caucusRole === 'cabinet');
  const fit = cab.filter((m) => m.interests.includes(interest));
  return fit[0]?.id || cab[0]?.id || state.parties[gov]?.leader || null;
}

// The government bill people are talking about: your dilemma if it's live, else the most visible one.
function billInPlay(state) {
  const live = Object.values(state.bills).filter((b) => b.status === 'active' && b.kind === 'government');
  const forced = live.find((b) => b.id === state.player.forceDilemma);
  return forced || live.sort((a, b) => b.visibility - a.visibility)[0] || null;
}

// The thing at home: a case you carried to Ostrava, else one of the riding type's standing complaints.
function localIssue(state, rng) {
  const open = (state.ridingCases || []).filter((c) => c.carried && !c.resolved && !c.raised);
  if (open.length) {
    const c = open[open.length - 1];
    return { issue: c.what, interest: c.interest, caseId: c.id };
  }
  const me = state.mps[state.player.mpId];
  const Q = data().questionPeriod;
  const pool = Q.issues[me.riding.type] || Q.issues.rural;
  return { ...rng.pick(pool), caseId: null };
}

// Does a slot come today? The whip's promise first, the guided week's Tuesday, then the rota.
function slotToday(state, rng) {
  const T = tuning().questionPeriod;
  const p = state.player;
  const d = state.date;
  const me = state.mps[p.mpId];
  if (!isSittingWeek(state) || d.dayOfWeek > 4 || me.caucusRole === 'speaker') return null;
  if (p.qpSlot) return 'deal';
  if (d.absWeek === 0 && state.flow.forceWatch && d.dayOfWeek === T.guidedDay) return 'rota';
  if (p.lastQp != null && absDay(state) - p.lastQp < T.minGapDays) return null;
  return rng.chance(T.slotOdds[String(Math.min(p.act, 3))] ?? 0) ? 'rota' : null;
}

// Stand the player up: pick the topic, the minister, the Speaker's call and the three questions on offer.
export function startQuestionPeriod(state, rng, source = 'rota') {
  const Q = data().questionPeriod;
  const side = sideOf(state);
  const bill = billInPlay(state);
  const local = localIssue(state, rng);
  const qp = {
    week: state.date.absWeek,
    day: state.date.dayOfWeek,
    source,
    side,
    phase: 'stand',
    billId: bill?.id || null,
    bill: bill?.title || null,
    local,
    ministerId: ministerFor(state, bill ? bill.category : local.interest, bill?.sponsor),
    localMinisterId: ministerFor(state, local.interest, null),
    call: '',
    questions: {},
    framing: null,
    outcome: null,
    answer: '',
    benches: '',
    gallery: '',
    effects: null,
  };
  qp.call = fillQp(state, rng.pick(Q.call), qp);
  const topic = bill ? 'bill' : 'issue';
  for (const f of FRAMINGS) {
    const pool = f === 'offScript' ? Q.questions[side].offScript : Q.questions[side][f][topic];
    qp.questions[f] = capFirst(fillQp(state, rng.pick(pool), qp));
  }
  state.questionPeriod = qp;
  state.player.qpSlot = null;
  return { kind: 'questionPeriod', important: true, needsChoice: true, source };
}

// The question is asked: the minister answers from their mood, the benches react, and the ledger moves.
export function ask(state, rng, framing) {
  const qp = state.questionPeriod;
  if (!qp || qp.phase !== 'stand') return;
  if (!FRAMINGS.includes(framing)) framing = 'soft';
  const Q = data().questionPeriod;
  const T = tuning().questionPeriod;
  const me = state.mps[state.player.mpId];
  const p = state.player;
  if (framing === 'offScript') qp.ministerId = qp.localMinisterId || qp.ministerId;
  const minister = state.mps[qp.ministerId];
  const mood = minister?.mood || 'guarded';
  const outcome = framing === 'soft' ? 'lob' : framing === 'offScript' ? 'home' : rng.chance(T.hitOdds[mood] ?? 0.5) ? 'hit' : 'parried';
  qp.framing = framing;
  qp.phase = 'answer';
  qp.outcome = outcome;
  qp.answer = capFirst(fillQp(state, rng.pick(Q.answers[outcome][mood]), qp));
  qp.benches = fillQp(state, rng.pick(Q.benches[qp.side][outcome]), qp);
  qp.gallery = fillQp(state, rng.pick(Q.gallery[outcome]), qp);

  const E = T.effects[qp.side][outcome];
  const party = state.parties[me.party];
  // The whip's opinion; when you are the whip, it's the leader's.
  const whipId = party?.chiefWhip === me.id ? party?.leader : party?.chiefWhip;
  const fx = { whip: 0, noticed: E.noticed, riding: E.riding + (qp.source === 'deal' ? T.dealRiding : 0), poll: 0, headline: null };
  if (whipId && state.mps[whipId]) fx.whip = adjustRapport(state, whipId, E.whip) ?? E.whip;
  p.actProgress.noticed = Math.max(0, p.actProgress.noticed + fx.noticed);
  p.ridingStanding = clamp(p.ridingStanding + fx.riding, 0, 100);
  addStyle(state, E.style);
  const gov = state.house.government;
  if (E.poll && state.polling?.[gov] != null) {
    state.polling[gov] = Math.max(0.5, Math.round((state.polling[gov] + E.poll) * 10) / 10);
    fx.poll = E.poll;
  }
  if (qp.local.caseId) {
    const c = state.ridingCases.find((x) => x.id === qp.local.caseId);
    if (c && framing === 'offScript') c.raised = true;
  }
  const events = { lob: 'qpLob', parried: 'qpParried', hit: 'qpHit', home: 'qpRiding' };
  if (rng.chance(E.press)) {
    const issue = framing === 'offScript' || !qp.bill ? qp.local.issue : qp.bill;
    fx.headline = headline(state, rng, events[outcome], { minister: fullName(minister), bill: qp.bill || issue, issue, party: party?.name || 'The party' });
  }
  qp.effects = fx;
  p.record.questions = (p.record.questions || 0) + 1;
  log(state, `Question Period: you asked ${fullName(minister) || 'the minister'} about ${framing === 'offScript' ? qp.local.issue : qp.bill || qp.local.issue}. ${qp.gallery}`, 'info');
}

function finish(state, rng) {
  const qp = state.questionPeriod;
  if (!qp) return;
  // A headless player (the bot, a skipped stop) asks the party's question.
  if (qp.phase === 'stand') ask(state, rng, 'soft');
  qp.phase = 'done';
  state.player.lastQp = absDay(state);
  state.questionPeriod = null;
}

hooks.questionPeriod.push((state, rng) => {
  const source = slotToday(state, rng);
  return source ? startQuestionPeriod(state, rng, source) : null;
});

resolvers.questionPeriod = (state) => withRng(state, (rng) => finish(state, rng));

registerActions({
  qpAsk: (state, { framing }) => withRng(state, (rng) => ask(state, rng, framing)),
});
