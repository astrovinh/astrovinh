import { test, expect } from 'claude-code/testing'
import { presenceLine } from './presence'
import type { Row, Status } from './rows'

// Live (working) is a filled circled letter, idle is an outlined circled letter.
const live = (letter: string) => String.fromCodePoint(0x1f150 + letter.charCodeAt(0) - 65)
const idle = (letter: string) => String.fromCodePoint(0x24b6 + letter.charCodeAt(0) - 65)
const DOT = '\u00b7'
const row = (name: string, status: Status = 'live', you = false): Row => ({
  id: name.toLowerCase(), name, you, status, statusText: '', clock: null, note: null, noteAge: null, main: null, others: [], fiveHour: null, week: null
})
const base = { rows: [] as Row[], paused: false, problem: null as string | null, hasSnapshot: true }

test('presence appends only a handoff hint when at least one waits for you', () => {
  expect(presenceLine({ ...base, hasHandoff: true })).toBe('Online members \u00b7 nobody right now \u00b7 a handoff for you \u00b7 /team')
  expect(presenceLine({ ...base, rows: [row('Linh')], paused: true, hasHandoff: true })).toBe(`${presenceLine({ ...base, rows: [row('Linh')], paused: true })} \u00b7 a handoff for you \u00b7 /team`)
  expect(presenceLine({ ...base, hasHandoff: false })).toBe(presenceLine(base))
  expect(presenceLine({ ...base, problem: 'offline', hasHandoff: true })).toBe("Online members \u00b7 can't reach the team server, will retry \u00b7 a handoff for you \u00b7 /team")
})

test('a live teammate is the filled circled initial', () => {
  expect(presenceLine({ ...base, rows: [row('Aki')] })).toBe('Online members \u{1F150}')
  expect(presenceLine({ ...base, rows: [row('aki')] })).toBe('Online members \u{1F150}')
})

test('an idle teammate is the outlined circled initial', () => {
  expect(presenceLine({ ...base, rows: [row('Aki', 'idle')] })).toBe('Online members \u24b6')
})

test('an accented initial loses its accent: a name starting with D-bar is a filled D', () => {
  expect(presenceLine({ ...base, rows: [row('\u0110\u1ee9c')] })).toBe(`Online members ${live('D')}`)
  expect(presenceLine({ ...base, rows: [row('\u00c9mile', 'idle')] })).toBe(`Online members ${idle('E')}`)
})

test('an initial that is not A to Z stays as the character itself, uppercased', () => {
  expect(presenceLine({ ...base, rows: [row('9lives')] })).toBe('Online members 9')
  expect(presenceLine({ ...base, rows: [row('\u3042ki')] })).toBe('Online members \u3042')
})

test('a non-latin initial is the character as typed, not its decomposed form', () => {
  // A Hangul syllable decomposes into two jamo under NFD; the line must show the syllable itself.
  expect(presenceLine({ ...base, rows: [row('\uac00\ub098')] })).toBe('Online members \uac00')
})

test('you are excluded from the list', () => {
  const rows = [row('Me', 'live', true), row('Linh')]
  expect(presenceLine({ ...base, rows })).toBe(`Online members ${live('L')}`)
})

test('offline teammates are not listed', () => {
  const rows = [row('Linh'), row('Hoa', 'offline'), row('Mai', 'idle')]
  expect(presenceLine({ ...base, rows })).toBe(`Online members ${live('L')} ${idle('M')}`)
})

test('glyphs come in the order the rows come, one space apart', () => {
  const rows = [row('Tuan'), row('Linh', 'live'), row('Mai', 'idle'), row('Nam', 'idle')]
  expect(presenceLine({ ...base, rows })).toBe(`Online members ${live('T')} ${live('L')} ${idle('M')} ${idle('N')}`)
})

test('eight online teammates show six glyphs then a count of the other two', () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => row(n))
  expect(presenceLine({ ...base, rows })).toBe(`Online members ${['A', 'B', 'C', 'D', 'E', 'F'].map(live).join(' ')} +2`)
})

test('exactly six online teammates show no count', () => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'].map(n => row(n))
  expect(presenceLine({ ...base, rows })).not.toContain('+')
})

test('offline teammates do not count toward the plus number', () => {
  const rows = [...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => row(n)), row('X', 'offline'), row('Y', 'offline')]
  expect(presenceLine({ ...base, rows })).toBe(`Online members ${['A', 'B', 'C', 'D', 'E', 'F'].map(live).join(' ')} +1`)
})

test('nobody online', () => {
  expect(presenceLine({ ...base, rows: [row('Me', 'live', true), row('Hoa', 'offline')] })).toBe(
    `Online members ${DOT} nobody right now`
  )
  expect(presenceLine({ ...base, rows: [] })).toBe(`Online members ${DOT} nobody right now`)
})

test('paused adds a suffix to the list and to the nobody line', () => {
  expect(presenceLine({ ...base, rows: [row('Tuan')], paused: true })).toBe(`Online members ${live('T')} ${DOT} sharing paused`)
  expect(presenceLine({ ...base, rows: [], paused: true })).toBe(`Online members ${DOT} nobody right now ${DOT} sharing paused`)
})

test('a failed refresh wins over everything and has no paused suffix', () => {
  expect(presenceLine({ ...base, rows: [row('Tuan')], problem: 'Network is down', paused: true })).toBe(
    `Online members ${DOT} can't reach the team server, will retry`
  )
})

test('no snapshot and no problem gives no line', () => {
  expect(presenceLine({ ...base, hasSnapshot: false })).toBeUndefined()
})
