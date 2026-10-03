// Session facts in, the one object we share out. Nothing else leaves the Mac.

import type { Heartbeat } from '../types'
import { IDLE_AFTER_MS } from './config'

export const LIMITS = { session: 32, project: 64, branch: 96, line: 120 } as const

export type SessionFacts = {
  session: string
  cwd: string
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
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`
}

/** The last folder of a path: the project name, never the path itself. */
export function basename(path: string): string {
  const parts = path.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || path
}

const percent = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null)

export function buildHeartbeat(f: SessionFacts): Heartbeat {
  return {
    session: cap(f.session, LIMITS.session),
    project: cap(basename(f.cwd), LIMITS.project),
    branch: cap(f.branch, LIMITS.branch),
    line: cap(f.line, LIMITS.line),
    state: f.now - f.lastTurnAt < IDLE_AFTER_MS ? 'working' : 'idle',
    fiveHour: percent(f.fiveHour),
    week: percent(f.week),
    startedAt: f.startedAt
  }
}
