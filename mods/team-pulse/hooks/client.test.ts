import { test, expect } from 'claude-code/testing'
import { backoffMs, parseJoinCode } from './client'

test('backoff doubles from 1 s and stops at 5 minutes', () => {
  expect([0, 1, 2, 3, 4].map(backoffMs)).toEqual([0, 1000, 2000, 4000, 8000])
  expect(backoffMs(20)).toBe(300_000)
})

test('a join code splits into team and secret, and junk is refused', () => {
  expect(parseJoinCode('abcdefghij.k2m3n4p5')).toEqual({ teamId: 'abcdefghij', secret: 'k2m3n4p5' })
  expect(parseJoinCode(' abcdefghij.k2m3n4p5 ')).toEqual({ teamId: 'abcdefghij', secret: 'k2m3n4p5' })
  expect(parseJoinCode('nope')).toBe(null)
  expect(parseJoinCode('ABCDEFGHIJ.k2m3n4p5')).toBe(null)
})
