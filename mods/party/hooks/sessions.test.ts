import { test, expect } from 'claude-code/testing'
import { assignSessionAnimals, mergeSessions, summary, statusLine } from './sessions'
import { buildRows } from './roster'
import { ANIMALS } from './animals'
import type { SessionView } from '../types'

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

const started = (id: string, startedAt: number): SessionView => ({ ...session(id), startedAt })
const lead = (entry: SessionView) => entry.agents.find(row => row.main)!

test('session animals rank by startedAt then id without changing presentation order or input', () => {
  const input = [started('c', 2), started('b', 1), started('a', 1)]
  const before = JSON.stringify(input)
  const result = assignSessionAnimals(input)
  expect(result.map(s => [s.id, lead(s).animal, lead(s).name])).toEqual([
    ['c', 'biscuit', 'Biscuit'], ['b', 'mochi', 'Mochi'], ['a', 'ember', 'Ember']
  ])
  expect(JSON.stringify(input)).toBe(before)
})

test('two live sessions get Ember and Mochi at merge time while their published leads remain Ember', () => {
  const older = started('z-older', 1), newer = started('a-newer', 2)
  expect(mergeSessions(newer, [older], NOW).map(s => [s.id, lead(s).name])).toEqual([
    ['a-newer', 'Mochi'], ['z-older', 'Ember']
  ])
  expect(lead(older).name).toBe('Ember')
  expect(lead(newer).name).toBe('Ember')
})

test('an older session keeps its animal when a newer session with an earlier id joins', () => {
  const older = started('z-older', 1)
  const alone = assignSessionAnimals([older])[0]!
  const joined = assignSessionAnimals([started('a-newer', 2), older]).find(s => s.id === older.id)!
  expect([lead(alone).animal, lead(alone).name]).toEqual(['ember', 'Ember'])
  expect([lead(joined).animal, lead(joined).name]).toEqual([lead(alone).animal, lead(alone).name])
})

test('five sessions start second coats and eight have distinct species and coat pairs before lap names wrap', () => {
  const input = Array.from({ length: 17 }, (_, i) => started(String(i), i))
  const result = assignSessionAnimals(input)
  expect(result.slice(0, 8).map(s => lead(s).animal)).toEqual(['ember', 'mochi', 'biscuit', 'waddle', 'ember2', 'mochi2', 'biscuit2', 'waddle2'])
  expect(result.map(s => lead(s).name)).toEqual([
    'Ember', 'Mochi', 'Biscuit', 'Waddle', 'Ember 2', 'Mochi 2', 'Biscuit 2', 'Waddle 2',
    'Ember 3', 'Mochi 3', 'Biscuit 3', 'Waddle 3', 'Ember 4', 'Mochi 4', 'Biscuit 4', 'Waddle 4', 'Ember 5'
  ])
  expect(new Set(result.slice(0, 8).map(s => { const a = ANIMALS[lead(s).animal]; return `${a.kind}:${a.coat}` })).size).toBe(8)
  expect(lead(result[8]!).animal).toBe('ember')
  expect(lead(result[12]!).animal).toBe('ember2')
})

test('every viewer assigns the same animals regardless of which session is own and stored input order', () => {
  const input = [started('z', 1), started('a', 2), started('m', 3), started('b', 4), started('x', 5)]
  const expected = [['a', 'mochi', 'Mochi'], ['b', 'waddle', 'Waddle'], ['m', 'biscuit', 'Biscuit'], ['x', 'ember2', 'Ember 2'], ['z', 'ember', 'Ember']]
  for (const own of input) for (const others of [input, [...input].reverse()]) {
    const result = mergeSessions(own, others, NOW)
    expect(result[0]!.id).toBe(own.id)
    expect([...result].sort((a, b) => a.id.localeCompare(b.id)).map(s => [s.id, lead(s).animal, lead(s).name])).toEqual(expected)
  }
})

test('one session stays Ember and sessions missing startedAt rank first as zero', () => {
  expect(lead(assignSessionAnimals([started('only', 123)])[0]!).animal).toBe('ember')
  const result = assignSessionAnimals([started('a-new', 1), session('z-old'), session('b-old')])
  expect(result.map(s => [s.id, lead(s).animal])).toEqual([['a-new', 'biscuit'], ['z-old', 'mochi'], ['b-old', 'ember']])
})

const crowded = () => buildRows({
  agents: ['Explore', 'Plan', 'general-purpose', 'code-reviewer', 'teammate'].flatMap((type, slot) =>
    Array.from({ length: 10 }, (_, i) => ({ id: `${slot}:${i}`, type, status: 'running' as const, description: `Task ${slot}:${i}`, firstSeen: NOW + i * 5 + slot, endedAt: null }))),
  stats: {}, main: { startedAt: NOW, endedAt: null, working: true }, now: NOW
})

test('spares never repeat their session lead species while fixed job animals and first-seen order remain', () => {
  const roster = crowded()
  const input = Array.from({ length: 8 }, (_, i) => ({ ...started(String(i), i), agents: roster.rows }))
  const result = assignSessionAnimals(input)
  const jobs = ['hop', 'sage', 'bruno', 'pan', 'pip']
  for (const s of result) {
    expect(s.agents.map(row => row.id)).toEqual(roster.rows.map(row => row.id))
    expect(s.agents.slice(1, 6).map(row => row.animal)).toEqual(jobs)
    for (const row of s.agents.filter(row => !row.main)) expect(ANIMALS[row.animal].kind === ANIMALS[lead(s).animal].kind).toBe(false)
    expect(lead(s).role).toBe('Lead')
  }
  expect(result[1]!.agents.slice(6, 11).map(row => row.animal)).toEqual(Array(5).fill('biscuit'))
  expect(result[2]!.agents.slice(6, 11).map(row => row.animal)).toEqual(Array(5).fill('mochi'))
  expect(result[3]!.agents.slice(6, 11).map(row => row.animal)).toEqual(Array(5).fill('mochi'))
})

test('session reassignment keeps lifetime spare positions after the first agent expires', () => {
  const memory = Array.from({ length: 4 }, (_, i) => ({ id: String(i), type: 'Explore', status: i === 0 ? 'completed' as const : 'running' as const,
    description: `Task ${i}`, firstSeen: NOW + i, endedAt: i === 0 ? NOW : null }))
  const at = (now: number) => ({ ...started('newer', 2), agents: buildRows({ agents: memory, stats: {}, main: null, now }).rows })
  const before = assignSessionAnimals([started('older', 1), at(NOW)])[1]!
  const after = assignSessionAnimals([started('older', 1), at(NOW + 300000)])[1]!
  expect(before.agents.slice(1).map(row => [row.id, row.animal, row.name])).toEqual(after.agents.map(row => [row.id, row.animal, row.name]))
  expect(after.agents[0]!.animal).toBe('biscuit')
})

test('stale sessions do not reserve lead ranks and reassignment leaves counts and status unchanged', () => {
  const own = { ...started('own', 2), counts: { total: 20, working: 12, blocked: 2, overflow: 8 } }
  const live = started('live', 1)
  const result = mergeSessions(own, [{ ...started('stale', 0), at: NOW - 25001 }, live], NOW)
  expect(result.map(s => [s.id, lead(s).animal])).toEqual([['own', 'mochi'], ['live', 'ember']])
  expect(summary(result)).toEqual(summary([own, live]))
  expect(statusLine(result)).toBe(statusLine([own, live]))
  expect(result[0]!.counts).toEqual(own.counts)
})
