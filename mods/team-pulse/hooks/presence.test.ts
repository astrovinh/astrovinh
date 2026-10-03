import { test, expect } from 'claude-code/testing'
import { presenceLine } from './presence'
import type { Row, Status } from './rows'

const GREEN = '\u{1F7E2}'
const YELLOW = '\u{1F7E1}'
const DOT = '\u00b7'
const row = (name: string, status: Status = 'live', you = false): Row => ({
  id: name.toLowerCase(), name, you, status, statusText: '', main: null, others: [], fiveHour: null, week: null
})
const base = { rows: [] as Row[], paused: false, problem: null as string | null, hasSnapshot: true }

test('you are excluded from the list', () => {
  const rows = [row('Me', 'live', true), row('Linh')]
  expect(presenceLine({ ...base, rows })).toBe(`Online members ${GREEN} Linh`)
})

test('offline teammates are not listed', () => {
  const rows = [row('Linh'), row('Hoa', 'offline'), row('Mai', 'idle')]
  expect(presenceLine({ ...base, rows })).toBe(`Online members ${GREEN} Linh ${YELLOW} Mai`)
})

test('live is green, idle is yellow, in the order the rows come', () => {
  const rows = [row('Tuan'), row('Linh', 'live'), row('Mai', 'idle'), row('Nam', 'idle')]
  expect(presenceLine({ ...base, rows })).toBe(`Online members ${GREEN} Tuan ${GREEN} Linh ${YELLOW} Mai ${YELLOW} Nam`)
})

test('eight online teammates show six names then a count of the other two', () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => row(n))
  expect(presenceLine({ ...base, rows })).toBe(
    `Online members ${GREEN} A ${GREEN} B ${GREEN} C ${GREEN} D ${GREEN} E ${GREEN} F +2`
  )
})

test('exactly six online teammates show no count', () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'].map(n => row(n))
  expect(presenceLine({ ...base, rows })).not.toContain('+')
})

test('offline teammates do not count toward the plus number', () => {
  const rows = [...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => row(n)), row('X', 'offline'), row('Y', 'offline')]
  expect(presenceLine({ ...base, rows })).toBe(
    `Online members ${GREEN} A ${GREEN} B ${GREEN} C ${GREEN} D ${GREEN} E ${GREEN} F +1`
  )
})

test('nobody online', () => {
  expect(presenceLine({ ...base, rows: [row('Me', 'live', true), row('Hoa', 'offline')] })).toBe(
    `Online members ${DOT} nobody right now`
  )
  expect(presenceLine({ ...base, rows: [] })).toBe(`Online members ${DOT} nobody right now`)
})

test('paused adds a suffix to the list and to the nobody line', () => {
  expect(presenceLine({ ...base, rows: [row('Tuan')], paused: true })).toBe(`Online members ${GREEN} Tuan ${DOT} sharing paused`)
  expect(presenceLine({ ...base, rows: [], paused: true })).toBe(`Online members ${DOT} nobody right now ${DOT} sharing paused`)
})

test('a failed refresh wins over everything and has no paused suffix', () => {
  expect(presenceLine({ ...base, rows: [row('Tuan')], problem: 'Network is down', paused: true })).toBe(
    `Online members ${DOT} can't reach the team server`
  )
})

test('no snapshot and no problem gives no line', () => {
  expect(presenceLine({ ...base, hasSnapshot: false })).toBeUndefined()
})
