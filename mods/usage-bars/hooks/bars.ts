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

const COST_W = 36

export const BAND_W = (GROUP_W + GROUP_GAP) * 3 + COST_W
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

import type { Spend, System } from '../types'
import { ring, ringColor } from './system'

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

/** Day, Week and Ctx as one row: tiny labels, thin rounded bars. */
export function bandSvg(a: BandInput): { source: string; alt: string; width: number } {
  const { cells } = contextCells(a.segments, BAR_W)
  const ctxFills = cells.map(c => ({ width: c.width, color: c.color ?? (c.glyph === '─' ? BUFFER : 'transparent') }))

  const pct = (r?: Reading) => (r ? `${Math.round(r.percentUsed)}%` : 'no reading')
  const alt =
    `Day ${pct(a.day)}, Week ${pct(a.week)}, Context ${a.contextPercent === null ? 'no reading' : `${Math.round(a.contextPercent)}%`}` +
    (a.spend === null ? '' : `, This week ${usd(a.spend.week)}`) +
    sysItems(a.system).map(i => `, ${i.name} ${Math.round(i.percent)}%`).join('')

  const rings = sysRings(a.system, (GROUP_W + GROUP_GAP) * 3 + COST_W + RING_GAP)
  const width = rings.width || BAND_W
  const source =
    svgOpen(width) +
    limitGroup(0, 'Day', a.day) +
    limitGroup(1, 'Week', a.week) +
    group(2, 'Ctx', ctxFills, a.segments.length ? a.contextPercent : null) +
    (a.spend === null ? '' : `<text x="${(GROUP_W + GROUP_GAP) * 3}" y="10.5" fill="${INK}">${usd(a.spend.week)}</text>`) +
    rings.source +
    `</svg>`

  return { source, alt, width }
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

const RING_GAP = 10
const RING_R = 5

/** CPU, memory, disk and battery as small rings, each with its label and percent, from `x`. */
function sysRings(s: System | null, x: number): { source: string; width: number } {
  const items = sysItems(s)
  if (!items.length) return { source: '', width: 0 }
  let at = x
  const parts = items.map(i => {
    const text = `${i.label} ${Math.round(i.percent)}%`
    const part =
      ring(at + RING_R + 1, H / 2, RING_R, i.percent, ringColor(i.kind, i.percent), TRACK) +
      `<text x="${at + 2 * RING_R + 6}" y="10.5" fill="${INK}">${text}</text>`
    at += 2 * RING_R + 6 + textWidth(text) + RING_GAP
    return part
  })
  return { source: parts.join(''), width: Math.ceil(at - RING_GAP) }
}

/** About how wide `s` draws at 10px in the system font, a little generous so text never collides. */
export function textWidth(s: string): number {
  let w = 0
  for (const ch of s) w += /[0-9]/.test(ch) ? 6.1 : /[%MWmw]/.test(ch) ? 8.6 : /[A-Z]/.test(ch) ? 6.9 : /[a-z]/.test(ch) ? 5.4 : ch === ' ' ? 2.8 : 4.2
  return w * 1.05
}

const LINE_GAP = 14

/** Shown on hover, two short lines: limits and spend; then the machine and each context category beside its bar color. */
export function detailSvg(a: BandInput): { source: string; alt: string; width: number; height: number } {
  const parts: string[] = []
  const words: string[] = []
  const ends: number[] = []
  let x = 0
  let line = 0
  const say = (s: string) => {
    parts.push(`<text x="${x}" y="${10.5 + line * H}" fill="${FAINT}">${esc(s)}</text>`)
    words.push(s)
    x += textWidth(s) + LINE_GAP
  }
  const newLine = () => {
    ends.push(x)
    x = 0
    line += 1
  }

  if (a.day?.resetsAt) say(`Day resets in ${untilReset(a.day.resetsAt, a.now)}`)
  if (a.week?.resetsAt) say(`Week resets in ${untilReset(a.week.resetsAt, a.now)}`)
  if (!a.day && !a.week) say('No limit reading yet')
  if (a.spend !== null) {
    const n = a.spend.sessionsToday
    say(`Week $${a.spend.week.toFixed(2)} · today $${a.spend.today.toFixed(2)} in ${n} session${n === 1 ? '' : 's'} · this session $${a.spend.session.toFixed(2)} · API prices`)
  }

  const s = a.system
  const used = a.segments.filter(seg => seg.kind === 'used' && seg.tokens > 0)
  if (s || used.length) newLine()
  if (s?.cpu != null) say(`CPU ${Math.round(s.cpu)}% of ${s.cores} cores`)
  if (s?.memory != null) say(`Memory ${Math.round(s.memory)}%${s.memoryGb ? ` of ${Math.round(s.memoryGb)} GB` : ''}`)
  if (s?.disk) say(`Disk ${Math.round(s.disk.freeGb)} GB free`)
  if (s?.battery) say(`Battery ${Math.round(s.battery.percent)}%, ${s.battery.state}`)

  const { legend } = contextCells(a.segments, BAR_W)
  used.forEach((seg, i) => {
    parts.push(`<circle cx="${x + 3}" cy="${7 + line * H}" r="3" fill="${legend[i]?.color ?? INK}"/>`)
    x += 9
    say(`${seg.name} ${tokens(seg.tokens)}`)
  })
  ends.push(x)

  const width = Math.max(1, Math.ceil(Math.max(...ends) - LINE_GAP))
  const height = (line + 1) * H
  return { source: svgOpen(width, height) + parts.join('') + `</svg>`, alt: words.join(', '), width, height }
}

function svgOpen(width: number, height = H): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" font-size="10" style="font-variant-numeric:tabular-nums">`
  )
}
