import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Membership, Snapshot } from '../types'
import { clockLabel } from './clock'

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
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => { store[e.key] = e.value; return { value: undefined } })
  on('store.delete', (_, e) => { delete store[e.key]; return { value: undefined } })
  on('store.keys', () => ({ value: Object.keys(store) }))
  mock.clock(on, { now: NOW })
  const state: Record<string, unknown> = { snapshot: null, fetchedAt: 0, problem: null, expanded: [] }
  on('state.get', (_, e) => ({ value: { value: state[e.key], version: 1 }, version: 1 }))
  on('state.set', (_, e) => {
    state[e.key] = e.value
    return { value: { isSet: true, version: 2 }, version: 2 }
  })
  const actions: string[] = []
  on('ui.status', () => ({ value: undefined }))
  on('ui.open', () => { actions.push('open'); return { value: { isPlaced: true } } })
  on('ui.close', () => { actions.push('close'); return { value: undefined } })
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
  return { code, secret, joined, requests, actions, store }
}
const onTeam = (): Membership => ({ server: 'https://pulse.test', teamId: 'abcdefghij', memberId: 'm1', key: '', name: 'Linh', team: 'Murror', isAdmin: false })

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
