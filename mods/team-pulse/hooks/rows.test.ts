import { test, expect } from 'claude-code/testing'
import { ago, buildRows, duration, sessionStatus } from './rows'
import type { Snapshot, SnapshotSession } from '../types'

const NOW = 1_800_000_000_000
const s = (o: Partial<SnapshotSession>): SnapshotSession => ({
  id: 's1', member: 'm1', project: 'mobile-app', branch: 'main', line: 'Fixing restore', state: 'working',
  stateSince: NOW - 60_000, fiveHour: 10, week: 20, startedAt: NOW - 3_600_000, seenAt: NOW - 30_000, ...o
})
const snap = (sessions: SnapshotSession[], members = [{ id: 'm1', name: 'Linh' }]): Snapshot => ({
  team: 'Murror', now: NOW, you: 'm1', members, sessions, segments: []
})

test('offline from 150 s without a heartbeat, live before', () => {
  expect(sessionStatus(s({ seenAt: NOW - 149_000 }), NOW)).toBe('live')
  expect(sessionStatus(s({ seenAt: NOW - 151_000 }), NOW)).toBe('offline')
  expect(sessionStatus(s({ state: 'idle' }), NOW)).toBe('idle')
})

test('rows use the server clock, not the viewer clock', () => {
  // The viewer fetched 20 s ago; a session seen 120 s before the server's now is 140 s old: still live.
  const rows = buildRows(snap([s({ seenAt: NOW - 120_000 })]), 20_000)
  expect(rows[0]!.status).toBe('live')
  // 40 s later it is 160 s old: offline.
  expect(buildRows(snap([s({ seenAt: NOW - 120_000 })]), 40_000)[0]!.status).toBe('offline')
})

test('live first by session count, then idle, then offline by last seen', () => {
  const members = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' }]
  const rows = buildRows(snap([
    s({ id: '1', member: 'a', seenAt: NOW - 200_000 }),
    s({ id: '2', member: 'b', state: 'idle' }),
    s({ id: '3', member: 'c' }), s({ id: '4', member: 'c' }),
    s({ id: '5', member: 'd' })
  ], members), 0)
  expect(rows.map(r => r.name)).toEqual(['Cy', 'Di', 'Bo', 'Ann'])
})

test('status text says sessions, idle time counted from the last turn, or last seen', () => {
  const members = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }, { id: 'e', name: 'Ed' }]
  const rows = buildRows(snap([
    s({ id: '1', member: 'a', seenAt: NOW - 3 * 3_600_000 }),
    s({ id: '2', member: 'b', state: 'idle', stateSince: NOW - 12 * 60_000 }),
    s({ id: '3', member: 'c' }), s({ id: '4', member: 'c' })
  ], members), 0)
  const text = Object.fromEntries(rows.map(r => [r.name, r.statusText]))
  expect(text).toEqual({ Cy: '2 sessions', Bo: 'idle 22m', Ann: 'seen 3h ago', Ed: 'not active yet' })
})

test('main session, others, where line and limits from the latest session', () => {
  const rows = buildRows(snap([
    s({ id: '1', line: 'Older work', seenAt: NOW - 50_000, fiveHour: 5 }),
    s({ id: '2', line: 'Newest work', seenAt: NOW - 10_000, fiveHour: 64, week: 41, startedAt: NOW - 74 * 60_000, branch: 'feat/x' })
  ]), 0)
  expect(rows[0]!.main).toEqual({ id: '2', line: 'Newest work', where: 'mobile-app · feat/x · 1h 14m' })
  expect(rows[0]!.others.map(o => o.id)).toEqual(['1'])
  expect([rows[0]!.fiveHour, rows[0]!.week]).toEqual([64, 41])
  expect(rows[0]!.you).toBe(true)
})

test('an offline person has no main session', () => {
  const rows = buildRows(snap([s({ seenAt: NOW - 3_600_000 })]), 0)
  expect(rows[0]!.main).toBe(null)
  expect(rows[0]!.others).toEqual([])
})

test('ago and duration read like the mockup', () => {
  expect(ago(30_000)).toBe('just now')
  expect(ago(12 * 60_000)).toBe('12m')
  expect(ago(3 * 3_600_000 + 5 * 60_000)).toBe('3h')
  expect(ago(2 * 86_400_000)).toBe('2d')
  expect(duration(42 * 60_000)).toBe('42m')
  expect(duration(74 * 60_000)).toBe('1h 14m')
})
