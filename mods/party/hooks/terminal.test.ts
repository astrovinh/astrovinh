import { test, expect } from 'claude-code/testing'
import type { AgentRow, AnimalKey } from '../types'
import { ANIMALS } from './animals'
import { ANIMAL_EMOJI, barCells, rowWidth, terminalRowLayout } from './terminal'

const NOW = 1_800_000_000_000
const row: AgentRow = { id: 'a', main: false, slot: 'scout', animal: 'hop', name: 'A very long animal name', role: 'Scout', state: 'running', line: 'Reading code', tool: 'read', tools: 999, startedAt: NOW - (99 * 3600 + 59 * 60) * 1000, endedAt: null, todo: null }
const states: AgentRow['state'][] = ['running', 'waiting', 'pending', 'idle', 'completed', 'failed', 'killed']
const expanded = (cells: ReturnType<typeof barCells>) => cells.flatMap(cell => Array.from({ length: cell.width }, () => ({ glyph: cell.glyph, color: cell.color, dim: cell.dim })))

test('terminal width invariant reserves two emoji cells and one spare for every width and row kind', () => {
  const ranks = { tiny: 0, narrow: 1, medium: 2, wide: 3 }
  let previous = 0
  for (let columns = 1; columns <= 200; columns++) {
    const layout = terminalRowLayout(columns)
    expect(ranks[layout.tier] >= previous).toBe(true)
    previous = ranks[layout.tier]
    for (const state of states) for (const todo of [null, { done: 3, total: 5 }]) {
      const agent = { ...row, state, todo }
      // Independently count a worst-case rendered line, including padding and separators.
      const meta = layout.tier === 'wide' ? `${todo ? '3/5 . ' : ''}999 tools . 99h 59m`
        : layout.tier === 'medium' ? `${todo ? '3/5 ' : ''}99h` : todo && layout.tier === 'narrow' ? '3/5' : '99h'
      const actual = 2 + 1 + layout.name + (layout.status ? 1 + 7 : 0) + (layout.bar ? 1 + layout.bar : 0) + 1 + meta.length
      expect(rowWidth(layout, agent)).toBe(actual)
      expect(actual <= columns - 1 || layout.tier === 'tiny').toBe(true)
    }
  }
})

test('terminal tier boundaries preserve the approved names, bars and metadata', () => {
  const tiny = { tier: 'tiny', name: 4, bar: 0, status: false, tools: false }
  const narrow = { tier: 'narrow', name: 6, bar: 4, status: false, tools: false }
  const medium = { tier: 'medium', name: 7, bar: 6, status: true, tools: false }
  const wide = { tier: 'wide', name: 8, bar: 10, status: true, tools: true }
  for (const [columns, expected] of [[1, tiny], [23, tiny], [24, narrow], [43, narrow], [44, medium], [63, medium], [64, wide], [200, wide], [undefined, wide]] as const) expect(terminalRowLayout(columns)).toEqual(expected)
})

test('every animal has the matching two-cell terminal emoji', () => {
  const expected: Record<AnimalKey, number> = { ember: 0x1f98a, ember2: 0x1f98a, hop: 0x1f430, sage: 0x1f989, bruno: 0x1f43b, pan: 0x1f43c, pip: 0x1f438, mochi: 0x1f431, mochi2: 0x1f431, biscuit: 0x1f436, biscuit2: 0x1f436, waddle: 0x1f427, waddle2: 0x1f427 }
  for (const animal of Object.keys(ANIMALS) as AnimalKey[]) expect(ANIMAL_EMOJI[animal]).toBe(String.fromCodePoint(expected[animal]))
})

test('todo bars round real progress, keep a visible start and never look finished early', () => {
  for (let cells = 2; cells <= 12; cells++) for (const state of states) {
    for (const [done, total] of [[0, 5], [1, 100], [3, 5], [99, 100], [5, 5]]) {
      const runs = expanded(barCells({ ...row, state, todo: { done: done!, total: total! } }, cells, NOW))
      const filled = done === 0 ? 0 : done === total ? cells : Math.max(1, Math.min(cells - 1, Math.round(cells * done! / total!)))
      expect(runs).toHaveLength(cells)
      expect(runs.filter(c => c.glyph === '\u2501')).toHaveLength(filled)
      expect(runs.slice(filled).every(c => c.glyph === '\u2500' && c.dim === true)).toBe(true)
      expect(runs.slice(0, filled).every(c => !!c.color && !c.dim)).toBe(true)
    }
  }
})

test('running without todos sweeps one bright segment inside every bar and ping-pongs with time', () => {
  for (let cells = 2; cells <= 12; cells++) {
    const bright = cells <= 4 ? 2 : 3
    const travel = cells - bright
    const positions: number[] = []
    for (let tick = 0; tick <= Math.max(2, 2 * travel); tick++) {
      const runs = expanded(barCells(row, cells, tick * 3000))
      const at = runs.findIndex(c => c.glyph === '\u2501')
      positions.push(at)
      expect(runs).toHaveLength(cells)
      expect(runs.filter(c => c.glyph === '\u2501')).toHaveLength(bright)
      expect(runs.slice(at, at + bright).every(c => c.glyph === '\u2501' && c.color === '#8cc9a1' && !c.dim)).toBe(true)
      expect(runs.filter(c => c.glyph !== '\u2501').every(c => c.glyph === '\u254c' && c.dim === true)).toBe(true)
      expect(at >= 0 && at + bright <= cells).toBe(true)
    }
    if (travel) {
      expect(positions[0]).toBe(0)
      expect(positions[1]).toBe(1)
      expect(positions[travel]).toBe(travel)
      expect(positions[2 * travel]).toBe(0)
    }
  }
  expect(barCells(row, 10, 2999)).toEqual(barCells(row, 10, 0))
  expect(JSON.stringify(barCells(row, 10, 3000)) === JSON.stringify(barCells(row, 10, 0))).toBe(false)
})

test('idle and pending without todos have no terminal bar cells', () => {
  for (const state of ['idle', 'pending'] as const) for (let cells = 0; cells <= 12; cells++) {
    expect(barCells({ ...row, state }, cells, NOW)).toEqual([])
  }
})

test('waiting without todos keeps the dotted unknown terminal bar', () => {
  for (let cells = 2; cells <= 12; cells++) {
    const state = 'waiting'
    const runs = expanded(barCells({ ...row, state }, cells, NOW))
    expect(runs).toHaveLength(cells)
    expect(runs.every(c => c.glyph === '\u254c' && c.dim === true)).toBe(true)
  }
})

test('finished bars fill completely in the actual outcome color', () => {
  for (const [state, color] of [['completed', '#94b7e8'], ['failed', '#f2a3b2'], ['killed', '#7b776c']] as const) {
    const runs = expanded(barCells({ ...row, state }, 10, NOW))
    expect(runs).toHaveLength(10)
    expect(runs.every(c => c.glyph === '\u2501' && c.color === color && !c.dim)).toBe(true)
  }
  expect(barCells(row, 0, NOW)).toEqual([])
})
