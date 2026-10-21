import type { SessionView } from '../types'

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
  return [named[0]!, ...named.slice(1).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))]
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

export function statusLine(sessions: SessionView[]): string | undefined {
  const { working, blocked } = summary(sessions)
  return working || blocked ? `party: ${working} working, ${blocked} ${needsYou(blocked)}` : undefined
}
