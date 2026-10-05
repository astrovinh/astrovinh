// Session facts in, the one object we share out. Nothing else leaves the Mac.

import type { Heartbeat } from '../types'
import { IDLE_AFTER_MS } from './config'

export const LIMITS = { session: 32, branch: 96, line: 120 } as const

export type SessionFacts = {
  session: string
  branch: string
  line: string
  lastTurnAt: number
  now: number
  fiveHour?: number | null
  week?: number | null
  startedAt: number
}

/** Collapses whitespace and cuts to `n` characters, ending with an ellipsis when cut. */
export function cap(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= n ? t : `${t.slice(0, n - 1)}\u2026`
}

const percent = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null)

export function buildHeartbeat(f: SessionFacts): Heartbeat {
  return {
    session: cap(f.session, LIMITS.session),
    // Kept so older servers accept the body; the folder name is never sent.
    project: '',
    branch: cap(f.branch, LIMITS.branch),
    line: cap(f.line, LIMITS.line),
    state: f.now - f.lastTurnAt < IDLE_AFTER_MS ? 'working' : 'idle',
    fiveHour: percent(f.fiveHour),
    week: percent(f.week),
    startedAt: f.startedAt
  }
}

/** The heartbeat session id: the per-process random `base` joined to the member, so a new membership means a new id. */
export function sessionIdFor(base: string, memberId: string): string {
  return (base.slice(0, 20) + memberId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
}

/** `/team join` is refused when the Mac is already on that team; another team replaces the membership. */
export function joinDecision(current: { teamId: string } | null, codeTeamId: string): 'join' | 'already' {
  return current && current.teamId === codeTeamId ? 'already' : 'join'
}
