export type Heartbeat = {
  session: string
  project: string
  branch: string
  line: string
  state: 'working' | 'idle'
  fiveHour: number | null
  week: number | null
  startedAt: number
}

export type SnapshotSession = {
  id: string
  member: string
  project: string
  branch: string
  line: string
  state: 'working' | 'idle'
  stateSince: number
  fiveHour: number | null
  week: number | null
  startedAt: number
  seenAt: number
}

// state is missing on an older server, which counted every segment as active.
export type SnapshotSegment = { session: string; member: string; start: number; end: number; state?: 'working' | 'idle' }

export type Snapshot = {
  team: string
  now: number
  you: string
  members: { id: string; name: string; status?: string | null; statusAt?: number | null }[]
  sessions: SnapshotSession[]
  segments: SnapshotSegment[]
}

export type Membership = {
  server: string
  teamId: string
  team: string
  memberId: string
  key: string
  name: string
  isAdmin: boolean
  joinCode?: string
}

declare module 'claude-code' {
  interface PluginState {
    'murror': {
      snapshot: Snapshot | null
      fetchedAt: number
      problem: string | null
      expanded: string[]
    }
  }
}
