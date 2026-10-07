import type { Snapshot } from '../../../mods/team-pulse/types'
import { avatarSvg } from '../../../mods/team-pulse/hooks/avatar'
import { bubbleSvg, esc, rowSvg, stripSvg } from '../../../mods/team-pulse/hooks/draw'
import { ago, buildRows, otherLine, withYouLine } from '../../../mods/team-pulse/hooks/rows'
import { inbox, latestWin, wavers, wavesTo } from '../../../mods/team-pulse/hooks/signals'
import { strip } from '../../../mods/team-pulse/hooks/strip'

/** Only called with task 30's authenticated, caller-filtered snapshot. No member key reaches this renderer. */
export function renderWebView(snap: Snapshot): string {
  const rows = buildRows(snap, 0)
  const handoffs = inbox(snap, snap.you, snap.now)
  const win = latestWin(snap, snap.now)
  const waved = wavers(snap, snap.now)
  const received = new Set(wavesTo(snap, snap.you).map(s => s.from))
  const nameOf = (id: string) => snap.members.find(m => m.id === id)?.name ?? 'Teammate'
  // Reuse the panel's choice of live teammates and grammar; only the browser wording differs.
  const working = withYouLine(rows).replace(' is with you right now', ' is working right now')
    .replace(' are with you right now', ' are working right now').replace(/\.$/, '')
  const cards = handoffs.slice(0, 2).map(handoff => `<article class="card">
    <p class="card-heading">${esc(`FOR YOU \u00b7 FROM ${nameOf(handoff.from).toUpperCase()} \u00b7 ${ago(Math.max(0, snap.now - handoff.at))} ago`)}</p>
    <p>${esc(handoff.text)}</p><p class="how">Take or dismiss it in /team</p></article>`).join('')
  const shelf = win ? `<p class="shelf"><span class="shelf-label">WIN</span><span>${esc(`${nameOf(win.win.from)}: ${win.win.text}`)}</span>${win.others ? `<span class="quiet">+${win.others}</span>` : ''}</p>` : ''
  const roster = rows.map(r => {
    const activity = strip(snap.segments.filter(s => s.member === r.id), snap.now)
    const avatar = avatarSvg(r.id, 30, r.status, waved.has(r.id))
    // An image gives each animal its own SVG document, including its shared clip-path id.
    const animal = `<img class="avatar" width="30" height="30" src="data:image/svg+xml,${encodeURIComponent(avatar.source)}" alt="${esc(`${avatar.alt}, ${r.status === 'live' ? 'working' : r.status}`)}">`
    const note = r.note ? bubbleSvg(r.note, r.noteAge, 290) : null
    const bars = rowSvg(r)
    const timeline = stripSvg(activity.pieces)
    const detailsId = `details-${r.id}`
    const statusText = r.status === 'live' ? 'working' : r.statusText
    return `<article class="row" data-member="${esc(r.id)}">${animal}<div class="row-main">
      <div class="name-line"><b class="name">${esc(r.name)}${r.you ? ' <span class="you">\u00b7 you</span>' : ''}${received.has(r.id) ? ' <span class="wave-label">waved at you</span>' : ''}</b><span class="clock">${esc(r.clock ?? statusText)}${r.clock ? `<span class="status-text">${esc(statusText)}</span>` : ''}</span></div>
      ${note ? `<div class="note" role="img" aria-label="${note.alt}">${note.source}</div>` : ''}
      <p class="work${r.main ? '' : ' quiet'}">${esc(r.main ? r.main.line || 'Working in Claude Code' : 'Not running Claude Code')}</p>
      <div class="sub"><div class="strip" role="img" aria-label="${esc(timeline.alt)}">${timeline.source}</div><button class="more" data-action="more" aria-expanded="false" aria-controls="${esc(detailsId)}">More</button></div>
      <div class="details" id="${esc(detailsId)}" data-details hidden>
        ${r.main ? `<p>${esc(r.main.where + (r.others.length ? ` \u00b7 ${r.others.length + 1} sessions` : ''))}</p>` : ''}
        <div class="bars" role="img" aria-label="${bars.alt}">${bars.source}</div>
        <p>${esc(`Claude activity ${activity.hours.toFixed(1)}h in the last 12 hours`)}</p>
        ${r.others.map(o => `<p>${esc(otherLine(o))}</p>`).join('')}
      </div></div></article>`
  }).join('')
  return `<section data-view data-snapshot-now="${snap.now}">
    <header class="top"><div class="heading"><h1>${esc(snap.team)}</h1><nav aria-label="View controls"><button data-action="hide" aria-pressed="false">Hide view</button><button data-action="signout">Sign out</button></nav></div><p class="working">${esc(working)}</p></header>
    <div class="view-body"><aside class="side" aria-label="Handoffs and wins">${cards}${handoffs.length > 2 ? `<p class="overflow quiet">+${handoffs.length - 2} more</p>` : ''}${shelf}</aside><section class="roster" aria-label="Team roster">${roster}</section><div class="cover" data-cover hidden>View hidden</div></div>
    <footer><span>View from <time data-snapshot-time></time></span><span>Read-only</span></footer>
  </section>`
}
