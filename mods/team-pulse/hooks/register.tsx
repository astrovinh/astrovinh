import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Membership, Snapshot } from '../types'
import { backoffMs, parseJoinCode, requestOf, resultOf, UNREACHABLE } from './client'
import type { CallResult } from './client'
import { COMMAND, DEFAULT_SERVER, HEARTBEAT_MS, PANE, READ_MS, TIMEOUT_MS } from './config'
import { cleanLine, fallbackLine, lineDue, lineRequest } from './line'
import { drawPanel } from './panel'
import { presenceLine } from './presence'
import { buildRows } from './rows'
import { basename, buildHeartbeat } from './share'

const snapshot = atom({ plugin: 'team-pulse', key: 'snapshot' } as const, null as Snapshot | null)
const fetchedAt = atom({ plugin: 'team-pulse', key: 'fetchedAt' } as const, 0)
const problem = atom({ plugin: 'team-pulse', key: 'problem' } as const, null as string | null)
const expanded = atom({ plugin: 'team-pulse', key: 'expanded' } as const, [] as string[])

// This session's own facts; a reload starts them over, which only delays one heartbeat.
const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')
let cwd = ''
let lastTurnAt = 0
let lastPrompt = ''
let line: string | null = null
let lineAt: number | null = null
let beatFailures = 0
let nextBeatAt = 0
let panelOpen = false
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
  const u = await $.session.usage().catch(() => null)
  const branch = await branchOf($)
  const said = (await $.store.get('said')) as string | null | undefined
  const hb = buildHeartbeat({
    session: sessionId,
    cwd,
    branch,
    line: said || line || fallbackLine(basename(cwd), branch),
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
      hasSnapshot: snap !== null
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
  lineAt = now
  const r = await $.model.complete(lineRequest(lastPrompt)).catch(() => null)
  const clean = r && r.isAnswered ? cleanLine(r.text) : null
  if (clean && clean !== line) {
    line = clean
    await showPresence($)
  }
}

async function openPanel($: any) {
  panelOpen = true
  await $.ui.open({ id: PANE, title: 'Team' })
  await refresh($)
}

async function runCommand($: any, args: string): Promise<string> {
  const [sub = '', ...rest] = args.trim().split(/\s+/)
  const m = await membership($)
  const srv = await serverOf($)

  switch (sub) {
    case '':
      if (panelOpen) {
        panelOpen = false
        await $.ui.close({ id: PANE })
        return 'Team panel closed.'
      }
      await openPanel($)
      return 'Team panel opened.'
    case 'create': {
      const [team, ...name] = rest
      if (!team || !name.length) return 'Use /team create <team> <your name>, for example /team create Murror Astro.'
      const r = await call<any>($, srv, { method: 'POST', path: '/teams', body: { team, name: name.join(' ') } })
      if (!r.ok) return r.message
      await $.store.set('membership', { server: srv, teamId: r.data.teamId, team: r.data.team, memberId: r.data.memberId, key: r.data.key, name: name.join(' '), isAdmin: true, joinCode: r.data.joinCode })
      nextBeatAt = 0
      await beat($).catch(() => {})
      await openPanel($)
      return `Created ${r.data.team}. Teammates join with: /team join ${r.data.joinCode} <their name>`
    }
    case 'join': {
      const [code = '', ...name] = rest
      const parsed = parseJoinCode(code)
      if (!parsed || !name.length) return 'Use /team join <code> <your name>. Ask the team admin for the code.'
      const r = await call<any>($, srv, { method: 'POST', path: `/teams/${parsed.teamId}/join`, body: { code: parsed.secret, name: name.join(' ') } })
      if (!r.ok) return r.message
      await $.store.set('membership', { server: srv, teamId: r.data.teamId, team: r.data.team, memberId: r.data.memberId, key: r.data.key, name: name.join(' '), isAdmin: false })
      nextBeatAt = 0
      await beat($).catch(() => {})
      await openPanel($)
      return `Joined ${r.data.team}. Your sessions are shared from now on; /team pause stops it.`
    }
    case 'leave': {
      if (!m) return 'You are not in a team.'
      const r = await call($, m.server, { method: 'POST', path: `/teams/${m.teamId}/leave`, key: m.key })
      if (!r.ok) return r.message
      await $.store.delete('membership')
      $.ui.status(undefined)
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
      return 'Commands: /team, create, join, leave, pause, resume, say, code, remove, server.'
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
    readTimer = $.clock.every(READ_MS, () => {
      readTick += 1
      if (panelOpen || readTick % 2 === 0) void refresh($).catch(() => {})
    })
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
    if (e.id === PANE) panelOpen = false
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== 'team-pulse' || !e.element.startsWith('expand:')) return next(e)
    const id = e.element.slice('expand:'.length)
    await update($, expanded, list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))
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
      joined: (await membership($)) !== null
    })
  })
}
