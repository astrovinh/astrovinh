export type AgentState = 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'
export type Slot = 'lead' | 'scout' | 'planner' | 'builder' | 'reviewer' | 'helper'
export type AnimalKey = 'ember' | 'ember2' | 'hop' | 'sage' | 'bruno' | 'pan' | 'pip' | 'mochi' | 'biscuit' | 'waddle' | 'mochi2' | 'biscuit2' | 'waddle2'
export type ToolKind = 'read' | 'edit' | 'run' | 'think'
export type PartySize = 'tiny' | 'small' | 'medium'
export type PartySettings = { motion: boolean; size: PartySize; codex?: boolean }
export type Todo = { status: 'pending' | 'in_progress' | 'completed'; activeForm?: string }
export type Progress = { done: number; total: number }
export type AgentStats = { tools: number; tool: ToolKind; todos: Todo[]; lastAt?: number }
export type AgentRecord = {
  id: string; type: string; description: string; status: AgentState
  parentId?: string; name?: string; teammateId?: string
  firstSeen: number; endedAt: number | null
}
export type MainFacts = { startedAt: number; endedAt: number | null; working: boolean }
export type AgentRow = {
  id: string
  main: boolean
  slot: Slot
  animal: AnimalKey
  animalIndex?: number
  name: string
  role: string
  state: AgentState
  line: string
  tool: ToolKind
  tools: number
  startedAt: number
  endedAt: number | null
  todo: Progress | null
  note?: string
  codex?: boolean
  depth?: number
  meta?: string
}
export type Roster = { rows: AgentRow[]; working: number; blocked: number; total: number; overflow: number; quiet: number; quietSince: number | null }
export type SessionSnapshot = { id: string; label: string; at: number; startedAt?: number; agents: AgentRow[]; quietSince?: number | null; counts?: Omit<Roster, 'rows' | 'quiet' | 'quietSince'> & { quiet?: number } }
export type SessionView = SessionSnapshot
export type RosterView = Omit<Roster, 'quiet' | 'quietSince'> & { quiet?: number; quietSince?: number | null; session: string; now: number; sessions?: SessionView[]; expanded?: string[]; settings?: PartySettings; codex?: AgentRow[]; codexQuiet?: number; ready?: number }
export type RosterInput = { agents: AgentRecord[]; stats: Record<string, AgentStats>; main: MainFacts | null; now: number; ownSession?: boolean }

declare module 'claude-code' {
  interface PluginState {
    'party': { roster: RosterView; expanded: string[]; settings: PartySettings }
  }
}

export type CodexRun = {
  id: string; parentId: string | null; kind: 'run' | 'helper'
  role: string | null; nickname: string | null; label: string | null
  startedAt: number; lastAt: number; cmds: number; spawned: number; done: boolean; tokens: number | null
}
export type CodexAck = { through: number; ready: Record<string, number> }
