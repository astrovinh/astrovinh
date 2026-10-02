// Pure helpers: turn numbers into cell counts and labels.

export type Cell = { width: number; color?: string; dim?: boolean; glyph: string }

/** Split `width` cells across `weights` (largest remainder), so the cells always sum to `width`. */
export function allocate(weights: number[], width: number): number[] {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0 || width <= 0) return weights.map(() => 0)

  const exact = weights.map(w => (w / total) * width)
  const cells = exact.map(Math.floor)
  let left = width - cells.reduce((a, b) => a + b, 0)

  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac)

  for (const { i } of order) {
    if (left <= 0) break
    cells[i] += 1
    left -= 1
  }

  return cells
}

/** Used share of a limit as a bar: a severity-colored used part, dim remainder. */
export function limitCells(percentUsed: number, width: number): Cell[] {
  const used = Math.max(0, Math.min(100, percentUsed))
  let [u, f] = allocate([used, 100 - used], width)
  // a non-zero reading always shows at least one cell
  if (used > 0 && u === 0 && width > 0) {
    u = 1
    f = width - 1
  }
  const color = used >= 85 ? '#f7768e' : used >= 60 ? '#e0af68' : '#9ece6a'

  return [
    { width: u, color, glyph: '█' },
    { width: f, dim: true, glyph: '░' }
  ]
}

export const PALETTE = ['#7aa2f7', '#bb9af7', '#e0af68', '#7dcfff', '#f7768e', '#73daca', '#ff9e64']

export type Seg = { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }

/** Context window as stacked cells: one color per used category, then buffer, then free. */
export function contextCells(segments: Seg[], width: number): { cells: Cell[]; legend: { name: string; color: string }[] } {
  const shown = segments.filter(s => s.kind !== 'deferred' && s.tokens > 0)
  const counts = allocate(shown.map(s => s.tokens), width)
  const legend: { name: string; color: string }[] = []
  let used = 0
  const cells: Cell[] = []

  shown.forEach((s, i) => {
    if (s.kind === 'used') {
      const color = PALETTE[used % PALETTE.length]
      used += 1
      legend.push({ name: s.name, color })
      cells.push({ width: counts[i], color, glyph: '█' })
    } else if (s.kind === 'buffer') {
      cells.push({ width: counts[i], dim: true, glyph: '▒' })
    } else {
      cells.push({ width: counts[i], dim: true, glyph: '░' })
    }
  })

  return { cells, legend }
}

export function untilReset(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return 'now'
  const mins = Math.round(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function labelFor(kind: string): string {
  return kind === 'five_hour' ? 'Day' : kind === 'seven_day' ? 'Wk' : kind === 'spend_limit' ? 'Spend' : kind
}
