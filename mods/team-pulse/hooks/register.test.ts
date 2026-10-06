import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Snapshot } from '../types'
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
