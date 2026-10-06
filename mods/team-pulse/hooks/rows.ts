// A team snapshot becomes one row per person: you first, then the server's member order.

import type { Snapshot, SnapshotSession } from '../types'
import { clockLabel } from './clock'
import { IDLE_AFTER_MS, OFFLINE_AFTER_MS } from './config'

export type Status = 'live' | 'idle' | 'offline'
export type SessionView = { id: string; line: string; where: string }
export type Row = {
  id: string
  name: string
  you: boolean
  status: Status
  statusText: string
  clock: string | null
  /** The away note the person set with /team status, and how old it is. */
  note: string | null
  noteAge: string | null
  main: SessionView | null
  others: SessionView[]
  fiveHour: number | null
  week: number | null
}

export function sessionStatus(s: Pick<SnapshotSession, 'state' | 'seenAt'>, now: number): Status {
  if (now - s.seenAt >= OFFLINE_AFTER_MS) return 'offline'
  return s.state === 'working' ? 'live' : 'idle'
}

export function ago(ms: number): string {
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}

export function duration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

/** `elapsedMs` is how long ago the snapshot was fetched; status uses the server's clock plus that. */
export function buildRows(snap: Snapshot, elapsedMs: number): Row[] {
  const now = snap.now + elapsedMs
  const rows = snap.members.map(m => {
    const mine = snap.sessions.filter(s => s.member === m.id).sort((a, b) => b.seenAt - a.seenAt)
    const active = mine
      .filter(s => sessionStatus(s, now) !== 'offline')
      .sort((a, b) => Number(b.state === 'working') - Number(a.state === 'working') || b.seenAt - a.seenAt)
    const status: Status = active.length ? sessionStatus(active[0]!, now) : 'offline'
    const view = (s: SnapshotSession): SessionView => ({
      id: s.id,
      line: s.line,
      where: [s.branch, duration(now - s.startedAt)].filter(Boolean).join(' \u00b7 ')
    })
    const latest = mine[0]
    const statusText =
      status === 'live'
        ? ''
        : status === 'idle'
          ? `idle ${ago(now - (active[0]!.stateSince - IDLE_AFTER_MS))}` // the state flips IDLE_AFTER_MS after the last turn
          : latest
            ? `seen ${ago(now - latest.seenAt)} ago`
            : 'not active yet'
    return {
      id: m.id,
      name: m.name,
      you: m.id === snap.you,
      status,
      statusText,
      clock: clockLabel(m.tz, now),
      note: m.status ?? null,
      noteAge: m.status && m.statusAt != null ? ago(now - m.statusAt) : null,
      main: active[0] ? view(active[0]) : null,
      others: active.slice(1).map(view),
      fiveHour: latest?.fiveHour ?? null,
      week: latest?.week ?? null
    }
  })
  return [...rows.filter(r => r.you), ...rows.filter(r => !r.you)]
}

/** The panel header: which teammates (not you) are working right now. */
export function withYouLine(rows: Row[]): string {
  const names = rows.filter(r => !r.you && r.status === 'live').map(r => r.name)
  if (names.length === 0) return 'No one else is working right now.'
  if (names.length === 1) return `${names[0]} is with you right now`
  if (names.length === 2) return `${names[0]} and ${names[1]} are with you right now`
  const rest = names.length - 2
  return `${names[0]}, ${names[1]} and ${rest} ${rest === 1 ? 'other' : 'others'} are with you right now`
}

/** One line for a session listed under "other sessions": what it does and where, without a stray separator. */
export function otherLine(o: SessionView): string {
  return [o.line || 'Working in Claude Code', o.where].filter(Boolean).join(' \u00b7 ')
}
