// The weekend edition: the week in review as the front page of an Ostrava paper. The lead story is the
// week's biggest headline from the press gallery, the rest run below the fold, with the polls as a chart,
// the week's numbers, and the player's photograph when the story is theirs.
import { t, esc, scenarioVerdict, aimShort } from './text.js';
import { data, tuning } from '../sim/config.js';
import { quietLead } from '../sim/media.js';
import { calendarOf, weatherOf } from '../sim/calendar.js';

const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '');

// Sorts the parties by national polling and writes the ticker that runs under the masthead.
function pollTicker(state, polling) {
  return Object.entries(polling)
    .filter(([id]) => state.parties[id])
    .sort((a, b) => b[1] - a[1])
    .map(([id, v]) => `${esc(state.parties[id].short)} ${Math.round(v)}`)
    .join(' · ');
}

// A small line chart of national polling, one line per party, the last few weeks. Inline SVG so it prints
// like the rest of the page and takes the party colours.
function pollChart(state, polling) {
  const weeks = tuning().media.chartWeeks;
  const history = (state.pollHistory || []).slice(-weeks);
  const ids = Object.keys(polling).filter((id) => state.parties[id]);
  if (!history.length || !ids.length) return '';
  const w = 300;
  const h = 120;
  const padL = 6;
  const padR = 44;
  const padT = 8;
  const padB = 14;
  const all = history.flatMap((p) => ids.map((id) => p.polling[id] ?? 0));
  const lo = Math.max(0, Math.floor(Math.min(...all) / 5) * 5 - 5);
  const hi = Math.ceil(Math.max(...all) / 5) * 5 + 5;
  const x = (i) => (history.length === 1 ? (w - padL - padR) / 2 + padL : padL + (i / (history.length - 1)) * (w - padL - padR));
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const grid = [];
  for (let v = lo; v <= hi; v += 10) grid.push(`<line x1="${padL}" x2="${w - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/>`);
  const lines = ids.map((id) => {
    const color = state.parties[id].color;
    const pts = history.map((p, i) => `${x(i).toFixed(1)},${y(p.polling[id] ?? 0).toFixed(1)}`);
    const last = history[history.length - 1].polling[id] ?? 0;
    const path = history.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>` : '';
    const dot = `<circle cx="${x(history.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3" fill="${color}"/>`;
    return { v: last, color, path, dot, label: `${esc(state.parties[id].short)} ${Math.round(last)}` };
  });
  // Labels down the right edge, nudged apart so two close parties stay readable.
  const labels = lines.map((l) => ({ ...l, ly: y(l.v) })).sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < labels.length; i++) labels[i].ly = Math.max(labels[i].ly, labels[i - 1].ly + 11);
  const text = labels.map((l) => `<text x="${w - padR + 8}" y="${(l.ly + 3.5).toFixed(1)}" fill="${l.color}">${l.label}</text>`).join('');
  const axis = `<text x="${padL}" y="${h - 2}" class="axis">${t('front.pollsNote')}</text>`;
  return `<svg class="poll-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${t('front.polls')}">${grid.join('')}${lines.map((l) => l.path + l.dot).join('')}${text}${axis}</svg>${history.length < 2 ? `<p class="muted small">${t('front.pollsFirst')}</p>` : ''}`;
}

export function renderFrontPage(state, p, photoUrl) {
  const H = data().headlines;
  const s = p.summary;
  const me = state.mps[state.player.mpId];
  // A save from before the paper existed can arrive here with no press for the week: run a quiet page.
  const press = s.press?.length ? s.press : [quietLead(state)];
  const lead = press[0];
  const rest = press.slice(1, 5);
  const polling = s.polling || state.polling;
  const week = state.date.absWeek;
  const ctx = { name: `${me.name.first} ${me.name.last}`, riding: me.riding.name };
  const byline = H.bylines[week % H.bylines.length];
  const caption = fill(H.captions[(week * 3 + 1) % H.captions.length], ctx);
  const photo = photoUrl && lead?.you ? `<figure class="press-photo"><img src="${photoUrl}" alt="" width="150" height="190"><figcaption>${esc(caption)}</figcaption></figure>` : '';
  const delta = ([a, b]) => `${a} → <b>${b}</b>${b > a ? ' ▲' : b < a ? ' ▼' : ''}`;
  // The paper is dated the Saturday of the week just closed; the date has already moved on to Monday.
  const cal = calendarOf({ week: s.week, year: s.year, dayOfWeek: 6 });
  const wx = weatherOf(state, Math.max(0, state.date.absWeek - 1));
  const dateText = p.firstWeek ? t('week.firstTitle') : t('front.date', { date: cal.dayOfMonth, month: cal.month, year: s.year });
  const weatherText = t('front.weather', { kind: t(`weather.${wx.kind}`), temp: String(wx.temp).replace('-', '\u2212') });

  const elsewhere = rest.length
    ? `<section class="front-elsewhere"><h4>${t('front.elsewhere')}</h4><ul>${rest.map((e) => `<li><span class="paper">${esc(e.paper)}</span> ${esc(e.text)}</li>`).join('')}</ul></section>`
    : '';
  return `<div class="sheet-handle"></div>
    <article class="front-page">
      <header class="masthead">
        <div class="ears"><span class="ear-edition">${t('front.edition')}</span><span class="ear-weather">${esc(weatherText)}</span><span>${esc(dateText)}</span></div>
        <h2>${esc(lead?.paper || H.papers[0])}</h2>
        <div class="dateline">${t('front.dateline', { polls: pollTicker(state, polling) })}</div>
      </header>
      ${scenarioVerdict(state)}
      <section class="lead${photo ? ' with-photo' : ''}">
        ${photo}
        <div class="lead-text">
          <h3>${esc(lead?.text || '')}</h3>
          ${lead?.deck ? `<p class="deck">${esc(lead.deck)}</p>` : ''}
          <p class="byline">${esc(byline)}</p>
        </div>
      </section>
      ${elsewhere}
      <div class="front-grid">
        <section class="front-numbers">
          <h4>${t('front.numbers')}</h4>
          <div class="kvs">
            <div class="kv"><span class="k">${t('week.riding')}</span><span class="v">${delta(s.ridingStanding)}</span></div>
            <div class="kv"><span class="k">${t('week.whip')}</span><span class="v">${delta(s.whipRapport)}</span></div>
            <div class="kv"><span class="k">${t('week.rebellions')}</span><span class="v">${s.rebellions}</span></div>
            <div class="kv"><span class="k">${t('week.divisions')}</span><span class="v">${s.divisions}</span></div>
            ${state.player.act >= 3 ? `<div class="kv${(state.pressure || 0) >= 70 ? ' stale' : ''}"><span class="k">${t('week.pressure')}</span><span class="v">${Math.round(state.pressure || 0)} / 100</span></div>` : ''}
          </div>
          <p class="aim-week"><span class="k">${t('week.aim')}</span>${esc(aimShort(state))}</p>
          <p class="muted small">${esc(t('week.act', { n: state.player.act, n2: state.player.whipFile.length, noticed: Math.round(state.player.actProgress.noticed) }))}</p>
        </section>
        <section class="front-polls">
          <h4>${t('front.polls')}</h4>
          ${pollChart(state, polling)}
        </section>
      </div>
      <section class="front-brief">
        <h4>${t('front.brief')}</h4>
        ${s.lines.length ? `<ol class="feed">${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : `<p class="muted small">${t('front.quietBrief')}</p>`}
      </section>
      ${p.firstWeek ? `<p class="tutorial">${t('week.firstNote')}</p>` : ''}
      <div class="card-actions"><button class="btn primary" data-act="next">${t('week.next')}</button></div>
    </article>`;
}
