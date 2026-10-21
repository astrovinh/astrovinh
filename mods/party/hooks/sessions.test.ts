import { test, expect } from 'claude-code/testing'
import { mergeSessions, summary, statusLine } from './sessions'
import { buildRows } from './roster'

const NOW = 1_800_000_000_000
const agents = buildRows({ agents: [], stats: {}, main: { startedAt: NOW, endedAt: null, working: true }, now: NOW }).rows
const session = (id: string, label = id, at = NOW) => ({ id, label, at, agents })

test('stale sessions are excluded after twenty-five seconds, including after an hour', () => {
  const own = session('own')
  expect(mergeSessions(own, [session('edge', 'edge', NOW - 25000), session('old', 'old', NOW - 25001)], NOW).map(s => s.id)).toEqual(['own', 'edge'])
  expect(mergeSessions(own, [session('other')], NOW + 3600000).map(s => s.id)).toEqual(['own'])
})

test('the own session appears exactly once even when the store returns it too', () => {
  const own = session('own', 'Zebra')
  const merged = mergeSessions(own, [session('b', 'Beta'), session('own', 'Old label'), session('a', 'Alpha')], NOW)
  expect(merged.map(s => s.id)).toEqual(['own', 'a', 'b'])
  expect(merged[0]!.label).toBe('Zebra')
})

test('duplicate labels get stable suffixes by session id independent of input order and own identity', () => {
  const a = session('a', 'Repo'), b = session('b', 'Repo'), c = session('c', 'Repo')
  expect(mergeSessions(c, [b, a], NOW).map(s => [s.id, s.label])).toEqual([['c', 'Repo 3'], ['a', 'Repo'], ['b', 'Repo 2']])
  expect(mergeSessions(a, [c, b], NOW).map(s => [s.id, s.label])).toEqual([['a', 'Repo'], ['b', 'Repo 2'], ['c', 'Repo 3']])
  expect([a.label, b.label, c.label]).toEqual(['Repo', 'Repo', 'Repo'])
})

test('foreign ids are unique and their newest heartbeat wins', () => {
  expect(mergeSessions(session('own'), [session('a', 'Old', NOW - 1), session('a', 'New')], NOW).map(s => s.label)).toEqual(['own', 'New'])
})

test('summary counts agents and statuses across folded sessions and preserves local overflow counts', () => {
  const own = { ...session('own'), counts: { total: 16, working: 14, blocked: 1, overflow: 4 } }
  const other = { ...session('other'), agents: [{ ...agents[0]!, state: 'waiting' as const }, { ...agents[0]!, id: 'idle', state: 'idle' as const }] }
  expect(summary([own, other])).toEqual({ total: 18, working: 14, blocked: 2, sessions: 2 })
  expect(summary([])).toEqual({ total: 0, working: 0, blocked: 0, sessions: 0 })
})

test('status text uses only ASCII counts and clears for an idle or empty party', () => {
  expect(statusLine([session('own'), { ...session('other'), agents: [{ ...agents[0]!, state: 'waiting' as const }] }])).toBe('party: 1 working, 1 needs you')
  expect(statusLine([{ ...session('idle'), agents: [{ ...agents[0]!, state: 'idle' as const }] }])).toBeUndefined()
  expect(statusLine([])).toBeUndefined()
})

test('status line says one needs you and zero or multiple need you', () => {
  for (const blocked of [0, 1, 2, 5]) {
    const own = { ...session('own'), counts: { total: blocked + 2, working: 2, blocked, overflow: 0 } }
    expect(statusLine([own])).toBe(`party: 2 working, ${blocked} ${blocked === 1 ? 'needs' : 'need'} you`)
  }
})
