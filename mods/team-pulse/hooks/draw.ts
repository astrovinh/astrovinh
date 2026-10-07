// Small SVG drawings for a panel row: the 5-hour bar, the week bar and the 12-hour strip.

import type { Piece } from './strip'

export const ROW_SVG_W = 300
export const ROW_SVG_H = 30
export const STRIP_SVG_W = 210
export const STRIP_SVG_H = 16
const LABEL_W = 40
const VALUE_W = 36
const BAR_W = ROW_SVG_W - LABEL_W - VALUE_W
const INK = '#AAA69A'
const TRACK = 'rgba(139,139,139,0.22)'
const STRIP = 'rgba(148,183,232,0.55)'
const STRIP_NOW = '#94B7E8'
const IDLE = 'rgba(214,186,123,0.55)'
const IDLE_NOW = '#D6BA7B'

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
  const w = STRIP_SVG_W - LABEL_W - 8
  return (
    `<rect y="-1" width="${w}" height="6" rx="3" fill="${TRACK}"/>` +
    pieces
      .map(pc => `<rect x="${(pc.from * w).toFixed(1)}" y="-1" width="${Math.max(1.5, (pc.to - pc.from) * w).toFixed(1)}" height="6" rx="3" fill="${pc.active ? (pc.running ? STRIP_NOW : STRIP) : pc.running ? IDLE_NOW : IDLE}"/>`)
      .join('')
  )
}

export function stripSvg(pieces: Piece[]): { source: string; alt: string } {
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIP_SVG_W}" height="${STRIP_SVG_H}" viewBox="0 0 ${STRIP_SVG_W} ${STRIP_SVG_H}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" font-size="10">` +
    `<text x="0" y="11" fill="${INK}">12h</text>` +
    `<g transform="translate(${LABEL_W} 6)">${stripTrack(pieces)}</g></svg>`
  return { source, alt: 'Claude activity in the last 12 hours' }
}

export function rowSvg(r: { fiveHour: number | null; week: number | null; name: string }): { source: string; alt: string } {
  const pct = (p: number | null) => (p === null ? '\u2013' : `${Math.round(p)}%`)
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ROW_SVG_W}" height="${ROW_SVG_H}" viewBox="0 0 ${ROW_SVG_W} ${ROW_SVG_H}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" font-size="10" style="font-variant-numeric:tabular-nums">` +
    line(7, '5h', bar(r.fiveHour), pct(r.fiveHour)) +
    line(22, 'Week', bar(r.week), pct(r.week)) +
    `</svg>`
  const alt = `${esc(r.name)}: 5-hour ${pct(r.fiveHour)}, week ${pct(r.week)}`
  return { source, alt }
}

export function textStrip(pieces: Piece[], cells: number): string {
  return Array.from({ length: cells }, (_, i) => {
    const at = (i + 0.5) / cells
    const piece = pieces.find(p => p.from <= at && p.to > at)
    return piece ? (piece.active ? '\u2501' : '\u2504') : '\u2500'
  }).join('')
}

export function textBar(p: number | null, cells: number): string {
  if (p === null) return '\u00b7'.repeat(cells)
  const on = Math.round((cells * Math.max(0, Math.min(100, p))) / 100)
  return '\u2501'.repeat(on) + '\u2500'.repeat(cells - on)
}

const BUBBLE_FILL = '#34332e'
const BUBBLE_EDGE = '#45433d'
const BUBBLE_PAD = 20

/** Estimated width in px of a string at font-size 11.5 in the system font; the SVG cannot measure text itself. */
export function noteWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    w += c > 0x2000 ? 14 : c >= 0xc0 ? 6.4 : ch === ' ' ? 3.1 : ch >= '0' && ch <= '9' ? 6.6 : ch >= 'A' && ch <= 'Z' ? 7.5 : ch >= 'a' && ch <= 'z' ? 5.9 : 4.6
  }
  return w * 1.05
}

const BUBBLE_LINES = 5
const LINE_H = 15
const TEXT_X = 10

/** Splits a word that is wider than a line into pieces that fit, by code points. */
function breakWord(word: string, room: number): string[] {
  const pieces: string[] = []
  let piece = ''
  for (const ch of word) {
    if (piece && noteWidth(piece + ch) > room) {
      pieces.push(piece)
      piece = ''
    }
    piece += ch
  }
  if (piece) pieces.push(piece)
  return pieces
}

/** Greedy word wrap: every returned line fits `room` px. */
function wrap(note: string, room: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of note.split(' ')) {
    if (!word) continue
    const joined = line ? `${line} ${word}` : word
    if (noteWidth(joined) <= room) {
      line = joined
      continue
    }
    if (line) lines.push(line)
    line = ''
    if (noteWidth(word) <= room) {
      line = word
    } else {
      const pieces = breakWord(word, room)
      line = pieces.pop() ?? ''
      lines.push(...pieces)
    }
  }
  lines.push(line)
  return lines
}

/** Cuts a line by code points until it and an ellipsis fit. */
function withEllipsis(line: string, room: number): string {
  let chars = Array.from(line.trimEnd())
  while (chars.length > 0 && noteWidth(chars.join('') + '\u2026') > room) chars = chars.slice(0, -1)
  return chars.join('').trimEnd() + '\u2026'
}

/**
 * A chat bubble with a tail pointing up at the name. The note wraps into at most five lines and the last one ends
 * with an ellipsis if text remains; the age goes after the last line, or on a line of its own when it does not fit.
 */
export function bubbleSvg(note: string, age: string | null, maxWidth: number): { source: string; alt: string; width: number; height: number } {
  const ageText = age ? ` \u00b7 ${age}` : ''
  const room = maxWidth - BUBBLE_PAD
  let lines = wrap(note, room)
  if (lines.length > BUBBLE_LINES) lines = [...lines.slice(0, BUBBLE_LINES - 1), withEllipsis(lines[BUBBLE_LINES - 1]!, room)]
  const last = lines[lines.length - 1]!
  const ageInline = !!ageText && noteWidth(last + ageText) <= room
  const count = lines.length + (ageText && !ageInline ? 1 : 0)
  // A single line is only as wide as it needs to be; anything longer fills the width.
  const width = count === 1 ? Math.min(maxWidth, Math.ceil(noteWidth(last) + noteWidth(ageText) + BUBBLE_PAD)) : maxWidth
  const height = 6 + 8 + count * LINE_H + 6
  const baseline = (i: number) => 6 + 8 + i * LINE_H + 11.5
  const tspans = lines
    .map((l, i) => `<tspan x="${TEXT_X}" y="${baseline(i)}" fill="#ecebe6">${esc(l)}</tspan>` + (ageInline && i === lines.length - 1 ? `<tspan fill="${INK}">${esc(ageText)}</tspan>` : ''))
    .join('')
  const ageLine = ageText && !ageInline ? `<tspan x="${TEXT_X}" y="${baseline(lines.length)}" fill="${INK}">${esc(age ?? '')}</tspan>` : ''
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Apple Color Emoji','Segoe UI',system-ui,sans-serif" font-size="11.5">` +
    `<rect x="0.5" y="6.5" width="${width - 1}" height="${height - 7}" rx="10" fill="${BUBBLE_FILL}" stroke="${BUBBLE_EDGE}" stroke-width="1"/>` +
    // The tail's fill hides the rect's top edge under it; only its two upper edges are stroked.
    `<path d="M12 7 L12 6.5 L17 0.5 L22 6.5 L22 7 Z" fill="${BUBBLE_FILL}"/>` +
    `<path d="M12 6.5 L17 0.5 L22 6.5" fill="none" stroke="${BUBBLE_EDGE}" stroke-width="1" stroke-linejoin="round"/>` +
    `<text xml:space="preserve">${tspans}${ageLine}</text></svg>`
  return { source, alt: esc(`Status: ${note}${age ? `, ${age}` : ''}`), width, height }
}
