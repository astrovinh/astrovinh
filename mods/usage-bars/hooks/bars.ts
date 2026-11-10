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
  // Week only: Day and Ctx left the band on 9 Nov 2026, on both surfaces.
  const full: TerminalLayout = { bar: BAR, labels: 'long', gap: 3, spend: true, system: true, panels: ['week'], bars: true }
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
    percentages
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
/** One pill: a ring around its letter, then the percent, in band units. */
const PILL_W = 50
const PILL_GAP = 10
const PILL_R = 7
/** Where a pill's percent starts, after its ring. */
const PILL_TEXT = PILL_R * 2 + 6
/** The three pills drawn at the band's right end, after one group gap. */
const PILLS_W = GROUP_GAP + PILL_W * 3 + PILL_GAP * 2
/** The machine rings: the same ring as a pill, after the native "All" label, with no percent. */
const ALL_LABEL = 'All'
const MACHINE_W = PILL_R * 2 + 2
const MACHINE_GAP = 7
const ALL_W = 22
function machinesW(n: number): number {
  return n ? ALL_W + n * MACHINE_W + (n - 1) * MACHINE_GAP : 0
}

export const BAND_W = PAD * 2 + (GROUP_FIXED + BAR_MAX) * 3 + GROUP_GAP * 4 + COST_W
export const BAND_H = 42

/** One text size everywhere: 11 band units at this scale is about the host's small native text. */
export const BAND_SCALE = 1.15
/** The widest the module grows on a wide session, in CSS px; it stays centred. */
export const MODULE_MAX_PX = 1200
/** The band's own side padding in CSS px; the drawer is inset by it so both share the same text edges. */
export function bandInset(layout: { scale: number }): number {
  return PAD * layout.scale
}

/** Kept for callers that size cards with the band; the band no longer grows its text with the pane. */
export function bandScale(_columns: number | undefined): number {
  return BAND_SCALE
}

type DesktopLayout = {
  panels: ('day' | 'week' | 'ctx')[]
  spend: boolean
  system: boolean
  barW: number
  scale: number
  width: number
  /** Where the pills start, in band units. */
  pillsX: number
  /** How many machine rings fit, and where their "All" label starts, in band units. */
  machines: number
  machinesX: number
}

/**
 * One line at any width: Week, then the machine rings, then the C M D pills. The bar shrinks first,
 * then dollars go, then the machine rings, never W or the pills. The band then widens to the session
 * (up to MODULE_MAX_PX), the pills at the right edge and the machine rings centred in the room before them.
 */
export function desktopLayout(columns: number | undefined, spend = true, system = true, machines = 0): DesktopLayout {
  const scale = bandScale(columns)
  const available = columns === undefined ? Infinity : columns * 7 - 16
  const pills = system ? PILLS_W : 0
  const budget = available / scale - pills
  const week = ['week'] as DesktopLayout['panels']
  const candidates = [
    { panels: week, spend, machines },
    { panels: week, spend: false, machines },
    { panels: week, spend: false, machines: 0 }
  ]
  for (const c of candidates) {
    const n = c.panels.length
    const fixed = PAD * 2 + n * GROUP_FIXED + (n - 1) * GROUP_GAP + (c.spend ? GROUP_GAP + COST_W : 0) + (c.machines ? GROUP_GAP + machinesW(c.machines) : 0)
    const barW = Math.min(BAR_MAX, Math.floor((budget - fixed) / n))
    if (barW >= BAR_MIN) return widen({ ...c, system, barW, scale, width: (fixed + n * barW + pills) * scale, pillsX: 0, machinesX: 0 }, available)
  }
  return widen({ panels: [], spend: false, system, barW: BAR_MIN, scale, width: system ? (PAD * 2 + PILLS_W - GROUP_GAP) * scale : 0, pillsX: 0, machines: 0, machinesX: 0 }, available)
}

function widen(l: DesktopLayout, available: number): DesktopLayout {
  // With only the pills left there is nothing to put the spare room after, so the pills stay their own width and centre.
  if (!l.width || !l.panels.length) return l
  const width = Math.max(l.width, Math.min(available, MODULE_MAX_PX))
  const end = l.panels.length * (GROUP_FIXED + l.barW + GROUP_GAP) - GROUP_GAP + (l.spend ? GROUP_GAP + COST_W : 0)
  const pillsX = l.system ? width / l.scale - PAD * 2 - (PILLS_W - GROUP_GAP) : width / l.scale - PAD * 2
  const room = pillsX - end - GROUP_GAP * 2
  return { ...l, width, pillsX: l.system ? pillsX : 0, machinesX: end + GROUP_GAP + Math.max(0, (room - machinesW(l.machines)) / 2) }
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

import type { MachineRow, Spend, System } from '../types'
export type { MachineRow }
import { ring } from './system'

/** One ring per machine: how busy it is now, or off when its last reading is too old. */
export type MachineRing = { name: string; load: number | null; off: boolean }

type BandInput = { day?: Reading; week?: Reading; segments: Seg[]; contextPercent: number | null; spend: Spend | null; system: System | null; now: number; machines?: MachineRing[] }

/** Dollars cut short, never rounded up: $0.42, $3.4, $12, $1.2k, $12k. */
export function usd(n: number): string {
  const cut = (x: number, places: number) => (Math.floor(x * 10 ** places + 1e-9) / 10 ** places).toFixed(places)
  if (n < 1) return `$${cut(n, 2)}`
  if (n < 10) return `$${cut(n, 1)}`
  if (n < 1000) return `$${cut(n, 0)}`
  if (n < 10000) return `$${cut(n / 1000, 1)}k`
  return `$${cut(n / 1000, 0)}k`
}

/** Week, the machine rings and the C M D pills share one row. */
export function bandSvg(a: BandInput, columns?: number): { source: string; alt: string; width: number; height: number; layout: DesktopLayout; inner: string } {
  const machines = a.machines ?? []
  const layout = desktopLayout(columns, a.spend !== null, a.system !== null, machines.length)

  const pct = (r?: Reading) => (r ? `${Math.round(r.percentUsed)}%` : 'no reading')
  const alt =
    `Week ${pct(a.week)}` +
    (a.spend === null ? '' : `, This week ${usd(a.spend.week)}`) +
    (layout.machines ? machines.map(m => `, ${m.name} ${m.off || m.load === null ? 'off' : `${Math.round(m.load)}%`}`).join('') : '') +
    sysItems(a.system).map(i => `, ${i.name} ${Math.round(i.percent)}%`).join('')

  const width = layout.width
  const height = BAND_H * layout.scale
  const baseWidth = width / layout.scale
  // Week's letter is the native button in the row at this spot (see bandParts), so the picture leaves it out.
  const groups = layout.panels.map((_, i) => limitGroup(i, '', a.week, layout.barW)).join('')
  const inner =
    `<g transform="translate(${PAD} ${(BAND_H - H) / 2})">` + groups +
    (!layout.spend || a.spend === null ? '' : `<text x="${layout.panels.length * (GROUP_FIXED + layout.barW + GROUP_GAP)}" y="10.5" fill="${INK}">${usd(a.spend.week)}</text>`) +
    (layout.machines ? machinesMarkup(machines, layout.machinesX + ALL_W) : '') +
    (layout.system ? pillsMarkup(a.system, layout.pillsX) : '') +
    `</g>`
  const source = svgOpen(baseWidth, BAND_H, layout.scale, 11) + inner + `</svg>`

  return { source: width ? source : '', alt, width, height, layout, inner }
}

export type BandPart =
  | { kind: 'picture'; source: string; alt: string; width: number; height: number }
  | { kind: 'button'; key: string; label: string; panel: Panel | 'week' | 'machines' }

/**
 * The band as it is drawn on the desktop: windows onto the one picture, with a native text button
 * in each gap where the picture leaves its label out (W, and each readable pill's percent).
 * Buttons laid OVER a picture are never drawn there, so every button sits in the row itself.
 */
export function bandParts(band: ReturnType<typeof bandSvg>, sys: System | null): BandPart[] {
  const { layout, inner, alt } = band
  if (!band.width) return []
  const base = band.width / layout.scale
  const week = layout.panels.indexOf('week')
  const slots: { x: number; label: string; key: string; panel: Panel | 'week' | 'machines' }[] = [
    ...(week < 0 ? [] : [{ x: PAD + week * (GROUP_FIXED + layout.barW + GROUP_GAP), label: 'W', key: 'usage-week', panel: 'week' as const }]),
    ...(!layout.machines ? [] : [{ x: PAD + layout.machinesX, label: ALL_LABEL, key: 'usage-machines', panel: 'machines' as const }]),
    ...(!layout.system ? [] : systemPills(sys).flatMap((p, i) => p.enabled
      ? [{ x: PAD + layout.pillsX + i * (PILL_W + PILL_GAP) + PILL_TEXT, label: p.value, key: `usage-${p.panel}`, panel: p.panel }]
      : []))
  ]
  const parts: BandPart[] = []
  let from = 0
  const window = (to: number) => {
    if (to - from < 0.5) return
    parts.push({
      kind: 'picture',
      // Shift the drawing, not the viewBox: the desktop drops a picture whose viewBox starts anywhere but 0.
      source: svgOpen(to - from, BAND_H, layout.scale, 11) + `<g transform="translate(${-from} 0)">${inner}</g>` + '</svg>',
      // Every picture needs a description: the desktop skips a picture whose alt is empty.
      alt: parts.length ? 'Usage band' : alt,
      width: (to - from) * layout.scale,
      height: BAND_H * layout.scale
    })
  }
  for (const s of slots) {
    window(s.x)
    parts.push({ kind: 'button', key: s.key, label: s.label, panel: s.panel })
    // The button's own text takes about the width the picture would have drawn.
    from = s.x + textWidth(s.label) * 1.1
  }
  window(base)
  return parts
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

/** Each pill's letter inside a severity ring filled to the reading, then the percent; a null reading draws only the track. */
function pillsMarkup(sys: System | null, x0: number): string {
  return systemPills(sys).map((p, i) => {
    const x = x0 + i * (PILL_W + PILL_GAP)
    const cy = H / 2
    return (
      ring(x + PILL_R + 1, cy, PILL_R, p.percent ?? 0, p.color, TRACK) +
      `<text x="${x + PILL_R + 1}" y="${cy + 3.5}" text-anchor="middle" font-size="9" fill="${INK}">${p.label}</text>` +
      // A pressable pill's percent is the native button laid over this spot (see pillHits); only a missing reading is drawn here.
      (p.enabled ? '' : `<text x="${x + PILL_TEXT}" y="10.5" fill="${FAINT}">${p.value}</text>`)
    )
  }).join('')
}

/** Each machine's name inside a ring filled to its load, the same ring as a pill; an off machine draws a dotted track. */
function machinesMarkup(machines: MachineRing[], x0: number): string {
  return machines.map((m, i) => {
    const cx = x0 + i * (MACHINE_W + MACHINE_GAP) + PILL_R + 1
    const cy = H / 2
    const off = m.off || m.load === null
    return (
      (off
        ? `<circle cx="${cx}" cy="${cy}" r="${PILL_R}" fill="none" stroke="${FAINT}" stroke-width="2" stroke-dasharray="2 2"/>`
        : ring(cx, cy, PILL_R, m.load!, severityColor(m.load!), TRACK)) +
      `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="${m.name.length > 2 ? 6 : 8}" fill="${off ? FAINT : INK}">${esc(m.name)}</text>`
    )
  }).join('')
}

/** Plain words for how long ago a reading came in. */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 15) return 'now'
  if (s < 60) return `${s} s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}


/** The All drawer: each machine on one line with its CPU, memory and disk bars and when it last reported. */
export function machinesSvg(rows: MachineRow[], now: number, scale: number, maxWidth: number, stale: number): Card {
  const width = maxWidth / scale
  const nameW = 64
  const seenW = 74
  const cols = ['CPU', 'Memory', 'Disk']
  const colW = Math.max(30, (width - PAD * 2 - nameW - seenW) / 3)
  const rowH = 22
  const top = PAD + 14
  const parts: string[] = [`<line x1="${PAD}" y1="1" x2="${width - PAD}" y2="1" stroke="${TRACK}"/>`]
  cols.forEach((c, i) => parts.push(`<text x="${PAD + nameW + i * colW}" y="${top}" font-size="11" fill="${FAINT}">${c}</text>`))
  rows.forEach((r, j) => {
    const y = top + 10 + j * rowH
    const off = r.at === null || now - r.at > stale
    parts.push(`<text x="${PAD}" y="${y + 9}" font-size="12" fill="${off ? FAINT : INK}">${esc(r.name)}</text>`)
    ;[r.cpu, r.memory, r.disk].forEach((v, i) => {
      const x = PAD + nameW + i * colW
      const w = colW - 12
      parts.push(`<rect x="${x}" y="${y + 3}" width="${w}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${TRACK}"/>`)
      if (!off && v !== null && v > 0) parts.push(`<rect x="${x}" y="${y + 3}" width="${Math.max(BAR_H, (w * v) / 100)}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${severityColor(v)}"/>`)
    })
    const seen = r.at === null ? 'no reading yet' : off ? `off, ${ago(now - r.at)}` : ago(now - r.at)
    parts.push(`<text x="${width - PAD}" y="${y + 9}" text-anchor="end" font-size="11" fill="${FAINT}">${seen}</text>`)
  })
  const height = top + 10 + rows.length * rowH + PAD / 2
  const alt = rows.map(r => {
    const off = r.at === null || now - r.at > stale
    const p = (n: number | null) => (n === null ? 'no reading' : `${Math.round(n)}%`)
    return off ? `${r.name} off` : `${r.name} CPU ${p(r.cpu)}, memory ${p(r.memory)}, disk ${p(r.disk)}`
  }).join('; ') || 'No machines yet'
  return { source: svgOpen(width, height, scale, 12) + parts.join('') + '</svg>', alt, width: maxWidth, height: height * scale }
}

/** Where each pressable pill sits in the band, in CSS px, for the invisible buttons laid over it. */
export function pillHits(layout: DesktopLayout, sys: System | null): { panel: Panel; left: number; width: number; label: string }[] {
  if (!layout.system) return []
  return systemPills(sys).flatMap((p, i) => p.enabled ? [{ panel: p.panel, left: (PAD + layout.pillsX + i * (PILL_W + PILL_GAP) + PILL_TEXT) * layout.scale, width: (PILL_W - PILL_TEXT) * layout.scale, label: p.value }] : [])
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
