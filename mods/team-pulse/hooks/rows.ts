// A team snapshot becomes one row per person, sorted for a glance.

import type { Snapshot, SnapshotSession } from '../types'
import { IDLE_AFTER_MS, OFFLINE_AFTER_MS } from './config'

export type Status = 'live' | 'idle' | 'offline'
export type SessionView = { id: string; line: string; where: string }
export type Row = {
  id: string
  name: string
  you: boolean
  status: Status
  statusText: string
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

const RANK: Record<Status, number> = { live: 0, idle: 1, offline: 2 }

/** `elapsedMs` is how long ago the snapshot was fetched; status uses the server's clock plus that. */
export function buildRows(snap: Snapshot, elapsedMs: number): Row[] {
  const now = snap.now + elapsedMs
  const rows = snap.members.map(m => {
    const mine = snap.sessions.filter(s => s.member === m.id).sort((a, b) => b.seenAt - a.seenAt)
    const active = mine
      .filter(s => sessionStatus(s, now) !== 'offline')
      .sort((a, b) => RANK[sessionStatus(a, now)] - RANK[sessionStatus(b, now)] || b.seenAt - a.seenAt)
    const status: Status = active.length ? sessionStatus(active[0]!, now) : 'offline'
    const view = (s: SnapshotSession): SessionView => ({
      id: s.id,
      line: s.line,
      where: [s.project, s.branch, duration(now - s.startedAt)].filter(Boolean).join(' · ')
    })
    const latest = mine[0]
    const statusText =
      status === 'live'
        ? `${active.length} session${active.length === 1 ? '' : 's'}`
        : status === 'idle'
          ? `idle ${ago(now - (active[0]!.stateSince - IDLE_AFTER_MS))}` // the state flips IDLE_AFTER_MS after the last turn
          : latest
            ? `seen ${ago(now - latest.seenAt)} ago`
            : 'not active yet'
    return {
      row: {
        id: m.id,
        name: m.name,
        you: m.id === snap.you,
        status,
        statusText,
        main: active[0] ? view(active[0]) : null,
        others: active.slice(1).map(view),
        fiveHour: latest?.fiveHour ?? null,
        week: latest?.week ?? null
      },
      count: active.length,
      lastSeen: latest?.seenAt ?? 0
    }
  })
  rows.sort((a, b) => RANK[a.row.status] - RANK[b.row.status] || b.count - a.count || b.lastSeen - a.lastSeen)
  return rows.map(r => r.row)
}
