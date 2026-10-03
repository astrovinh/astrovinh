// How the machine is running: CPU, memory, disk and battery, read from macOS
// command output and drawn as small rings.

import type { System } from '../types'

export type { System }

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/** `ps -A -o %cpu=` sums each process's share of one core; divide by the cores. */
export function parseCpu(psOut: string, cores: number): number | null {
  if (!(cores > 0)) return null
  let sum = 0
  for (const line of psOut.split('\n')) {
    const n = Number.parseFloat(line)
    if (Number.isFinite(n)) sum += n
  }
  return clamp(sum / cores)
}

/** `memory_pressure -Q` reports the free share; used is the rest. */
export function parseMemory(out: string): number | null {
  const m = /free percentage:\s*(\d+(?:\.\d+)?)%/.exec(out)
  return m ? clamp(100 - Number(m[1])) : null
}

/**
 * `df -k <volume>`: used and available 1K blocks. On macOS read the Data
 * volume: `/` is the sealed system snapshot and reads a few percent used.
 */
export function parseDisk(dfOut: string): { percent: number; freeGb: number } | null {
  const line = dfOut.trim().split('\n').pop() ?? ''
  const cols = line.trim().split(/\s+/)
  const used = Number(cols[2])
  const avail = Number(cols[3])
  if (!Number.isFinite(used) || !Number.isFinite(avail) || used + avail <= 0) return null
  return { percent: clamp((used / (used + avail)) * 100), freeGb: (avail * 1024) / 1e9 }
}

/** `pmset -g batt`; null on a Mac with no battery. */
export function parseBattery(out: string): { percent: number; state: string } | null {
  const m = /InternalBattery[^\n]*?\t(\d+)%;\s*([^;]+);/.exec(out)
  return m ? { percent: clamp(Number(m[1])), state: m[2]!.trim() } : null
}

/** Busy is bad for CPU, memory and disk; for the battery, empty is. */
export function ringColor(kind: 'load' | 'battery', percent: number): string {
  if (kind === 'battery') return percent <= 15 ? '#f7768e' : percent <= 30 ? '#e0af68' : '#9ece6a'
  return percent >= 85 ? '#f7768e' : percent >= 60 ? '#e0af68' : '#9ece6a'
}

/** A ring of radius `r` centred at (cx, cy), filled clockwise from the top to `percent`. */
export function ring(cx: number, cy: number, r: number, percent: number, color: string, track: string): string {
  const c = 2 * Math.PI * r
  const on = (c * clamp(percent)) / 100
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="2"/>` +
    (on > 0
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" ` +
        `stroke-dasharray="${on.toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`
      : '')
  )
}
