import { test, expect } from 'claude-code/testing'
import { dayKey, parseLedger, record, totals, weekStart } from './ledger'

// Local times, so the tests hold in any time zone.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

test('weeks start on Monday', () => {
  expect(weekStart(at(2026, 10, 2))).toBe('2026-09-28') // a Friday
  expect(weekStart(at(2026, 9, 28))).toBe('2026-09-28') // the Monday itself
  expect(weekStart(at(2026, 10, 4))).toBe('2026-09-28') // the Sunday
})

test('record adds only what was spent since the last record', () => {
  let l = record(undefined, 2, at(2026, 10, 2))
  l = record(l, 5, at(2026, 10, 2, 13))
  expect(l.days['2026-10-02']).toBe(5)
  expect(l.seen).toBe(5)
})

test('spend after midnight counts toward the new day only', () => {
  let l = record(undefined, 4, at(2026, 10, 2, 23))
  l = record(l, 6, at(2026, 10, 3, 1))
  expect(l.days['2026-10-02']).toBe(4)
  expect(l.days['2026-10-03']).toBe(2)
})

test('a relaunched session whose count started over is all new spend', () => {
  let l = record(undefined, 8, at(2026, 10, 2, 9))
  l = record(l, 1, at(2026, 10, 2, 10))
  expect(l.days['2026-10-02']).toBe(9)
})

test('days older than two weeks are dropped', () => {
  const old = { seen: 3, at: 0, days: { '2026-09-01': 3 } }
  expect(Object.keys(record(old, 3, at(2026, 10, 2)).days).length).toBe(0)
})

test('totals sum this week and today across sessions, and skip last week', () => {
  const a = { seen: 0, at: 0, days: { '2026-09-27': 50, '2026-09-29': 10, '2026-10-02': 3 } }
  const b = { seen: 0, at: 0, days: { '2026-10-02': 4 } }
  const c = { seen: 0, at: 0, days: { '2026-09-30': 1 } }
  const s = totals([a, b, c], 3, at(2026, 10, 2))
  expect(s.week).toBe(18)
  expect(s.today).toBe(7)
  expect(s.sessionsToday).toBe(2)
  expect(s.session).toBe(3)
})

test('an unreadable ledger file counts as absent', () => {
  expect(parseLedger('{"seen": 1, "da')).toBe(undefined)
  expect(parseLedger('null')).toBe(undefined)
  expect(parseLedger(undefined)).toBe(undefined)
  expect(parseLedger('{"seen":1,"at":0,"days":{}}')?.seen).toBe(1)
})

test('dayKey is the local date', () => {
  expect(dayKey(at(2026, 1, 5, 0))).toBe('2026-01-05')
})
