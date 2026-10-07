import { test, expect, mock } from 'claude-code/testing'
import type { On, PaneCloseInput, PaneCloseOrigin, UiPane } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import type { Membership, Signal, Snapshot } from '../types'
import { clockLabel } from './clock'
import { PANE, READ_MS } from './config'
import { register } from './register'

const NOW = Date.UTC(2026, 9, 6, 15, 40)
const prepare = (on: On, tz: string | null = null, error: string | null = null) => {
  mock.store(on, { membership: { server: 'https://pulse.test', teamId: 'test-team', memberId: 'm1', key: '', name: 'Linh', team: 'Murror', isAdmin: false } })
  mock.clock(on, { now: NOW })
  const state: Record<string, unknown> = { snapshot: null, fetchedAt: 0, problem: null, expanded: [] }
  // Core state events answer with a value envelope in the test dispatcher.
  on('state.get', (_, e) => ({ value: { value: state[e.key], version: 1 }, version: 1 }))
  on('state.set', (_, e) => {
    state[e.key] = e.value
    return { value: { isSet: true, version: 2 }, version: 2 }
  })
  on('ui.status', () => ({ value: undefined }))
  const requests: { method: string | undefined; url: string; body: any }[] = []
  on('http.fetch', (_, e) => {
    const body = e.init?.body ? JSON.parse(e.init.body) : null
    requests.push({ method: e.init?.method, url: e.url, body })
    if (e.init?.method === 'PUT') {
      if (error) return { value: { ok: false, status: 400, headers: {}, text: JSON.stringify({ error }) } }
      tz = body.tz || null
      return { value: { ok: true, status: 200, headers: {}, text: JSON.stringify({ ok: true, tz }) } }
    }
    const snapshot: Snapshot = { team: 'Murror', now: NOW, you: 'm1', members: [{ id: 'm1', name: 'Linh', tz }], sessions: [], segments: [] }
    return { value: { ok: true, status: 200, headers: {}, text: JSON.stringify(snapshot) } }
  })
  return requests
}

const command = { command: 'team', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } }

test('team clock without an argument reads the current setting and usage without changing it', async ($, on) => {
  const requests = prepare(on, 'Asia/Ho_Chi_Minh')
  const r = await $.command.run({ ...command, args: 'clock' })
  expect(r.text).toContain('Asia/Ho_Chi_Minh')
  expect(r.text).toContain('/team clock on')
  expect(r.text).toContain('/team clock off')
  expect(r.text).toContain('/team clock <IANA>')
  expect(requests.some(r => r.method === 'PUT')).toBe(false)
})

test('team clock on shares this runtime zone and confirms its local time', async ($, on) => {
  const requests = prepare(on)
  const r = await $.command.run({ ...command, args: 'clock on' })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  expect(requests[0]).toEqual({ method: 'PUT', url: 'https://pulse.test/teams/test-team/clock', body: { tz } })
  expect(r.text).toContain(clockLabel(tz, NOW))
  expect(r.text).toContain('/team clock off hides it.')
})

test('team clock accepts an explicit IANA zone and refreshes the snapshot', async ($, on) => {
  const requests = prepare(on)
  const r = await $.command.run({ ...command, args: 'clock Asia/Ho_Chi_Minh' })
  expect(requests.map(r => r.method)).toEqual(['PUT', 'GET'])
  expect(requests[0]!.body).toEqual({ tz: 'Asia/Ho_Chi_Minh' })
  expect(r.text).toBe('Your local time now shows as VN 10:40 PM. /team clock off hides it.')
})

test('team clock off clears the zone and says the clock is hidden', async ($, on) => {
  const requests = prepare(on, 'Asia/Ho_Chi_Minh')
  const r = await $.command.run({ ...command, args: 'clock off' })
  expect(requests[0]).toBeDefined()
  expect(requests[0]!.body).toEqual({ tz: '' })
  expect(r.text).toBe('Your local clock is hidden.')
})

test('team clock without a shared zone says it is hidden', async ($, on) => {
  prepare(on)
  expect((await $.command.run({ ...command, args: 'clock' })).text).toContain('Your local clock is hidden.')
})

test('team clock returns server validation errors without a refresh', async ($, on) => {
  const error = 'That is not a time zone. Use a name like Asia/Ho_Chi_Minh or America/Los_Angeles.'
  const requests = prepare(on, null, error)
  expect((await $.command.run({ ...command, args: 'clock Invalid/Zone' })).text).toBe(error)
  expect(requests).toHaveLength(1)
})

test('team clock requires membership', async ($, on) => {
  mock.store(on)
  expect((await $.command.run({ ...command, args: 'clock on' })).text).toContain('You are not in a team.')
})

test('team commands help includes clock', async ($, on) => {
  mock.store(on)
  expect((await $.command.run({ ...command, args: 'help' })).text).toContain('clock')
})

const deviceSetup = (on: On, current: Membership | null = null, opts: { error?: string; removed?: 'device' | 'member'; isAdmin?: boolean } = {}) => {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  const random = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => alphabet[b % alphabet.length]).join('')
  const teamId = 'abcdefghij'
  const secret = random(10)
  const code = `${teamId}.${secret}`
  const key = random(32)
  const joined = { teamId, team: 'Murror', memberId: 'm1', key, name: 'Linh N', isAdmin: opts.isAdmin ?? false }
  const store: Record<string, unknown> = { server: 'https://pulse.test', ...(current ? { membership: current, panelPinned: true } : {}) }
  const failures = { store: false, open: false, close: false }
  on('store.get', (_, e) => {
    if (e.key === 'panelPinned' && failures.store) throw new Error('Store unavailable')
    return { value: store[e.key] }
  })
  on('store.set', (_, e) => { store[e.key] = e.value; return { value: undefined } })
  on('store.delete', (_, e) => { delete store[e.key]; return { value: undefined } })
  on('store.keys', () => ({ value: Object.keys(store) }))
  const clock = mock.clock(on, { now: NOW })
  const state: Record<string, unknown> = { snapshot: null, fetchedAt: 0, problem: null, expanded: [] }
  on('state.get', (_, e) => ({ value: { value: state[e.key], version: 1 }, version: 1 }))
  on('state.set', (_, e) => {
    state[e.key] = e.value
    return { value: { isSet: true, version: 2 }, version: 2 }
  })
  const actions: string[] = []
  const panes: UiPane[] = []
  const opens: { id: string; title: string | undefined }[] = []
  const closes: { id: string }[] = []
  on('ui.status', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: panes }))
  on('ui.open', (_, e) => {
    if (failures.open) throw new Error('Open unavailable')
    actions.push('open')
    opens.push({ id: e.id, title: e.title })
    const pane = panes.find(p => p.id === e.id)
    if (pane) pane.isPlaced = true
    else panes.push({ id: e.id, title: e.title ?? e.id, isShown: true, isFocused: false, isPlaced: true })
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    if (failures.close) throw new Error('Close unavailable')
    actions.push('close')
    closes.push({ id: e.id })
    const index = panes.findIndex(p => p.id === e.id)
    if (index !== -1) panes.splice(index, 1)
    return { value: undefined }
  })
  on('session.usage', () => ({ value: { rateLimits: [], startedAt: NOW, context: { tokens: 0, window: 200_000 } } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  const requests: { method: string | undefined; url: string; body: any; authorization: string | undefined }[] = []
  on('http.fetch', (_, e) => {
    const body = e.init?.body ? JSON.parse(e.init.body) : null
    requests.push({ method: e.init?.method, url: e.url, body, authorization: e.init?.headers?.authorization })
    actions.push(e.init?.method === 'PUT' ? 'beat' : 'fetch')
    const response = (data: unknown, status = 200) => ({ value: { ok: status === 200, status, headers: {}, text: JSON.stringify(data) } })
    if (opts.error && e.init?.method === 'POST') return response({ error: opts.error }, 403)
    if (e.url.endsWith('/pair/join')) return response(joined)
    if (e.url.endsWith('/pair')) return response({ pairCode: code, expiresAt: NOW + 600_000 })
    if (e.url.endsWith('/leave')) return response({ ok: true, removed: opts.removed ?? 'member' })
    if (e.init?.method === 'PUT') return response({ ok: true })
    return response({ team: 'Murror', now: NOW, you: 'm1', members: [{ id: 'm1', name: joined.name }], sessions: [], segments: [] })
  })
  return { code, secret, joined, requests, actions, store, state, clock, panes, opens, closes, failures }
}
const onTeam = (): Membership => ({ server: 'https://pulse.test', teamId: 'abcdefghij', memberId: 'm1', key: '', name: 'Linh', team: 'Murror', isAdmin: false })

const sessionStart = { cwd: '/tmp/team-pulse-test', surface: 'terminal' as const, isInteractive: true }
const teamPane = (isPlaced: boolean): UiPane => ({ id: PANE, title: 'Team', isShown: isPlaced, isFocused: false, isPlaced })
const panelSetup = (on: On, hasMembership = true) => {
  const p = deviceSetup(on, hasMembership ? onTeam() : null)
  p.store.panelPinned = false
  p.store.paused = true
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return p
}
const startPanelSession = async ($: Engine, p: ReturnType<typeof panelSetup>) => {
  await $.session.start(sessionStart)
  await p.clock.settle()
  p.actions.length = 0
  p.requests.length = 0
  p.opens.length = 0
  p.closes.length = 0
}

// The kit cannot raise ui.close directly. Capture the real hook to deliver the engine's stamped origin.
let closeHook: ($: any, e: PaneCloseInput, next: (e: PaneCloseInput) => Promise<{ value: undefined }>) => unknown
register(((event: string, hook: unknown) => {
  if (event === 'ui.close') closeHook = hook as typeof closeHook
}) as On, {})
const deliverClose = async (p: ReturnType<typeof panelSetup>, kind: PaneCloseOrigin['kind']) => {
  const context = {
    store: {
      get: async (key: string) => p.store[key],
      set: async (key: string, value: unknown) => { p.store[key] = value }
    }
  }
  await closeHook(context, { id: PANE, origin: { kind } }, async () => ({ value: undefined }))
}

test('one read timer tick opens a closed pane when another session pins the panel and refreshes it', async ($, on) => {
  const p = panelSetup(on)
  await startPanelSession($, p)
  p.store.panelPinned = true
  p.state.snapshot = null
  await p.clock.advance(READ_MS)
  expect(p.opens).toEqual([{ id: PANE, title: 'Team' }])
  expect(p.actions).toEqual(['open', 'fetch'])
  expect(p.state.snapshot).toBeDefined()
  expect(p.state.snapshot).not.toBeNull()
  expect(p.store.panelPinned).toBe(true)
})

test('one read timer tick closes a shown pane when another session un-pins the panel', async ($, on) => {
  const p = panelSetup(on)
  await startPanelSession($, p)
  p.panes.push(teamPane(true))
  await p.clock.advance(READ_MS)
  expect(p.closes).toEqual([{ id: PANE }])
  await deliverClose(p, 'plugin')
  expect(p.store.panelPinned).toBe(false)
})

for (const pinned of [false, true]) {
  test(`a plugin close event keeps panelPinned ${pinned}`, async ($, on) => {
    const p = panelSetup(on)
    p.store.panelPinned = pinned
    p.panes.push(teamPane(true))
    await deliverClose(p, 'plugin')
    expect(p.store.panelPinned).toBe(pinned)
  })
}

test('a person closing the Team pane un-pins it', async ($, on) => {
  const p = panelSetup(on)
  p.store.panelPinned = true
  p.panes.push(teamPane(true))
  await deliverClose(p, 'person')
  expect(p.store.panelPinned).toBe(false)
})

for (const pinned of [true, false]) {
  test(`a read timer tick without membership does not ${pinned ? 'open' : 'close'} the panel`, async ($, on) => {
    const p = panelSetup(on, false)
    await startPanelSession($, p)
    p.store.panelPinned = pinned
    if (!pinned) p.panes.push(teamPane(true))
    await p.clock.advance(READ_MS)
    expect(p.opens).toHaveLength(0)
    expect(p.closes).toHaveLength(0)
  })
}

test('read timer ticks leave a pinned waiting pane for the engine to seat and refresh every second tick', async ($, on) => {
  const p = panelSetup(on)
  await startPanelSession($, p)
  p.store.panelPinned = true
  p.panes.push(teamPane(false))
  await p.clock.advance(READ_MS * 4)
  expect(p.opens).toHaveLength(0)
  expect(p.closes).toHaveLength(0)
  expect(p.requests.map(r => r.method)).toEqual(['GET', 'GET'])
})

test('a read timer tick closes a waiting pane when the panel is not pinned', async ($, on) => {
  const p = panelSetup(on)
  await startPanelSession($, p)
  p.panes.push(teamPane(false))
  await p.clock.advance(READ_MS)
  expect(p.closes).toEqual([{ id: PANE }])
})

test('a shown pinned panel refreshes on every read timer tick without reopening', async ($, on) => {
  const p = panelSetup(on)
  await startPanelSession($, p)
  p.store.panelPinned = true
  p.panes.push(teamPane(true))
  await p.clock.advance(READ_MS * 4)
  expect(p.opens).toHaveLength(0)
  expect(p.closes).toHaveLength(0)
  expect(p.requests.map(r => r.method)).toEqual(['GET', 'GET', 'GET', 'GET'])
})

test('a closed un-pinned panel refreshes on every second read timer tick', async ($, on) => {
  const p = panelSetup(on)
  await startPanelSession($, p)
  await p.clock.advance(READ_MS * 4)
  expect(p.opens).toHaveLength(0)
  expect(p.closes).toHaveLength(0)
  expect(p.requests.map(r => r.method)).toEqual(['GET', 'GET'])
})

for (const failure of ['store', 'open', 'close'] as const) {
  test(`a follow ${failure} failure does not stop later read timer ticks`, async ($, on) => {
    const p = panelSetup(on)
    await startPanelSession($, p)
    p.store.panelPinned = failure !== 'close'
    if (failure === 'close') p.panes.push(teamPane(true))
    p.failures[failure] = true
    await p.clock.advance(READ_MS)
    expect(p.opens).toHaveLength(0)
    expect(p.closes).toHaveLength(0)
    p.failures[failure] = false
    await p.clock.advance(READ_MS)
    if (failure === 'close') expect(p.closes).toEqual([{ id: PANE }])
    else expect(p.opens).toEqual([{ id: PANE, title: 'Team' }])
  })
}

test('session start still reopens a pinned panel', async ($, on) => {
  const p = panelSetup(on)
  p.store.panelPinned = true
  await $.session.start(sessionStart)
  await p.clock.settle()
  expect(p.opens).toEqual([{ id: PANE, title: 'Team' }])
})

test('team still opens a waiting pane on request and toggles the shown panel closed', async ($, on) => {
  const p = panelSetup(on)
  p.panes.push(teamPane(false))
  expect((await $.command.run({ ...command, args: '' })).text).toBe('Team panel opened.')
  expect(p.store.panelPinned).toBe(true)
  expect((await $.command.run({ ...command, args: '' })).text).toBe('Team panel closed.')
  expect(p.store.panelPinned).toBe(false)
  expect(p.opens).toEqual([{ id: PANE, title: 'Team' }])
  expect(p.closes).toEqual([{ id: PANE }])
})

test('team device code replies with a one-use code without storing it', async ($, on) => {
  const current = onTeam()
  const p = deviceSetup(on, current)
  const r = await $.command.run({ ...command, args: 'device code' })
  expect(r.text).toBe(`On your other Mac, run: /team device join ${p.code} (works once, for 10 minutes).`)
  expect(p.requests.map(r => [r.method, r.url])).toEqual([['POST', 'https://pulse.test/teams/abcdefghij/pair']])
  expect(p.store.membership).toEqual(current)
  expect(JSON.stringify(p.store).includes(p.secret)).toBe(false)
})

test('team device code requires membership', async ($, on) => {
  const p = deviceSetup(on)
  expect((await $.command.run({ ...command, args: 'device code' })).text).toContain('You are not in a team.')
  expect(p.requests).toHaveLength(0)
})

test('team device join stores the server identity, beats and opens the panel', async ($, on) => {
  const p = deviceSetup(on, null, { isAdmin: true })
  expect((await $.command.run({ ...command, args: `device join ${p.code}` })).text).toBe('This Mac is now part of Linh N on Murror.')
  expect(p.requests[0]).toEqual({ method: 'POST', url: 'https://pulse.test/teams/abcdefghij/pair/join', body: { code: p.secret }, authorization: undefined })
  expect(p.store.membership).toEqual({ server: 'https://pulse.test', ...p.joined })
  expect(p.requests[1]!.method).toBe('PUT')
  expect(p.requests[1]!.authorization === `Bearer ${p.joined.key}`).toBe(true)
  expect(p.requests[1]!.body.turnAt).toBeDefined()
  expect(p.actions).toEqual(['fetch', 'beat', 'open', 'fetch'])
  expect(p.store.panelPinned).toBe(true)
  expect(JSON.stringify(p.store).includes(p.secret)).toBe(false)
})

test('team device join refuses a membership on the same team before calling the server', async ($, on) => {
  const current = onTeam()
  const p = deviceSetup(on, current)
  expect((await $.command.run({ ...command, args: `device join ${p.code}` })).text).toBe('This Mac is already on Murror as Linh. To move it to another person, run /team leave first.')
  expect(p.requests).toHaveLength(0)
  expect(p.store.membership).toEqual(current)
})

test('team device join replaces a membership on another team using the server name and role', async ($, on) => {
  const p = deviceSetup(on, { ...onTeam(), teamId: 'anotherteam' })
  expect((await $.command.run({ ...command, args: `device join ${p.code}` })).text).toBe('This Mac is now part of Linh N on Murror.')
  expect(p.store.membership).toEqual({ server: 'https://pulse.test', ...p.joined })
})

test('team device join rejects malformed codes without changing membership', async ($, on) => {
  const p = deviceSetup(on)
  for (const args of ['device join', 'device join invalid', 'device unknown']) {
    expect((await $.command.run({ ...command, args })).text).toContain('/team device')
  }
  expect(p.requests).toHaveLength(0)
  expect(p.store.membership).toBeUndefined()
})

test('team device commands return server errors without changing membership or opening the panel', async ($, on) => {
  const current = onTeam()
  const p = deviceSetup(on, current, { error: 'Pairing failed.' })
  expect((await $.command.run({ ...command, args: 'device code' })).text).toBe('Pairing failed.')
  delete p.store.membership
  expect((await $.command.run({ ...command, args: `device join ${p.code}` })).text).toBe('Pairing failed.')
  expect(p.store.membership).toBeUndefined()
  expect(p.actions.includes('open')).toBe(false)
})

test('team leave confirms only this Mac left when other devices remain', async ($, on) => {
  const p = deviceSetup(on, onTeam(), { removed: 'device' })
  expect((await $.command.run({ ...command, args: 'leave' })).text).toBe('This Mac left Murror. Your other Macs are still on the team.')
  expect(p.store.membership).toBeUndefined()
  expect(p.store.panelPinned).toBe(false)
  expect(p.actions.includes('close')).toBe(true)
})

test('team leave keeps the shared-data deletion reply for the last device', async ($, on) => {
  const p = deviceSetup(on, onTeam(), { removed: 'member' })
  expect((await $.command.run({ ...command, args: 'leave' })).text).toBe('You left Murror. Your shared data was deleted.')
  expect(p.store.membership).toBeUndefined()
})

test('team commands help includes device', async ($, on) => {
  mock.store(on)
  expect((await $.command.run({ ...command, args: 'help' })).text).toContain('device')
})

const signalSetup = (on: On, opts: { error?: string; noMember?: boolean; hidden?: boolean; signals?: Signal[] } = {}) => {
  const store: Record<string, unknown> = { ...(opts.noMember ? {} : { membership: { ...onTeam(), name: 'Astro' } }), signalsHidden: opts.hidden ?? false }
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => { store[e.key] = e.value; return { value: undefined } })
  const serverView: Snapshot = {
    team: 'Murror', now: NOW, you: 'm1', members: [{ id: 'm1', name: 'Astro' }, { id: 'm2', name: 'Linh' }, { id: 'm3', name: 'Linh Nguyen' }, { id: 'k', name: 'Khanh' }], sessions: [], segments: [],
    signals: opts.signals ?? [{ id: 'handoff1', kind: 'handoff', from: 'k', to: 'm1', text: 'Her study is ready for review', at: NOW }]
  }
  const state: Record<string, unknown> = { snapshot: serverView, fetchedAt: Date.now(), problem: null, expanded: [] }
  on('state.get', (_, e) => ({ value: { value: state[e.key], version: 1 }, version: 1 }))
  on('state.set', (_, e) => { state[e.key] = e.value; return { value: { isSet: true, version: 2 }, version: 2 } })
  mock.clock(on, { now: NOW })
  const statuses: (string | undefined)[] = []
  on('ui.status', (_, e) => { statuses.push(e.text); return { value: undefined } })
  const requests: { method: string | undefined; url: string; body: any }[] = []
  on('http.fetch', (_, e) => {
    const body = e.init?.body ? JSON.parse(e.init.body) : null
    requests.push({ method: e.init?.method, url: e.url, body })
    const response = (data: unknown, status = 200) => ({ value: { ok: status === 200, status, headers: {}, text: JSON.stringify(data) } })
    if (e.init?.method !== 'GET' && opts.error) return response({ error: opts.error }, 429)
    if (e.init?.method === 'PUT') {
      const id = e.url.split('/').pop()
      serverView.signals = serverView.signals!.filter(s => s.id !== id)
      return response({ ok: true })
    }
    if (e.init?.method === 'POST') return response({ ok: true, id: 'new-signal' })
    return response(serverView)
  })
  return { store, state, requests, statuses }
}
const signalPanel = { plugin: 'murror', surface: 'terminal' as const, component: 'Pane' as const, requestId: 'team', props: { title: 'Team', isFocused: true, bodyColumns: 80, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 50 }, view: {} } }

test('team handoff matches the longest teammate name, sends the note and refreshes', async ($, on) => {
  const p = signalSetup(on)
  expect((await $.command.run({ ...command, args: 'handoff lINH ngUYEN Their draft is ready' })).text).toBe('Handoff sent to Linh Nguyen. It waits on their team panel until they take or dismiss it.')
  expect(p.requests).toEqual([{ method: 'POST', url: 'https://pulse.test/teams/abcdefghij/signals', body: { kind: 'handoff', to: 'm3', text: 'Their draft is ready' } }, { method: 'GET', url: 'https://pulse.test/teams/abcdefghij', body: null }])
})

test('team wave sends only the receiver and confirms the twelve hour animal marker', async ($, on) => {
  const p = signalSetup(on)
  expect((await $.command.run({ ...command, args: 'wave Khanh' })).text).toBe('You waved at Khanh. A small hand shows on your animal for 12 hours.')
  expect(p.requests[0]!.body).toEqual({ kind: 'wave', to: 'k' })
  expect(p.requests.map(r => r.method)).toEqual(['POST', 'GET'])
})

test('team win sends the note with no receiver and confirms forty eight hour sharing', async ($, on) => {
  const p = signalSetup(on)
  expect((await $.command.run({ ...command, args: 'win Their draft is ready' })).text).toBe('Shared with the team for 48 hours.')
  expect(p.requests[0]!.body).toEqual({ kind: 'win', text: 'Their draft is ready' })
  expect(p.requests.map(r => r.method)).toEqual(['POST', 'GET'])
})

test('signal commands require membership and validate missing notes and unknown names', async ($, on) => {
  const p = signalSetup(on)
  for (const args of ['handoff', 'handoff Linh', 'wave', 'win']) expect((await $.command.run({ ...command, args })).text).toContain(`/team ${args.split(' ')[0]}`)
  for (const args of ['wave Nobody', 'handoff Nobody']) expect((await $.command.run({ ...command, args })).text).toBe('No one on the team is called Nobody. Open /team to see the names.')
  expect((await $.command.run({ ...command, args: 'wave Linh Nguyen extra' })).text).toBe('No one on the team is called Linh Nguyen extra. Open /team to see the names.')
  expect((await $.command.run({ ...command, args: 'wave Astro' })).text).toBe('No one on the team is called Astro. Open /team to see the names.')
  expect(p.requests).toHaveLength(0)
  delete p.store.membership
  for (const args of ['handoff Linh Draft', 'wave Linh', 'win Ready']) expect((await $.command.run({ ...command, args })).text).toContain('You are not in a team.')
  expect(p.requests).toHaveLength(0)
})

test('a signal command fetches names when this session has no snapshot yet', async ($, on) => {
  const p = signalSetup(on)
  p.state.snapshot = null
  expect((await $.command.run({ ...command, args: 'wave Linh Nguyen' })).text).toBe('You waved at Linh Nguyen. A small hand shows on your animal for 12 hours.')
  expect(p.requests.map(r => r.method)).toEqual(['GET', 'POST', 'GET'])
})

test('signal commands return server failures without refreshing', async ($, on) => {
  const p = signalSetup(on, { error: 'Please try again later.' })
  for (const args of ['handoff Linh Review', 'wave Linh', 'win Ready']) expect((await $.command.run({ ...command, args })).text).toBe('Please try again later.')
  expect(p.requests.map(r => r.method)).toEqual(['POST', 'POST', 'POST'])
})

test('team signals off and on persist a local choice across renders without a server call', async ($, on) => {
  const p = signalSetup(on, { signals: [
    { id: 'win', kind: 'win', from: 'm2', to: '', text: 'Their draft is ready', at: NOW },
    { id: 'wave', kind: 'wave', from: 'm2', to: 'm1', text: '', at: NOW },
    { id: 'handoff1', kind: 'handoff', from: 'k', to: 'm1', text: 'Her study is ready', at: NOW }
  ] })
  let ui = await $.ui.mount(signalPanel)
  expect(JSON.stringify(await ui.drawn()).includes('WIN')).toBe(true)
  expect((await $.command.run({ ...command, args: 'signals off' })).text).toContain('this Mac')
  expect(p.store.signalsHidden).toBe(true)
  // Our state event handlers replace core state and its redraw subscriptions, so remount after writes.
  await ui.unmount()
  ui = await $.ui.mount(signalPanel)
  let tree = JSON.stringify(await ui.drawn())
  expect(tree.includes('WIN') || tree.includes('waved at you')).toBe(false)
  expect((await ui.find({ key: 'take:handoff1' }))?.text).toBe('Take')
  await $.command.run({ ...command, args: 'signals on' })
  expect(p.store.signalsHidden).toBe(false)
  await ui.unmount()
  ui = await $.ui.mount(signalPanel)
  tree = JSON.stringify(await ui.drawn())
  expect(tree.includes('WIN') && tree.includes('waved at you')).toBe(true)
  expect((await $.command.run({ ...command, args: 'signals unknown' })).text).toContain('/team signals on|off')
  expect(p.requests).toHaveLength(0)
  await ui.unmount()
})

for (const action of ['take', 'dismiss']) {
  test(`the panel ${action} button updates the handoff, refreshes and clears its status hint`, async ($, on) => {
    const p = signalSetup(on)
    let ui = await $.ui.mount(signalPanel)
    await ui.press({ key: `${action}:handoff1` })
    expect(p.requests).toEqual([{ method: 'PUT', url: 'https://pulse.test/teams/abcdefghij/signals/handoff1', body: { action } }, { method: 'GET', url: 'https://pulse.test/teams/abcdefghij', body: null }])
    await ui.unmount()
    ui = await $.ui.mount(signalPanel)
    expect(await ui.find({ key: 'take:handoff1' })).toBeUndefined()
    expect(p.statuses[p.statuses.length - 1]?.includes('a handoff for you')).toBe(false)
    await ui.unmount()
  })
}

test('a failed handoff button keeps the card and shows the message in the panel problem line', async ($, on) => {
  const p = signalSetup(on, { error: 'Nothing to update.' })
  let ui = await $.ui.mount(signalPanel)
  await ui.press({ key: 'take:handoff1' })
  expect(p.requests).toHaveLength(1)
  expect(p.state.problem).toBe('Nothing to update.')
  await ui.unmount()
  ui = await $.ui.mount(signalPanel)
  expect(JSON.stringify(await ui.drawn()).includes('Nothing to update.')).toBe(true)
  expect((await ui.find({ key: 'take:handoff1' }))?.text).toBe('Take')
  await ui.unmount()
})

test('the status line adds a hint only for received open handoffs, even when signals are hidden', async ($, on) => {
  const p = signalSetup(on, { hidden: true })
  await $.command.run({ ...command, args: 'win Ready' })
  expect(p.statuses[p.statuses.length - 1]).toBe('Online members \u00b7 nobody right now \u00b7 a handoff for you \u00b7 /team')
})

test('team commands help includes handoff, wave, win and signals', async ($, on) => {
  signalSetup(on)
  const reply = (await $.command.run({ ...command, args: 'help' })).text
  for (const word of ['handoff', 'wave', 'win', 'signals']) expect(reply).toContain(word)
})

test('team web replies with only the page URL and connection instructions', async ($, on) => {
  const current = { ...onTeam(), server: 'https://pulse.test///' }
  const p = deviceSetup(on, current)
  expect((await $.command.run({ ...command, args: 'web' })).text).toBe('Open https://pulse.test/web/abcdefghij in your browser. It will show a code; type /team web <code> here to connect it for 30 days.')
  expect(p.requests).toHaveLength(0)
  expect(p.store.membership).toEqual(current)
})

test('team web code approves with the member key without storing the code or changing activity', async ($, on) => {
  const p = deviceSetup(on, onTeam())
  const current = { ...onTeam(), key: p.joined.key }
  p.store.membership = current
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
  const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => alphabet[b % alphabet.length]).join('')
  expect((await $.command.run({ ...command, args: `web  ${code.toLowerCase()}  ` })).text).toBe('Connected. That browser can see Murror for 30 days. /team web revoke signs out every browser you connected.')
  expect(p.requests).toEqual([{ method: 'POST', url: 'https://pulse.test/teams/abcdefghij/web/approve', body: { code }, authorization: `Bearer ${current.key}` }])
  expect(p.actions).toEqual(['fetch'])
  expect(p.store.membership).toEqual(current)
  expect(JSON.stringify(p.store).includes(code)).toBe(false)
  expect(JSON.stringify(p.state).includes(code)).toBe(false)
})

test('team web revoke calls the authenticated revoke endpoint', async ($, on) => {
  const p = deviceSetup(on, onTeam())
  p.store.membership = { ...onTeam(), key: p.joined.key }
  expect((await $.command.run({ ...command, args: 'web revoke' })).text).toBe('Signed out every browser you connected.')
  expect(p.requests).toEqual([{ method: 'POST', url: 'https://pulse.test/teams/abcdefghij/web/revoke', body: null, authorization: `Bearer ${p.joined.key}` }])
  expect(p.actions).toEqual(['fetch'])
})

test('every team web command needs membership', async ($, on) => {
  const p = deviceSetup(on)
  for (const args of ['web', 'web ABC234', 'web revoke']) expect((await $.command.run({ ...command, args })).text).toContain('You are not in a team.')
  expect(p.requests).toHaveLength(0)
})

test('team web commands return server failures without storing anything or opening the panel', async ($, on) => {
  const p = deviceSetup(on, onTeam(), { error: 'That code is not valid or has expired. Refresh the page for a new one.' })
  for (const args of ['web ABC234', 'web revoke']) expect((await $.command.run({ ...command, args })).text).toBe('That code is not valid or has expired. Refresh the page for a new one.')
  expect(p.requests.map(r => r.method)).toEqual(['POST', 'POST'])
  expect(p.store.membership).toEqual(onTeam())
  expect(p.actions.includes('open')).toBe(false)
})

test('team commands help includes web', async ($, on) => {
  mock.store(on)
  expect((await $.command.run({ ...command, args: 'help' })).text).toContain('web')
})
