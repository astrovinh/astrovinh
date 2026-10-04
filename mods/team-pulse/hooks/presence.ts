// The one line under the prompt: which teammates are online right now.
// Status text cannot be colored, so the state is a colored emoji: green = working, yellow = idle.
// Offline teammates and you are not listed.

import type { Row } from './rows'

export const DOTS = { live: '\u{1F7E2}', idle: '\u{1F7E1}' } as const
export const MAX_NAMES = 6

const DOT = '\u00b7'
const LABEL = 'Online members'

export function presenceLine(v: {
  rows: Row[]
  paused: boolean
  problem: string | null
  hasSnapshot: boolean
}): string | undefined {
  if (v.problem) return `${LABEL} ${DOT} can't reach the team server, will retry`
  if (!v.hasSnapshot) return undefined
  const paused = v.paused ? ` ${DOT} sharing paused` : ''
  const online = v.rows.filter(r => !r.you && (r.status === 'live' || r.status === 'idle'))
  if (!online.length) return `${LABEL} ${DOT} nobody right now${paused}`
  const shown = online.slice(0, MAX_NAMES).map(r => `${DOTS[r.status as 'live' | 'idle']} ${r.name}`)
  const more = online.length > MAX_NAMES ? [`+${online.length - MAX_NAMES}`] : []
  return `${LABEL} ${[...shown, ...more].join(' ')}${paused}`
}
