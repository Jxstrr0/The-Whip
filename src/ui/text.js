// UI text: strings from data/strings.en.json with {slot} filling, plus shared formatting for MPs and parties.
import { data, tuning } from '../sim/config.js';
import { getSettings } from '../settings.js';
import { isGuidedWeek, actAim, sceneJob } from '../sim/goals.js';

export function t(key, vars = {}) {
  const s = data().strings[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

// The whip's count for a vote, as one ruled line: where we stand against the number needed, and the marks.
export function countLine(pr) {
  if (!pr || !pr.needed) return '';
  const stand = pr.short > 0 ? t('count.line', { ours: pr.ours, needed: pr.needed, short: pr.short }) : `${pr.ours} of ${pr.needed} · ${t('count.safe')}`;
  return `<p class="count-line"><b>${t('count.title')}</b> · ${esc(stand)}<br><small>${esc(t('count.marks', { firm: pr.firm, leaning: pr.leaning, lost: pr.lost, absent: pr.absent, unmarked: pr.unmarked }))}</small></p>`;
}

// A rubber stamp for an outcome: CARRIED, DEFEATED, DEAL, LEAVE GRANTED. kind: yea | nay | grey | brass.
export function stamp(text, kind = '', big = false) {
  return `<span class="stamp ${kind}${big ? ' big' : ''}">${esc(text)}</span>`;
}

// A scenario's brief, shown on the morning it opens, and its verdict once the week has settled.
export function scenarioBrief(state) {
  const m = state.mode;
  if (m?.kind !== 'scenario' || !m.brief || state.date.absWeek !== m.startWeek || state.date.dayOfWeek !== m.startDay) return '';
  return `<p class="tutorial brief"><b>${esc(m.title)}.</b> ${esc(m.brief)}</p>`;
}

export function scenarioVerdict(state) {
  const v = state.mode?.verdict;
  if (!v) return '';
  const kind = ['won', 'held'].includes(v.key) ? 'yea' : ['lost', 'fell', 'ousted'].includes(v.key) ? 'nay' : ['riding', 'party'].includes(v.key) ? 'brass' : 'grey';
  return `<blockquote class="line scenario-verdict">${stamp(t('scenario.stamp.' + v.key), kind)} ${esc(v.text)}</blockquote>`;
}

// Week 0 of the first Parliament is the guided first week: a hint on each room's first sheet, then never again.
export function firstWeekHint(state, key) {
  return isGuidedWeek(state) ? `<p class="tutorial">${t(key)}</p>` : '';
}

// "Your job here": one line under a scene's title saying what the player is there to do.
export function jobLine(state, kind, ctx = {}) {
  const j = sceneJob(state, kind, ctx);
  return j ? `<p class="job"><span class="job-label">${t('job.label')}</span>${esc(t(j.key, j.vars))}</p>` : '';
}

// The act's aim, short: "Act 1 · Get noticed · 3 of 8" for the agenda bar.
export function aimShort(state) {
  const a = actAim(state);
  const c = a.counters[0];
  const tail = a.waiting || !c ? '' : ` · ${t('aim.s.' + c.key, c)}`;
  return `${t('career.act', { n: a.act })} · ${t('aim.short.' + a.act)}${tail}`;
}

// The act's aim in full: the goal, every counter as a bar, and how it's won or lost.
export function aimDetail(state) {
  const a = actAim(state);
  const vars = { floor: tuning().ranks.revoltBelowSupport, top: tuning().confidence.pressureReplaced };
  const row = (c) => {
    const pct = Math.max(0, Math.min(100, (c.have / Math.max(1, c.need)) * 100));
    const ok = c.limit === 'above' ? c.have >= c.need : c.limit === 'below' ? c.have < c.need * 0.7 : c.have >= c.need;
    return `<div class="aim-row${ok ? ' done' : ''}${c.limit ? ' limit' : ''}"><div class="aim-k"><span>${esc(t('aim.c.' + c.key, { need: c.need }))}</span><b>${esc(c.limit ? String(c.have) : t('aim.of', c))}</b></div><div class="aim-bar"><i style="width:${pct}%"></i></div></div>`;
  };
  const either = a.act === 4 ? `<p class="muted small">${t('aim.either')}</p>` : '';
  const counters = a.act === 4 ? `${a.counters.slice(0, 2).map(row).join('')}${either}${a.counters.slice(2).map(row).join('')}` : a.counters.map(row).join('');
  return `<p class="aim-goal">${esc(t('aim.' + a.act))}</p>${counters}${a.waiting ? `<p class="note">${esc(t('aim.wait.' + a.act))}</p>` : ''}<p class="aim-how">${esc(t('aim.how.' + a.act, vars))}</p>`;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function mpName(mp) {
  return `${mp.name.first} ${mp.name.last}`;
}

export function partyOf(state, mp) {
  return mp.party === 'ind' ? null : state.parties[mp.party];
}

// Party colours; the colour-blind setting swaps in the Okabe-Ito palette from data/parties.json.
export function partyColor(state, mp) {
  const P = data().parties;
  if (getSettings().colourBlind) {
    if (mp.party === 'ind') return P.independentCbColor;
    return P.core.find((q) => q.id === mp.party)?.cbColor ?? P.fifthCbColor;
  }
  return mp.party === 'ind' ? P.independentColor : state.parties[mp.party].color;
}

export function partyShort(state, mp) {
  return mp.party === 'ind' ? 'IND' : state.parties[mp.party].short;
}

export function partyName(state, pid) {
  return pid === 'ind' ? t('party.ind') : state.parties[pid]?.name ?? pid;
}

export function roleName(state, mp) {
  if (mp.caucusRole === 'leader' && state.house.government === mp.party) return t('role.primeMinister');
  return t('role.' + mp.caucusRole);
}

export function interestName(id) {
  return data().world.interestNames[id] ?? id;
}

function band(v, words) {
  const cuts = [-40, -15, 15, 40];
  let i = 0;
  while (i < cuts.length && v > cuts[i]) i++;
  return words[i];
}

export function ideologyText(ideo) {
  const econ = band(ideo.economy, ['left', 'centre-left', 'centre', 'centre-right', 'right']);
  const soc = band(ideo.social, ['progressive', 'socially liberal', 'moderate', 'socially conservative', 'traditionalist']);
  return `${econ} on the economy, ${soc}`;
}

export function loyaltyText(v) {
  if (v >= 80) return `${v} · rock-solid`;
  if (v >= 65) return `${v} · reliable`;
  if (v >= 50) return `${v} · independent-minded`;
  if (v >= 35) return `${v} · restless`;
  return `${v} · a maverick`;
}

export function ambitionText(v) {
  if (v >= 75) return `${v} · wants the top job`;
  if (v >= 55) return `${v} · wants a post`;
  if (v >= 30) return `${v} · content for now`;
  return `${v} · no appetite for climbing`;
}

export function rapportText(v) {
  if (v >= 50) return `${v} · close`;
  if (v >= 20) return `${v} · friendly`;
  if (v > -20) return `${v} · neutral`;
  if (v > -50) return `${v} · cool`;
  return `${v} · hostile`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Longlight's mark: the sun on the horizon, in the studio's colours. Used on the title page and the loading screen.
export function longlightMark(cls = 'mark') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#141413"/><path class="sun" d="M20 40a12 12 0 0 1 24 0z" fill="#d97757"/><rect x="8" y="39.5" width="48" height="3" fill="#7b3fc4"/></svg>`;
}
