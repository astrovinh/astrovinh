export type AgentState = 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'
export type Slot = 'lead' | 'scout' | 'planner' | 'builder' | 'reviewer' | 'helper'
export type AnimalKey = 'ember' | 'hop' | 'sage' | 'bruno' | 'pan' | 'pip' | 'mochi' | 'biscuit' | 'waddle' | 'mochi2' | 'biscuit2' | 'waddle2'
export type ToolKind = 'read' | 'edit' | 'run' | 'think'
export type PartySize = 'tiny' | 'small' | 'medium'
export type PartySettings = { motion: boolean; size: PartySize }
export type Todo = { status: 'pending' | 'in_progress' | 'completed'; activeForm?: string }
export type Progress = { done: number; total: number }
export type AgentStats = { tools: number; tool: ToolKind; todos: Todo[] }
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
}
export type Roster = { rows: AgentRow[]; working: number; blocked: number; total: number; overflow: number }
export type SessionSnapshot = { id: string; label: string; at: number; agents: AgentRow[] }
export type SessionView = SessionSnapshot & { counts?: Omit<Roster, 'rows'> }
export type RosterView = Roster & { session: string; now: number; sessions?: SessionView[]; expanded?: string[]; settings?: PartySettings }
export type RosterInput = { agents: AgentRecord[]; stats: Record<string, AgentStats>; main: MainFacts | null; now: number }

declare module 'claude-code' {
  interface PluginState {
    'party': { roster: RosterView; expanded: string[]; settings: PartySettings }
  }
}
