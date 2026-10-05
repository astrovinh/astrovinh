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
const IDLE = 'rgba(224,175,104,0.45)'
const IDLE_NOW = '#e0af68'

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
      .map(pc => `<rect x="${(pc.from * w).toFixed(1)}" y="-1" width="${Math.max(1.5, (pc.to - pc.from) * w).toFixed(1)}" height="6" rx="3" fill="${pc.active ? (pc.running ? STRIP_NOW : STRIP) : pc.running ? IDLE_NOW : IDLE}"/>`)
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

const BUBBLE_FILL = '#34332e'
const BUBBLE_EDGE = '#45433d'
const BUBBLE_PAD = 20
export const BUBBLE_H = 26

/** Estimated width in px of a string at font-size 11.5 in the system font; the SVG cannot measure text itself. */
export function noteWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    w += c > 0x2000 ? 14 : c >= 0xc0 ? 6.4 : ch === ' ' ? 3.1 : ch >= '0' && ch <= '9' ? 6.6 : ch >= 'A' && ch <= 'Z' ? 7.5 : ch >= 'a' && ch <= 'z' ? 5.9 : 4.6
  }
  return w * 1.05
}

/** A chat bubble with a tail pointing up at the name. The note is cut to fit; the age never is. */
export function bubbleSvg(note: string, age: string | null, maxWidth: number): { source: string; alt: string; width: number; height: number } {
  const ageText = age ? ` \u00b7 ${age}` : ''
  const room = maxWidth - BUBBLE_PAD - noteWidth(ageText)
  let chars = Array.from(note)
  let shown = note
  if (noteWidth(note) > room) {
    while (chars.length > 0 && noteWidth(chars.join('') + '\u2026') > room) chars = chars.slice(0, -1)
    shown = chars.join('') + '\u2026'
  }
  // A cut note fills the whole width; the loop above stops up to one character short of it.
  const width = shown === note ? Math.min(maxWidth, Math.ceil(noteWidth(shown) + noteWidth(ageText) + BUBBLE_PAD)) : maxWidth
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BUBBLE_H}" viewBox="0 0 ${width} ${BUBBLE_H}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Apple Color Emoji','Segoe UI',system-ui,sans-serif" font-size="11.5">` +
    `<rect x="0.5" y="6.5" width="${width - 1}" height="19" rx="10" fill="${BUBBLE_FILL}" stroke="${BUBBLE_EDGE}" stroke-width="1"/>` +
    // The tail's fill hides the rect's top edge under it; only its two upper edges are stroked.
    `<path d="M12 7 L12 6.5 L17 0.5 L22 6.5 L22 7 Z" fill="${BUBBLE_FILL}"/>` +
    `<path d="M12 6.5 L17 0.5 L22 6.5" fill="none" stroke="${BUBBLE_EDGE}" stroke-width="1" stroke-linejoin="round"/>` +
    `<text x="10" y="20" xml:space="preserve"><tspan fill="#ecebe6">${esc(shown)}</tspan>` +
    (ageText ? `<tspan fill="${INK}">${esc(ageText)}</tspan>` : '') +
    `</text></svg>`
  return { source, alt: esc(`Status: ${note}${age ? `, ${age}` : ''}`), width, height: BUBBLE_H }
}
