// Spend across sessions. Each session keeps its own ledger file, so two
// sessions never write over each other; the band sums every file.

import type { Spend } from '../types'

export type { Spend }

/** One session's spend, split by the local day it was seen. `seen` is the session total last recorded. */
export type Ledger = { seen: number; at: number; days: Record<string, number> }

const DAY_MS = 86_400_000
const KEEP_DAYS = 14

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day, YYYY-MM-DD, so string order is date order. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The Monday that starts the local week holding `ms`. */
export function weekStart(ms: number): string {
  const d = new Date(ms)
  const back = (d.getDay() + 6) % 7
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime())
}

/**
 * Adds what the session spent since the last record to today. A total below
 * `seen` means the session's count started over (a relaunch), so all of it is new.
 */
export function record(prev: Ledger | undefined, total: number, now: number): Ledger {
  const seen = prev?.seen ?? 0
  const spent = total >= seen ? total - seen : total
  const cutoff = dayKey(now - KEEP_DAYS * DAY_MS)
  const days: Record<string, number> = {}
  for (const [day, usd] of Object.entries(prev?.days ?? {})) if (day >= cutoff) days[day] = usd
  const today = dayKey(now)
  if (spent > 0) days[today] = (days[today] ?? 0) + spent
  return { seen: total, at: now, days }
}

/** Reads a ledger file's text; anything unreadable (a half-written file) counts as absent. */
export function parseLedger(text: unknown): Ledger | undefined {
  if (typeof text !== 'string') return undefined
  try {
    const l = JSON.parse(text)
    return l && typeof l.seen === 'number' && l.days && typeof l.days === 'object' ? l : undefined
  } catch {
    return undefined
  }
}

/** This week's and today's spend over every session's ledger. */
export function totals(ledgers: Ledger[], session: number, now: number): Spend {
  const from = weekStart(now)
  const today = dayKey(now)
  let week = 0
  let todaySum = 0
  let sessionsToday = 0
  for (const l of ledgers) {
    for (const [day, usd] of Object.entries(l.days)) {
      if (day >= from && day <= today) week += usd
      if (day === today) todaySum += usd
    }
    if ((l.days[today] ?? 0) > 0) sessionsToday += 1
  }
  return { week, today: todaySum, sessionsToday, session }
}
