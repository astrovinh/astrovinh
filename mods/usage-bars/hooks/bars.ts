// Pure helpers: turn numbers into cell counts and labels.

export type Cell = { width: number; color?: string; dim?: boolean; glyph: string }

const BAR = 10 // full terminal bar cells
const LABELS = { day: 'Day', week: 'Week', ctx: 'Ctx' }

export type TerminalLayout = {
  bar: number
  labels: 'long' | 'short'
  gap: number
  spend: boolean
  system: boolean
  panels: ('day' | 'week' | 'ctx')[]
  bars: boolean
}

/** Worst-case cells: percentages reserve " 100%", regardless of the current reading. */
export function layoutWidth(layout: TerminalLayout, spendChars: number): number {
  const panels = layout.panels.reduce((width, panel) => {
    const label = layout.labels === 'long' ? LABELS[panel].length : 1
    // Without bars, the label's trailing space is also the percent's separator.
    return width + label + (layout.bars ? 1 + layout.bar : 0) + 5
  }, 0)
  const gaps = Math.max(0, layout.panels.length - 1) * layout.gap
  const spend = layout.spend && spendChars > 0 ? layout.gap + spendChars : 0
  const system = layout.system ? 3 + 8 + 3 + 8 + 3 + 9 : 0
  return panels + gaps + spend + system
}

/** Prefer the richest band that fits, keeping one terminal cell spare. */
export function terminalLayout(columns: number | undefined, spendChars: number): TerminalLayout {
  const full: TerminalLayout = { bar: BAR, labels: 'long', gap: 3, spend: true, system: true, panels: ['day', 'week', 'ctx'], bars: true }
  if (columns === undefined) return full
  const compact: TerminalLayout = { ...full, bar: 6, gap: 2, system: false }
  const short: TerminalLayout = { ...compact, bar: 4, labels: 'short', spend: false }
  const percentages: TerminalLayout = { ...short, bar: 0, bars: false }
  const candidates: TerminalLayout[] = [
    full,
    { ...full, system: false },
    compact,
    { ...compact, spend: false },
    short,
    percentages,
    { ...percentages, panels: ['day'] }
  ]
  return candidates.find(layout => layoutWidth(layout, spendChars) <= columns - 1) ?? { ...percentages, panels: [] }
}

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
    cells[i] = cells[i]! + 1
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
  let [u, f] = allocate([used, 100 - used], width) as [number, number]
  // a non-zero reading always shows at least one cell
  if (used > 0 && u === 0 && width > 0) {
    u = 1
    f = width - 1
  }

  return [
    { width: u, color: severityColor(used), glyph: '\u2501' },
    { width: f, dim: true, glyph: '\u2501' }
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
      const color = PALETTE[used % PALETTE.length]!
      used += 1
      legend.push({ name: s.name, color })
      cells.push({ width: counts[i]!, color, glyph: '\u2501' })
    } else if (s.kind === 'buffer') {
      cells.push({ width: counts[i]!, dim: true, glyph: '\u2500' })
    } else {
      cells.push({ width: counts[i]!, dim: true, glyph: '\u2501' })
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
const LABEL_W = 24
const BAR_MAX = 56
const BAR_MIN = 12
const PCT_GAP = 5
const PCT_W = 30
const GROUP_GAP = 14
const GROUP_FIXED = LABEL_W + PCT_GAP + PCT_W
const INK = '#8b8b8b'
const FAINT = 'rgba(139,139,139,0.45)'
const TRACK = 'rgba(139,139,139,0.22)'
const BUFFER = 'rgba(139,139,139,0.38)'

const COST_W = 48
const PAD = 12
export const PILL_H = 28
export const PILL_RING = 10
/** The three text pills beside the band, worst case, in CSS px: ring, gap and "C 100%". They do not scale with the band. */
const PILLS_PX = 190

export const BAND_W = PAD * 2 + (GROUP_FIXED + BAR_MAX) * 3 + GROUP_GAP * 4 + COST_W
export const BAND_H = 42

/** The host measures panes in code-font cells; SVGs draw in CSS pixels. */
export function bandScale(columns: number | undefined): number {
  const available = columns === undefined ? BAND_W + PILLS_PX : columns * 7 - 16
  return Math.max(1.15, Math.min(1.6, (available - PILLS_PX) / BAND_W))
}

type DesktopLayout = {
  panels: ('day' | 'week' | 'ctx')[]
  spend: boolean
  system: boolean
  barW: number
  scale: number
  width: number
}

/** One line at any width: the bars shrink first, then dollars, then panels go, never the pills. */
export function desktopLayout(columns: number | undefined, spend = true, system = true): DesktopLayout {
  const scale = bandScale(columns)
  const available = columns === undefined ? Infinity : columns * 7 - 16
  const budget = (available - (system ? PILLS_PX : 0)) / scale
  const all = ['day', 'week', 'ctx'] as DesktopLayout['panels']
  const candidates = [
    { panels: all, spend },
    { panels: all, spend: false },
    { panels: ['day', 'week'] as DesktopLayout['panels'], spend: false },
    { panels: ['day'] as DesktopLayout['panels'], spend: false }
  ]
  for (const c of candidates) {
    const n = c.panels.length
    const fixed = PAD * 2 + n * GROUP_FIXED + (n - 1) * GROUP_GAP + (c.spend ? GROUP_GAP + COST_W : 0)
    const barW = Math.min(BAR_MAX, Math.floor((budget - fixed) / n))
    if (barW >= BAR_MIN) return { ...c, system, barW, scale, width: (fixed + n * barW) * scale }
  }
  return { panels: [], spend: false, system, barW: BAR_MIN, scale, width: 0 }
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))
}

function tokens(n: number): string {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

/** One label + bar + percent; `fills` are the bar's colored runs, in pixels from the left. */
function group(i: number, label: string, fills: { width: number; color: string }[], pct: number | null, barW: number): string {
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
    `<g transform="translate(${i * (GROUP_FIXED + barW + GROUP_GAP)} 0)">` +
    `<text x="0" y="10.5" fill="${INK}">${label}</text>` +
    `<g transform="translate(${LABEL_W} ${(H - BAR_H) / 2})">` +
    `<clipPath id="c${i}"><rect width="${barW}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath>` +
    `<rect width="${barW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${TRACK}"/>` +
    `<g clip-path="url(#c${i})">${runs}</g></g>` +
    `<text x="${LABEL_W + barW + PCT_GAP}" y="10.5" fill="${pct === null ? FAINT : INK}">${pct === null ? '\u2013' : `${Math.round(pct)}%`}</text>` +
    `</g>`
  )
}

function limitGroup(i: number, label: string, r: Reading | undefined, barW: number): string {
  if (!r) return group(i, label, [], null, barW)
  const used = limitCells(r.percentUsed, barW)[0]!
  return group(i, label, [{ width: used.width, color: used.color! }], r.percentUsed, barW)
}

import type { Spend, System } from '../types'
import { ring } from './system'

type BandInput = { day?: Reading; week?: Reading; segments: Seg[]; contextPercent: number | null; spend: Spend | null; system: System | null; now: number }

/** Dollars cut short, never rounded up: $0.42, $3.4, $12, $1.2k, $12k. */
export function usd(n: number): string {
  const cut = (x: number, places: number) => (Math.floor(x * 10 ** places + 1e-9) / 10 ** places).toFixed(places)
  if (n < 1) return `$${cut(n, 2)}`
  if (n < 10) return `$${cut(n, 1)}`
  if (n < 1000) return `$${cut(n, 0)}`
  if (n < 10000) return `$${cut(n / 1000, 1)}k`
  return `$${cut(n / 1000, 0)}k`
}

/** Day, Week and Ctx share one row; native pill buttons sit over its right side. */
export function bandSvg(a: BandInput, columns?: number): { source: string; alt: string; width: number; height: number; layout: DesktopLayout } {
  const layout = desktopLayout(columns, a.spend !== null, a.system !== null)
  const { cells } = contextCells(a.segments, layout.barW)
  const ctxFills = cells.map(c => ({ width: c.width, color: c.color ?? (c.glyph === '\u2500' ? BUFFER : 'transparent') }))

  const pct = (r?: Reading) => (r ? `${Math.round(r.percentUsed)}%` : 'no reading')
  const alt =
    `Day ${pct(a.day)}, Week ${pct(a.week)}, Context ${a.contextPercent === null ? 'no reading' : `${Math.round(a.contextPercent)}%`}` +
    (a.spend === null ? '' : `, This week ${usd(a.spend.week)}`) +
    sysItems(a.system).map(i => `, ${i.name} ${Math.round(i.percent)}%`).join('')

  const width = layout.width
  const height = BAND_H * layout.scale
  const baseWidth = width / layout.scale
  const groups = layout.panels.map((panel, i) => panel === 'ctx'
    ? group(i, 'Ctx', ctxFills, a.segments.length ? a.contextPercent : null, layout.barW)
    : limitGroup(i, panel === 'day' ? 'D' : 'W', panel === 'day' ? a.day : a.week, layout.barW)).join('')
  const source =
    svgOpen(baseWidth, BAND_H, layout.scale, 11) +
    `<g transform="translate(${PAD} ${(BAND_H - H) / 2})">` + groups +
    (!layout.spend || a.spend === null ? '' : `<text x="${layout.panels.length * (GROUP_FIXED + layout.barW + GROUP_GAP)}" y="10.5" fill="${INK}">${usd(a.spend.week)}</text>`) +
    `</g>` +
    `</svg>`

  return { source: width ? source : '', alt, width, height, layout }
}

type SysItem = { label: string; name: string; percent: number; kind: 'load' | 'battery' }

function sysItems(s: System | null): SysItem[] {
  if (!s) return []
  const items: (SysItem | null)[] = [
    s.cpu === null ? null : { label: 'CPU', name: 'CPU', percent: s.cpu, kind: 'load' },
    s.memory === null ? null : { label: 'Mem', name: 'Memory', percent: s.memory, kind: 'load' },
    s.disk === null ? null : { label: 'Disk', name: 'Disk', percent: s.disk.percent, kind: 'load' },
    s.battery === null ? null : { label: 'Bat', name: 'Battery', percent: s.battery.percent, kind: 'battery' }
  ]
  return items.filter((i): i is SysItem => i !== null)
}

export type Panel = 'cpu' | 'mem' | 'disk'

/** Missing readings remain visible but are never controls. */
export function systemPills(sys: System | null) {
  if (sys === null) return []
  return ([
    { panel: 'cpu', label: 'C', percent: sys.cpu },
    { panel: 'mem', label: 'M', percent: sys.memory },
    { panel: 'disk', label: 'D', percent: sys.disk?.percent ?? null }
  ] as const).map(p => ({
    ...p,
    value: p.percent === null ? '\u2013' : `${Math.round(p.percent)}%`,
    color: p.percent === null ? INK : severityColor(p.percent),
    enabled: p.percent !== null
  }))
}

/** The severity ring beside a pill's label, filled to the reading; a null reading draws only the track. */
export function pillRingSvg(percent: number | null, color: string): string {
  return svgOpen(PILL_RING, PILL_RING) + ring(PILL_RING / 2, PILL_RING / 2, 4.5, percent ?? 0, color, TRACK) + '</svg>'
}

export function spacerSvg(width: number, height = 1): string {
  return svgOpen(width, height) + `<rect width="${width}" height="${height}" fill="none"/>` + '</svg>'
}

/** Where the Week group sits in the band, in pixels, so the hover can be aimed at it alone. */
export function weekHover(layout: DesktopLayout): { left: number; width: number; height: number } | null {
  const i = layout.panels.indexOf('week')
  if (i < 0) return null
  const groupW = GROUP_FIXED + layout.barW
  return { left: (PAD + i * (groupW + GROUP_GAP)) * layout.scale, width: groupW * layout.scale, height: BAND_H * layout.scale }
}

/** About how wide `s` draws at 10px in the system font, a little generous so text never collides. */
export function textWidth(s: string): number {
  let w = 0
  for (const ch of s) w += /[0-9]/.test(ch) ? 6.1 : /[%MWmw]/.test(ch) ? 8.6 : /[A-Z]/.test(ch) ? 6.9 : /[a-z]/.test(ch) ? 5.4 : ch === ' ' ? 2.8 : 4.2
  return w * 1.05
}

type CardLine = { text: string; secondary?: boolean; color?: string }
type Card = { source: string; alt: string; width: number; height: number }

/** Wrap at readable size rather than letting the host squeeze a long image. */
function wrapLine(text: string, width: number, font: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && textWidth(next) * font / 10 > width) {
      lines.push(line)
      line = ''
    }
    // A single long category name must fit too; do not silently clip it.
    for (const char of (line ? ` ${word}` : word)) {
      if (line && textWidth(line + char) * font / 10 > width) {
        lines.push(line)
        line = ''
      }
      line += char
    }
  }
  if (line) lines.push(line)
  return lines
}

function card(lines: CardLine[], scale: number, maxWidth: number, reserve = 0): Card {
  const width = maxWidth / scale
  const contentWidth = Math.max(1, width - PAD * 2 - 9)
  const parts: string[] = []
  let y = PAD
  for (const line of lines) {
    const font = line.secondary ? 13 : 14
    wrapLine(line.text, contentWidth, font).forEach((text, i) => {
      if (line.color && i === 0) parts.push(`<circle cx="${PAD + 3}" cy="${y + font / 2}" r="3" fill="${line.color}"/>`)
      parts.push(`<text x="${PAD + (line.color ? 9 : 0)}" y="${y + font}" font-size="${font}" fill="${INK}">${esc(text)}</text>`)
      y += font * 1.5
    })
  }
  const height = y + PAD + reserve
  return {
    source: svgOpen(width, height, scale, 14) + parts.join('') + '</svg>',
    alt: lines.map(l => l.text).join(', '), width: maxWidth, height: height * scale
  }
}

/** One plain hover line with reset times and today's spend. */
export function detailSvg(a: BandInput, scale = 1, maxWidth = BAND_W * scale): Card {
  const parts: string[] = []
  if (a.day?.resetsAt) parts.push(`Day resets in ${untilReset(a.day.resetsAt, a.now)}`)
  if (a.week?.resetsAt) parts.push(`Week resets in ${untilReset(a.week.resetsAt, a.now)}`)
  if (a.spend !== null) parts.push(`Today $${a.spend.today.toFixed(2)}`)
  return card([{ text: parts.join(' \u00b7 ') || 'No limit reading yet' }], scale, maxWidth)
}

/** Lane B can add action rows here; no probes or cleanup commands belong in this shell. */
export function drawer(panel: Panel | null, sys: System | null, scale: number, maxWidth = 360 * scale): Card | null {
  if (!panel || !sys) return null
  const title = { cpu: 'CPU', mem: 'Memory', disk: 'Disk' }[panel]
  const percent = panel === 'cpu' ? sys.cpu : panel === 'mem' ? sys.memory : sys.disk?.percent ?? null
  const text = percent === null ? `${title} \u2013` : `${title} ${Math.round(percent)}% ${panel === 'cpu' ? 'busy' : 'used'}${panel === 'disk' && sys.disk ? `, ${Math.round(sys.disk.freeGb)} GB free` : ''}`
  return card([{ text }], scale, maxWidth, PILL_H)
}

function svgOpen(width: number, height = H, scale = 1, font = 14): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" font-size="${font}" style="font-variant-numeric:tabular-nums">`
  )
}
