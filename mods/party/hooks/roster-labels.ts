import type { AgentState } from '../types'

export const STATE_LABEL: Record<AgentState, string> = {
  running: 'Working', waiting: 'Blocked', pending: 'Pending', idle: 'Idle',
  completed: 'Done', failed: 'Failed', killed: 'Stopped'
}
