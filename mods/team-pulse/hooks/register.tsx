import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Membership, Snapshot } from '../types'
import { backoffMs, parseJoinCode, requestOf, resultOf, UNREACHABLE } from './client'
import type { CallResult } from './client'
import { clockLabel } from './clock'
import { COMMAND, DEFAULT_SERVER, HEARTBEAT_MS, PANE, READ_MS, TIMEOUT_MS } from './config'
import { cleanLine, fallbackLine, lineDue, lineRequest } from './line'
import { cleanName } from './names'
import { drawPanel } from './panel'
import { followAction, paneStateOf, pinnedAfterClose } from './pin'
import { presenceLine } from './presence'
import { buildRows } from './rows'
import { buildHeartbeat, joinDecision, sessionIdFor } from './share'
import { inbox, targetOf } from './signals'

const snapshot = atom({ plugin: 'murror', key: 'snapshot' } as const, null as Snapshot | null)
const fetchedAt = atom({ plugin: 'murror', key: 'fetchedAt' } as const, 0)
const problem = atom({ plugin: 'murror', key: 'problem' } as const, null as string | null)
const expanded = atom({ plugin: 'murror', key: 'expanded' } as const, [] as string[])

// This session's own facts; a reload starts them over, which only delays one heartbeat.
const sessionBase = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')
let cwd = ''
let lastTurnAt = 0
let lastPrompt = ''
let line: string | null = null
let lineAt: number | null = null
let beatFailures = 0
let nextBeatAt = 0
let readTick = 0
let beatTimer: { cancel: () => void } | null = null
let readTimer: { cancel: () => void } | null = null

const membership = async ($: any) => ((await $.store.get('membership')) as Membership | undefined) ?? null
const serverOf = async ($: any) => ((await $.store.get('server')) as string | undefined) ?? DEFAULT_SERVER

/** Calls the team server: JSON in and out, a 5 s timeout, never a thrown error. */
async function call<T>(
  $: any,
  server: string,
  c: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; key?: string; body?: unknown }
): Promise<CallResult<T>> {
  const { url, init } = requestOf(server, c)
  const timeout = $.clock.sleep(TIMEOUT_MS).then(() => {
    throw new Error('timeout')
  })
  try {
    return resultOf<T>(await Promise.race([$.http.fetch(url, init), timeout]))
  } catch {
    return UNREACHABLE
  }
}

async function branchOf($: any): Promise<string> {
  const r = await $.process.run(['git', '-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 2000 }).catch(() => null)
  return r && r.exitCode === 0 ? r.stdout.trim() : ''
}

async function beat($: any) {
  const m = await membership($)
  if (!m || (await $.store.get('paused')) === true) return
  const now = await $.clock.now()
  if (now < nextBeatAt) return
  const sessionId = sessionIdFor(sessionBase, m.memberId)
  const u = await $.session.usage().catch(() => null)
  const branch = await branchOf($)
  const said = (await $.store.get('said')) as string | null | undefined
  const hb = buildHeartbeat({
    session: sessionId,
    branch,
    line: said || line || fallbackLine(branch),
    lastTurnAt,
    now,
    fiveHour: u?.rateLimits?.find((l: any) => l.kind === 'five_hour')?.percentUsed ?? null,
    week: u?.rateLimits?.find((l: any) => l.kind === 'seven_day')?.percentUsed ?? null,
    startedAt: u?.startedAt ?? now
  })
  const r = await call($, m.server, { method: 'PUT', path: `/teams/${m.teamId}/sessions/${sessionId}`, key: m.key, body: hb })
  if (r.ok) {
    beatFailures = 0
    nextBeatAt = 0
  } else if (r.status === 401) {
    await $.store.delete('membership')
    await dropPanel($)
    $.ui.status(undefined)
    $.ui.toast('You were removed from the team. Join again with /team join <code> <your name>.')
  } else {
    beatFailures += 1
    nextBeatAt = now + backoffMs(beatFailures)
  }
}

/** The presence line under the prompt: teammates who are online. */
async function showPresence($: any) {
  if (!(await membership($))) {
    $.ui.status(undefined)
    return
  }
  const snap = await read($, snapshot)
  const at = await read($, fetchedAt)
  $.ui.status(
    presenceLine({
      rows: snap ? buildRows(snap, Date.now() - at) : [],
      paused: (await $.store.get('paused')) === true,
      problem: await read($, problem),
      hasSnapshot: snap !== null,
      hasHandoff: inbox(snap, snap?.you ?? '', snap ? snap.now + Math.max(0, at ? Date.now() - at : 0) : 0).length > 0
    })
  )
}

async function refresh($: any) {
  const m = await membership($)
  if (!m) return
  const r = await call<Snapshot>($, m.server, { method: 'GET', path: `/teams/${m.teamId}`, key: m.key })
  if (r.ok && (!r.data || !Array.isArray(r.data.members) || !Array.isArray(r.data.sessions) || !Array.isArray(r.data.segments))) {
    await update($, problem, () => 'The team server sent something unexpected')
  } else if (r.ok) {
    await update($, snapshot, () => r.data)
    await update($, fetchedAt, () => Date.now())
    await update($, problem, () => null)
  } else if (r.status !== 429) {
    // A 429 keeps the last view quietly; anything else says why.
    await update($, problem, () => r.message)
  }
  await showPresence($)
}

async function writeLine($: any) {
  if (!(await membership($))) return
  if ((await $.store.get('said')) || (await $.store.get('paused')) === true || !lastPrompt) return
  const now = await $.clock.now()
  if (!lineDue(lineAt, now)) return
  const previousAt = lineAt
  lineAt = now
  const r = await $.model.complete(lineRequest(lastPrompt)).catch(() => null)
  const clean = r && r.isAnswered ? cleanLine(r.text) : null
  // Nothing to summarize (NONE or no answer) must not start the wait before the next try.
  if (!clean) lineAt = previousAt
  if (clean && clean !== line) {
    line = clean
    await showPresence($)
  }
}

/** Remembers whether the panel should come back in the next session. */
async function setPinned($: any, value: boolean) {
  if (((await $.store.get('panelPinned')) === true) !== value) await $.store.set('panelPinned', value)
}

/** Where the Team pane stands, from the engine's own record rather than anything this module remembers. */
async function paneState($: any) {
  // Older Claude Code has no ui.panes, so calling it throws at once (not as a rejected promise): that lands in the catch as closed, and /team still opens.
  // No typeof probe on $.ui.panes: the validator only allows $.noun.event(...) calls.
  try {
    return paneStateOf(await $.ui.panes(), PANE)
  } catch {
    return 'closed'
  }
}

/** Follows the panel pin shared by every open session on this Mac. */
async function follow($: any) {
  try {
    if (!(await membership($))) return
    const pinned = (await $.store.get('panelPinned')) === true
    const action = followAction(pinned, await paneState($))
    if (action === 'open') await $.ui.open({ id: PANE, title: 'Team' })
    else if (action === 'close') await $.ui.close({ id: PANE })
  } catch {
    // A store or UI failure must not stop this session's read timer.
  }
}

/** Closes the panel and un-pins it, for when there is no team to show. */
async function dropPanel($: any) {
  await setPinned($, false)
  await $.ui.close({ id: PANE }).catch(() => {})
}

async function openPanel($: any) {
  await setPinned($, true)
  // The person asked for this open, so it seats at any width.
  await $.ui.open({ id: PANE, title: 'Team' })
  await refresh($)
}

const NOT_IN_TEAM = 'You are not in a team. Create one with /team create <team> <your name>, or join with /team join <code> <your name>.'

async function runCommand($: any, args: string): Promise<string> {
  const [sub = '', ...rest] = args.trim().split(/\s+/)
  const m = await membership($)
  const srv = await serverOf($)

  switch (sub) {
    case '':
      if ((await paneState($)) === 'shown') {
        await setPinned($, false)
        await $.ui.close({ id: PANE })
        return 'Team panel closed.'
      }
      await openPanel($)
      return 'Team panel opened.'
    case 'create': {
      const [team, ...words] = rest
      const name = cleanName(words.join(' '))
      if (!team || !name) return 'Use /team create <team> <your name>, for example /team create Murror Astro.'
      const r = await call<any>($, srv, { method: 'POST', path: '/teams', body: { team, name } })
      if (!r.ok) return r.message
      await $.store.set('membership', { server: srv, teamId: r.data.teamId, team: r.data.team, memberId: r.data.memberId, key: r.data.key, name, isAdmin: true, joinCode: r.data.joinCode })
      nextBeatAt = 0
      await beat($).catch(() => {})
      await openPanel($)
      return `Created ${r.data.team}. Teammates join with: /team join ${r.data.joinCode} followed by their name`
    }
    case 'join': {
      const [code = '', ...words] = rest
      const name = cleanName(words.join(' '))
      const parsed = parseJoinCode(code)
      if (!parsed || !name) return 'Use /team join <code> <your name>. Ask the team admin for the code.'
      if (joinDecision(m, parsed.teamId) === 'already') return `You are already on ${m!.team} as ${m!.name}. Use /team name <new name> to change your name.`
      const r = await call<any>($, srv, { method: 'POST', path: `/teams/${parsed.teamId}/join`, body: { code: parsed.secret, name } })
      if (!r.ok) return r.message
      await $.store.set('membership', { server: srv, teamId: r.data.teamId, team: r.data.team, memberId: r.data.memberId, key: r.data.key, name, isAdmin: false })
      nextBeatAt = 0
      await beat($).catch(() => {})
      await openPanel($)
      return `Joined ${r.data.team}. Your sessions are shared from now on; /team pause stops it.`
    }
    case 'device': {
      const [action, code = ''] = rest
      if (action === 'code') {
        if (!m) return NOT_IN_TEAM
        const r = await call<{ pairCode: string; expiresAt: number }>($, m.server, { method: 'POST', path: `/teams/${m.teamId}/pair`, key: m.key })
        if (!r.ok) return r.message
        return `On your other Mac, run: /team device join ${r.data.pairCode} (works once, for 10 minutes).`
      }
      const parsed = action === 'join' ? parseJoinCode(code) : null
      if (!parsed) return 'Use /team device code on your other Mac, then /team device join <code> on this Mac.'
      if (joinDecision(m, parsed.teamId) === 'already') return `This Mac is already on ${m!.team} as ${m!.name}. To move it to another person, run /team leave first.`
      const r = await call<any>($, srv, { method: 'POST', path: `/teams/${parsed.teamId}/pair/join`, body: { code: parsed.secret } })
      if (!r.ok) return r.message
      await $.store.set('membership', { server: srv, teamId: r.data.teamId, team: r.data.team, memberId: r.data.memberId, key: r.data.key, name: r.data.name, isAdmin: r.data.isAdmin })
      nextBeatAt = 0
      await beat($).catch(() => {})
      await openPanel($)
      return `This Mac is now part of ${r.data.name} on ${r.data.team}.`
    }
    case 'web': {
      if (!m) return NOT_IN_TEAM
      if (!rest.length) return `Open ${m.server.replace(/\/+$/, '')}/web/${m.teamId} in your browser. It will show a code; type /team web <code> here to connect it for 30 days.`
      const code = rest.join(' ').trim().toUpperCase()
      const revoke = code === 'REVOKE'
      const r = await call($, m.server, { method: 'POST', path: `/teams/${m.teamId}/web/${revoke ? 'revoke' : 'approve'}`, key: m.key, body: revoke ? undefined : { code } })
      if (!r.ok) return r.message
      return revoke ? 'Signed out every browser you connected.' : `Connected. That browser can see ${m.team} for 30 days. /team web revoke signs out every browser you connected.`
    }
    case 'leave': {
      if (!m) return 'You are not in a team.'
      const r = await call<{ ok: boolean; removed: 'device' | 'member' }>($, m.server, { method: 'POST', path: `/teams/${m.teamId}/leave`, key: m.key })
      if (!r.ok) return r.message
      await $.store.delete('membership')
      await dropPanel($)
      $.ui.status(undefined)
      if (r.data.removed === 'device') return `This Mac left ${m.team}. Your other Macs are still on the team.`
      return `You left ${m.team}. Your shared data was deleted.`
    }
    case 'pause':
      await $.store.set('paused', true)
      await showPresence($)
      return 'Sharing paused on this Mac. Teammates will see you as offline. /team resume starts it again.'
    case 'resume':
      await $.store.set('paused', false)
      nextBeatAt = 0
      void beat($).catch(() => {})
      await showPresence($)
      return 'Sharing resumed.'
    case 'say': {
      const text = rest.join(' ').replace(/^["']|["']$/g, '').trim()
      await $.store.set('said', text || null)
      nextBeatAt = 0
      void beat($).catch(() => {})
      await showPresence($)
      return text ? `Your line is now "${text}". /team say with nothing after it goes back to automatic lines.` : 'Back to automatic lines.'
    }
    case 'status': {
      if (!m) return NOT_IN_TEAM
      const text = rest.join(' ').replace(/^["']|["']$/g, '').trim()
      const r = await call<{ ok: boolean; status: string | null }>($, m.server, { method: 'PUT', path: `/teams/${m.teamId}/status`, key: m.key, body: { status: text } })
      if (!r.ok) return r.message
      await refresh($)
      return text ? `Your status is set: "${r.data.status ?? text}". /team status alone clears it.` : 'Status cleared.'
    }
    case 'handoff':
    case 'wave': {
      if (!m) return NOT_IN_TEAM
      const args = rest.join(' ')
      const usage = sub === 'handoff' ? 'Use /team handoff <name> <note>.' : 'Use /team wave <name>.'
      if (!args) return usage
      let snap = await read($, snapshot)
      if (!snap) {
        await refresh($)
        snap = await read($, snapshot)
        if (!snap) return (await read($, problem)) ?? 'Open /team to see the names.'
      }
      const target = targetOf(args, snap.members, m.memberId)
      if (!target || (sub === 'wave' && target.rest)) return `No one on the team is called ${args}. Open /team to see the names.`
      if (sub === 'handoff' && !target.rest) return usage
      const r = await call($, m.server, { method: 'POST', path: `/teams/${m.teamId}/signals`, key: m.key, body: { kind: sub, to: target.member.id, ...(sub === 'handoff' ? { text: target.rest } : {}) } })
      if (!r.ok) return r.message
      await refresh($)
      return sub === 'handoff' ? `Handoff sent to ${target.member.name}. It waits on their team panel until they take or dismiss it.` : `You waved at ${target.member.name}. A small hand shows on your animal for 12 hours.`
    }
    case 'win': {
      if (!m) return NOT_IN_TEAM
      const text = rest.join(' ').replace(/^["']|["']$/g, '').trim()
      if (!text) return 'Use /team win <note>.'
      const r = await call($, m.server, { method: 'POST', path: `/teams/${m.teamId}/signals`, key: m.key, body: { kind: 'win', text } })
      if (!r.ok) return r.message
      await refresh($)
      return 'Shared with the team for 48 hours.'
    }
    case 'signals': {
      if (rest.length !== 1 || (rest[0] !== 'on' && rest[0] !== 'off')) return 'Use /team signals on|off.'
      const hidden = rest[0] === 'off'
      await $.store.set('signalsHidden', hidden)
      // Redraw the panel's local choice without a server call. Handoffs stay visible either way.
      await update($, snapshot, value => value ? { ...value } : value)
      return hidden ? 'Waves and wins are hidden on this Mac. Handoffs still show.' : 'Waves and wins show on this Mac.'
    }
    case 'clock': {
      if (!m) return NOT_IN_TEAM
      const choice = rest.join(' ')
      const usage = "Use /team clock on to share this Mac's time zone, /team clock <IANA> to share another, or /team clock off to hide it."
      if (!choice) {
        await refresh($)
        const snap = await read($, snapshot)
        const tz = snap?.members.find(x => x.id === m.memberId)?.tz
        return `${tz ? `Your clock uses ${tz}.` : 'Your local clock is hidden.'} ${usage}`
      }
      const tz = choice === 'off' ? '' : choice === 'on' ? Intl.DateTimeFormat().resolvedOptions().timeZone : choice
      const r = await call<{ ok: boolean; tz: string | null }>($, m.server, { method: 'PUT', path: `/teams/${m.teamId}/clock`, key: m.key, body: { tz } })
      if (!r.ok) return r.message
      await refresh($)
      const snap = await read($, snapshot)
      const at = await read($, fetchedAt)
      const now = snap ? snap.now + Math.max(0, Date.now() - at) : await $.clock.now()
      const label = clockLabel(r.data.tz, now)
      return label ? `Your local time now shows as ${label}. /team clock off hides it.` : 'Your local clock is hidden.'
    }
    case 'name': {
      if (!m) return NOT_IN_TEAM
      const name = cleanName(rest.join(' '))
      if (!name) return 'Use /team name <your new name>, for example /team name Linh.'
      const r = await call<{ ok: boolean; name: string }>($, m.server, { method: 'PUT', path: `/teams/${m.teamId}/name`, key: m.key, body: { name } })
      if (!r.ok) return r.message
      const stored = r.data.name ?? name
      await $.store.set('membership', { ...m, name: stored })
      await refresh($)
      return `You are now ${stored} on the team.`
    }
    case 'code': {
      if (!m?.isAdmin) return 'Only the team admin can change the join code.'
      const r = await call<any>($, m.server, { method: 'POST', path: `/teams/${m.teamId}/code`, key: m.key })
      if (!r.ok) return r.message
      await $.store.set('membership', { ...m, joinCode: r.data.joinCode })
      return `New join code: ${r.data.joinCode}. The old one no longer works.`
    }
    case 'remove': {
      if (!m?.isAdmin) return 'Only the team admin can remove someone.'
      const snap = await read($, snapshot)
      const who = snap?.members.find(x => x.name.toLowerCase() === rest.join(' ').toLowerCase())
      if (!who) return 'No one on the team has that name. Open /team to see the names.'
      const r = await call($, m.server, { method: 'DELETE', path: `/teams/${m.teamId}/members/${who.id}`, key: m.key })
      if (!r.ok) return r.message
      await refresh($)
      return `Removed ${who.name}. Their shared data was deleted.`
    }
    case 'server':
      if (!rest[0]) return `Team server: ${srv}`
      await $.store.set('server', rest[0])
      return `Team server set to ${rest[0]} for new teams. Run /team join or /team create to use it.`
    default:
      return 'Commands: /team, create, join, device, web, leave, pause, resume, say, status, clock, handoff, wave, win, signals, name, code, remove, server.'
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({ name: COMMAND, description: "See your teammates' Claude Code sessions" })
    void beat($).catch(() => {})
    beatTimer?.cancel()
    readTimer?.cancel()
    beatTimer = $.clock.every(HEARTBEAT_MS, () => void beat($).catch(() => {}))
    // The panel needs fresh reads every tick; the presence line alone is fine with every second one.
    readTimer = $.clock.every(READ_MS, async () => {
      await follow($)
      readTick += 1
      if (readTick % 2 === 0 || (await paneState($)) === 'shown') void refresh($).catch(() => {})
    })
    // Bring the panel back if it was open when the last session ended; the first refresh below draws it.
    if ((await membership($)) && (await $.store.get('panelPinned')) === true) {
      // The engine may hold an unasked open back in a narrow window (split view); the pin stays and the pane seats itself once there is room.
      void $.ui.open({ id: PANE, title: 'Team' }).catch(() => {})
    }
    void refresh($).catch(() => {})
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (!e.text.startsWith('/')) {
      lastTurnAt = await $.clock.now()
      lastPrompt = e.text
      void writeLine($).catch(() => {})
    }
    return next(e)
  })

  // A long turn keeps the session working: every tool call and the end of the turn count as activity.
  on('tool.call', async ($, e, next) => {
    lastTurnAt = await $.clock.now()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    lastTurnAt = await $.clock.now()
    return next(e)
  })

  on('command.run', { command: 'team' }, async ($, e) => ({ text: await runCommand($, e.args) }))

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      const current = (await $.store.get('panelPinned')) === true
      const pinned = pinnedAfterClose(e.origin.kind, current)
      if (pinned !== current) await $.store.set('panelPinned', pinned)
    }
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== 'murror') return next(e)
    if (e.element.startsWith('expand:')) {
      const id = e.element.slice('expand:'.length)
      await update($, expanded, list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))
    } else if (e.element.startsWith('take:') || e.element.startsWith('dismiss:')) {
      const action = e.element.startsWith('take:') ? 'take' : 'dismiss'
      const id = e.element.slice(action.length + 1)
      const m = await membership($)
      if (!m) {
        await update($, problem, () => NOT_IN_TEAM)
      } else {
        const r = await call($, m.server, { method: 'PUT', path: `/teams/${m.teamId}/signals/${encodeURIComponent(id)}`, key: m.key, body: { action } })
        if (r.ok) await refresh($)
        else await update($, problem, () => r.message)
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'team' }, async ($, e) => {
    const snap = await read($, snapshot)
    const at = await read($, fetchedAt)
    const agoMs = at ? Math.max(0, Date.now() - at) : 0
    return drawPanel($.ui.resolve(e), e.surface, {
      rows: snap ? buildRows(snap, agoMs) : [],
      snapshot: snap,
      problem: await read($, problem),
      expanded: await read($, expanded),
      fetchedAgoMs: agoMs,
      onExpand: () => {},
      signalsHidden: (await $.store.get('signalsHidden')) === true,
      joined: (await membership($)) !== null
    })
  })
}
