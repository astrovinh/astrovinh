// The one line under the prompt: who on the team is around, then your own part.
// Status text cannot be colored, so the state is a shape: filled = working, half = idle, hollow = offline.

import type { Row } from './rows'
import { cap } from './share'

export const SHAPES = { live: '\u25cf', idle: '\u25d0', offline: '\u25cb' } as const
export const MAX_NAMES = 6
export const MAX_YOU = 60

const DOT = '\u00b7'

export function presenceLine(v: {
  rows: Row[]
  youLine: string
  paused: boolean
  problem: string | null
  hasSnapshot: boolean
}): string | undefined {
  if (v.problem) return `Team ${DOT} can't reach the team server`
  if (!v.hasSnapshot) return undefined
  const mine = v.paused ? 'sharing paused' : `you: ${cap(v.youLine, MAX_YOU)}`
  const mates = v.rows.filter(r => !r.you)
  if (!mates.length) return `Team ${DOT} no teammates yet ${DOT} ${mine}`
  const shown = mates.slice(0, MAX_NAMES).map(r => `${SHAPES[r.status]} ${r.name}`)
  const more = mates.length > MAX_NAMES ? [`+${mates.length - MAX_NAMES}`] : []
  return `Team  ${[...shown, ...more].join('  ')}  ${DOT} ${mine}`
}
