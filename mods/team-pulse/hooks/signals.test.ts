import { test, expect } from 'claude-code/testing'
import type { Snapshot } from '../types'
import { inbox, latestWin, targetOf, wavers, wavesTo } from './signals'

const NOW = 1_800_000_000_000
const HOUR = 3_600_000
const members = [{ id: 'you', name: 'Astro' }, { id: 'linh', name: 'Linh' }, { id: 'linh-n', name: 'Linh Nguyen' }, { id: 'khanh', name: 'Khanh' }]
const base: Snapshot = { team: 'Murror', now: NOW, you: 'you', members, sessions: [], segments: [] }
const signal = (id: string, kind: 'handoff' | 'wave' | 'win', from = 'linh', to = 'you', at = NOW) => ({ id, kind, from, to, text: `note ${id}`, at })

test('targetOf matches the longest teammate name prefix without case sensitivity and keeps the note', () => {
  expect(targetOf('  lINH ngUYEN Their draft is ready  ', members, 'you')).toEqual({ member: members[2], rest: 'Their draft is ready' })
  expect(targetOf('Linh Review when ready', members, 'you')).toEqual({ member: members[1], rest: 'Review when ready' })
  expect(targetOf('Khanh', members, 'you')).toEqual({ member: members[3], rest: '' })
})

test('targetOf excludes you and requires a whole name followed by a space or the end', () => {
  for (const args of ['Astro hello', 'LinhNguyen hello', 'Nobody hello', '']) expect(targetOf(args, members, 'you')).toBe(null)
  expect(targetOf('Linh Nguyen hello', members, 'linh-n')).toEqual({ member: members[1], rest: 'Nguyen hello' })
})

test('inbox selects live handoffs addressed to you, newest first, without changing the snapshot', () => {
  const signals = [signal('older', 'handoff', 'linh', 'you', NOW - HOUR), signal('sent', 'handoff', 'you', 'linh'), signal('wave', 'wave'), signal('expired', 'handoff', 'linh', 'you', NOW - 7 * 24 * HOUR), signal('newer', 'handoff')]
  const snap = { ...base, signals }
  expect(inbox(snap, 'you', NOW).map(s => s.id)).toEqual(['newer', 'older'])
  expect(snap.signals[0]!.id).toBe('older')
  expect(inbox(snap, 'you', NOW + 7 * 24 * HOUR)).toEqual([])
})

test('wavesTo selects live waves received by you using the snapshot clock', () => {
  const snap = { ...base, signals: [signal('incoming', 'wave'), signal('sent', 'wave', 'you', 'linh'), signal('old', 'wave', 'khanh', 'you', NOW - 12 * HOUR), signal('handoff', 'handoff')] }
  expect(wavesTo(snap, 'you').map(s => s.from)).toEqual(['linh'])
})

test('wavers marks senders of live waves once, including waves sent to someone else', () => {
  const snap = { ...base, signals: [signal('one', 'wave'), signal('two', 'wave', 'linh', 'khanh'), signal('three', 'wave', 'khanh', 'linh'), signal('old', 'wave', 'you', 'linh', NOW - 12 * HOUR), signal('ho', 'handoff', 'you')] }
  expect([...wavers(snap, NOW)].sort()).toEqual(['khanh', 'linh'])
  expect([...wavers(snap, NOW + 12 * HOUR)]).toEqual([])
})

test('latestWin returns the newest live win and how many other live wins remain', () => {
  const newest = signal('new', 'win', 'khanh', '', NOW)
  const snap = { ...base, signals: [signal('old', 'win', 'linh', '', NOW - HOUR), signal('wave', 'wave'), newest, signal('expired', 'win', 'linh', '', NOW - 48 * HOUR)] }
  expect(latestWin(snap, NOW)).toEqual({ win: newest, others: 1 })
  expect(latestWin(snap, NOW + 48 * HOUR)).toBe(null)
})

test('signal helpers quietly support older servers and a missing snapshot', () => {
  for (const snap of [base, null]) {
    expect(inbox(snap, 'you', NOW)).toEqual([])
    expect(wavesTo(snap, 'you')).toEqual([])
    expect([...wavers(snap, NOW)]).toEqual([])
    expect(latestWin(snap, NOW)).toBe(null)
  }
})
