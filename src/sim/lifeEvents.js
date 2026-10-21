// MPs' own arcs: an ambition, a crisis, trouble at home, a retirement in the air. Each is a moment where
// showing up for someone builds a bond, and not showing up is remembered. (By-elections come with stage 8.)
import { data, tuning } from './config.js';
import { hooks, log, resolvers } from './pacing.js';
import { adjustRapport } from './relationships.js';
import { reveal } from './knowledge.js';
import { budget } from './tools.js';
import { remember, person } from './memoir.js';

const fullName = (m) => `${m.name.first} ${m.name.last}`;
const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);

export function newLifeEvent(state, rng, m) {
  const C = tuning().career;
  const kinds = ['ambition', 'crisis', 'ridingTrouble'];
  if (m.age >= C.retirementAge) kinds.push('retirement', 'retirement');
  const kind = rng.pick(kinds);
  state.lifeEventSeq = (state.lifeEventSeq || 0) + 1;
  const e = { id: 'e' + String(state.lifeEventSeq).padStart(3, '0'), kind, stage: 0, week: state.date.absWeek, resolvedBy: null, text: fill(rng.pick(data().career.lifeEvent[kind]), { name: fullName(m), riding: m.riding.name }) };
  m.lifeEvents.push(e);
  if (kind === 'retirement') m.retiring = true;
  if (kind === 'crisis') m.attendance = Math.max(20, m.attendance - 15);
  if (kind === 'ridingTrouble') m.margin = Math.max(1, m.margin - 3);
  return e;
}

// Weekends: a few MPs' lives move. One of them, if they're close to you, asks something of you.
hooks.weekend.push((state, rng) => {
  const C = tuning().career;
  const p = state.player;
  const me = state.mps[p.mpId];
  let stop = null;
  let shown = 0;
  for (const m of Object.values(state.mps)) {
    if (m.id === me.id || m.caucusRole === 'speaker' || !rng.chance(C.lifeEventOdds)) continue;
    if (m.lifeEvents.some((e) => !e.resolvedBy && state.date.absWeek - e.week < 12)) continue;
    const e = newLifeEvent(state, rng, m);
    const close = m.party === me.party && (m.rapport > 10 || m.cohort === me.cohort || p.mentor === m.id);
    if (close && shown < C.lifeEventMaxPerWeek && p.pacing.stopFor.includes('lifeEvent')) {
      shown++;
      reveal(state, m.id, 'lifeEvents', 'gossip');
      const L = data().career.lifeEvent;
      stop = { kind: 'career', event: 'lifeEvent', important: true, needsChoice: true, mpId: m.id, eventId: e.id, text: e.text, options: [{ id: 'showUp', label: L.showUp, note: L.showUpNote, enabled: true }, { id: 'sendNote', label: L.sendNote, note: L.sendNoteNote, enabled: true }, { id: 'ignore', label: L.ignore, note: L.ignoreNote, enabled: true }] };
    }
  }
  return stop;
});

// Showing up, or not, goes in the memoir; a note is the decent minimum and doesn't.
function rememberLifeEvent(state, m, e, sub) {
  const M = data().memoir;
  const what = (M.lifeWhat[e.kind] || M.lifeWhat.crisis).replace('{where}', m.riding.name);
  remember(state, 'lifeEvent', { sub, ctx: { name: fullName(m), first: m.name.first, what }, people: [person(state, m.id, M.notes.lifeEvent)] });
}

function respond(state, p, choice) {
  const C = tuning().career;
  const m = state.mps[p.mpId];
  const e = m?.lifeEvents.find((x) => x.id === p.eventId);
  if (!m || !e) return;
  if (choice === 'showUp') {
    e.resolvedBy = state.player.mpId;
    budget(state);
    state.player.toolTime = Math.max(0, state.player.toolTime - C.showUpTime);
    adjustRapport(state, m.id, C.showUpRapport);
    m.relations[state.player.mpId] = Math.min(100, (m.relations[state.player.mpId] || 0) + 15);
    log(state, `You showed up for ${fullName(m)}. They won't forget it.`, 'career');
    rememberLifeEvent(state, m, e, 'showUp');
  } else if (choice === 'sendNote') {
    adjustRapport(state, m.id, C.noteRapport);
    log(state, `You sent ${fullName(m)} a note.`, 'career');
  } else {
    adjustRapport(state, m.id, C.ignoreRapport);
    e.ignoredBy = state.player.mpId;
    log(state, `${fullName(m)} noticed you didn't come by.`, 'career');
    rememberLifeEvent(state, m, e, 'ignore');
  }
}

const prevExtra = resolvers.careerExtra;
resolvers.careerExtra = (state, p, choice) => {
  if (p.event === 'lifeEvent') return respond(state, p, choice || 'sendNote');
  prevExtra?.(state, p, choice);
};
