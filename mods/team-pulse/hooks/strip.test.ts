import { test, expect } from 'claude-code/testing'
import { strip } from './strip'

const H = 3_600_000
const NOW = 1_800_000_000_000

test('a segment inside the window maps to fractions and hours', () => {
  const r = strip([{ start: NOW - 6 * H, end: NOW - 3 * H }], NOW)
  expect(r.pieces).toEqual([{ from: 0.5, to: 0.75, running: false }])
  expect(r.hours).toBe(3)
})

test('a segment that began before the window is clipped to its start', () => {
  const r = strip([{ start: NOW - 20 * H, end: NOW - 10 * H }], NOW)
  expect(r.pieces[0]!.from).toBe(0)
  expect(r.hours).toBe(2)
})

test('a segment ending within 150 s of now is running', () => {
  expect(strip([{ start: NOW - H, end: NOW - 100_000 }], NOW).pieces[0]!.running).toBe(true)
  expect(strip([{ start: NOW - H, end: NOW - 200_000 }], NOW).pieces[0]!.running).toBe(false)
})

test('two sessions at once count the overlap once', () => {
  const r = strip([{ start: NOW - 4 * H, end: NOW - 2 * H }, { start: NOW - 3 * H, end: NOW - H }], NOW)
  expect(r.hours).toBe(3)
  expect(r.pieces.length).toBe(1)
})

test('nothing in the window means no pieces and zero hours', () => {
  expect(strip([{ start: NOW - 30 * H, end: NOW - 13 * H }], NOW)).toEqual({ pieces: [], hours: 0 })
  expect(strip([], NOW)).toEqual({ pieces: [], hours: 0 })
})

test('hours round to one decimal', () => {
  expect(strip([{ start: NOW - 1.26 * H, end: NOW - 0.01 * H }], NOW).hours).toBe(1.3)
})
