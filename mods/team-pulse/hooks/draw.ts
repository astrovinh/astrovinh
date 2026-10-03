// Small SVG drawings for a panel row: the 5-hour bar, the week bar and the 12-hour strip.

import type { Piece } from './strip'

export const ROW_SVG_W = 300
export const ROW_SVG_H = 46
const LABEL_W = 40
const VALUE_W = 36
const BAR_W = ROW_SVG_W - LABEL_W - VALUE_W
const INK = '#8b8b8b'
const TRACK = 'rgba(139,139,139,0.22)'
const STRIP = 'rgba(122,162,247,0.55)'
const STRIP_NOW = '#7aa2f7'

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))
}

export function severity(p: number): string {
  return p >= 85 ? '#f7768e' : p >= 60 ? '#e0af68' : '#9ece6a'
}

function line(y: number, label: string, track: string, value: string): string {
  return (
    `<text x="0" y="${y + 4}" fill="${INK}">${label}</text>` +
    `<g transform="translate(${LABEL_W} ${y - 2})">${track}</g>` +
    `<text x="${ROW_SVG_W}" y="${y + 4}" fill="${INK}" text-anchor="end">${value}</text>`
  )
}

function bar(p: number | null): string {
  const base = `<rect width="${BAR_W - 8}" height="4" rx="2" fill="${TRACK}"/>`
  if (p === null) return base
  const w = Math.max(p > 0 ? 2 : 0, Math.round(((BAR_W - 8) * Math.min(100, p)) / 100))
  return base + `<rect width="${w}" height="4" rx="2" fill="${severity(p)}"/>`
}

function stripTrack(pieces: Piece[]): string {
  const w = BAR_W - 8
  return (
    `<rect y="-1" width="${w}" height="6" rx="3" fill="${TRACK}"/>` +
    pieces
      .map(pc => `<rect x="${(pc.from * w).toFixed(1)}" y="-1" width="${Math.max(1.5, (pc.to - pc.from) * w).toFixed(1)}" height="6" rx="3" fill="${pc.running ? STRIP_NOW : STRIP}"/>`)
      .join('')
  )
}

export function rowSvg(r: { fiveHour: number | null; week: number | null; pieces: Piece[]; hours: number; name: string }): { source: string; alt: string } {
  const pct = (p: number | null) => (p === null ? '\u2013' : `${Math.round(p)}%`)
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ROW_SVG_W}" height="${ROW_SVG_H}" viewBox="0 0 ${ROW_SVG_W} ${ROW_SVG_H}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" font-size="10" style="font-variant-numeric:tabular-nums">` +
    line(7, '5h', bar(r.fiveHour), pct(r.fiveHour)) +
    line(22, 'Week', bar(r.week), pct(r.week)) +
    line(38, '12h', stripTrack(r.pieces), `${r.hours.toFixed(1)}h`) +
    `</svg>`
  const alt = `${esc(r.name)}: 5-hour ${pct(r.fiveHour)}, week ${pct(r.week)}, ${r.hours.toFixed(1)} hours in the last 12 hours`
  return { source, alt }
}

export function textBar(p: number | null, cells: number): string {
  if (p === null) return '\u00b7'.repeat(cells)
  const on = Math.round((cells * Math.max(0, Math.min(100, p))) / 100)
  return '\u2501'.repeat(on) + '\u2500'.repeat(cells - on)
}
