import type { AgentInfo } from 'claude-code'
import type { AgentRecord, AgentRow, AnimalKey, Roster, RosterInput, Slot, Todo, ToolKind } from '../types'
import { ANIMALS } from './animals'
import { STATE_LABEL } from './roster-labels'

const SLOT: Record<Slot, AnimalKey> = { lead: 'ember', scout: 'hop', planner: 'sage', builder: 'bruno', reviewer: 'pan', helper: 'pip' }
const SPARES: AnimalKey[] = ['mochi', 'biscuit', 'waddle', 'mochi2', 'biscuit2', 'waddle2']
const ROLE: Record<Slot, string> = { lead: 'Lead', scout: 'Scout', planner: 'Planner', builder: 'Builder', reviewer: 'Reviewer', helper: 'Little helper' }
export const finished = (state: string) => ['completed', 'failed', 'killed'].includes(state)

export function slotOf(type: string, isMain: boolean): Slot {
  if (isMain) return 'lead'
  if (type === 'Explore') return 'scout'
  if (type === 'Plan') return 'planner'
  if (type === 'general-purpose') return 'builder'
  return /review/i.test(type) ? 'reviewer' : 'helper'
}

// Include expired agents in this input: their lifetime positions still reserve their animals.
export function assignAnimals<T extends { id: string; slot: Slot; animalIndex?: number }>(rows: T[], exclude: ReadonlySet<string> = new Set()): (T & { animal: AnimalKey; name: string; animalIndex: number })[] {
  const count = new Map<Slot, number>()
  const spares = SPARES.filter(key => !exclude.has(ANIMALS[key].kind))
  return rows.map(row => {
    // The publisher reserves lifetime positions before expired rows are removed.
    const n = row.animalIndex ?? count.get(row.slot) ?? 0
    count.set(row.slot, Math.max(count.get(row.slot) ?? 0, n + 1))
    const animal = n === 0 ? SLOT[row.slot] : spares[(n - 1) % spares.length]!
    const lap = n === 0 ? 1 : Math.floor((n - 1) / spares.length) + 1
    return { ...row, animal, animalIndex: n, name: `${ANIMALS[animal].name}${lap > 1 ? ` ${lap}` : ''}` }
  })
}

export function toolKind(name: string): ToolKind {
  if (['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'].includes(name)) return 'read'
  if (['Edit', 'Write', 'NotebookEdit'].includes(name)) return 'edit'
  if (['Bash', 'BashOutput', 'KillShell'].includes(name)) return 'run'
  return 'think'
}

export function phrase(kind: ToolKind): string {
  return { read: 'Reading', edit: 'Editing', run: 'Running a command', think: 'Thinking' }[kind]
}

// Keep only the two approved todo facts. Never retain content, prompts, or tool arguments.
export function cleanTodos(todos: unknown): Todo[] {
  if (!Array.isArray(todos)) return []
  return todos.filter(t => t && ['pending', 'in_progress', 'completed'].includes(t.status)).map(t => ({ status: t.status, ...(typeof t.activeForm === 'string' ? { activeForm: t.activeForm } : {}) }))
}

export function todoProgress(todos: unknown): { done: number; total: number } | null {
  const items = cleanTodos(todos)
  return items.length ? { done: items.filter(t => t.status === 'completed').length, total: items.length } : null
}

export function todoLine(todos: unknown): string | null {
  return cleanTodos(todos).find(t => t.status === 'in_progress')?.activeForm?.trim() || null
}

export function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`
}

export function rememberAgents(live: AgentInfo[], memory: AgentRecord[], now: number): AgentRecord[] {
  const byId = new Map(memory.map(a => [a.id, a]))
  for (const info of live) {
    const old = byId.get(info.id)
    byId.set(info.id, { ...info, firstSeen: old?.firstSeen ?? now, endedAt: finished(info.status) ? old?.endedAt ?? now : null })
  }
  return [...byId.values()]
}

export function buildRows(input: RosterInput): Roster {
  const { agents, stats, main, now } = input
  const ordered = [...agents].sort((a, b) => a.firstSeen - b.firstSeen)
  const assigned = assignAnimals(ordered.map(a => ({ ...a, slot: slotOf(a.type, false) })))
  const rows: AgentRow[] = []
  if (main) {
    const st = stats.main
    rows.push({ id: 'main', main: true, slot: 'lead', animal: 'ember', name: 'Ember', role: 'Lead', state: main.working ? 'running' : 'idle',
      line: todoLine(st?.todos) || (st ? phrase(st.tool) : main.working ? 'Working' : 'Ready'), tool: st?.tool ?? 'think', tools: st?.tools ?? 0,
      startedAt: main.startedAt, endedAt: main.endedAt, todo: todoProgress(st?.todos) })
  }
  for (const a of assigned) {
    if (a.endedAt !== null && now - a.endedAt >= 300000) continue
    const st = stats[a.id]
    rows.push({ id: a.id, main: false, slot: a.slot, animal: a.animal, animalIndex: a.animalIndex, name: a.name, role: ROLE[a.slot], state: a.status,
      line: todoLine(st?.todos) || a.description.trim() || (st ? phrase(st.tool) : STATE_LABEL[a.status]),
      tool: st?.tool ?? 'think', tools: st?.tools ?? 0, startedAt: a.firstSeen, endedAt: a.endedAt, todo: todoProgress(st?.todos),
      ...((a.teammateId || a.type === 'teammate') && !st ? { note: `Reported ${a.status}, activity unavailable` } : {}) })
  }
  const visible = rows.slice(0, 12)
  return { rows: visible, total: rows.length, working: rows.filter(r => r.state === 'running').length, blocked: rows.filter(r => r.state === 'waiting').length, overflow: rows.length - visible.length }
}
