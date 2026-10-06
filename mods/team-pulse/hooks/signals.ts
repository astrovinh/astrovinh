import type { Signal, Snapshot } from '../types'

const HOUR = 3_600_000
const LIFE = { handoff: 7 * 24 * HOUR, wave: 12 * HOUR, win: 48 * HOUR } as const
const live = (s: Signal, now: number) => now - s.at < LIFE[s.kind]
const newest = (a: Signal, b: Signal) => b.at - a.at

export function targetOf(args: string, members: Snapshot['members'], you: string): { member: Snapshot['members'][number]; rest: string } | null {
  const words = args.trim()
  const lower = words.toLowerCase()
  const member = members.filter(m => m.id !== you && m.name && lower.startsWith(m.name.toLowerCase()) && (words.length === m.name.length || /\s/.test(words[m.name.length]!)))
    .sort((a, b) => b.name.length - a.name.length)[0]
  return member ? { member, rest: words.slice(member.name.length).trim() } : null
}

export function inbox(snap: Snapshot | null, you: string, now: number): Signal[] {
  return (snap?.signals ?? []).filter(s => s.kind === 'handoff' && s.to === you && live(s, now)).sort(newest)
}

export function wavesTo(snap: Snapshot | null, you: string): Signal[] {
  return (snap?.signals ?? []).filter(s => s.kind === 'wave' && s.to === you && live(s, snap!.now)).sort(newest)
}

export function wavers(snap: Snapshot | null, now: number): Set<string> {
  return new Set((snap?.signals ?? []).filter(s => s.kind === 'wave' && live(s, now)).map(s => s.from))
}

export function latestWin(snap: Snapshot | null, now: number): { win: Signal; others: number } | null {
  const wins = (snap?.signals ?? []).filter(s => s.kind === 'win' && live(s, now)).sort(newest)
  return wins[0] ? { win: wins[0], others: wins.length - 1 } : null
}
