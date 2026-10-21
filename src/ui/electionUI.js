// The writ and election night as sheets of the Order Paper: the campaign choice, then the result with the
// seats before and after, your riding stamped HELD or LOST, and the door into the next Parliament.
import { t, esc, stamp, scenarioVerdict, jobLine } from './text.js';

export function createElectionUI(root, { getState, dispatch }) {
  const sheet = document.createElement('section');
  sheet.className = 'sheet election-sheet hidden';
  root.appendChild(sheet);
  let shown = null;

  function campaign(state, p) {
    const me = state.mps[state.player.mpId];
    const nom = state.player.nominationThreat >= 60 ? `<p class="note bad">${t('dissolved.nomination')}</p>` : '';
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${t('dissolved.title')}</h2>
      ${jobLine(state, 'campaign')}${scenarioVerdict(state)}<blockquote class="line">${t('dissolved.' + (p.reason || 'fixedDate'))}</blockquote>
      <p>${esc(t('dissolved.yourRiding', { riding: me.riding.name, margin: me.margin, standing: Math.round(state.player.ridingStanding) }))}</p>${nom}
      <div class="choices">
        <button class="btn primary" data-c="canvass">${t('dissolved.canvass')}<small class="approach">${t('dissolved.canvassNote')}</small></button>
        <button class="btn" data-c="tour">${t('dissolved.tour')}<small class="approach">${t('dissolved.tourNote')}</small></button>
        <button class="btn" data-c="rest">${t('dissolved.rest')}<small class="approach">${t('dissolved.restNote')}</small></button>
      </div>`;
    sheet.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => dispatch({ type: 'resolve', choice: b.dataset.c })));
  }

  function result(state, p) {
    const r = p.player;
    const lost = r.result !== 'held';
    const rows = p.seats
      .slice()
      .sort((a, b) => b.after - a.after)
      .map((s) => `<div class="kv"><span class="k"><span class="chip" style="background:${esc(s.color)}"></span> ${esc(s.name)}</span><span class="v">${s.before} → <b>${s.after}</b>${s.after > s.before ? ' ▲' : s.after < s.before ? ' ▼' : ''}</span></div>`)
      .join('');
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${t('election.title')}</h2>
      <p class="muted">${esc(p.campaignText || '')}</p>
      <p>${stamp(t(lost ? 'election.lost' : 'election.held'), lost ? 'nay' : 'yea', true)}</p>
      <p><b>${esc(r.result === 'deselected' ? t('election.nominationLost') : t('election.yourRiding', { riding: r.riding, result: t(lost ? 'election.lost' : 'election.held').toLowerCase(), margin: r.margin }))}</b></p>
      <p>${esc(t(p.minority ? 'election.minority' : 'election.government', { party: p.governmentName }))}</p>
      <h3>${t('election.seats')} <small>${t('election.before')} → ${t('election.after')}</small></h3>
      <div class="kvs">${rows}</div>
      <p class="muted">${esc(t('election.cohortLost', { n: p.cohortLost }))} ${esc(t('election.newcomers', { n: p.newcomers, gone: p.gone }))}</p>
      <div class="card-actions"><button class="btn primary" data-act="go">${lost ? t('election.continueLost') : t('election.continue', { n: p.parliament })}</button></div>`;
    sheet.querySelector('[data-act="go"]').onclick = () => dispatch({ type: 'resolve' });
  }

  function handover(state, p) {
    sheet.innerHTML = `<div class="sheet-handle"></div><h2>${t('election.handoverTitle')}</h2>
      <blockquote class="line">${esc(t('election.handover', { party: p.fromName, newParty: p.toName }))}</blockquote>
      <div class="card-actions"><button class="btn primary" data-act="go">${t('career.continue')}</button></div>`;
    sheet.querySelector('[data-act="go"]').onclick = () => dispatch({ type: 'resolve' });
  }

  function render(state) {
    const p = state.flow.pending;
    if (p?.kind !== 'dissolved' && p?.kind !== 'election') {
      sheet.classList.add('hidden');
      shown = null;
      return;
    }
    const key = `${p.kind}:${p.phase || ''}:${p.parliament || ''}`;
    if (shown === key) return;
    shown = key;
    if (p.kind === 'dissolved') campaign(state, p);
    else if (p.phase === 'handover') handover(state, p);
    else result(state, p);
    sheet.classList.remove('hidden');
  }
  return { render };
}
