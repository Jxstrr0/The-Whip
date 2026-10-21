// UI text: strings from data/strings.en.json with {slot} filling, plus shared formatting for MPs and parties.
import { data } from '../sim/config.js';

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

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function mpName(mp) {
  return `${mp.name.first} ${mp.name.last}`;
}

export function partyOf(state, mp) {
  return mp.party === 'ind' ? null : state.parties[mp.party];
}

export function partyColor(state, mp) {
  return mp.party === 'ind' ? data().parties.independentColor : state.parties[mp.party].color;
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
