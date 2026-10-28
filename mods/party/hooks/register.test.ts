import { test, expect, mock } from 'claude-code/testing'
import type { AgentInfo, On, UiPane } from 'claude-code'
import { register } from './register'
import type { RosterView } from '../types'

const NOW = 1_800_000_000_000
const command = { command: 'party', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } }
const start = { cwd: '/tmp/party-test', surface: 'terminal' as const, isInteractive: true }
const setup = (on: On, initial: Record<string, unknown> = {}, realState = false) => {
  const clock = mock.clock(on, { now: NOW })
  const state = { roster: { rows: [], total: 0, working: 0, blocked: 0, overflow: 0, now: NOW, session: '' } as RosterView }
  const store: Record<string, any> = { ...initial }
  const published: { key: string; value: any }[] = []
  const deleted: string[] = []
  const statuses: (string | undefined)[] = []
  const expanded = { value: [] as string[] }
  const settings = { value: { motion: true, size: 'small' } }
  const panes: UiPane[] = []
  const agents: AgentInfo[] = [{ id: 'a', type: 'Explore', description: 'Map hooks', status: 'running' }]
  const writes: RosterView[] = []
  const calls: string[] = []
  const fail = { list: false, state: false, panes: false }
  let reads = 0
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 's1' }))
  on('session.cwd', () => ({ value: '/tmp/party-test' }))
  on('session.repo', () => ({ value: null }))
  on('agent.list', () => { reads++; if (fail.list) throw new Error('List unavailable'); return { value: [...agents] } })
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => { store[e.key] = e.value; published.push({ key: e.key, value: e.value }); return { value: undefined } })
  on('store.delete', (_, e) => { delete store[e.key]; deleted.push(e.key); return { value: undefined } })
  on('store.keys', () => ({ value: Object.keys(store) }))
  on('ui.status', (_, e) => { statuses.push(e.text); return { value: undefined } })
  if (!realState) {
    on('state.get', (_, e) => ({ value: { value: e.key === 'expanded' ? expanded.value : e.key === 'settings' ? settings.value : state.roster, version: 1 }, version: 1 }))
    on('state.set', (_, e) => { if (fail.state) throw new Error('State unavailable'); if (e.key === 'expanded') expanded.value = e.value as string[]; else if (e.key === 'settings') settings.value = e.value as typeof settings.value; else { state.roster = e.value as RosterView; writes.push(state.roster) } return { value: { isSet: true, version: 2 }, version: 2 } })
  }
  on('ui.panes', () => { if (fail.panes) throw new Error('Panes unavailable'); return { value: panes } })
  on('ui.open', (_, e) => { calls.push('open'); panes.push({ id: e.id, title: 'Party', isShown: true, isFocused: false, isPlaced: true }); return { value: { isPlaced: true } } })
  on('ui.close', () => { calls.push('close'); panes.length = 0; return { value: undefined } })
  on('tool.call', () => ({ result: 'Tool result', text: 'Tool result' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return { clock, state, panes, agents, writes, calls, fail, store, published, deleted, statuses, expanded, settings, reads: () => reads }
}

test('/party opens then closes its own pane', async ($, on) => {
  const p = setup(on)
  await $.session.start(start)
  expect((await $.command.run(command)).text).toBe('Party panel opened.')
  expect((await $.command.run(command)).text).toBe('Party panel closed.')
  expect(p.calls).toEqual(['open', 'close'])
})

test('a refresh updates the roster and schedules ten-second ticks when panes throws', async ($, on) => {
  const p = setup(on)
  p.fail.panes = true
  await $.session.start(start)
  await p.clock.settle()
  expect(p.state.roster.rows.map(row => row.id)).toEqual(['main', 'a'])
  expect(p.writes).toHaveLength(1)
  const count = p.reads()
  p.agents[0]!.status = 'waiting'
  await p.clock.advance(9000)
  expect(p.reads()).toBe(count)
  await p.clock.advance(1000)
  expect(p.reads()).toBe(count + 1)
  expect(p.state.roster.blocked).toBe(1)
})

test('/party opens its pane when panes throws', async ($, on) => {
  const p = setup(on)
  p.fail.panes = true
  await $.session.start(start)
  expect((await $.command.run(command)).text).toBe('Party panel opened.')
  expect(p.calls).toEqual(['open'])
})

test('refreshes count every agent and update when a hidden agent becomes blocked', async ($, on) => {
  const p = setup(on)
  p.agents.splice(0, p.agents.length, ...Array.from({ length: 15 }, (_, i) => ({ id: String(i), type: 'Explore', description: `Task ${i}`, status: 'running' as const })))
  await $.session.start(start)
  expect(p.state.roster.rows).toHaveLength(12)
  expect([p.state.roster.total, p.state.roster.working, p.state.roster.blocked, p.state.roster.overflow]).toEqual([16, 15, 0, 4])
  expect(p.store['s:s1'].agents).toHaveLength(12)
  const visible = p.state.roster.rows.map(row => row.id)
  p.agents[14]!.status = 'waiting'
  await p.clock.advance(10000)
  expect(p.state.roster.rows.map(row => row.id)).toEqual(visible)
  expect([p.state.roster.working, p.state.roster.blocked, p.state.roster.overflow]).toEqual([14, 1, 4])
})

// tool.call's public helper deliberately strips agentId. Deliver the engine-stamped hook directly.
const hooks: Record<string, ($: any, e: any, next: any) => Promise<any>> = {}
register(((event: string, ...args: any[]) => { hooks[event] = args[args.length - 1] }) as On, {})

// The imported hook and engine-loaded hook live in different isolates. Keep stamped
// events and their timers/state together; other tests exercise the real dispatcher.
const stampedContext = () => {
  let value: RosterView | undefined
  const store: Record<string, any> = {}
  let expanded: string[] = []
  let settings = { motion: true, size: 'small' }
  let placed = false
  const flags = { timer: false }
  const timers: { ms: number; cancelled: boolean; fn: () => void }[] = []
  const context = {
    clock: { now: async () => NOW, every: (ms: number, fn: () => void) => {
      if (flags.timer) throw new Error('Timer unavailable')
      const timer = { ms, cancelled: false, fn }
      timers.push(timer)
      return { cancel: () => { timer.cancelled = true } }
    } },
    session: { repo: async () => null, cwd: async () => '/tmp/party-test', id: async () => 's1' },
    store: { get: async (_key: string): Promise<any> => store[_key], set: async (key: string, value: any) => { store[key] = value }, keys: async () => Object.keys(store), delete: async (key: string) => { delete store[key] } },
    command: { register: async () => ({ command: 'party' }) },
    agent: { list: async () => [{ id: 'a', type: 'Explore', description: 'Map hooks', status: 'running' }] },
    state: {
      get: async (ref: { key: string }) => ({ value: ref.key === 'expanded' ? expanded : ref.key === 'settings' ? settings : value, version: 1 }),
      set: async (ref: { key: string }, nextValue: any) => { if (ref.key === 'expanded') expanded = nextValue; else if (ref.key === 'settings') settings = nextValue; else value = nextValue; return { isSet: true, version: 2 } }
    },
    ui: { status: async (_text?: string) => {}, panes: async () => placed ? [{ id: 'party', isShown: true, isPlaced: true }] : [], open: async () => { placed = true }, close: async () => { placed = false } }
  }
  return { context, flags, timers, store, settings: () => settings, view: () => value!, refresh: () => hooks['command.run']!(context, command, async () => ({})) }
}

test('a synchronous panes error still updates the roster and keeps a ten-second timer', async () => {
  const p = stampedContext()
  p.context.ui.panes = () => { throw new Error('ui.panes is unavailable') }
  await hooks['session.start']!(p.context, start, async () => ({ cwd: start.cwd }))
  expect(p.view()?.rows.map(row => row.id)).toEqual(['main', 'a'])
  expect(p.timers.map(timer => [timer.ms, timer.cancelled])).toEqual([[10000, false], [1000, false]])
  expect((await p.refresh()).text).toBe('Party panel opened.')
  expect(p.timers.filter(timer => !timer.cancelled).map(timer => timer.ms).sort((a, b) => a - b)).toEqual([1000, 10000])
})

test('a failed timer replacement preserves the previous refresh timer', async () => {
  const p = stampedContext()
  await hooks['session.start']!(p.context, start, async () => ({ cwd: start.cwd }))
  expect(p.timers.filter(timer => timer.ms !== 1000)).toHaveLength(1)
  p.flags.timer = true
  await p.refresh()
  expect(p.timers[0]!.cancelled).toBe(false)
  p.flags.timer = false
  await p.refresh()
  await p.refresh()
  expect(p.timers.length > 1).toBe(true)
})

test('tool calls count under their agent id or main and TodoWrite sets and clears progress', async () => {
  const p = stampedContext()
  const $ = p.context
  await hooks['session.start']!($, start, async () => ({ cwd: start.cwd }))
  const next = async (e: any) => ({ text: e.tool })
  expect(await hooks['tool.call']!($, { agentId: 'a', tool: 'Read' }, next)).toEqual({ text: 'Read' })
  await hooks['tool.call']!($, { tool: 'Bash', command: 'safe test input' }, next)
  await hooks['tool.call']!($, { agentId: 'a', tool: 'TodoWrite', todos: [{ status: 'completed', activeForm: 'Done' }, { status: 'in_progress', activeForm: 'Mapping hooks' }] }, next)
  await p.refresh()
  const [main, a] = p.view().rows
  expect(main!.tools).toBe(1)
  expect(main!.tool).toBe('run')
  expect(a!.tools).toBe(2)
  expect(a!.todo).toEqual({ done: 1, total: 2 })
  expect(a!.line).toBe('Mapping hooks')
  await hooks['tool.call']!($, { agentId: 'a', tool: 'TodoWrite', todos: [] }, next)
  await p.refresh()
  expect(p.view().rows[1]!.todo).toBe(null)
})

test('main turn events change working state while subagent completion leaves it alone', async () => {
  const p = stampedContext()
  const $ = p.context
  await hooks['session.start']!($, start, async () => ({ cwd: start.cwd }))
  const next = async () => ({ value: undefined })
  await hooks['turn.start']!($, { turnId: 't1', text: '' }, next)
  await p.refresh()
  expect(p.view().rows[0]!.state).toBe('running')
  await hooks['turn.complete']!($, { agentId: 'a' }, next)
  await p.refresh()
  expect(p.view().rows[0]!.state).toBe('running')
  await hooks['turn.complete']!($, {}, next)
  await p.refresh()
  expect(p.view().rows[0]!.state).toBe('idle')
})

test('refresh writes one roster atom only when rows or displayed elapsed time change', async ($, on) => {
  const p = setup(on)
  p.agents[0]!.status = 'completed'
  await $.session.start(start)
  await p.clock.settle()
  const count = p.writes.length
  expect(count > 0).toBe(true)
  await p.clock.advance(10000)
  expect(p.writes.length).toBe(count)
  p.agents[0]!.status = 'waiting'
  await p.clock.advance(10000)
  expect(p.writes.length).toBe(count + 1)
  expect(p.state.roster.blocked).toBe(1)
})

test('refresh cadence follows shown panes including an external close', async ($, on) => {
  const p = setup(on)
  await $.session.start(start)
  await p.clock.settle()
  let count = p.reads()
  await p.clock.advance(9000)
  expect(p.reads()).toBe(count)
  await p.clock.advance(1000)
  expect(p.reads()).toBe(count + 1)
  await $.command.run(command)
  count = p.reads()
  await p.clock.advance(3000)
  expect(p.reads()).toBe(count + 1)
  p.panes.length = 0
  p.store.panelPinned = false
  await p.clock.advance(3000)
  count = p.reads()
  await p.clock.advance(9000)
  expect(p.reads()).toBe(count)
  await p.clock.advance(1000)
  expect(p.reads()).toBe(count + 1)
})

for (const kind of ['list', 'state', 'panes'] as const) {
  test(`a ${kind} failure does not stop later refresh ticks`, async ($, on) => {
    const p = setup(on)
    await $.session.start(start)
    p.fail[kind] = true
    p.agents[0]!.status = 'waiting'
    await p.clock.advance(10000)
    p.fail[kind] = false
    await p.clock.advance(10000)
    expect(p.state.roster.blocked).toBe(1)
  })
}

test('render hook passes pane viewport columns through to the visible hairline width', async () => {
  const p = stampedContext()
  await hooks['session.start']!(p.context, start, async () => ({ cwd: start.cwd }))
  for (const [columns, width] of [[undefined, 200], [20, 120], [44, 232], [80, 320]] as const) {
    const meters: { width: number; height: number }[] = []
    const component = (props: any) => props.children ?? null
    const context = { ...p.context, ui: { ...p.context.ui, resolve: () => ({ Box: component, Text: component, Svg: (props: any) => {
      if (props.height === 3) meters.push(props)
      return null
    } }) } }
    await hooks['ui.render']!(context, { surface: 'desktop', viewport: columns === undefined ? undefined : { columns, rows: 40 } }, async () => ({}))
    // The idle main row has no bar; only the running scout supplies a hairline.
    expect(meters).toHaveLength(1)
    expect(meters.map(meter => [meter.width, meter.height])).toEqual([[width, 3]])
  }
})

test('render hook mounts the actual desktop and terminal panes', async ($, on) => {
  const p = setup(on)
  await $.session.start(start)
  await p.clock.settle()
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'party', surface, component: 'Pane', requestId: 'party', props: { title: 'Party', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
    expect(JSON.stringify(await ui.drawn())).toContain('Map hooks')
    await ui.unmount()
  }
})

const foreign = (id: string, at = NOW, label = 'Debug26') => ({ id, label, at, agents: [{
  id: 'main', main: true, slot: 'lead', animal: 'ember', name: 'Ember', role: 'Lead', state: 'waiting',
  line: 'Waiting on background work', tool: 'think', tools: 0, startedAt: NOW, endedAt: null, todo: null
}] })

test('publishes one compact session key only on roster change or the ten-second heartbeat', async ($, on) => {
  const p = setup(on)
  await $.session.start(start)
  expect(p.published.filter(w => w.key.startsWith('s:'))).toHaveLength(1)
  expect(Object.keys(p.store['s:s1']).sort()).toEqual(['agents', 'at', 'counts', 'id', 'label', 'quietSince', 'startedAt'])
  expect(p.store['s:s1'].id).toBe('s1')
  expect(p.store['s:s1'].label).toBe('party-test')
  expect(p.store['s:s1'].startedAt).toBe(NOW)
  await $.command.run(command)
  await p.clock.advance(9000)
  expect(p.published.filter(w => w.key.startsWith('s:'))).toHaveLength(1)
  p.agents[0]!.status = 'waiting'
  await $.command.run(command)
  expect(p.published.filter(w => w.key.startsWith('s:'))).toHaveLength(2)
  await p.clock.advance(9000)
  expect(p.published.filter(w => w.key.startsWith('s:'))).toHaveLength(2)
  await p.clock.advance(1000)
  expect(p.published.filter(w => w.key.startsWith('s:'))).toHaveLength(3)
  expect(p.published.filter(w => w.key.startsWith('s:')).every(w => w.value.agents.length <= 12)).toBe(true)
})

test('viewer retains foreign session starts and assigns its own lead without changing publication or counts', async ($, on) => {
  const p = setup(on, { 's:z-older': { ...foreign('z-older'), startedAt: NOW - 1 },
    's:a-newer': { ...foreign('a-newer'), startedAt: NOW + 1 } })
  await $.session.start(start)
  const sessions = p.state.roster.sessions!
  expect(sessions[0]!.id).toBe('s1')
  expect([...sessions].sort((a, b) => a.startedAt! - b.startedAt!).map(s => [s.id, s.startedAt, s.agents[0]!.animal])).toEqual([
    ['z-older', NOW - 1, 'ember'], ['s1', NOW, 'mochi'], ['a-newer', NOW + 1, 'biscuit']
  ])
  expect(p.store['s:s1'].agents[0].animal).toBe('ember')
  expect(sessions[0]!.counts).toEqual({ total: 2, working: 1, blocked: 0, overflow: 0, quiet: 0 })
  expect(p.statuses[p.statuses.length - 1]).toBe('party: 1 working, 2 need you')
})

test('session start timestamp stays fixed through heartbeats and later turns', async ($, on) => {
  const p = setup(on)
  await $.session.start(start)
  await p.clock.advance(3600000)
  expect(p.store['s:s1'].startedAt).toBe(NOW)
  expect(p.store['s:s1'].at).toBe(NOW + 3600000)
  await $.turn.start({ turnId: 'later', text: '' })
  await $.command.run(command)
  expect(p.store['s:s1'].startedAt).toBe(NOW)
  expect(p.state.roster.sessions![0]!.startedAt).toBe(NOW)
})

test('heartbeat repairs an own key lost to another process without changing the roster', async ($, on) => {
  const p = setup(on)
  await $.session.start(start)
  delete p.store['s:s1']
  await p.clock.advance(10000)
  expect(p.store['s:s1']?.at).toBe(NOW + 10000)
})

test('ignores stale foreign sessions and deletes only foreign keys older than two minutes', async ($, on) => {
  const p = setup(on, { 's:live': foreign('live'), 's:stale': foreign('stale', NOW - 25001), 's:old': foreign('old', NOW - 120001), 'unrelated': 7 })
  await $.session.start(start)
  expect((p.state.roster as any).sessions.map((s: any) => s.id)).toEqual(['s1', 'live'])
  expect(p.deleted).toEqual(['s:old'])
  expect(p.store['s:stale']).toBeDefined()
  expect(p.store.unrelated).toBe(7)
  await p.clock.advance(30000)
  expect((p.state.roster as any).sessions.map((s: any) => s.id)).toEqual(['s1'])
})

test('session end deletes its own key and cancels refresh without touching the pin', async () => {
  const p = stampedContext()
  await hooks['session.start']!(p.context, start, async () => ({}))
  p.store.panelPinned = true
  await hooks['session.end']!(p.context, { sessionId: 's1', reason: 'other' }, async () => ({}))
  expect(p.store['s:s1']).toBeUndefined()
  expect(p.store.panelPinned).toBe(true)
  expect(p.timers.every(t => t.cancelled)).toBe(true)
})

test('status line counts all live sessions then clears when nothing is working or blocked', async ($, on) => {
  const p = setup(on, { 's:other': foreign('other') })
  await $.session.start(start)
  expect(p.statuses[p.statuses.length - 1]).toBe('party: 1 working, 1 needs you')
  p.agents[0]!.status = 'completed'
  delete p.store['s:other']
  await p.clock.advance(10000)
  expect(p.statuses[p.statuses.length - 1]).toBeUndefined()
})

test('a session header press toggles persisted folding across pane remounts', async ($, on) => {
  const p = setup(on, { 's:other': foreign('other') })
  await $.session.start(start)
  const target = { plugin: 'party' as const, surface: 'desktop' as const, component: 'Pane' as const, requestId: 'party', props: { title: 'Party', isFocused: true, bodyColumns: 80, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} } }
  let ui = await $.ui.mount(target)
  expect(JSON.stringify(await ui.drawn()).includes('Waiting on background work')).toBe(false)
  await ui.press({ key: 'expand:other' })
  await ui.unmount()
  expect(p.expanded.value).toEqual(['other'])
  ui = await $.ui.mount(target)
  expect(JSON.stringify(await ui.drawn())).toContain('Waiting on background work')
  expect(JSON.stringify(await ui.drawn())).toContain('hide')
  await ui.press({ key: 'expand:other' })
  await ui.unmount()
  expect(p.expanded.value).toEqual([])
})

test('shared pin opens and closes this pane on ticks while a waiting pane is left to the engine', async ($, on) => {
  const p = setup(on, { panelPinned: true })
  await $.session.start(start)
  expect(p.calls).toEqual(['open'])
  p.panes[0]!.isPlaced = false
  p.panes[0]!.isShown = false
  await p.clock.advance(10000)
  expect(p.calls).toEqual(['open'])
  p.store.panelPinned = false
  await p.clock.advance(10000)
  expect(p.calls).toEqual(['open', 'close'])
})

test('uses the session noun for identity and the repository folder for its label', async () => {
  const p = stampedContext()
  p.context.session.id = async () => 'real-id'
  p.context.session.repo = async () => ({ root: '/projects/repository/', remote: null }) as any
  await hooks['session.start']!(p.context, { ...start, sessionId: 'wrong-id' }, async () => ({}))
  expect(p.store['s:real-id'].label).toBe('repository')
  expect(p.store['s:wrong-id']).toBeUndefined()
  expect((p.view().sessions ?? []).map(s => s.id)).toEqual(['real-id'])
})

test('a failed session write retries on the next heartbeat tick without waiting ten seconds', async () => {
  const p = stampedContext()
  const set = p.context.store.set
  p.context.store.set = async () => { throw new Error('Store unavailable') }
  await hooks['session.start']!(p.context, start, async () => ({}))
  expect(p.store['s:s1']).toBeUndefined()
  p.context.store.set = set
  await p.timers.find(t => t.ms === 1000)!.fn()
  // The clock handler launches async work without blocking the engine.
  await Promise.resolve()
  await Promise.resolve()
  expect(p.store['s:s1'].id).toBe('s1')
})

test('an in-flight session publication cannot resurrect its key after session end', async () => {
  const p = stampedContext()
  const set = p.context.store.set
  let release = () => {}
  let entered = () => {}
  const writing = new Promise<void>(resolve => { entered = resolve })
  const gate = new Promise<void>(resolve => { release = resolve })
  p.context.store.set = async (key, value) => { entered(); await gate; await set(key, value) }
  const starting = hooks['session.start']!(p.context, start, async () => ({}))
  await writing
  await hooks['session.end']!(p.context, { sessionId: 's1', reason: 'other' }, async () => ({}))
  release()
  await starting
  expect(p.store['s:s1']).toBeUndefined()
})

for (const reason of ['clear', 'resume']) {
  test(`${reason} follows the new session identity without another start and retains its early activity`, async () => {
    const p = stampedContext()
    await hooks['session.start']!(p.context, start, async () => ({}))
    await hooks['session.end']!(p.context, { sessionId: 's1', reason }, async () => ({}))
    expect(p.store['s:s1']).toBeUndefined()
    const tick = p.timers.find(t => t.ms === 10000 && !t.cancelled)
    expect(tick).toBeDefined()
    // No new identity yet: an old timer must not republish the ending session.
    await tick!.fn()
    expect(p.store['s:s1']).toBeUndefined()
    p.context.session.id = async () => 's2'
    await hooks['turn.start']!(p.context, { turnId: 'new' }, async () => ({}))
    await hooks['tool.call']!(p.context, { tool: 'Read' }, async () => ({}))
    await tick!.fn()
    expect(p.store['s:s2'].id).toBe('s2')
    expect(p.store['s:s1']).toBeUndefined()
    expect(p.view().sessions?.map(s => s.id)).toEqual(['s2'])
    expect(p.view().rows[0]!.state).toBe('running')
    expect(p.view().rows[0]!.tools).toBe(1)
  })
}

test('session end remains best effort when deleting its key throws', async () => {
  const p = stampedContext()
  await hooks['session.start']!(p.context, start, async () => ({}))
  p.context.store.delete = async () => { throw new Error('Store unavailable') }
  expect(await hooks['session.end']!(p.context, { sessionId: 's1' }, async () => 'continued')).toBe('continued')
  expect(p.timers.every(t => t.cancelled)).toBe(true)
})

test('folding survives session initialization and ignores presses for another plugin or the own session', async () => {
  const p = stampedContext()
  await p.context.state.set({ key: 'expanded' }, ['other'])
  await hooks['session.start']!(p.context, start, async () => ({}))
  const next = async () => 'continued'
  expect(await hooks['ui.press']!(p.context, { plugin: 'elsewhere', element: 'expand:foreign' }, next)).toBe('continued')
  await hooks['ui.press']!(p.context, { plugin: 'party', element: 'expand:s1' }, next)
  expect((await p.context.state.get({ key: 'expanded' })).value).toEqual(['other'])
})

test('a broken foreign key does not hide healthy sessions and the two-minute boundary is retained', async ($, on) => {
  const p = setup(on, { 's:bad': null, 's:wrong': foreign('mismatched'), 's:edge': foreign('edge', NOW - 120000), 's:live': foreign('live') })
  await $.session.start(start)
  expect((p.state.roster.sessions ?? []).map(s => s.id)).toEqual(['s1', 'live'])
  expect(p.deleted).toEqual([])
})

for (const kind of ['person', 'plugin', 'unload'] as const) {
  test(`a ${kind} close ${kind === 'person' ? 'clears' : 'preserves'} the shared pin`, async () => {
    const p = stampedContext()
    await hooks['session.start']!(p.context, start, async () => ({}))
    p.store.panelPinned = true
    const e = { id: 'party', origin: { kind } }
    expect(await hooks['ui.close']!(p.context, e, async (e: any) => e)).toEqual(e)
    expect(p.store.panelPinned).toBe(kind !== 'person')
  })
}

const drawStamped = async (p: ReturnType<typeof stampedContext>) => {
  const pictures: any[] = []
  const component = (props: any) => props.children ?? null
  const context = { ...p.context, ui: { ...p.context.ui, resolve: () => ({
    Box: component, Text: component, Button: component, Svg: (props: any) => { pictures.push(props); return null }
  }) } }
  await hooks['ui.render']!(context, { surface: 'desktop' }, async () => ({}))
  return pictures
}

test('main and stamped subagent TodoWrite fill three of five and clearing either list removes progress', async () => {
  const p = stampedContext()
  await hooks['session.start']!(p.context, start, async () => ({}))
  const todos = Array.from({ length: 5 }, (_, i) => ({ status: i < 3 ? 'completed' : 'in_progress', activeForm: 'Checking progress' }))
  for (const agentId of [undefined, 'a']) await hooks['tool.call']!(p.context, { agentId, tool: 'TodoWrite', todos }, async () => ({}))
  await p.refresh()
  expect(p.view().rows.map(r => r.todo)).toEqual([{ done: 3, total: 5 }, { done: 3, total: 5 }])
  const meters = (await drawStamped(p)).filter(p => p.height === 3)
  expect(meters).toHaveLength(2)
  expect(meters.every(p => p.alt === '3 of 5 steps' && p.source.includes('width="60"'))).toBe(true)
  for (const agentId of [undefined, 'a']) await hooks['tool.call']!(p.context, { agentId, tool: 'TodoWrite', todos: [] }, async () => ({}))
  await p.refresh()
  expect(p.view().rows.map(r => r.todo)).toEqual([null, null])
  expect((await drawStamped(p)).filter(p => p.height === 3).every(p => p.alt === 'Progress unavailable')).toBe(true)
})

test('help and unknown input list every command without changing the pane or shared pin', async ($, on) => {
  const p = setup(on, { panelPinned: true })
  await $.session.start(start)
  const calls = [...p.calls]
  for (const args of ['help', 'unknown', 'motion', 'motion maybe', 'motion off extra', 'size', 'size huge', 'help extra']) {
    const answer = await $.command.run({ ...command, args })
    for (const text of ['/party', '/party help', '/party motion on|off', '/party size tiny|small|medium']) expect(answer.text).toContain(text)
    expect(p.calls).toEqual(calls)
    expect(p.store.panelPinned).toBe(true)
    expect(p.store.motion).toBeUndefined()
    expect(p.store.size).toBeUndefined()
  }
})

test('motion commands apply immediately to every SVG without toggling, even when agent listing fails', async () => {
  const p = stampedContext()
  await hooks['session.start']!(p.context, start, async () => ({}))
  p.store.panelPinned = true
  p.context.agent.list = async () => { throw new Error('List unavailable') }
  for (const motion of [false, true, false]) {
    const answer = await hooks['command.run']!(p.context, { ...command, args: `motion ${motion ? 'on' : 'off'}` }, async () => ({}))
    expect(answer.text).toBe(`Party motion ${motion ? 'on' : 'off'}.`)
    expect(p.store.motion).toBe(motion)
    expect(p.store.panelPinned).toBe(true)
    expect(p.settings().motion).toBe(motion)
    const pictures = await drawStamped(p)
    expect(pictures.some(p => p.source.includes('<animate'))).toBe(motion)
    if (!motion) expect(pictures.some(p => p.isInteractive === true)).toBe(false)
  }
})

test('size commands apply immediately to row animals and preserve the motion setting and pin', async () => {
  const p = stampedContext()
  p.store.motion = false
  await hooks['session.start']!(p.context, start, async () => ({}))
  for (const [size, px] of [['tiny', 24], ['small', 36], ['medium', 48]] as const) {
    const answer = await hooks['command.run']!(p.context, { ...command, args: `  size   ${size}  ` }, async () => ({}))
    expect(answer.text).toBe(`Party size ${size}.`)
    expect(p.store.size).toBe(size)
    expect(p.store.motion).toBe(false)
    expect(p.store.panelPinned).toBeUndefined()
    expect(p.settings()).toEqual({ motion: false, size })
    expect((await drawStamped(p)).filter(p => p.height > 3).map(p => p.width)).toEqual([px, px])
  }
})

test('stored settings load at startup and another session updates unchanged rows on the next tick', async ($, on) => {
  const p = setup(on, { motion: false, size: 'tiny' })
  p.agents[0]!.status = 'completed'
  await $.session.start(start)
  expect(p.settings.value).toEqual({ motion: false, size: 'tiny' })
  const rosterWrites = p.writes.length
  p.store.motion = true
  p.store.size = 'medium'
  await p.clock.advance(10000)
  expect(p.settings.value).toEqual({ motion: true, size: 'medium' })
  expect(p.writes.length).toBe(rosterWrites)
  await $.session.start(start)
  expect(p.settings.value).toEqual({ motion: true, size: 'medium' })
})

test('invalid stored settings fall back to motion on and small animals', async ($, on) => {
  const p = setup(on, { motion: 'off', size: 'giant' })
  await $.session.start(start)
  expect(p.settings.value).toEqual({ motion: true, size: 'small' })
})

test('a failed setting write reports failure without toggling the panel', async () => {
  const p = stampedContext()
  await hooks['session.start']!(p.context, start, async () => ({}))
  p.context.store.set = async () => { throw new Error('Store unavailable') }
  const answer = await hooks['command.run']!(p.context, { ...command, args: 'motion off' }, async () => ({}))
  expect(answer.text).toBe('Party could not save that setting. Try again.')
  expect(p.settings()).toEqual({ motion: true, size: 'small' })
  expect(p.store.panelPinned).toBeUndefined()
})

test('an older refresh cannot overwrite a motion command issued while it was reading settings', async () => {
  const p = stampedContext()
  p.store.motion = true
  await hooks['session.start']!(p.context, start, async () => ({}))
  const get = p.context.store.get
  let release = () => {}
  let entered = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  const blocked = new Promise<void>(resolve => { entered = resolve })
  let hold = true
  p.context.store.get = async key => {
    if (key === 'size' && hold) { hold = false; entered(); await gate }
    return get(key)
  }
  const reading = p.timers.find(t => t.ms === 10000 && !t.cancelled)!.fn()
  await blocked
  try {
    await hooks['command.run']!(p.context, { ...command, args: 'motion off' }, async () => ({}))
    expect(p.settings().motion).toBe(false)
  } finally { release() }
  await reading
  expect(p.settings().motion).toBe(false)
})

test('settings commands redraw an already mounted engine pane without toggling it', async ($, on) => {
  // Use the engine's real atom store so its redraw notifications are exercised.
  const p = setup(on, {}, true)
  await $.session.start(start)
  await $.command.run(command)
  const ui = await $.ui.mount({ plugin: 'party', surface: 'desktop', component: 'Pane', requestId: 'party', props: { title: 'Party', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
  try {
    expect(JSON.stringify(await ui.drawn())).toContain('<animate')
    await $.command.run({ ...command, args: 'motion off' })
    await p.clock.settle()
    expect(JSON.stringify(await ui.drawn()).includes('<animate')).toBe(false)
    expect(p.calls).toEqual(['open'])
  } finally { await ui.unmount() }
})

test('three-second refreshes move a running terminal sweep within the same displayed minute', async () => {
  const p = stampedContext()
  let now = NOW
  p.context.clock.now = async () => now
  await hooks['session.start']!(p.context, start, async () => ({}))
  now += 3600000
  await hooks['tool.call']!(p.context, { agentId: 'a', tool: 'Read' }, async () => ({}))
  await p.refresh()
  const before = p.view()
  now += 3000
  await p.timers.find(t => t.ms === 3000 && !t.cancelled)!.fn()
  expect(p.view() === before).toBe(false)
  expect(Math.floor((p.view().now - p.view().rows[1]!.startedAt) / 60000)).toBe(Math.floor((before.now - before.rows[1]!.startedAt) / 60000))
})

test('three-second refreshes leave an unchanged nonrunning roster alone', async () => {
  const p = stampedContext()
  let now = NOW
  p.context.clock.now = async () => now
  p.context.agent.list = async () => [{ id: 'a', type: 'Explore', description: 'Map hooks', status: 'waiting' }]
  await hooks['session.start']!(p.context, start, async () => ({}))
  now += 3600000
  await hooks['tool.call']!(p.context, { agentId: 'a', tool: 'Read' }, async () => ({}))
  await p.refresh()
  const before = p.view()
  now += 3000
  await p.timers.find(t => t.ms === 3000 && !t.cancelled)!.fn()
  expect(p.view() === before).toBe(true)
})

test('a measured running row does not add a sweep redraw tick', async () => {
  const p = stampedContext()
  let now = NOW
  p.context.clock.now = async () => now
  await hooks['session.start']!(p.context, start, async () => ({}))
  await hooks['tool.call']!(p.context, { agentId: 'a', tool: 'TodoWrite', todos: [{ status: 'in_progress' }] }, async () => ({}))
  now += 3600000
  await p.refresh()
  const before = p.view()
  now += 3000
  await p.refresh()
  expect(p.view() === before).toBe(true)
})

test('terminal render hook applies viewport columns to its row layout', async () => {
  const p = stampedContext()
  await hooks['session.start']!(p.context, start, async () => ({}))
  const nodes: { type: string; props: any }[] = []
  const component = (type: string) => (props: any) => { const node = { type, props }; nodes.push(node); return node }
  const context = { ...p.context, ui: { ...p.context.ui, resolve: () => ({ Box: component('Box'), Text: component('Text') }) } }
  for (const [columns, bar] of [[24, 4], [44, 6], [64, 10]]) {
    nodes.length = 0
    const tree = await hooks['ui.render']!(context, { surface: 'terminal', viewport: { columns } }, async () => ({}))
    expect(tree.props.width).toBe(columns! - 1)
    const meters = nodes.filter(n => n.type === 'Box' && n.props.key === 'bar')
    expect(meters).toHaveLength(2)
    expect(meters.every(n => n.props.width === bar)).toBe(true)
  }
})

const codexContext = () => {
  const p = stampedContext()
  let now = NOW
  const scan = { calls: 0, exists: true, fail: false, result: JSON.stringify({ runs: [{ id: 'cx', parentId: null, kind: 'run', role: null, nickname: null, label: 'task-39', startedAt: NOW - 60000, lastAt: NOW, cmds: 4, spawned: 0, done: false, tokens: null }] }), wait: null as Promise<any> | null }
  const resolver = { calls: 0, output: '', fail: false, exitCode: 0, truncated: false, argv: [] as string[][] }
  const scanArgv: string[][] = []
  const statuses: (string | undefined)[] = []
  p.context.clock.now = async () => now
  p.context.ui.status = async (text?: string) => { statuses.push(text) }
  const context = Object.assign(p.context, {
    plugin: { root: '/synthetic/mod' },
    env: { get: async () => '/synthetic/home' },
    fs: { exists: async (_path: string) => scan.exists },
    process: { run: async (args: string[], opts: any) => {
      expect(opts).toEqual({ timeoutMs: 3000 })
      if (args[0] === 'sh') {
        resolver.calls++
        resolver.argv.push(args)
        if (resolver.fail) throw new Error('Synthetic resolver failure or timeout')
        return { exitCode: resolver.exitCode, stdout: resolver.output, isStdoutTruncated: resolver.truncated }
      }
      scan.calls++
      scanArgv.push(args)
      if (scan.fail) throw new Error('Synthetic process failure or timeout')
      if (scan.wait) return scan.wait
      return { exitCode: 0, stdout: scan.result }
    } }
  })
  const tick = async () => { await p.timers.filter(t => !t.cancelled && t.ms !== 1000).slice(-1)[0]!.fn() }
  const start = () => hooks['session.start']!(context, { cwd: '/synthetic', surface: 'terminal', isInteractive: true }, async () => ({}))
  return { ...p, context, scan, resolver, scanArgv, statuses, tick, start, now: (value: number) => { now = value } }
}

test('Codex scans only when enabled and the folder exists, without publishing runs', async () => {
  const p = codexContext()
  p.scan.exists = false
  await p.start()
  expect(p.scan.calls).toBe(0)
  expect(p.resolver.calls).toBe(0)
  p.scan.exists = true
  await p.tick()
  expect(p.scan.calls).toBe(1)
  expect(p.view().codex!.map(r => r.id)).toEqual(['cx'])
  expect(JSON.stringify(p.store['s:s1']).includes('cx')).toBe(false)
  expect(p.statuses.slice(-1)[0]).toBe('party: 2 working, 0 need you')
  await hooks['command.run']!(p.context, { ...command, args: 'codex off' }, async () => ({}))
  expect(p.view().codex).toEqual([])
  expect(p.store.codex).toBe(false)
  await p.tick()
  expect(p.scan.calls).toBe(1)
})

test('failed and malformed Codex scans retain the last good lane; idle transition redraws once', async () => {
  const p = codexContext()
  await p.start()
  expect(p.view().codex).toHaveLength(1)
  p.scan.fail = true
  await p.tick()
  expect(p.view().codex).toHaveLength(1)
  p.scan.fail = false
  p.scan.result = '{broken'
  p.now(NOW + 45001)
  await p.tick()
  expect(p.view().codex![0]!.state).toBe('idle')
})

test('Codex scans never overlap and off hides the lane while a scan is in flight', async () => {
  const p = codexContext()
  await p.start()
  let release!: (value: any) => void
  p.scan.wait = new Promise(resolve => { release = resolve })
  const pending = p.tick()
  for (let i = 0; i < 40 && p.scan.calls < 2; i++) await Promise.resolve()
  expect(p.scan.calls).toBe(2)
  await p.tick()
  expect(p.scan.calls).toBe(2)
  p.context.agent.list = async () => { throw new Error('Unavailable') }
  await hooks['command.run']!(p.context, { ...command, args: 'codex off' }, async () => ({}))
  expect(p.view().codex).toEqual([])
  release({ exitCode: 0, stdout: p.scan.result })
  await pending
  expect(p.view().codex).toEqual([])
})

test('non-slash prompt clears ready only in this session and late scans cannot revive it', async () => {
  const p = codexContext()
  p.scan.result = p.scan.result.replace('"done":false', '"done":true')
  await p.start()
  expect(p.view().ready).toBe(1)
  expect(p.statuses.slice(-1)[0]).toBe('party: 1 working, codex finished: ready for review')
  await hooks['prompt.submit']!(p.context, { text: '/party help' }, async (e: any) => e)
  expect(p.view().ready).toBe(1)
  p.now(NOW + 300001)
  await p.tick()
  expect(p.view().codex).toEqual([])
  expect(p.view().ready).toBe(1)
  await hooks['prompt.submit']!(p.context, { text: 'Review it' }, async (e: any) => e)
  expect(p.view().ready).toBe(0)
  await p.tick()
  expect(p.view().ready).toBe(0)
  await p.start()
  expect(p.view().ready).toBe(1)
})

test('a scan paused on settings cannot repopulate a new session with prior-generation facts', async () => {
  const p = codexContext()
  await p.start()
  let releaseProcess!: (value: any) => void
  let releaseSettings!: () => void
  let entered = false
  p.scan.wait = new Promise(resolve => { releaseProcess = resolve })
  const pending = p.tick()
  for (let i = 0; i < 40 && p.scan.calls < 2; i++) await Promise.resolve()
  const original = p.context.state.get
  const gate = new Promise<void>(resolve => { releaseSettings = resolve })
  let pause = true
  p.context.state.get = async ref => {
    if (ref.key === 'settings' && pause) { pause = false; entered = true; await gate }
    return original(ref)
  }
  releaseProcess({ exitCode: 0, stdout: p.scan.result.replace('"done":false', '"done":true') })
  for (let i = 0; i < 40 && !entered; i++) await Promise.resolve()
  expect(entered).toBe(true)
  await p.start()
  p.scan.fail = true
  releaseSettings()
  await pending
  await p.tick()
  expect(p.view().codex).toEqual([])
  expect(p.view().ready).toBe(0)
})

test('an older redraw cannot restore the lane after a later codex off command', async () => {
  const p = codexContext()
  await p.start()
  const set = (value: string) => hooks['command.run']!(p.context, { ...command, args: `codex ${value}` }, async () => ({}))
  await set('off')
  let release!: () => void
  let entered = false
  let pause = true
  const gate = new Promise<void>(resolve => { release = resolve })
  p.context.clock.now = async () => {
    if (pause) { pause = false; entered = true; await gate }
    return NOW
  }
  const pending = set('on')
  for (let i = 0; i < 80 && !entered; i++) await Promise.resolve()
  expect(entered).toBe(true)
  await set('off')
  release()
  await pending
  expect(p.view().codex).toEqual([])
})

test('a delayed ready status cannot undo a later prompt acknowledgement', async () => {
  const p = codexContext()
  await p.start()
  p.scan.result = p.scan.result.replace('"done":false', '"done":true')
  let release!: () => void
  let entered = false
  const gate = new Promise<void>(resolve => { release = resolve })
  const original = p.context.ui.status
  p.context.ui.status = async text => {
    if (text?.includes('ready for review') && !entered) { entered = true; await gate }
    await original(text)
  }
  const pending = p.tick()
  for (let i = 0; i < 100 && !entered; i++) await Promise.resolve()
  expect(entered).toBe(true)
  p.now(NOW + 1)
  await hooks['prompt.submit']!(p.context, { text: 'Review it' }, async (e: any) => e)
  expect(p.view().ready).toBe(0)
  release()
  await pending
  expect(p.view().ready).toBe(0)
  expect(p.statuses.slice(-1)[0]!.includes('ready for review')).toBe(false)
})

test('a delayed ready status cannot return after the session ends', async () => {
  const p = codexContext()
  await p.start()
  p.scan.result = p.scan.result.replace('"done":false', '"done":true')
  let release!: () => void
  let entered = false
  const gate = new Promise<void>(resolve => { release = resolve })
  const original = p.context.ui.status
  p.context.ui.status = async text => {
    if (text?.includes('ready for review') && !entered) { entered = true; await gate }
    await original(text)
  }
  const pending = p.tick()
  for (let i = 0; i < 100 && !entered; i++) await Promise.resolve()
  expect(entered).toBe(true)
  await hooks['session.end']!(p.context, { reason: 'other' }, async (e: any) => e)
  release()
  await pending
  expect(p.statuses.slice(-1)[0]).toBe(undefined)
})


test('Python resolver runs once across many Codex refreshes and scans use the resolved executable', async () => {
  const p = codexContext()
  p.resolver.output = '/synthetic/real/bin/python3\n'
  await p.start()
  for (let i = 0; i < 5; i++) await p.tick()
  expect(p.resolver.calls).toBe(1)
  expect(p.resolver.argv[0]!.slice(0, 2)).toEqual(['sh', '-c'])
  expect(p.scan.calls).toBe(6)
  expect(p.scanArgv).toEqual(Array.from({ length: 6 }, () => ['/synthetic/real/bin/python3', '/synthetic/mod/bin/codex_scan.py']))
  expect(p.view().codex).toHaveLength(1)
})

for (const failure of ['throw', 'exit', 'truncated', 'empty', 'relative', 'space', 'newline']) {
  test(`a ${failure} Python resolver failure is cached as python3 and the Codex lane still renders`, async () => {
    const p = codexContext()
    p.resolver.fail = failure === 'throw'
    p.resolver.exitCode = failure === 'exit' ? 1 : 0
    p.resolver.truncated = failure === 'truncated'
    p.resolver.output = failure === 'empty' ? '' : failure === 'relative' ? 'relative/python3' : failure === 'space' ? '/synthetic/with space/python3' : failure === 'newline' ? '/usr/bin/python3\n/other/python3' : '/synthetic/python3'
    await p.start()
    await p.tick()
    expect(p.resolver.calls).toBe(1)
    expect(p.scanArgv).toEqual(Array.from({ length: 2 }, () => ['python3', '/synthetic/mod/bin/codex_scan.py']))
    expect(p.view().codex!.map(row => row.id)).toEqual(['cx'])
  })
}

test('session.start resets the cached Python executable and resolves once more', async () => {
  const p = codexContext()
  p.resolver.output = '/synthetic/first/python3'
  await p.start()
  await p.tick()
  p.resolver.output = '/synthetic/second/python3'
  await p.start()
  await p.tick()
  expect(p.resolver.calls).toBe(2)
  expect(p.scanArgv.map(args => args[0])).toEqual(['/synthetic/first/python3', '/synthetic/first/python3', '/synthetic/second/python3', '/synthetic/second/python3'])
})

for (const missing of [false, true]) {
  test(`a ${missing ? 'not found' : 'generic'} Codex scan failure retains the lane and ${missing ? 'resets' : 'keeps'} the Python cache`, async () => {
    const p = codexContext()
    p.resolver.output = '/synthetic/first/python3'
    await p.start()
    p.scan.wait = Promise.reject(new Error(missing ? 'Executable not found' : 'Synthetic process failure'))
    await p.tick()
    expect(p.view().codex).toHaveLength(1)
    p.scan.wait = null
    p.resolver.output = '/synthetic/second/python3'
    await p.tick()
    expect(p.resolver.calls).toBe(missing ? 2 : 1)
    expect(p.scanArgv.slice(-1)[0]![0]).toBe(missing ? '/synthetic/second/python3' : '/synthetic/first/python3')
    expect(p.view().codex).toHaveLength(1)
  })
}


test('a not found scan exit clears the Python cache while preserving the last lane', async () => {
  const p = codexContext()
  p.resolver.output = '/synthetic/first/python3'
  await p.start()
  p.scan.wait = Promise.resolve({ exitCode: 127, stdout: '', stderr: 'python: not found' })
  await p.tick()
  expect(p.view().codex).toHaveLength(1)
  p.scan.wait = null
  p.resolver.output = '/synthetic/second/python3'
  await p.tick()
  expect(p.resolver.calls).toBe(2)
  expect(p.scanArgv.slice(-1)[0]![0]).toBe('/synthetic/second/python3')
})

test('tool activity uses a numeric clock timestamp, revives quiet agents, and retains no tool content', async () => {
  const p = stampedContext()
  let now = NOW
  p.context.clock.now = async () => now
  await hooks['session.start']!(p.context, start, async () => ({}))
  now += 660000
  await p.refresh()
  expect((p.view() as any).quiet).toBe(1)
  expect(p.view().rows.map(r => r.id)).toEqual(['main'])
  await hooks['tool.call']!(p.context, { agentId: 'a', tool: 'Bash', command: 'SYNTHETIC_PRIVATE_CONTENT', content: 'SYNTHETIC_PRIVATE_CONTENT' }, async () => ({}))
  await p.refresh()
  expect(p.view().rows.map(r => r.id)).toEqual(['main', 'a'])
  now += 600000
  await p.refresh()
  expect((p.view() as any).quietSince).toBe(NOW + 660000)
  expect(typeof (p.view() as any).quietSince).toBe('number')
  expect(p.store['s:s1'].counts.quiet).toBe(2)
  expect(JSON.stringify([p.view(), p.store]).includes('SYNTHETIC_PRIVATE_CONTENT')).toBe(false)
})

test('foreign quiet snapshots retain counts and quiet elapsed redraws without live rows', async () => {
  const p = stampedContext()
  let now = NOW
  p.context.clock.now = async () => now
  p.context.agent.list = async () => []
  p.store['s:foreign'] = { id: 'foreign', label: 'Other', at: NOW, startedAt: NOW, agents: [], quietSince: NOW - 660000,
    counts: { total: 0, working: 0, blocked: 0, overflow: 0, quiet: 2 } }
  await hooks['session.start']!(p.context, start, async () => ({}))
  expect((p.view().sessions![1]!.counts as any).quiet).toBe(2)
  const before = p.view()
  now += 1000
  await p.refresh()
  expect(p.view() === before).toBe(false)
})
