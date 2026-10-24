import type { AnimalKey, SessionView } from '../types'
import { ANIMALS } from './animals'
import { assignAnimals } from './roster'

const LEADS: AnimalKey[] = ['ember', 'mochi', 'biscuit', 'waddle', 'ember2', 'mochi2', 'biscuit2', 'waddle2']

export function assignSessionAnimals(sessions: SessionView[]): SessionView[] {
  const ranked = [...sessions].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0) || a.id.localeCompare(b.id))
  const ranks = new Map(ranked.map((s, rank) => [s.id, rank]))
  return sessions.map(s => {
    const rank = ranks.get(s.id)!
    const animal = LEADS[rank % LEADS.length]!
    const lap = Math.floor(rank / 4) + 1
    const name = `${ANIMALS[animal].name}${lap > 1 ? ` ${lap}` : ''}`
    const others = assignAnimals(s.agents.filter(row => !row.main), new Set([ANIMALS[animal].kind]))
    const assigned = new Map(others.map(row => [row.id, row]))
    return { ...s, agents: s.agents.map(row => row.main ? { ...row, animal, name } : assigned.get(row.id)!) }
  })
}

export function mergeSessions(own: SessionView, others: SessionView[], now: number): SessionView[] {
  const live = new Map<string, SessionView>()
  for (const entry of others) {
    if (entry.id === own.id || now - entry.at > 25000) continue
    if (!live.has(entry.id) || entry.at > live.get(entry.id)!.at) live.set(entry.id, entry)
  }
  const all = [own, ...live.values()]
  const labels = new Map<string, string[]>()
  for (const entry of all) labels.set(entry.label, [...(labels.get(entry.label) ?? []), entry.id])
  for (const ids of labels.values()) ids.sort()
  const named = all.map(entry => {
    const index = labels.get(entry.label)!.indexOf(entry.id)
    return { ...entry, label: entry.label + (index > 0 ? ` ${index + 1}` : '') }
  })
  return assignSessionAnimals([named[0]!, ...named.slice(1).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))])
}

export function summary(sessions: SessionView[]) {
  return sessions.reduce((sum, session) => {
    const counts = session.counts ?? {
      total: session.agents.length,
      working: session.agents.filter(row => row.state === 'running').length,
      blocked: session.agents.filter(row => row.state === 'waiting').length
    }
    return { total: sum.total + counts.total, working: sum.working + counts.working, blocked: sum.blocked + counts.blocked, sessions: sum.sessions + 1 }
  }, { total: 0, working: 0, blocked: 0, sessions: 0 })
}

export function needsYou(count: number): string {
  return `${count === 1 ? 'needs' : 'need'} you`
}

export function statusLine(sessions: SessionView[], codex = { working: 0, ready: 0 }): string | undefined {
  const counts = summary(sessions)
  const working = counts.working + codex.working
  const blocked = counts.blocked
  const base = working || blocked ? `party: ${working} working, ${blocked} ${needsYou(blocked)}` : undefined
  if (!codex.ready) return base
  const activity = blocked ? `${working} working, ${blocked} ${needsYou(blocked)}, ` : working ? `${working} working, ` : ''
  return `party: ${activity}codex finished: ready for review`
}
