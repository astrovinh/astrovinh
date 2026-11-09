import type { System } from '../types'
import { esc, severityColor } from './bars'

const INK = '#8b8b8b'
const NAME = '#a9a9a9'
const TRACK = 'rgba(139,139,139,0.22)'
const OTHER = 'rgba(139,139,139,0.55)'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif"
/** One colour per listed row, the same in the share bar and the row's dot. */
export const LEGEND = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#378ADD', '#BA7517']
/** The host measures the drawer in code-font cells; pictures are drawn in CSS px. */
export const CELL_PX = 7
export const SHARE_H = 56
export const ROW_H = 22

export type Gauge = { title: string; subtitle: string; percent: number | null; color: string; capacity: number }

/** What the drawer header says about one panel, from the same readings as the pills, and what 100% of it is. */
export function gaugeFor(panel: 'cpu' | 'mem' | 'disk', sys: System): Gauge {
  const title = { cpu: 'CPU', mem: 'Memory', disk: 'Disk' }[panel]
  const percent = panel === 'cpu' ? sys.cpu : panel === 'mem' ? sys.memory : sys.disk?.percent ?? null
  const color = percent === null ? INK : severityColor(percent)
  const p = percent === null ? null : Math.round(percent)
  if (panel === 'cpu') return { title, subtitle: p === null ? 'No reading yet' : `${p}% busy${sys.cores ? ` \u00b7 ${sys.cores} cores` : ''}`, percent, color, capacity: Math.max(1, sys.cores) * 100 }
  if (panel === 'mem') {
    const total = sys.memoryGb ?? 0
    return { title, subtitle: p === null ? 'No reading yet' : `${p}% used${total ? ` \u00b7 ${Math.round((total * p) / 100)} of ${Math.round(total)} GB` : ''}`, percent, color, capacity: total * 1e9 }
  }
  const free = sys.disk?.freeGb ?? 0
  const total = sys.disk && sys.disk.percent < 100 ? (free * 1e9) / (1 - sys.disk.percent / 100) : 0
  return { title, subtitle: p === null ? 'No reading yet' : `${p}% used \u00b7 ${Math.round(free)} GB free`, percent, color, capacity: total }
}

function open(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}" style="font-variant-numeric:tabular-nums">`
}

/**
 * The header: title, reading, and one bar split by the listed rows in their legend colours,
 * the rest of the reading in grey, and what is free as the track.
 */
export function shareSvg(g: Gauge, shares: number[], width: number): string {
  const w = Math.max(80, width)
  const barY = 40
  const used = Math.max(0, Math.min(1, (g.percent ?? 0) / 100))
  let x = 0
  const runs = shares.map((s, i) => {
    const run = Math.max(s > 0 ? 3 : 0, Math.round(w * Math.max(0, s)))
    const r = run ? `<rect x="${x}" y="${barY}" width="${run}" height="8" fill="${LEGEND[i % LEGEND.length]}"/>` : ''
    x += run
    return r
  }).join('')
  const rest = Math.max(0, Math.round(w * used) - x)
  return (
    open(w, SHARE_H) +
    // A hairline parts the drawer from the band above it.
    `<rect width="${w}" height="0.5" fill="${TRACK}"/>` +
    `<text x="0" y="28" font-size="13" font-weight="600" fill="${NAME}">${esc(g.title)}</text>` +
    `<text x="${w}" y="28" font-size="12" text-anchor="end" fill="${INK}">${esc(g.subtitle)}</text>` +
    `<clipPath id="share"><rect y="${barY}" width="${w}" height="8" rx="4"/></clipPath>` +
    `<rect y="${barY}" width="${w}" height="8" rx="4" fill="${TRACK}"/>` +
    `<g clip-path="url(#share)">${runs}${rest ? `<rect x="${x}" y="${barY}" width="${rest}" height="8" fill="${OTHER}"/>` : ''}</g>` +
    '</svg>'
  )
}

/**
 * One legend row: its colour dot, the name, a quiet note, and the amount ending at `width`.
 * A `tail` (such as "protected") is drawn in the action column after it, `tailPx` wide.
 */
export function rowSvg(color: string | null, name: string, note: string, amount: string, width: number, tail = '', tailPx = 0): string {
  const w = Math.max(80, width)
  const cy = ROW_H / 2
  const nameX = color ? 16 : 0
  return (
    open(w + (tail ? tailPx : 0), ROW_H) +
    (tail ? `<text x="${w + 10}" y="${cy + 4}" font-size="12" fill="${INK}">${esc(tail)}</text>` : '') +
    (color ? `<circle cx="5" cy="${cy}" r="4" fill="${color}"/>` : '') +
    `<text x="${nameX}" y="${cy + 4}" font-size="12" fill="${NAME}">${esc(name)}` +
    (note ? `<tspan dx="8" font-size="11" fill="${INK}">${esc(note)}</tspan>` : '') + '</text>' +
    `<text x="${w}" y="${cy + 4}" font-size="12" text-anchor="end" fill="${NAME}">${esc(amount)}</text>` +
    '</svg>'
  )
}
