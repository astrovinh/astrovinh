// The one line under the prompt: which teammates are online right now.
// Status text cannot be colored, so each teammate is their circled initial:
// a filled circle (white on black) while working, an outlined circle while idle.
// Offline teammates and you are not listed.

import type { Row } from './rows'

export const MAX_NAMES = 6

const DOT = '\u00b7'
const LABEL = 'Online members'

/** The first letter of a name, accents removed, upper case. A-Z become circled letters; anything else stays as it is. */
export function glyph(name: string, live: boolean): string {
  const first = Array.from(name.trim())[0] ?? '?'
  // D with a stroke has no decomposition, so it is mapped by hand.
  const letter = first === '\u0110' || first === '\u0111' ? 'D' : first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const i = letter.length === 1 ? letter.charCodeAt(0) - 65 : -1
  // Not A to Z: the character as typed (upper case), never its decomposed form.
  if (i < 0 || i > 25) return Array.from(first.toUpperCase())[0] ?? first
  return String.fromCodePoint((live ? 0x1f150 : 0x24b6) + i)
}

export function presenceLine(v: {
  rows: Row[]
  paused: boolean
  problem: string | null
  hasSnapshot: boolean
  hasHandoff?: boolean
}): string | undefined {
  const handoff = v.hasHandoff ? ` ${DOT} a handoff for you ${DOT} /team` : ''
  if (v.problem) return `${LABEL} ${DOT} can't reach the team server, will retry${handoff}`
  if (!v.hasSnapshot) return undefined
  const paused = v.paused ? ` ${DOT} sharing paused` : ''
  const online = v.rows.filter(r => !r.you && (r.status === 'live' || r.status === 'idle'))
  if (!online.length) return `${LABEL} ${DOT} nobody right now${paused}${handoff}`
  const shown = online.slice(0, MAX_NAMES).map(r => glyph(r.name, r.status === 'live'))
  const more = online.length > MAX_NAMES ? [`+${online.length - MAX_NAMES}`] : []
  return `${LABEL} ${[...shown, ...more].join(' ')}${paused}${handoff}`
}
