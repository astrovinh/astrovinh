// The last 12 hours, ending now: where a person had sessions running. Overlapping
// sessions merge first, so two at once count once.

import { OFFLINE_AFTER_MS, WINDOW_MS } from './config'

export type Piece = { from: number; to: number; running: boolean }

export function strip(segments: { start: number; end: number }[], now: number): { pieces: Piece[]; hours: number } {
  const from = now - WINDOW_MS
  const clipped = segments
    .map(s => ({ start: Math.max(s.start, from), end: Math.min(s.end, now) }))
    .filter(s => s.end > s.start)
    .sort((a, b) => a.start - b.start)

  const merged: { start: number; end: number }[] = []
  for (const s of clipped) {
    const last = merged[merged.length - 1]
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end)
    else merged.push({ ...s })
  }

  const pieces = merged.map(s => ({
    from: (s.start - from) / WINDOW_MS,
    to: (s.end - from) / WINDOW_MS,
    running: now - s.end < OFFLINE_AFTER_MS
  }))
  const ms = merged.reduce((sum, s) => sum + (s.end - s.start), 0)
  return { pieces, hours: Math.round((ms / 3_600_000) * 10) / 10 }
}
