import type { System } from '../types'
import { severityColor } from './bars'

const INK = '#8b8b8b'
const TRACK = 'rgba(139,139,139,0.22)'
export const GAUGE = 52
export const METER_W = 56
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif"

export type Gauge = { title: string; subtitle: string; percent: number | null; color: string }

/** What the drawer header says about one panel, from the same readings as the pills. */
export function gaugeFor(panel: 'cpu' | 'mem' | 'disk', sys: System): Gauge {
  const title = { cpu: 'CPU', mem: 'Memory', disk: 'Disk' }[panel]
  const percent = panel === 'cpu' ? sys.cpu : panel === 'mem' ? sys.memory : sys.disk?.percent ?? null
  const word = panel === 'cpu' ? 'busy' : 'used'
  const free = panel === 'disk' && sys.disk ? `, ${Math.round(sys.disk.freeGb)} GB free` : ''
  return { title, subtitle: percent === null ? 'No reading yet' : `${Math.round(percent)}% ${word}${free}`, percent, color: percent === null ? INK : severityColor(percent) }
}

/** A round gauge with the percent in the middle. */
export function gaugeSvg(percent: number | null, color: string): string {
  const r = 21
  const c = 2 * Math.PI * r
  const on = (c * Math.max(0, Math.min(100, percent ?? 0))) / 100
  const mid = GAUGE / 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${GAUGE}" height="${GAUGE}" viewBox="0 0 ${GAUGE} ${GAUGE}" font-family="${FONT}">` +
    `<circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="4"/>` +
    (on > 0 ? `<circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${on.toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${mid} ${mid})"/>` : '') +
    `<text x="${mid}" y="${mid + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="${INK}">${percent === null ? '\u2013' : Math.round(percent)}</text>` +
    '</svg>'
  )
}

/** A thin rounded bar for one row, sized against the biggest row. */
export function meterSvg(fraction: number, color: string): string {
  const f = Math.max(0, Math.min(1, fraction))
  const w = f > 0 ? Math.max(4, Math.round(METER_W * f)) : 0
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${METER_W}" height="6" viewBox="0 0 ${METER_W} 6">` +
    `<rect width="${METER_W}" height="6" rx="3" fill="${TRACK}"/>` +
    (w ? `<rect width="${w}" height="6" rx="3" fill="${color}"/>` : '') +
    '</svg>'
  )
}
