import { test, expect } from 'claude-code/testing'
import { ago, buildRows, duration, otherLine, sessionStatus, withYouLine } from './rows'
import type { Row, Status } from './rows'
import type { Snapshot, SnapshotSession } from '../types'

const NOW = 1_800_000_000_000
const s = (o: Partial<SnapshotSession>): SnapshotSession => ({
  id: 's1', member: 'm1', project: 'mobile-app', branch: 'main', line: 'Fixing restore', state: 'working',
  stateSince: NOW - 60_000, fiveHour: 10, week: 20, startedAt: NOW - 3_600_000, seenAt: NOW - 30_000, ...o
})
const snap = (sessions: SnapshotSession[], members: Snapshot['members'] = [{ id: 'm1', name: 'Linh' }]): Snapshot => ({
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

test('row clocks use the server clock plus time since the fetch', () => {
  const instant = Date.UTC(2026, 9, 6, 15, 40)
  const members = [{ id: 'm1', name: 'Linh', tz: 'Asia/Ho_Chi_Minh' }, { id: 'm2', name: 'Hoa' }, { id: 'm3', name: 'Mai', tz: null }]
  const view = { ...snap([], members), now: instant }
  const labels = (elapsed: number) => buildRows(view, elapsed).map(r => r.clock)
  expect(labels(0)).toEqual(['VN 10:40 PM', null, null])
  expect(labels(60_000)).toEqual(['VN 10:41 PM', null, null])
})

test('you first, then server member order even when a later member is live', () => {
  const members = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' }]
  const view = snap([
    s({ id: '1', member: 'a', seenAt: NOW - 200_000 }),
    s({ id: '2', member: 'b', state: 'idle' }),
    s({ id: '3', member: 'c' }), s({ id: '4', member: 'c' }),
    s({ id: '5', member: 'd' })
  ], members)
  const rows = buildRows({ ...view, you: 'b' }, 0)
  expect(rows.map(r => r.name)).toEqual(['Bo', 'Ann', 'Cy', 'Di'])
  expect(buildRows({ ...view, you: 'b' }, 200_000).map(r => r.name)).toEqual(['Bo', 'Ann', 'Cy', 'Di'])
})

test('status text has no session count, retaining idle time and last seen', () => {
  const members = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }, { id: 'e', name: 'Ed' }]
  const rows = buildRows(snap([
    s({ id: '1', member: 'a', seenAt: NOW - 3 * 3_600_000 }),
    s({ id: '2', member: 'b', state: 'idle', stateSince: NOW - 12 * 60_000 }),
    s({ id: '3', member: 'c' }), s({ id: '4', member: 'c' })
  ], members), 0)
  const text = Object.fromEntries(rows.map(r => [r.name, r.statusText]))
  expect(text).toEqual({ Cy: '', Bo: 'idle 22m', Ann: 'seen 3h ago', Ed: 'not active yet' })
  expect(rows.some(r => r.statusText.includes('session'))).toBe(false)
})

test('main session, others, where line and limits from the latest session', () => {
  const rows = buildRows(snap([
    s({ id: '1', line: 'Older work', seenAt: NOW - 50_000, fiveHour: 5 }),
    s({ id: '2', line: 'Newest work', seenAt: NOW - 10_000, fiveHour: 64, week: 41, startedAt: NOW - 74 * 60_000, branch: 'feat/x' })
  ]), 0)
  expect(rows[0]!.main).toEqual({ id: '2', line: 'Newest work', where: 'feat/x \u00b7 1h 14m' })
  expect(rows[0]!.others.map(o => o.id)).toEqual(['1'])
  expect([rows[0]!.fiveHour, rows[0]!.week]).toEqual([64, 41])
  expect(rows[0]!.you).toBe(true)
})

test('an offline person has no main session', () => {
  const rows = buildRows(snap([s({ seenAt: NOW - 3_600_000 })]), 0)
  expect(rows[0]!.main).toBe(null)
  expect(rows[0]!.others).toEqual([])
})

test('a person stays live while their work line follows the newest activity on any Mac', () => {
  const row = buildRows(snap([
    s({ id: 'liveMac', state: 'working', line: 'Earlier activity', turnAt: NOW - 60_000, seenAt: NOW - 1_000 }),
    s({ id: 'idleMac', state: 'idle', line: 'Most recent activity', turnAt: NOW - 10_000, seenAt: NOW - 20_000 })
  ]), 0)[0]!
  expect(row.status).toBe('live')
  expect(row.statusText).toBe('')
  expect(row.main!.id).toBe('idleMac')
  expect(row.main!.line).toBe('Most recent activity')
  expect(row.others.map(s => s.id)).toEqual(['liveMac'])
})

test('main session activity falls back to seen time for older clients', () => {
  for (const turnAt of [undefined, 0]) {
    const row = buildRows(snap([
      s({ id: 'newClient', turnAt: NOW - 60_000, seenAt: NOW - 1_000 }),
      s({ id: 'oldClient', turnAt, seenAt: NOW - 20_000 })
    ]), 0)[0]!
    expect(row.main!.id).toBe('oldClient')
  }
})

test('offline sessions do not supply the main work line even with newer activity', () => {
  const row = buildRows(snap([
    s({ id: 'online', state: 'idle', turnAt: NOW - 600_000 }),
    s({ id: 'offline', turnAt: NOW - 1_000, seenAt: NOW - 200_000 })
  ]), 0)[0]!
  expect(row.status).toBe('idle')
  expect(row.main!.id).toBe('online')
})

test('ago and duration read like the mockup', () => {
  expect(ago(30_000)).toBe('just now')
  expect(ago(12 * 60_000)).toBe('12m')
  expect(ago(3 * 3_600_000 + 5 * 60_000)).toBe('3h')
  expect(ago(2 * 86_400_000)).toBe('2d')
  expect(duration(42 * 60_000)).toBe('42m')
  expect(duration(74 * 60_000)).toBe('1h 14m')
})

// Row.status already means live/idle/offline, so the away note lives in `note` and `noteAge`.
const withNotes = (elapsed: number) =>
  buildRows(
    snap([], [
      { id: 'a', name: 'Ann', status: 'sleeping, back 8am', statusAt: NOW - 3 * 3_600_000 },
      { id: 'b', name: 'Bo' },
      { id: 'c', name: 'Cy', status: 'lunch', statusAt: null },
      { id: 'd', name: 'Di', status: null, statusAt: null }
    ]),
    elapsed
  )
const byName = (rows: ReturnType<typeof buildRows>, f: (r: ReturnType<typeof buildRows>[number]) => unknown) =>
  Object.fromEntries(rows.map(r => [r.name, f(r)]))

test('a member with an away note and a time gets the note and its age', () => {
  const rows = withNotes(0)
  expect(byName(rows, r => r.note)).toEqual({ Ann: 'sleeping, back 8am', Bo: null, Cy: 'lunch', Di: null })
  expect(byName(rows, r => r.noteAge)).toEqual({ Ann: '3h', Bo: null, Cy: null, Di: null })
})

test('away note ages use the server clock plus the time since the fetch, not Date.now()', () => {
  // Date.now() is nowhere near NOW (2027); only the server clock gives 3h, and 2h later it gives 5h.
  expect(byName(withNotes(0), r => r.noteAge).Ann).toBe('3h')
  expect(byName(withNotes(2 * 3_600_000), r => r.noteAge).Ann).toBe('5h')
})

test('an empty session line stays empty in the view', () => {
  const rows = buildRows(snap([s({ line: '', branch: '' })]), 0)
  expect(rows[0]!.main!.line).toBe('')
  expect(rows[0]!.main!.where).toBe('1h 0m')
})

const mate = (name: string, status: Status = 'live', you = false): Row => ({
  id: name.toLowerCase(), name, you, status, statusText: '', clock: null, note: null, noteAge: null, main: null, others: [], fiveHour: null, week: null
})

test('with-you line: nobody else working', () => {
  expect(withYouLine([])).toBe('No one else is working right now.')
  expect(withYouLine([mate('Me', 'live', true), mate('Hoa', 'idle'), mate('Nam', 'offline')])).toBe('No one else is working right now.')
})

test('with-you line: one teammate', () => {
  expect(withYouLine([mate('Me', 'live', true), mate('Linh'), mate('Hoa', 'idle')])).toBe('Linh is with you right now')
})

test('with-you line: two teammates', () => {
  expect(withYouLine([mate('Linh'), mate('Mai'), mate('Me', 'live', true)])).toBe('Linh and Mai are with you right now')
})

test('with-you line: three or more name the first two and count the rest', () => {
  expect(withYouLine([mate('Linh'), mate('Mai'), mate('Nam')])).toBe('Linh, Mai and 1 other are with you right now')
  expect(withYouLine([mate('Linh'), mate('Mai'), mate('Nam'), mate('Hoa'), mate('Me', 'live', true), mate('Tu', 'idle')])).toBe(
    'Linh, Mai and 2 others are with you right now'
  )
})

test('an other session shows its line, or says it is working when the line is empty', () => {
  expect(otherLine({ id: '2', line: 'Fixing restore', where: 'main \u00b7 5m' })).toBe('Fixing restore \u00b7 main \u00b7 5m')
  expect(otherLine({ id: '2', line: '', where: 'main \u00b7 5m' })).toBe('Working in Claude Code \u00b7 main \u00b7 5m')
  expect(otherLine({ id: '2', line: '', where: '' })).toBe('Working in Claude Code')
  expect(otherLine({ id: '2', line: 'Fixing restore', where: '' })).toBe('Fixing restore')
})
