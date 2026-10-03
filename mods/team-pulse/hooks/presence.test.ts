import { test, expect } from 'claude-code/testing'
import { presenceLine } from './presence'
import type { Row, Status } from './rows'

const DOT = '\u00b7'
const row = (name: string, status: Status = 'live', you = false): Row => ({
  id: name.toLowerCase(), name, you, status, statusText: '', main: null, others: [], fiveHour: null, week: null
})
const base = { rows: [] as Row[], youLine: 'Fixing restore', paused: false, problem: null as string | null, hasSnapshot: true }

test('you are excluded and the shapes follow live, idle, offline', () => {
  const rows = [row('Tuan'), row('Linh', 'live'), row('Me', 'live', true), row('Mai', 'idle'), row('Hoa', 'offline')]
  expect(presenceLine({ ...base, rows })).toBe(
    `Team  \u25cf Tuan  \u25cf Linh  \u25d0 Mai  \u25cb Hoa  ${DOT} you: Fixing restore`
  )
})

test('only six names show, then a count of the rest', () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => row(n))
  const text = presenceLine({ ...base, rows })!
  expect(text).toBe(
    `Team  \u25cf A  \u25cf B  \u25cf C  \u25cf D  \u25cf E  \u25cf F  +2  ${DOT} you: Fixing restore`
  )
})

test('exactly six teammates show no count', () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'].map(n => row(n))
  expect(presenceLine({ ...base, rows })).not.toContain('+')
})

test('paused says so instead of the line', () => {
  expect(presenceLine({ ...base, rows: [row('Tuan')], paused: true })).toBe(`Team  \u25cf Tuan  ${DOT} sharing paused`)
})

test('no teammates yet', () => {
  expect(presenceLine({ ...base, rows: [row('Me', 'live', true)] })).toBe(`Team ${DOT} no teammates yet ${DOT} you: Fixing restore`)
  expect(presenceLine({ ...base, rows: [], paused: true })).toBe(`Team ${DOT} no teammates yet ${DOT} sharing paused`)
})

test('a failed refresh wins over everything', () => {
  expect(presenceLine({ ...base, rows: [row('Tuan')], problem: 'Network is down', paused: true })).toBe(
    `Team ${DOT} can't reach the team server`
  )
})

test('no snapshot and no problem gives no line', () => {
  expect(presenceLine({ ...base, hasSnapshot: false })).toBeUndefined()
})

test('a long line of yours is cut at 60 with an ellipsis', () => {
  const text = presenceLine({ ...base, rows: [row('Tuan')], youLine: 'x'.repeat(100) })!
  const mine = text.split(`${DOT} you: `)[1]!
  expect(mine.length).toBe(60)
  expect(mine.endsWith('\u2026')).toBe(true)
})
