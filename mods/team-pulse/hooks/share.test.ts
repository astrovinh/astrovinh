import { test, expect } from 'claude-code/testing'
import { basename, buildHeartbeat, cap } from './share'

const facts = {
  session: 'abc123',
  cwd: '/Users/linh/code/mobile-app/',
  branch: 'fix/paywall-restore',
  line: 'Fixing purchase restore on iOS',
  lastTurnAt: 1_000_000,
  now: 1_000_000 + 60_000,
  fiveHour: 64,
  week: 41,
  startedAt: 900_000
}

test('a heartbeat carries exactly the allowed fields', () => {
  const keys = Object.keys(buildHeartbeat(facts)).sort()
  expect(keys).toEqual(['branch', 'fiveHour', 'line', 'project', 'session', 'startedAt', 'state', 'week'])
})

test('the repo folder name is never shared: project is always empty', () => {
  expect(buildHeartbeat(facts).project).toBe('')
  expect(JSON.stringify(buildHeartbeat(facts)).includes('mobile-app')).toBe(false)
  expect(basename('/a/b/c')).toBe('c')
  expect(basename('c')).toBe('c')
})

test('every text field is capped and whitespace is collapsed', () => {
  const hb = buildHeartbeat({ ...facts, line: 'x'.repeat(500), branch: 'b'.repeat(500), session: 's'.repeat(99) })
  expect(hb.line.length).toBe(120)
  expect(hb.line.endsWith('\u2026')).toBe(true)
  expect(hb.branch.length).toBe(96)
  expect(hb.session.length).toBe(32)
  expect(cap('  a \n  b  ', 10)).toBe('a b')
})

test('working until 10 minutes after the last turn, idle from then', () => {
  expect(buildHeartbeat({ ...facts, now: facts.lastTurnAt + 599_999 }).state).toBe('working')
  expect(buildHeartbeat({ ...facts, now: facts.lastTurnAt + 600_000 }).state).toBe('idle')
})

test('limits outside 0 to 100 or missing become clamped or null', () => {
  expect(buildHeartbeat({ ...facts, fiveHour: 140 }).fiveHour).toBe(100)
  expect(buildHeartbeat({ ...facts, week: undefined }).week).toBe(null)
  expect(buildHeartbeat({ ...facts, week: Number.NaN }).week).toBe(null)
})
