// Goals: what the player is working toward in this act, and what each scene is for. Pure reads of state;
// the UI turns the keys into text. Thresholds come from tuning, so the aim always matches the rules.
import { tuning } from './config.js';
import { fellBack } from './career.js';

const weeksInAct = (state) => state.date.absWeek - (state.player.actStart ?? 0);

// The guided first week: the first week of the player's first Parliament, outside scenarios.
export function isGuidedWeek(state) {
  return state.date.absWeek === 0 && (state.player.record?.parliaments ?? 1) === 1 && state.mode?.kind !== 'scenario';
}

// The act's aim. Each counter is { key, have, need }; `limit` counters are ones to stay under or above,
// not reach. `waiting` is set once the counters are done and the next step is up to the House; `fell` when
// this Act 2 follows a fall from the whip's office.
export function actAim(state) {
  const p = state.player;
  const C = tuning().career;
  const R = tuning().ranks;
  const weeks = weeksInAct(state);
  const counters = [];
  let waiting = false;
  switch (p.act) {
    case 1:
      counters.push({ key: 'noticed', have: Math.floor(p.actProgress.noticed), need: C.noticedForAct2 });
      if (state.date.absWeek < C.act1MinWeeks) counters.push({ key: 'weeks', have: state.date.absWeek, need: C.act1MinWeeks });
      break;
    case 2:
      if (weeks < C.act2MinWeeks) counters.push({ key: 'weeks', have: weeks, need: C.act2MinWeeks });
      else waiting = true;
      break;
    case 3:
      counters.push({ key: 'carried', have: Math.min(p.actProgress.rowVotesCarried, R.rowCarriesForAct4), need: R.rowCarriesForAct4 });
      if (weeks < R.act3MinWeeks) counters.push({ key: 'weeks', have: weeks, need: R.act3MinWeeks });
      break;
    case 4:
      counters.push({ key: 'caucus', have: Math.round(p.caucusSupport), need: R.caucusSupportForChief }, { key: 'trust', have: Math.round(p.leaderTrust), need: R.leaderTrustForChief });
      if (weeks < R.act4MinWeeks) counters.push({ key: 'weeks', have: weeks, need: R.act4MinWeeks });
      else waiting = true;
      break;
    default:
      counters.push({ key: 'caucusFloor', have: Math.round(p.caucusSupport), need: R.revoltBelowSupport, limit: 'above' }, { key: 'pressure', have: Math.round(state.pressure || 0), need: tuning().confidence.pressureReplaced, limit: 'below' });
  }
  return { act: Math.max(1, Math.min(5, p.act)), counters, waiting, fell: fellBack(p) };
}

// One short line for each scene: the key of what the player is there to do, and the values it fills in.
export function sceneJob(state, kind, ctx = {}) {
  const p = state.player;
  const whip = p.act >= tuning().tools.officeFilesFromAct;
  switch (kind) {
    case 'morning':
      if (!ctx.items?.length) return { key: 'job.morning.none' };
      if (ctx.items.some((i) => i.stop === 'bigVote')) return { key: 'job.morning.bigVote' };
      if (ctx.items.some((i) => i.stop === 'ownVote')) return { key: 'job.morning.ownVote' };
      return { key: whip ? 'job.morning.whip' : 'job.morning' };
    case 'office':
      return { key: whip ? 'job.office.whip' : ctx.whipCall ? 'job.office.called' : fellBack(p) && weeksInAct(state) < 1 ? 'job.office.fell' : 'job.office', vars: { n: ctx.slots ?? p.slots } };
    case 'meeting':
      return { key: `job.meeting.${ctx.situation in MEETINGS ? ctx.situation : 'other'}`, vars: { pos: ctx.pos || '' } };
    case 'caucus':
      if (ctx.revolt && !ctx.revolt.choice) return { key: ctx.revolt.target === 'whip' ? 'job.caucus.revoltYou' : 'job.caucus.revolt' };
      return { key: p.act === 5 ? 'job.caucus.chief' : 'job.caucus', vars: { floor: tuning().ranks.revoltBelowSupport } };
    case 'questionPeriod':
      return { key: 'job.qp' };
    case 'division': {
      if (ctx.reason === 'ownBill') return { key: 'job.division.ownBill' };
      if (ctx.chase) return { key: 'job.division.chase', vars: { pos: ctx.pos } };
      if (ctx.dilemma) return { key: 'job.division.dilemma', vars: { pos: ctx.pos } };
      if (ctx.reason === 'bigVote') return { key: 'job.division.bigVote', vars: { pos: ctx.pos } };
      if (ctx.confidence) return { key: 'job.division.confidence', vars: { pos: ctx.pos } };
      return { key: ctx.line === 'whipped' ? 'job.division.line' : 'job.division.free', vars: { pos: ctx.pos } };
    }
    case 'riding':
      return { key: 'job.riding' };
    case 'campaign':
      return { key: 'job.campaign' };
    default:
      return null;
  }
}

const MEETINGS = { whipCall: 1, rebelRecruit: 1, favorAsk: 1, introduction: 1, gossip: 1, complaint: 1, mentorAdvice: 1 };

