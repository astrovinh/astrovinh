export type Proc = { pid: number; ppid: number; uid: number; rss: number; cpu: number; start: string; command: string }
export type Group = { id: string; name: string; bytes: number; cpu: number; pids: number[]; processes: Proc[]; protected: boolean }
export type Target = { path: string; real: string; age?: number; owned?: boolean }
export type Item = { id: string; name: string; bytes: number; kind: 'cache' | 'worktree' | 'sim'; targets: Target[]; argv?: string[]; repo?: string; eligible: boolean }
export type View = { panel: 'cpu' | 'mem' | 'disk' | null; phase: 'looking' | 'ready' | 'readonly' | 'busy' | 'error'; items: Item[]; groups: Group[]; selected: string[]; armed: string | null; until: number; message: string }

/** One machine's last reading for the All row and drawer; `at` is null until it has ever reported. */
export type MachineRow = { name: string; cpu: number | null; memory: number | null; disk: number | null; at: number | null }

export type Segment = { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Spend = { week: number; today: number; sessionsToday: number; session: number }
export type System = {
  cpu: number | null
  cores: number
  memory: number | null
  memoryGb: number | null
  disk: { percent: number; freeGb: number } | null
  battery: { percent: number; state: string } | null
}

declare module 'claude-code' {
  interface PluginState {
    'usage-bars': {
      segments: Segment[]
      window: number
      contextPercent: number | null
      limits: Limit[]
      spend: Spend | null
      system: System | null
      panel: 'cpu' | 'mem' | 'disk' | null
      weekOpen: boolean
      machines: MachineRow[]
      machinesOpen: boolean
      cleanupView: View
    }
  }
}
