// The last 12 hours, ending now: where a person had sessions running, active (a prompt from them
// or Claude working on it) or idle (open with neither). Overlapping sessions merge first, so two
// at once count once, and time that is active in any session is active. Hours count active time only.

import { OFFLINE_AFTER_MS, WINDOW_MS } from './config'

export type Piece = { from: number; to: number; running: boolean; active: boolean }

type Span = { start: number; end: number }

function union(spans: Span[]): Span[] {
  const merged: Span[] = []
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1]
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end)
    else merged.push({ ...s })
  }
  return merged
}

/** The parts of `spans` (already merged, sorted) that fall outside `cut` (already merged, sorted). */
function minus(spans: Span[], cut: Span[]): Span[] {
  const out: Span[] = []
  for (const s of spans) {
    let start = s.start
    for (const c of cut) {
      if (c.end <= start || c.start >= s.end) continue
      if (c.start > start) out.push({ start, end: c.start })
      start = Math.max(start, c.end)
      if (start >= s.end) break
    }
    if (start < s.end) out.push({ start, end: s.end })
  }
  return out
}

export function strip(segments: { start: number; end: number; state?: 'working' | 'idle' }[], now: number): { pieces: Piece[]; hours: number } {
  const from = now - WINDOW_MS
  const clipped = segments
    .map(s => ({ start: Math.max(s.start, from), end: Math.min(s.end, now), idle: s.state === 'idle' }))
    .filter(s => s.end > s.start)

  const active = union(clipped.filter(s => !s.idle))
  const idle = minus(union(clipped.filter(s => s.idle)), active)

  const pieces = [
    ...active.map(s => ({ s, active: true })),
    ...idle.map(s => ({ s, active: false }))
  ]
    .sort((a, b) => a.s.start - b.s.start)
    .map(({ s, active }) => ({
      from: (s.start - from) / WINDOW_MS,
      to: (s.end - from) / WINDOW_MS,
      running: now - s.end < OFFLINE_AFTER_MS,
      active
    }))
  const ms = active.reduce((sum, s) => sum + (s.end - s.start), 0)
  return { pieces, hours: Math.round((ms / 3_600_000) * 10) / 10 }
}
