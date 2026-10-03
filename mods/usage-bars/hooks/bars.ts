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

/** Green, amber from 60%, red from 85%. */
export function severityColor(percentUsed: number): string {
  return percentUsed >= 85 ? '#f7768e' : percentUsed >= 60 ? '#e0af68' : '#9ece6a'
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

  return [
    { width: u, color: severityColor(used), glyph: '━' },
    { width: f, dim: true, glyph: '━' }
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
      cells.push({ width: counts[i], color, glyph: '━' })
    } else if (s.kind === 'buffer') {
      cells.push({ width: counts[i], dim: true, glyph: '─' })
    } else {
      cells.push({ width: counts[i], dim: true, glyph: '━' })
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

// The desktop band: one small SVG row, sized in CSS pixels.

type Reading = { percentUsed: number; resetsAt?: string }

const H = 14
const BAR_H = 4
const LABEL_W = 32
const BAR_W = 56
const PCT_GAP = 5
const PCT_W = 25
const GROUP_GAP = 14
const GROUP_W = LABEL_W + BAR_W + PCT_GAP + PCT_W
const INK = '#8b8b8b'
const FAINT = 'rgba(139,139,139,0.45)'
const TRACK = 'rgba(139,139,139,0.22)'
const BUFFER = 'rgba(139,139,139,0.38)'

export const BAND_W = GROUP_W * 3 + GROUP_GAP * 2
export const BAND_H = H

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))
}

function tokens(n: number): string {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

/** One label + bar + percent; `fills` are the bar's colored runs, in pixels from the left. */
function group(i: number, label: string, fills: { width: number; color: string }[], pct: number | null): string {
  let x = 0
  const runs = fills
    .filter(f => f.width > 0)
    .map(f => {
      const r = `<rect x="${x}" width="${f.width}" height="${BAR_H}" fill="${f.color}"/>`
      x += f.width
      return r
    })
    .join('')

  return (
    `<g transform="translate(${i * (GROUP_W + GROUP_GAP)} 0)">` +
    `<text x="0" y="10.5" fill="${INK}">${label}</text>` +
    `<g transform="translate(${LABEL_W} ${(H - BAR_H) / 2})">` +
    `<clipPath id="c${i}"><rect width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath>` +
    `<rect width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${TRACK}"/>` +
    `<g clip-path="url(#c${i})">${runs}</g></g>` +
    `<text x="${LABEL_W + BAR_W + PCT_GAP}" y="10.5" fill="${pct === null ? FAINT : INK}">${pct === null ? '–' : `${Math.round(pct)}%`}</text>` +
    `</g>`
  )
}

function limitGroup(i: number, label: string, r: Reading | undefined): string {
  if (!r) return group(i, label, [], null)
  const used = limitCells(r.percentUsed, BAR_W)[0]!
  return group(i, label, [{ width: used.width, color: used.color! }], r.percentUsed)
}

type BandInput = { day?: Reading; week?: Reading; segments: Seg[]; contextPercent: number | null; now: number }

/** Day, Week and Ctx as one row: tiny labels, thin rounded bars. */
export function bandSvg(a: BandInput): { source: string; alt: string } {
  const { cells } = contextCells(a.segments, BAR_W)
  const ctxFills = cells.map(c => ({ width: c.width, color: c.color ?? (c.glyph === '─' ? BUFFER : 'transparent') }))

  const pct = (r?: Reading) => (r ? `${Math.round(r.percentUsed)}%` : 'no reading')
  const alt = `Day ${pct(a.day)}, Week ${pct(a.week)}, Context ${a.contextPercent === null ? 'no reading' : `${Math.round(a.contextPercent)}%`}`

  const source =
    svgOpen(BAND_W) +
    limitGroup(0, 'Day', a.day) +
    limitGroup(1, 'Week', a.week) +
    group(2, 'Ctx', ctxFills, a.segments.length ? a.contextPercent : null) +
    `</svg>`

  return { source, alt }
}

const CHAR_W = 5.6 // a generous average advance at 10px, so text never clips

/** The row shown on hover: reset times, then each context category beside its bar color. */
export function detailSvg(a: BandInput): { source: string; alt: string; width: number } {
  const parts: string[] = []
  const words: string[] = []
  let x = 0
  const say = (s: string) => {
    parts.push(`<text x="${x}" y="10.5" fill="${FAINT}">${esc(s)}</text>`)
    words.push(s)
    x += s.length * CHAR_W + 12
  }

  if (a.day?.resetsAt) say(`Day resets in ${untilReset(a.day.resetsAt, a.now)}`)
  if (a.week?.resetsAt) say(`Week resets in ${untilReset(a.week.resetsAt, a.now)}`)
  if (!a.day && !a.week) say('No limit reading yet')

  const { legend } = contextCells(a.segments, BAR_W)
  a.segments
    .filter(s => s.kind === 'used' && s.tokens > 0)
    .forEach((s, i) => {
      parts.push(`<circle cx="${x + 3}" cy="7" r="3" fill="${legend[i]?.color ?? INK}"/>`)
      x += 9
      say(`${s.name} ${tokens(s.tokens)}`)
    })

  const width = Math.max(1, Math.ceil(x))
  return { source: svgOpen(width) + parts.join('') + `</svg>`, alt: words.join(', '), width }
}

function svgOpen(width: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" font-size="10" style="font-variant-numeric:tabular-nums">`
  )
}
