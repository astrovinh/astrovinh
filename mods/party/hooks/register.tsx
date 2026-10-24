import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { AgentRecord, AgentStats, MainFacts, PartySettings, PartySize, RosterView, SessionSnapshot, SessionView } from '../types'
import { drawPanel } from './draw'
import { buildRows, cleanTodos, elapsed, rememberAgents, toolKind } from './roster'
import { mergeSessions, statusLine } from './sessions'
import { followAction, paneStateOf, pinnedAfterClose } from './pin'
import { COMMANDS, DEFAULT_SETTINGS } from './settings'

const PANE = 'party'
const EMPTY: RosterView = { rows: [], total: 0, working: 0, blocked: 0, overflow: 0, now: 0, session: '' }
const roster = atom({ plugin: 'party', key: 'roster' } as const, EMPTY)
const expanded = atom({ plugin: 'party', key: 'expanded' } as const, [] as string[])
const settings = atom({ plugin: 'party', key: 'settings' } as const, DEFAULT_SETTINGS)

let agents: AgentRecord[] = []
let stats: Record<string, AgentStats> = {}
let main: MainFacts | null = null
let session = ''
let sessionId = ''
let signature = ''
let timer: { cancel: () => void } | null = null
let heartbeat: { cancel: () => void } | null = null
let interval = 0
let refreshing = false
let active = false
let continuing = false
let generation = 0
let own: SessionSnapshot | null = null
let published = ''
let publishedAt = 0
let publishing = false
let lastStatus: string | null = null
let settingsRevision = 0

async function syncSettings($: any) {
  const revision = ++settingsRevision
  const motion = await $.store.get('motion')
  const size = await $.store.get('size')
  const next: PartySettings = {
    motion: typeof motion === 'boolean' ? motion : DEFAULT_SETTINGS.motion,
    size: size === 'tiny' || size === 'small' || size === 'medium' ? size : DEFAULT_SETTINGS.size
  }
  const current = await read($, settings)
  if (revision !== settingsRevision) return
  if (current.motion !== next.motion || current.size !== next.size) {
    await update($, settings, previous => revision === settingsRevision ? next : previous)
  }
}

async function paneShown($: any) {
  // Older Claude Code has no ui.panes, so calling it throws at once (not as a rejected promise): that lands in the catch as closed, and /party still opens.
  // No typeof probe on $.ui.panes: the validator only allows $.noun.event(...) calls.
  try {
    return (await $.ui.panes()).some((p: { id: string; isShown: boolean }) => p.id === PANE && p.isShown)
  } catch {
    return false
  }
}

async function paneState($: any) {
  // Older Claude Code has no ui.panes, so calling it throws at once (not as a rejected promise): that lands in the catch as closed, and /party still opens.
  // No typeof probe on $.ui.panes: the validator only allows $.noun.event(...) calls.
  try { return paneStateOf(await $.ui.panes(), PANE) }
  catch { return 'closed' as const }
}

async function follow($: any) {
  try {
    const action = followAction((await $.store.get('panelPinned')) === true, await paneState($))
    if (action === 'open') await $.ui.open({ id: PANE, title: 'Party' })
    else if (action === 'close') await $.ui.close({ id: PANE })
  } catch {
    // A store or UI failure must not stop this session's read timer.
  }
}

async function publish($: any) {
  if (!active || !own || publishing) return
  publishing = true
  const snapshot = own
  const cycle = generation
  const key = `s:${snapshot.id}`
  try {
    const now = await $.clock.now()
    if (!active || cycle !== generation) return
    const next = JSON.stringify({ ...snapshot, at: undefined })
    if (published !== next || now - publishedAt >= 10000) {
      await $.store.set(key, { ...snapshot, at: now })
      // An in-flight write must not resurrect a session that ended while it awaited the store.
      if (!active || cycle !== generation || snapshot.id !== sessionId) await $.store.delete(key)
      else { published = next; publishedAt = now }
    }
  } catch {
    // Keep the last successful signature so a failed write retries next tick.
  } finally { publishing = false }
}

async function otherSessions($: any, now: number): Promise<SessionView[]> {
  const others: SessionView[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith('s:') || key === `s:${sessionId}`) continue
    try {
      const entry = await $.store.get(key) as SessionSnapshot | undefined
      if (!entry || key !== `s:${entry.id}` || typeof entry.label !== 'string' || !Number.isFinite(entry.at) || !Array.isArray(entry.agents)) continue
      if (now - entry.at > 120000) await $.store.delete(key)
      else others.push({ id: entry.id, label: entry.label, at: entry.at, agents: entry.agents.slice(0, 12) })
    } catch {
      // One disappearing key must not hide the remaining live sessions.
    }
  }
  return others
}

const schedule = ($: any, shown: boolean) => {
  const ms = shown ? 3000 : 10000
  if (timer && interval === ms) return
  const replacement = $.clock.every(ms, () => refresh($).catch(() => {}))
  timer?.cancel()
  interval = ms
  timer = replacement
}

const refresh = async ($: any, followPin = true) => {
  if ((!active && !continuing) || refreshing) return
  refreshing = true
  const cycle = generation
  try {
    // Preferences redraw independently, even when the roster is unchanged or unavailable.
    try { await syncSettings($) } catch {}
    if (continuing) {
      const id = await $.session.id()
      if (cycle !== generation || id === sessionId) return
      const repo = await $.session.repo().catch(() => null)
      const label = (repo?.root || await $.session.cwd()).replace(/\/+$/, '').split('/').pop() || 'This session'
      const now = await $.clock.now()
      if (cycle !== generation) return
      sessionId = id
      session = label
      main ??= { startedAt: now, endedAt: now, working: false }
      continuing = false
      active = true
    }
    if (followPin) await follow($)
    schedule($, await paneShown($))
    const now = await $.clock.now()
    const live = await $.agent.list()
    if (!active || cycle !== generation) return
    agents = rememberAgents(live, agents, now)
    const local = buildRows({ agents, stats, main, now })
    own = { id: sessionId, label: session, at: now, agents: local.rows }
    await publish($)
    const counts = { total: local.total, working: local.working, blocked: local.blocked, overflow: local.overflow }
    const sessions = mergeSessions({ ...own, counts }, await otherSessions($, now), now)
    if (!active || cycle !== generation) return
    const view = { ...local, now, session, sessions }
    const status = statusLine(sessions)
    if (lastStatus !== (status ?? '')) {
      try { await $.ui.status(status); lastStatus = status ?? '' } catch {}
    }
    if (!active || cycle !== generation) return
    // Elapsed labels and unmeasured activity are the only clock-driven redraws.
    const nextSignature = JSON.stringify({ ...view, now: undefined,
      sweep: sessions.some(s => s.agents.some(r => r.state === 'running' && !r.todo)) ? Math.floor(now / 3000) : undefined,
      sessions: sessions.map(s => ({ ...s, at: undefined, times: s.agents.map(r => elapsed((r.endedAt ?? now) - r.startedAt)) })) })
    if (signature !== nextSignature) {
      await update($, roster, () => view)
      if (cycle === generation) signature = nextSignature
    }
  } catch {
    // Preserve the last good picture and retry on the next interval.
  } finally {
    refreshing = false
  }
}


export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      timer?.cancel()
      heartbeat?.cancel()
      timer = null
      heartbeat = null
      active = true
      continuing = false
      generation += 1
      agents = []
      stats = {}
      signature = ''
      own = null
      published = ''
      publishedAt = 0
      lastStatus = null
      const now = await $.clock.now()
      main = { startedAt: now, endedAt: now, working: false }
      const repo = await $.session.repo().catch(() => null)
      sessionId = await $.session.id()
      session = (repo?.root || await $.session.cwd()).replace(/\/+$/, '').split('/').pop() || 'This session'
      await $.command.register({ name: PANE, description: 'See your agents in Party' })
    } catch {}
    try { schedule($, false) } catch {}
    // Publication has its own clock so a 3-second read cadence never delays a 10-second heartbeat.
    try { heartbeat = $.clock.every(1000, () => void publish($)) } catch {}
    await refresh($)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    active = false
    generation += 1
    continuing = e.reason === 'clear' || e.reason === 'resume'
    if (continuing) {
      // These transitions keep the process but never fire session.start again.
      // Clear old facts now so the next session's early turn/tool events survive its first read.
      agents = []
      stats = {}
      main = null
      own = null
      signature = ''
      published = ''
      publishedAt = 0
      lastStatus = null
    } else {
      timer?.cancel()
      heartbeat?.cancel()
      timer = null
      heartbeat = null
    }
    try { await $.store.delete(`s:${sessionId}`) } catch {}
    try { await $.ui.status(undefined) } catch {}
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    try {
      const id = e.agentId ?? 'main'
      const previous = stats[id]
      stats[id] = { tools: (previous?.tools ?? 0) + 1, tool: toolKind(e.tool), todos: e.tool === 'TodoWrite' ? cleanTodos(e.todos) : previous?.todos ?? [] }
    } catch {}
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    try {
      const now = await $.clock.now()
      main = { startedAt: main?.startedAt ?? now, endedAt: null, working: true }
    } catch {}
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    try {
      if (!e.agentId && main) main = { ...main, working: false, endedAt: await $.clock.now() }
    } catch {}
    return next(e)
  })

  on('command.run', { command: PANE }, async ($, e) => {
    const args = e.args.trim().split(/\s+/)
    if (args[0]) {
      const [name, value] = args
      const motion = name === 'motion' && (value === 'on' || value === 'off')
      const size = name === 'size' && (value === 'tiny' || value === 'small' || value === 'medium')
      if (args.length !== 2 || (!motion && !size)) return { text: COMMANDS }
      try {
        // Separate keys keep a size change from overwriting another session's motion choice.
        if (motion) await $.store.set('motion', value === 'on')
        else await $.store.set('size', value as PartySize)
        await syncSettings($)
        return { text: `Party ${name} ${value}.` }
      } catch { return { text: 'Party could not save that setting. Try again.' } }
    }
    try {
      const shown = (await paneState($)) === 'shown'
      await $.store.set('panelPinned', !shown)
      if (shown) await $.ui.close({ id: PANE })
      else await $.ui.open({ id: PANE, title: 'Party' })
      schedule($, !shown)
      await refresh($, false)
      return { text: shown ? 'Party panel closed.' : 'Party panel opened.' }
    } catch { return { text: 'Party could not open. Try /party again.' } }
  })

  on('ui.close', async ($, e, next) => {
    try {
      if (e.id === PANE) {
        const current = (await $.store.get('panelPinned')) === true
        const pinned = pinnedAfterClose(e.origin.kind, current)
        if (pinned !== current) await $.store.set('panelPinned', pinned)
      }
    } catch {}
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    try {
      if (e.plugin === 'party' && e.element.startsWith('expand:')) {
        const id = e.element.slice('expand:'.length)
        if (id !== sessionId) await update($, expanded, list => list.includes(id) ? list.filter(x => x !== id) : [...list, id])
      }
    } catch {}
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    try { return drawPanel($.ui.resolve(e), e.surface, { ...await read($, roster), expanded: await read($, expanded), settings: await read($, settings) }, e.viewport?.columns) }
    catch { return { type: 'Box', props: {}, children: [] } }
  })
}
