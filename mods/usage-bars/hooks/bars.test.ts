import { test, expect } from 'claude-code/testing'
import { allocate, limitCells, contextCells, untilReset } from './bars'

test('allocate always fills the width', () => {
  for (const w of [1, 7, 20, 33]) {
    expect(allocate([5, 3, 1, 1], w).reduce((a, b) => a + b, 0)).toBe(w)
  }
})

test('limit bar shows at least one cell for a small reading', () => {
  expect(limitCells(1, 20)[0].width).toBe(1)
  expect(limitCells(0, 20)[0].width).toBe(0)
  expect(limitCells(50, 20)[0].width).toBe(10)
})

test('context bar gives one color per used category', () => {
  const { cells, legend } = contextCells(
    [
      { name: 'System', tokens: 100, kind: 'used' },
      { name: 'Messages', tokens: 300, kind: 'used' },
      { name: 'Free', tokens: 600, kind: 'free' }
    ],
    20
  )
  expect(legend.length).toBe(2)
  expect(legend[0].color === legend[1].color).toBe(false)
  expect(cells.reduce((a, c) => a + c.width, 0)).toBe(20)
})

test('untilReset formats days, hours, minutes', () => {
  const now = Date.parse('2026-10-02T00:00:00Z')
  expect(untilReset('2026-10-05T04:00:00Z', now)).toBe('3d 4h')
  expect(untilReset('2026-10-02T02:10:00Z', now)).toBe('2h 10m')
  expect(untilReset('2026-10-02T00:20:00Z', now)).toBe('20m')
})
