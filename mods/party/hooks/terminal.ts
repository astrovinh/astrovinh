import type { AgentRow, AnimalKey } from '../types'
import { elapsed } from './roster'

export const ANIMAL_EMOJI: Record<AnimalKey, string> = {
  ember: '\u{1F98A}', hop: '\u{1F430}', sage: '\u{1F989}', bruno: '\u{1F43B}', pan: '\u{1F43C}', pip: '\u{1F438}',
  mochi: '\u{1F431}', mochi2: '\u{1F431}', biscuit: '\u{1F436}', biscuit2: '\u{1F436}', waddle: '\u{1F427}', waddle2: '\u{1F427}'
}

type TerminalRowLayout = { tier: 'wide' | 'medium' | 'narrow' | 'tiny'; name: number; bar: number; status: boolean; tools: boolean }
type Cell = { glyph: string; color?: string; dim?: boolean; width: number }
const COLORS = { running: '#8cc9a1', waiting: '#d6ba7b', completed: '#94b7e8', failed: '#f2a3b2', killed: '#7b776c', pending: '#7b776c', idle: '#7b776c' }

/** Prefer the richest approved tier for this viewport, leaving one cell spare. */
export function terminalRowLayout(columns: number | undefined): TerminalRowLayout {
  if (columns === undefined || columns >= 64) return { tier: 'wide', name: 8, bar: 10, status: true, tools: true }
  if (columns >= 44) return { tier: 'medium', name: 7, bar: 6, status: true, tools: false }
  if (columns >= 24) return { tier: 'narrow', name: 6, bar: 4, status: false, tools: false }
  return { tier: 'tiny', name: 4, bar: 0, status: false, tools: false }
}

/** Worst-case first line: emoji is two cells; names and metadata have bounded columns. */
export function rowWidth(layout: TerminalRowLayout, row: AgentRow): number {
  const meta = layout.tier === 'wide' ? (row.todo ? '3/5 . ' : '') + '999 tools . 99h 59m'
    : layout.tier === 'medium' && row.todo ? '3/5 99h' : '99h'
  return 2 + 1 + layout.name + (layout.status ? 1 + 7 : 0) + (layout.bar ? 1 + layout.bar : 0) + 1 + meta.length
}

/** Compact tiers show the largest elapsed unit; only todo lists supply step counts. */
export function terminalMeta(layout: TerminalRowLayout, row: AgentRow, now: number): string {
  const fullTime = elapsed((row.endedAt ?? now) - row.startedAt)
  const time = layout.tier === 'wide' ? fullTime : fullTime.split(' ')[0]!
  const progress = row.todo ? `${row.todo.done}/${row.todo.total}` : ''
  if (layout.tier === 'tiny') return time
  if (layout.tier === 'narrow') return progress || time
  return [progress, layout.tools ? `${row.tools} ${row.tools === 1 ? 'tool' : 'tools'}` : '', time].filter(Boolean).join(layout.tools ? ' \u00b7 ' : ' ')
}

/** Solid progress is measured, sweeping progress is activity, dotted progress is unknown. */
export function barCells(row: AgentRow, cells: number, now: number): Cell[] {
  if (cells <= 0) return []
  const color = COLORS[row.state]
  if (row.todo) {
    const { done, total } = row.todo
    const filled = done <= 0 ? 0 : done >= total ? cells : Math.max(1, Math.min(cells - 1, Math.round(cells * done / total)))
    return [{ glyph: '\u2501', color, width: filled }, { glyph: '\u2500', dim: true, width: cells - filled }]
  }
  if (row.state === 'running') {
    const bright = Math.min(cells, cells <= 4 ? 2 : 3)
    const travel = cells - bright
    const step = travel ? Math.floor(now / 3000) % (2 * travel) : 0
    const at = step <= travel ? step : 2 * travel - step
    return [
      { glyph: '\u254c', dim: true, width: at },
      { glyph: '\u2501', color, width: bright },
      { glyph: '\u254c', dim: true, width: cells - bright - at }
    ]
  }
  if (row.state === 'completed' || row.state === 'failed' || row.state === 'killed') return [{ glyph: '\u2501', color, width: cells }]
  return [{ glyph: '\u254c', color, dim: true, width: cells }]
}
